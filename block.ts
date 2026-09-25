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