import { type, homedir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const os = type();

export const AGENDAS_DEFAULT_DIR = {
	'Linux': '/usr/share/quartersbrief',
	'Windows_NT': path.join(process.env.PROGRAMDATA ?? '', 'Quartersbrief')
}[os];

export const AGENDAS_USER_DIR = {
	'Linux': path.join(homedir(), 'quartersbrief'),
	'Windows_NT': path.join(process.env.USERPROFILE ?? '', 'Quartersbrief')
}[os];

export const CONFIG_DEFAULT_DIR = {
	'Linux': '/etc',
	'Windows_NT': path.join(process.env.LOCALAPPDATA ?? '', 'Quartersbrief', 'Config')
}[os];

export const DATA_DIR = {
	'Linux': '/var/lib/quartersbrief',
	'Windows_NT': path.join(process.env.LOCALAPPDATA ?? '', 'Quartersbrief', 'Data')	
}[os];

export const CACHE_DIR = {
	'Linux': '/var/cache/quartersbrief',
	'Windows_NT': path.join(process.env.LOCALAPPDATA ?? '', 'Quartersbrief', 'Cache')
}[os];

export const BASE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
