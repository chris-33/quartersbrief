import { type, homedir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAppPath as getGamePath } from 'steam-path';
const os = type();


export const AGENDAS_DEFAULT_DIR = {
	'Linux': '/usr/share/quartersbrief',
	'Windows_NT': path.join(process.env.PROGRAMDATA ?? '', 'Quartersbrief', 'Agendas')
}[os];

export const AGENDAS_USER_DIR = {
	'Linux': path.join(homedir(), 'quartersbrief'),
	'Windows_NT': path.join(process.env.USERPROFILE ?? '', 'Quartersbrief')
}[os];

export const CONFIG_USER_DIR = {
	'Linux': path.join(homedir(), '.config/quartersbrief'),
	'Windows_NT': path.join(process.env.LOCALAPPDATA ?? '', 'Quartersbrief')
}[os];

export const DATA_DIR = {
	'Linux': '/var/lib/quartersbrief',
	'Windows_NT': path.join(process.env.PROGRAMDATA ?? '', 'Quartersbrief', 'Data')	
}[os];

export const CACHE_DIR = {
	'Linux': '/var/cache/quartersbrief',
	'Windows_NT': path.join(process.env.PROGRAMDATA ?? '', 'Quartersbrief', 'Cache')
}[os];

export const BASE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

const WOWS_APP_ID = 552990;
export const WOWS_DIRS = [
	// Steam game path, if installed; otherwise catch thrown error 
	await getGamePath(WOWS_APP_ID)
		.then(info => info.path)
		.catch(err => err.message.match(/steam/i) ? null : Promise.reject(err)), 
	...{
		// On Linux: ~, /games (even though not a standard location), /opt/, mounted drives
		'Linux': [
			homedir(),
			'/games',
			'/opt',
			'/mount', '/media'
		],
		// On Windows: standard program files folders, c:\Games
		'Windows_NT': [
			process.env.PROGRAMFILES,
			process.env['PROGRAMFILES(X86)'],
			path.join(process.env.SYSTEMDRIVE ?? 'c:/', 'Games')
		]
	}[os] 
].filter(Boolean).map(p => path.join(p, '**'));