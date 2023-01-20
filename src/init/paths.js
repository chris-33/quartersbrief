import { type, homedir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
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
