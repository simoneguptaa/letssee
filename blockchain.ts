import sha256 from 'crypto-js/sha256.js';
import { broadcastLatest } from './p2p.ts';
import {hexToBinary} from './util.ts';

class Block{
    public index: number; // block number in the chain
    public data: string; // data included in the block
    public timestamp: number;
    public previousHash: string | null; // previous block's hash
    public hash: string; // current block's hash
    public difficulty: number;
    public nonce: number;

    constructor(index: number, data: string, timestamp: number, previousHash: string | null, hash: string, difficulty: number, nonce: number){
        this.index = index;
        this.data = data;
        this.timestamp = timestamp;
        this.previousHash = previousHash;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

const BLOCK_GENERATION_INTERVAL: number = 10; // (in seconds) defines how often a block should be found
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10; // (in blocks) defines how often the difficulty should adjust to the increasing or decreasing network hashrate
// For every 10 blocks that is generated, we check if the time that took to generate those blocks are > or < the expected time.
// Expected time: BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL

// genesis block - the first block in the blockchain
const genesisBlockIndex = 0;
const genesisBlockData = "genesis block";
const genesisBlockTimestamp = 1465154705;
const genesisBlockPreviousHash: string | null = null;
const genesisBlockHash = "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7";
const genesisBlockDifficulty = 0;
const genesisBlockNonce = 0;

const genesisBlock: Block = new Block(
    genesisBlockIndex, genesisBlockData, genesisBlockTimestamp, genesisBlockPreviousHash, genesisBlockHash, genesisBlockDifficulty, genesisBlockNonce
);

// for now, use an in-memory js array to store the blockchain
let blockchain: Block[] = [genesisBlock];

const getBlockchain = (): Block[] => blockchain;
const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

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

// the block hash has nothing to do with mining yet, as there is no proof of work problem to solve
// the deeper/ earlier the block is in a chain, the harder it is to modify it - hashes of all consecutive blocks must be changed
const calculateHash = (index: number, data: string, timestamp: number, previousHash: string | null) => {
    return sha256(index + data + timestamp + previousHash).toString();
}
const calculateHashForBlock = (block: Block): string => {
    return calculateHash(block.index, block.data, block.timestamp, block.previousHash);
}

const addBlock = (newBlock: Block) => {
    // CHECK: check for valid block structure?
    if(isValidNewBlock(newBlock, getLatestBlock())){
        blockchain.push(newBlock);
    }
}
const addBlockToChain = (newBlock: Block) => {
    // CHECK: check for valid block structure?
    if(isValidNewBlock(newBlock, getLatestBlock())){
        blockchain.push(newBlock);
        return true;
    }
    return false;
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

// The Proof of Work puzzle is to find a block hash, that contains a specific number of zeroes as its prefix.
// The difficulty property defines how many prefixing zeroes the block hash must have.
// In order to find a hash that satisfies the difficulty, we must be able to calculate different hashes with the same content of the block.
// This is done by modifying the nonce parameter.
const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
    const hashInBinary: string = hexToBinary(hash);
    const requiredPrefix: string = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
}

// To find a valid block, increase the nonce until a valid hash is obtained.
const findBlock = (index: number, previousHash: string, timestamp: number, data: string, difficulty: number): Block => {
    let nonce = 0;
    while(true){
        const hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if(hashMatchesDifficulty(hash, difficulty)){
            return new Block(index, data, timestamp, previousHash, hash, difficulty, nonce);
        }
        nonce++;
    }
}

const getDifficulty = (aBlockchain: Block[]): number => {
    const latestBlock: Block = aBlockchain[blockchain.length - 1];
    if(latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0){
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        return latestBlock.difficulty;
    }
}

const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]): number => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    
    if(timeTaken < timeExpected / 2){ // Time taken is 2 times smaller than expected. Increase the difficulty.
        return prevAdjustmentBlock.difficulty + 1;

    } else if(timeTaken > timeExpected * 2){ // Time taken is 2 times greater than expected. Decrease the difficulty.
        return prevAdjustmentBlock.difficulty - 1;

    } else { // Best case: time taken matches exactly the time expected. CHECK: hashrate matches exactly the current difficulty.
        return prevAdjustmentBlock.difficulty;
    }
}

// Timestamp validation: to mitigate the attack where a false timestamp is introduced in order to manipulate the difficulty
const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
    // A block is valid if its timestamp is atmost 1 min in the future from the current time.
    // obtaining a block with a timestamp from the future - different computers participating in the blockchain will read different times.
    // A block in the chain is valid, if the timestamp is at most 1 min in the past of the previous block.
    // (A new block's timestamp cannot be 60 seconds or more behind the previous block's timestamp.)
    return (newBlock.timestamp < getCurrentTimestamp() + 60) && (newBlock.timestamp < previousBlock.timestamp - 60 );
}

// The correct chain is not the longest chain, but the chain with the most cumulative difficulty.
// i.e., the chain which required the most resources (= hashRate * time) produce
// why 2^difficulty?

export {Block, getBlockchain, getLatestBlock, generateNextBlock, isValidBlockStructure, replaceChain, addBlockToChain};