import {WebSocket, WebSocketServer} from 'ws';
import {Server} from 'ws';
import { addBlockToChain, Block, getBlockchain, getLatestBlock, isValidBlockStructure, replaceChain } from './blockchain.ts';

const sockets: WebSocket[] = [];

// rules for keeping the network in sync:
// node generates a new block - broadcast it to the network
// a node connects to a new peer - it query's for the latest block
// when a node encounters a block that has an index larger than the current known block, it either adds the block to its current chain or querys for the full blockchain

enum MessageType {
    QUERY_CHAINLENGTH = 0,
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
            case MessageType.QUERY_CHAINLENGTH:
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

const initErrorHandler = (ws: WebSocket) => {
    const closeConnection = (myWs: WebSocket) => {
        console.log("connection failed to peer: " + myWs.url);
        sockets.splice(sockets.indexOf(myWs), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
};

const write = (ws: WebSocket, message: Message): void => {
    // The WebSocket send method enqueues the data to be transmitted to the server into an internal browser buffer and returns immediately without waiting for the data to be fully transmitted.
    // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
    ws.send(JSON.stringify(message));
};

// Eg: a node on generating a block would broadcast to all other nodes
// the node that generated the block itself is not excluded here
const broadcast = (message: Message): void => {
    sockets.forEach((socket) => write(socket, message));
};

const queryChainLengthMsg = (): Message => {
    return {'type': MessageType.QUERY_CHAINLENGTH, 'data': null};
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

// CHECK: A new peer would connect to all peers
const connectToPeers = (newPeer: string): void => {
    const ws: WebSocket = new WebSocket(newPeer);
    ws.on('open', () => {
        initConnection(ws);
    });
    ws.on('error', () => {
        console.log("connection failed");
    });
};

export {connectToPeers, broadcastLatest, initP2PServer, getSockets};