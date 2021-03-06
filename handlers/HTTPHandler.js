const BaseHandler = require('./BaseHandler');
const { HTTP, HTTPRequest, HTTPResponse } = require('../http-parser');
const { URL } = require('url');
const net = require('net');
const debug = require('debug')('green-tunnel-http-handler');

const { isStartOfHTTPPacket, dnsLookup } = require('../utils');

class HTTPHandler extends BaseHandler {

    static clientToServer(data) {
        const srtData = data.toString();

        if(isStartOfHTTPPacket(srtData)) {
            const packet = new HTTPRequest(srtData);
            packet.path = new URL(packet.path).pathname;

            if(packet.headers.hasOwnProperty('Proxy-Connection'))
                delete packet.headers['Proxy-Connection'];

            return packet.toString()
        } else
            return data;
    }

    static serverToClient(data) {
        return data;
    }

    static handlerNewSocket(clientSocket, dnsType, dnsServer, firstChunk = null) {
        const firstLine = firstChunk.toString().split('\r\n')[0];
        const url = new URL(firstLine.split(/\s+/)[1]);

        const host = url.hostname;
        const port = url.port || 80;

        const serverSocket = net.createConnection({host: host, port: port, lookup: dnsLookup(dnsType, dnsServer)}, () => {
            debug('connected to server!');

            serverSocket.write(HTTPHandler.clientToServer(firstChunk));
            clientSocket.resume();
        });

        serverSocket.on('error', (e) => {
            clientSocket.end();
            debug('ERROR', e);
        });

        serverSocket.on('data', (data) => { clientSocket.write(HTTPHandler.serverToClient(data)) });
        clientSocket.on('data', (data) => { serverSocket.write(HTTPHandler.clientToServer(data)) });

        serverSocket.on('end', () => {
            debug('disconnected from server');
            clientSocket.end();
        });

        clientSocket.on('end', () => {
            debug('disconnected from client');
            serverSocket.end();
        });
    }
}

module.exports = HTTPHandler;