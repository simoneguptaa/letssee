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