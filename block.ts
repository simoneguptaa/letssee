import { timeStamp } from "node:console";
import express from 'express';
import * as bodyParser from 'body-parser';
import {WebSocket, WebSocketServer} from 'ws';
import {Server} from 'ws';

class Block{
    public index: number; // block number in the chain
    public data: string; // data included in the block
    public timestamp: number;
    public previousHash: string | null; // previous block's hash
    public hash: string; // current block's hash

    constructor(index: number, data: string, timestamp: number, previousHash: string | null, hash: string){
        this.index = index;
        this.data = data;
        this.timestamp = timestamp;
        this.previousHash = previousHash;
        this.hash = hash;
    }
}

var CryptoJS = require("crypto-js");

// the block hash has nothing to do with mining yet, as there is no proof of work problem to solve
// the deeper/ earlier the block is in a chain, the harder it is to modify it - hashes of all consecutive blocks must be changed
const calculateHash = (index: number, data: string, timestamp: number, previousHash: string | null) => {
    return CryptoJS.SHA256(index + data + timestamp + previousHash).toString();
}

// genesis block - the first block in the blockchain
const genesisBlockIndex = 0;
const genesisBlockData = "genesis block";
const genesisBlockTimestamp = 1465154705;
const genesisBlockPreviousHash: string | null = null;
const genesisBlockHash = "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7";

const genesisBlock: Block = new Block(
    genesisBlockIndex, genesisBlockData, genesisBlockTimestamp, genesisBlockPreviousHash, genesisBlockHash
);

// for now, use an in-memory js array to store the blockchain
let blockchain: Block[] = [genesisBlock];

const generateNextBlock = (blockData: string) => {
    const previousBlock: Block = getLatestBlock();
    const nextIndex: number = previousBlock.index + 1;
    const nextTimestamp: number = new Date().getTime() / 1000;
    const nextData: string = blockData;
    const nextHash: string = calculateHash(nextIndex, nextData, nextTimestamp, previousBlock.hash);

    const newBlock: Block = new Block(nextIndex, nextData, nextTimestamp, previousBlock.hash, nextHash);
    blockchain.push(newBlock);
    return newBlock;
}

const getLatestBlock = () => {
    return blockchain[-1];
}

// check block validity:
// index of the block must be one larger than the previous
// previousHash of the new block must match the hash of the previous block
// hash of the block itself must be valid

const isValidNewBlock = (newBlock: Block, previousBlock: Block) => {
    const newBlockCalculatedHash = calculateHash(newBlock.index, newBlock.data, newBlock.timestamp, newBlock.previousHash);
    
    if(newBlock.index !== previousBlock.index + 1){
        console.log("index invalid");
        return false;
    } else if(newBlock.previousHash !== previousBlock.hash){
        console.log("invalid previousHash");
    } else if(newBlockCalculatedHash !== newBlock.hash){
        console.log(typeof newBlock.hash + " " + typeof newBlockCalculatedHash);
        console.log("invalid hash: " + newBlockCalculatedHash + " " + newBlock.hash);
        return false;
    }
    return true;
}

// validate the structure of the block
// a node rejects malformed content sent by a peer

const isValidBlockStructure = (block: Block): boolean => {
    return typeof block.index === "number"
        && typeof block.data === "string"
        && typeof block.timestamp === "number"
        && (typeof block.previousHash === "string" || block.previousHash === null) // typeof always returns a string - typeof null evaluates to "object"
        && typeof block.hash === "string";
}

const isValidChain = (blockchainToValidate: Block[]): boolean => {
    const isValidGenesis = (block: Block): boolean => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    }

    if(!isValidGenesis(blockchainToValidate[0])){
        return false;
    }

    for (let i = 1; i < blockchainToValidate.length; i++){
        if(!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i-1])){
            return false;
        }
    }

    return true;
}

const replaceChain = (newBlocks: Block[]) => {
    if (isValidChain(newBlocks) && newBlocks.length > blockchain.length){
        console.log("received blockchain is valid. replacing current blockchain with received blockchain");
        blockchain = newBlocks;
        // broadcastLatest();
    } else {
        console.log("received blockchain invalid");
    }
}

const addBlockToChain = (block: Block) => {
    if(isValidBlockStructure(block)){
        blockchain.push(block);
        return true;
    }
    return false;
}

// rules for keeping the network in sync:
// node generates a new block - broadcast it to the network
// a node connects to a new peer - it query's for the latest block
// when a node encounters a block that has an index larger than the current known block, it either adds the block to its current chain or querys for the full blockchain

const sockets: WebSocket[] = [];

enum MessageType {
    QUERY_LATEST = 0,
    QUERY_ALL = 1,
    RESPONSE_BLOCKCHAIN = 2
}

class Message {
    public type: MessageType;
    public data: any;

