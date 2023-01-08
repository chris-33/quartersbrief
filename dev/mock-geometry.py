#!/usr/bin/env python3
import struct
import json
import sys
import os.path
import hashlib

if len(sys.argv) < 2:
	print('Error: no infile specified.\nYou need to pass the name of an armor file in .json format to convert to .geometry')
	exit(1)
else:
	infile = sys.argv[1]

with open(infile, 'r') as f:
	armor = json.load(f)

outfile = os.path.join(os.path.dirname(infile), os.path.splitext(os.path.basename(infile))[0] + '.geometry')

armor = armor['armor']

with open(outfile, 'wb') as f:
	f.write(20*b'\xff')

	if len(armor) == 0:		
		f.write((0).to_bytes(4, byteorder='little'))
		f.write((0x40 - f.tell()) * b'\xff')
		# When there are no armor blocks, source files seem to have 0 as armor section position
		f.write((0).to_bytes(4, byteorder='little'))
		# For writing metadata:
		armorContentLength = 0
		data = b'' 
	else:
		# Number of armor model blocks
		f.write((1).to_bytes(4, byteorder='little'))

		# 0x0040
		# armorSectionPosition:4							// uint32
		# ?zeros:4
		f.write((0x40 - f.tell()) * b'\xff')
		# Arbitrarily make armor section position 0x0060.
		f.write((0x0060).to_bytes(4, byteorder='little'))
		f.write(4 * b'\00')

		# In a real file, this would be where visual model defitions, collision models etc would go.
		f.write((0x60 - f.tell()) * b'\xff')
		
		# 0x0060
		# Beginning of armor section (because we just made it so)
		armorContentLengthPosition = f.tell()
		# armorContentLength:4						// uint32; counted from the first byte of unknownA to sectionName
		# ?zeros:4
		f.write(4 * b'\x00') # Will be written later
		f.write(4 * b'\x00')

		# sectionNameLength:4							// uint32
		# ?zeros:4
		sectionNamePositionMark = f.tell()
		f.write(len('CM_PA_united.armor ').to_bytes(4, byteorder='little'))
		f.write(4 * b'\x00')

		# sectionNamePosition:4						// uint32; position counted from the first byte of sectionNameLength
		# ?zeros:4
		sectionNamePositionPosition = f.tell()
		f.write(4 * b'\x00') # Will be written later
		f.write(4 * b'\x00')

		# unknownA:36
		armorContentLengthMark = f.tell()
		# From now on, write to a byte string (so we can later hash what's been written)
		data = 36 * b'\xff'

		# numberOfArmorPieces:4					// uint32
		data += len(armor).to_bytes(4, byteorder='little')
		for id in armor.keys():
			# Flatten the piece from a list of triangles (which are lists of length 3 of vertices) to a list of vertices
			vertices = [vertex for tri in armor[id] for vertex in tri]

			# id:4								// uint32
			data += (int(id)).to_bytes(4, byteorder='little')
			
			# unknownB:24
			data += 24*b'\xff'
			
			# numberOfVertices:4					// uint32
			data += len(vertices).to_bytes(4, byteorder='little')

			for vertex in vertices:			
				# Write x,y, and z in one go:
				data += struct.pack('<fff', *vertex)
				# unknownC:4
				data += 4 * b'\xff'

		# Write the byte string
		f.write(data)

		armorContentLength = f.tell() - armorContentLengthMark
		sectionNamePosition = f.tell()

		# sectionName:sectionNameLength				// ascii; 'CM_PA_united.armor '
		f.write('CM_PA_united.armor\u0000'.encode('latin-1'))

		f.seek(armorContentLengthPosition)
		f.write(armorContentLength.to_bytes(4, byteorder='little'))
		
		f.seek(sectionNamePositionPosition)
		f.write((sectionNamePosition - sectionNamePositionMark).to_bytes(4, byteorder='little'))

# Construct dict to update json file (add metadata)
armor = {
	'armor': armor,
	'metadata': {
		'size': armorContentLength,
		'hash': hashlib.md5(data).hexdigest()
	}
}
with open(infile, 'wt') as f:
	json.dump(armor, f, indent='\t')
