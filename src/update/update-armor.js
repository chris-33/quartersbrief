import executeSteps, { each, passthrough } from './infra/execute-steps.js';
import { extract, readFile, writeJSON } from './infra/steps.js';
import _BufferCursor from 'buffercursor';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import rootlog from 'loglevel';

const dedicatedlog = rootlog.getLogger('ArmorUpdater');

/**
 * Utility class that extends BufferCursor with some convenience methods.
 */
class BufferCursor extends _BufferCursor {
	/**
	 * Read `num` bytes from buffer and expect all of them 0.
	 * @param  {number} num The number of bytes to read
	 * @returns Undefined on success.
	 * @throws If any of the bytes read were non-zero.
	 */
	expectZeros(num) {
		for (let i = 0; i < num; i++) {
			let zero = this.readUInt8();
			if (zero !== 0)
				throw new Error(`Expected to find ${num} zeros, but found ${zero} at ${i}`);
		}
	}

	/**
	 * Reads `length` bytes and converts them to a string using the specified `encoding`. 
	 * @param  {number} length   The number of bytes to read
	 * @param  {String} [encoding] The encoding to use for conversion. Default is `'hex'`,
	 * which means the contents will be returned as a string of hexadecimal notation.
	 * @return {String}          The contents as a string.
	 */
	readString(length, encoding = 'hex') {
		const startPos = this.tell();
		const res = this.buffer.subarray(startPos, startPos + length).toString(encoding);
		this.seek(startPos + length);
		return res;
	}

	/**
	 * Skip `num` bytes. Equivalent to `cur.seek(cur.tell() + num)`.
	 */
	skip(num) {
		return this.seek(this.tell() + num);
	}
}

