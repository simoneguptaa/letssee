class Block{
    public index: number; // block number in the chain
    public data: string; // data included in the block
    public timestamp: number;
    public previousHash: string; // previous block's hash
    public hash: string; // current block's hash

    constructor(index: number, data: string, timestamp: number, previousHash: string, hash: string){
        this.index = index;
        this.data = data;
        this.timestamp = timestamp;
        this.previousHash = previousHash;
        this.hash = hash;
    }
}

var CryptoJS = require("crypto-js");

// the block hash has nothing to do with mining yet, as there is no proof of work problem to solve
const calculateHash = (index: number, data: string, timestamp: number, previousHash: string, hash: string) => {
    CryptoJS.SHA256(index + data + timestamp + previousHash).toString();
}

// the deeper/ earlier the block is in a chain, the harder it is to modify it - hashes of all consecutive blocks must be changed