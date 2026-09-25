import { timeStamp } from "node:console";

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