export default async function updateArmor(wows, dest, buildno) {
	const resource = {
		include: [ 'content/gameplay/*/ship/*.geometry' ],
		exclude: [ '*Bow*', '*Mid*', '*Stern*' ]
	};
	const tmpdir = path.join(os.tmpdir(), 'armor');
	dest = path.join(dest, 'armor');
	await Promise.all([ fs.mkdir(tmpdir, { recursive: true }), fs.mkdir(dest, { recursive: true }) ]);


	return await executeSteps([
		extract(wows, tmpdir, buildno, resource),
		// Read the extracted file as a Buffer
		each(async infile => await executeSteps([
			readFile({ encoding: null}, infile),
			/*
				Convert armor part of .geometry file to JSON.
				File format (see also https://github.com/SEA-group/Geometry-model-extraction-demo/blob/master/GeometryFileStructure.txt):

				# 0x0000
				numberOfVertexTypes:4							// uint32
				numberOfIndexTypes:4							// uint32
				numberOfVertexBlocs:4							// uint32; "small" blocs, not the large ones
				numberOfIndexBlocs:4							// uint32
				numberOfCollissionModelBlocs:4					// uint32
				numberOfArmorModelBlocs:4						// uint32

				(...)

				# 0x0040
				armorSectionPosition:4							// uint32
				?zeros:4

				(...) 

				# armorSectionPosition
				armorSection[
					armorContentLength:4						// uint32; counted from the first byte of unknownA to sectionName
					?zeros:4
					sectionNameLength:4							// uint32
					?zeros:4
					sectionNamePosition:4						// uint32; position counted from the first byte of sectionNameLength
					?zeros:4
					armorContent[
						unknownA:36
						numberOfArmorPieces:4					// uint32
						armorPieces{
							id:4								// uint32
							unknownB:24									
							numberOfVertices:4					// uint32
							armorVertex{
								xyz:12							// float*3
								unknownC:4
							}:8
						}:32+8*numberOfVertices
					]:armorContentLength
					sectionName:sectionNameLength				// ascii; 'CM_PA_united.armor '
				]
			 */
			function convert(buffer) {
				let cur = new BufferCursor(buffer);
				
				const metadata = {};
				cur.seek(20);
				metadata.numArmorBlocks = cur.readUInt32LE();
				if (metadata.numArmorBlocks === 0)
					return {};//throw new Error(`File ${infile} did not contain any armor blocks`);
				else if (metadata.numArmorBlocks > 1)
					throw new Error(`File ${infile} contained more than one armor block: ${metadata.numArmorBlocks}`);

				// Read the position at which the armor section begins
				cur.seek(0x40);
				metadata.armorSectionPosition = cur.readUInt32LE();
				dedicatedlog.debug(`Expecting armor section to begin at offset ${metadata.armorSectionPosition}`);
				cur.expectZeros(4);

				// The armor section begins with some metadata, which we will now read:
				// - length of the section
				// - length of the section name (section name is constant === 'CM_PA_united.armor\u0000')
				// - position of the section name
				cur.seek(metadata.armorSectionPosition);
				metadata.armorContentLength = cur.readUInt32LE();
				cur.expectZeros(4);
				metadata.sectionNameLengthPosRelative = cur.tell();
				metadata.sectionNameLength = cur.readUInt32LE();
				cur.expectZeros(4);
				metadata.sectionNamePosition = cur.readUInt32LE();
				metadata.sectionNamePositionTrue = metadata.sectionNamePosition + metadata.sectionNameLengthPosRelative;
				cur.expectZeros(4);

				metadata.armorContentPosition = cur.tell();
				const armor = {};
				while (cur.tell() < metadata.sectionNamePositionTrue) {
					// "UnknownA"
					// !!! 12 bytes more than the original document says !!!
					cur.skip(36); 
					metadata.numArmorPieces = cur.readUInt32LE();
					for (let i = 0; i < metadata.numArmorPieces; i++) {
						const piece = {};
						piece.id = cur.readUInt32LE();
						// "UnknownB"
						cur.skip(24);
						const numVertices = cur.readUInt32LE();
						piece.vertices = [];
						for (let j = 0; j < numVertices; j++) {
							const vertex = {};
							vertex.x = cur.readFloatLE();
							vertex.y = cur.readFloatLE();
							vertex.z = cur.readFloatLE();
							// "UnknownC"
							cur.skip(4);
							piece.vertices.push(vertex);
						}
						armor[piece.id] = piece;
					}
				}	
				dedicatedlog.debug(`Finished reading armor section. Read ${Object.keys(armor).length} armor pieces`);
				// Make sure we are in the position foretold when we read metadata.
				// If we aren't, that's a sign our input format is not correct anymore.
				// If that happens, most likely the sizes of UnknownA, UnknownB or UnknownC have changed.
				if (cur.tell() !== metadata.sectionNamePositionTrue)
					throw new Error(`Format error: misaligned position after reading armor section. Expected to be at ${metadata.armorContentPosition + metadata.armorContentLength} but am at ${cur.tell()}.`);

				// Make sure the secton name is 'CM_PA_united.armor\u0000'.
				// Again, if this is not the case, our input format is incorrect.
				metadata.sectionName = cur.readString(metadata.sectionNameLength, 'utf8');
				if (metadata.sectionName !== 'CM_PA_united.armor\u0000')
					throw new Error(`Format error: expected section name to be 'CM_PA_united.armor\\u0000' but it was '${metadata.sectionName}'`);
				
				return armor;
			},
			function postProcess(armor) {
				const convertVertex = ({ x, y, z }) => [ x, y, z ];

				for (let id in armor) {
					let piece = armor[id];
					piece.vertices = piece.vertices.map(convertVertex);
					armor[id] = [];
					for (let i = 0; i < piece.vertices.length; i += 3) {
						armor[id].push([ piece.vertices[i], piece.vertices[i + 1], piece.vertices[i + 2]])
					}
				}
				return {
					source: armor
				}
			},
			writeJSON(path.format({
				dir: dest,
				name: path.basename(infile, '.geometry'),
				ext: '.json'
			}))
		])),
		// Delete the extracted files now that we have read them
		passthrough(async () => await fs.rm(tmpdir, { recursive: true, force: true })),
	]);
}