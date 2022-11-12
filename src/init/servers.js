import express from 'express';
import log from 'loglevel';
import { createServer } from 'http';
import { Server } from 'socket.io';

function createServers(host, port) {
	const srv = express();
	srv.use(express.static('res/www'));
	srv.use('/font', express.static('node_modules/@fortawesome/fontawesome-free/webfonts'))
	
	const httpServer = createServer(srv);
	const io = new Server(httpServer);

	httpServer.listen(port, host);
	log.info(`Server listening on ${host}:${port}.`)
	return { srv: srv, io: io };
}

export { createServers as default };