    constructor(type: MessageType, data: any){
        this.type = type;
        this.data = data;
    }
}

const httpPort: number = parseInt(process.env.HTTP_PORT ?? '3001');
const p2pPort: number = parseInt(process.env.P2P_PORT ?? '6001');

// the user must be able to control the node in some way. 
// this is done by setting up an HTTP server.
const initHttpServer = (myHttpPort: number) => {
    const app = express(); // creates and returns a new Express app instance - this object is your actual web server/ app. app is that instance.
    // use app to define routes and middleware

    app.use(bodyParser.json()); // middleware configuration in express that automatically parses incoming HTTP request bodies containing JSON data.

    app.get("/blocks", (req, res) => {
        res.send(blockchain);
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

const initP2PServer = (p2pPort: number) => {
    const server: Server = new WebSocketServer({port: p2pPort});
    server.on('connection', (ws: WebSocket) => {
        initConnection(ws);
    });
    console.log("listening websocket p2p port on: " + p2pPort);
};

const getSockets = () => sockets;

const initConnection = (ws: WebSocket) => {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
};

// JSON.stringify() = javascript object to json string
// JSON.parse() = json string to js object

const JSONToObject = <T>(data: string): T | null=> {
    try {
        return JSON.parse(data);
    } catch (e) {
        console.log(e);
        return null;
    }
};

const initMessageHandler = (ws: WebSocket) => {
    ws.on('message', (data: string) => { // CHECK: the error on "on" got fixed by the named import instead
        const message: Message | null = JSONToObject<Message>(data); // CHECK: type has default value?
        if (message === null){
            console.log("could not parse received JSON message: " + data);
            return;
        }
        console.log("received message: " + JSON.stringify(message));
        switch (message.type){
            case MessageType.QUERY_LATEST:
                write(ws, responseLatestMsg());
                break;
            case MessageType.QUERY_ALL:
                write(ws, responseChainMsg());
                break;
            case MessageType.RESPONSE_BLOCKCHAIN:
                const receivedBlocks: Block[] | null = JSONToObject<Block[]>(message.data);
                if (receivedBlocks === null){
                    console.log("invalid blocks received: ");
                    console.log(message.data);
                    break;
                }
                handleBlockchainResponse(receivedBlocks);
                break;
        }
    });
};

const getBlockchain = () => {
    return blockchain;
}

const write = (ws: WebSocket, message: Message): void => {
    ws.send(JSON.stringify(message));
};

const broadcast = (message: Message): void => {
    sockets.forEach((socket) => write(socket, message));
};

const queryChainLengthMsg = (): Message => {
    return {'type': MessageType.QUERY_LATEST, 'data': null};
}

const queryAllMsg = (): Message => {
    return {'type': MessageType.QUERY_ALL, 'data': null};
}

const responseChainMsg = (): Message => {
    return {'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(getBlockchain())}
}

const responseLatestMsg = (): Message => {
    return {
        'type': MessageType.RESPONSE_BLOCKCHAIN,
        'data': JSON.stringify([getLatestBlock()])
    }
}

const initErrorHandler = (ws: WebSocket) => {
    const closeConnection = (myWs: WebSocket) => {
        console.log("connection failed to peer: " + myWs.url);
        sockets.splice(sockets.indexOf(myWs), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
};

const handleBlockchainResponse = (receivedBlocks: Block[]) => {
    if (receivedBlocks.length === 0){
        console.log("received block chain size of 0");
        return;
    }
    const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1];
    if(!isValidBlockStructure(latestBlockReceived)){
        console.log("block structure not valid");
        return;
    }
    const latestBlockHeld: Block = getLatestBlock();
    if(latestBlockReceived.index > latestBlockHeld.index){
        console.log("blockchain possibly behind. we got: " + latestBlockHeld.index + ", peer got: " + latestBlockReceived.index);
        if(latestBlockHeld.hash === latestBlockReceived.previousHash){
            if(addBlockToChain(latestBlockReceived)){
                broadcast(responseLatestMsg());
            }
        } else if (receivedBlocks.length === 1){
            console.log("we have to query the chain from our peer");
            broadcast(queryAllMsg());
        } else {
            console.log("received blokchain is longer than current blockchain");
            replaceChain(receivedBlocks);
        }
    } else {
        console.log("received blockchain is no longer than current blockchain. do nothing");
    }
}

const broadcastLatest = (): void => {
    broadcast(responseLatestMsg());
};

const connectToPeers = (newPeer: string): void => {
    const ws: WebSocket = new WebSocket(newPeer);
    ws.on('open', () => {
        initConnection(ws);
    });
    ws.on('error', () => {
        console.log("connection failed");
    });
};

initHttpServer(httpPort);
initP2PServer(p2pPort);

