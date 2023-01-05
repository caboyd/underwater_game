export class RollingAverage {
    buffer: number[];
    index: number = 0;
    constructor(size: number) {
        this.buffer = new Array(size);
    }
    add(x: number) {
        this.buffer[this.index++] = x;
        if (this.index >= this.buffer.length) this.index = 0;
    }
    avg(): number {
        return this.buffer.reduce((acc, v) => acc + v, 0) / this.buffer.length;
    }
}
