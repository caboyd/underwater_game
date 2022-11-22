import {vec2} from "gl-matrix";
import {Noise, NoiseOptions, DefaultNoiseOptions, PositionWithPseudos} from "./Noise";

interface Vec2 {
    x: number;
    y: number;
}

const UINT_MAX = 0xffffffff as const;

export class Perlin implements Noise {
    GRID_SIZE: number;
    amplitude: number;
    SEED_X1: number;
    SEED_X2: number;
    SEED_Y1: number;
    SEED_Y2: number;
    SEED_Q0: number;
    SEED_Q1: number;
    SEED_Q2: number;

    constructor(grid_size: number, amplitude: number, options?: Partial<NoiseOptions>) {
        const opt = {...DefaultNoiseOptions, ...options};
        this.GRID_SIZE = grid_size;
        this.amplitude = amplitude;
        this.SEED_X1 = opt.SEED_X1;
        this.SEED_X2 = opt.SEED_X2;
        this.SEED_Y1 = opt.SEED_Y1;
        this.SEED_Y2 = opt.SEED_Y2;
        this.SEED_Q0 = opt.SEED_Q0;
        this.SEED_Q1 = opt.SEED_Q1;
        this.SEED_Q2 = opt.SEED_Q2;
    }

    private pseudorandom(x: number, y: number): number {
        let n = this.SEED_X1 * x + this.SEED_Y1 * y;
        let quad_term = this.SEED_Q2 * n * n + this.SEED_Q1 * n + this.SEED_Q0;
        let result = quad_term + this.SEED_X2 * x + this.SEED_Y2 * y;
        return result;
    }

    private fade(n: number): number {
        //result = (1 - cos(n * 3.14159265f)) * 0.5f;
        //result = -2 * (n*n*n) + 3 * (n*n);
        let result = 6 * (n * n * n * n * n) - 15 * (n * n * n * n) + 10 * (n * n * n);

        //result = n;
        return result;
    }

    /**
     *
     * @param x
     * @param y
     * @returns value in the range [0, amplitude]
     */
    public noise2(x: number, y: number): number {
        const x0 = Math.floor(x / this.GRID_SIZE);
        const x1 = x0 + 1;
        const y0 = Math.floor(y / this.GRID_SIZE);
        const y1 = y0 + 1;

        let sx = x / this.GRID_SIZE - x0;
        let sy = y / this.GRID_SIZE - y0;

        let lattice00 = this.randomGradient(x0, y0);
        let lattice01 = this.randomGradient(x0, y1);
        let lattice10 = this.randomGradient(x1, y0);
        let lattice11 = this.randomGradient(x1, y1);

        let direction00: vec2 = [-sx, -sy];
        let direction01: vec2 = [-sx, 1 - sy];
        let direction10: vec2 = [1 - sx, -sy];
        let direction11: vec2 = [1 - sx, 1 - sy];

        let value00 = vec2.dot(lattice00, direction00);
        let value01 = vec2.dot(lattice01, direction01);
        let value10 = vec2.dot(lattice10, direction10);
        let value11 = vec2.dot(lattice11, direction11);

        let x_fade1 = this.fade(sx);
        let y_fade1 = this.fade(sy);
        let x_fade0 = 1.0 - x_fade1;
        let y_fade0 = 1.0 - y_fade1;

        let value0 = value00 * y_fade0 + value01 * y_fade1;
        let value1 = value10 * y_fade0 + value11 * y_fade1;
        let value = value0 * x_fade0 + value1 * x_fade1;

        let result = ((value + 1) / 2) * this.amplitude;
        return result;
    }

    /**
     * @param x
     * @param y
     * @returns value in the range [0, amplitude]
     */
    public noise(x: number, y: number): number {
        const x0 = Math.floor(x / this.GRID_SIZE);
        const x1 = x0 + 1;
        const y0 = Math.floor(y / this.GRID_SIZE);
        const y1 = y0 + 1;

        let sx = x / this.GRID_SIZE - x0;
        let sy = y / this.GRID_SIZE - y0;

        let n0 = this.dotGridGradient(x0, y0, x, y);
        let n1 = this.dotGridGradient(x1, y0, x, y);
        const ix0 = this.interpolate(n0, n1, sx);

        n0 = this.dotGridGradient(x0, y1, x, y);
        n1 = this.dotGridGradient(x1, y1, x, y);
        const ix1 = this.interpolate(n0, n1, sx);

        let result = this.interpolate(ix0, ix1, sy);
        result = (result + 1) / 2;
        result *= this.amplitude;
        return result;
    }

    private dotGridGradient(ix: number, iy: number, x: number, y: number): number {
        // Get gradient from integer coordinates
        const radians = Math.PI * 2 * this.pseudorandom(ix, iy);
        const gradient_x = Math.cos(radians);
        const gradient_y = Math.sin(radians);

        // Compute the distance vector
        const dx = x / this.GRID_SIZE - ix;
        const dy = y / this.GRID_SIZE - iy;

        // Compute the dot-product
        return dx * gradient_x + dy * gradient_y;
    }

    private randomGradient(ix: number, iy: number): vec2 {
        const radians = Math.PI * 2 * this.pseudorandom(ix, iy);
        return [Math.cos(radians), Math.sin(radians)];
    }

    private interpolate(x: number, y: number, w: number) {
        return (y - x) * w + x;
    }

    public worleyPoint(out: vec2, pos: vec2): vec2 {
        return vec2.set(out, -1, -1);
    }
}
