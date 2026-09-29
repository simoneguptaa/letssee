import express from 'express';
import * as bodyParser from 'body-parser';

import {Block, generateNextBlock, getBlockchain} from './blockchain';
import {connectToPeers, getSockets, initP2PServer} from './p2p';

const httpPort: number = parseInt(process.env.HTTP_PORT ?? '3001');
const p2pPort: number = parseInt(process.env.P2P_PORT ?? '6001');

// the user must be able to control the node in some way. 
// this is done by setting up an HTTP server.
const initHttpServer = (myHttpPort: number) => {
    const app = express(); // creates and returns a new Express app instance - this object is your actual web server/ app. app is that instance.
    // use app to define routes and middleware

    app.use(bodyParser.json()); // middleware configuration in express that automatically parses incoming HTTP request bodies containing JSON data.

    app.get("/blocks", (req, res) => {
        res.send(getBlockchain());
    });

    app.post("/mineBlock", (req, res) => {
        const newBlock: Block = generateNextBlock(req.body.data);
        res.send(newBlock);
    });

    app.get("/peers", (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ":" + s._socket.remotePort));
    });

    app.post("/addPeer", (req, res) => {
        connectToPeers(req.body.peer);
        res.send();
    });

    app.listen(myHttpPort, () => {
        console.log("listening on HTTP port: " + myHttpPort);
    });
}

initHttpServer(httpPort);
initP2PServer(p2pPort);

