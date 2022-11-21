import {vec2} from "gl-matrix";
import {Noise, NoiseOptions, DefaultNoiseOptions, PositionWithPseudos} from "./Noise";

const UINT_MAX = 0xffffffff as const;

export class Worley implements Noise {
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
        result %= UINT_MAX;
        return result;
    }

    private worleyPointCell(x_cell: number, y_cell: number, L: number): PositionWithPseudos {
        const random1 = this.pseudorandom(x_cell, y_cell);
        const random2 = this.xorShift(random1);
        let random3 = this.xorShift(random2);

        const x = (x_cell + this.uintTo01(random1)) * this.GRID_SIZE;
        const y = (y_cell + this.uintTo01(random2)) * this.GRID_SIZE;

        let result: PositionWithPseudos;
        result = {pos: vec2.fromValues(x, y), psuedo: Array(L)};

        for (let i = 0; i < L; i++) {
            result.psuedo[i] = this.uintTo01(random3);
            random3 = this.xorShift(random3);
        }
        return result;
    }

    public worleyPoint(pos: vec2, L: number): PositionWithPseudos {
        const x_cell = Math.floor(pos[0] / this.GRID_SIZE);
        const y_cell = Math.floor(pos[1] / this.GRID_SIZE);
        return this.worleyPointCell(x_cell, y_cell, L);
    }

    public noise(x: number, y: number): number {
        let result = this.differenceNoise(x, y);
        result /= Math.hypot(this.GRID_SIZE, this.GRID_SIZE);
        return result;
    }

    public differenceNoise(x: number, y: number): number {
        const x_cell = Math.floor(x / this.GRID_SIZE);
        const y_cell = Math.floor(y / this.GRID_SIZE);

        let best_dist = 1.0e20;
        let second_dist = 1.0e20;

        for (let y_add = -1; y_add <= 1; y_add++) {
            for (let x_add = -1; x_add <= 1; x_add++) {
                const point = this.worleyPointCell(x_cell + x_add, y_cell + y_add, 0).pos;
                const distance = vec2.distance([x, y], point);
                if (distance < best_dist) {
                    second_dist = best_dist;
                    best_dist = distance;
                } else if (distance < second_dist) second_dist = distance;
            }
        }

        return (second_dist - best_dist) * this.amplitude;
    }

    public differenceNMNoise(x: number, y: number, N: number, M: number): number {
        const x_cell = Math.floor(x / this.GRID_SIZE);
        const y_cell = Math.floor(y / this.GRID_SIZE);
        const pos = vec2.fromValues(x, y);

        let best_dist = Array(M).fill(1e20);
        for (let y_add = -1; y_add <= 1; y_add++) {
            for (let x_add = -1; x_add <= 1; x_add++) {
                const point = this.worleyPointCell(x_cell + x_add, y_cell + y_add, 0).pos;
                const distance = vec2.distance(pos, point);
                for (let i = 0; i < M; i++) {
                    if (distance < best_dist[i]) {
                        best_dist.splice(i, 0, distance);
                        break;
                    }
                }
            }
        }

        return (best_dist[M - 1] - best_dist[N - 1]) * this.amplitude;
    }

    public distanceNoise(x: number, y: number): number {
        const x_cell = Math.floor(x / this.GRID_SIZE);
        const y_cell = Math.floor(y / this.GRID_SIZE);
        const pos = vec2.fromValues(x, y);

        let best_dist = 1.0e20;
        for (let y_add = -1; y_add <= 1; y_add++) {
            for (let x_add = -1; x_add <= 1; x_add++) {
                const point = this.worleyPointCell(x_cell + x_add, y_cell + y_add, 0).pos;
                const distance = vec2.distance(pos, point);
                if (distance < best_dist) best_dist = distance;
            }
        }

        return best_dist * this.amplitude;
    }

    public distanceNNoise(x: number, y: number, N: number): number {
        const x_cell = Math.floor(x / this.GRID_SIZE);
        const y_cell = Math.floor(y / this.GRID_SIZE);
        const pos = vec2.fromValues(x, y);

        let best_dist = Array(N).fill(1e20);
        for (let y_add = -1; y_add <= 1; y_add++) {
            for (let x_add = -1; x_add <= 1; x_add++) {
                const point = this.worleyPointCell(x_cell + x_add, y_cell + y_add, 0).pos;
                const distance = vec2.distance(pos, point);
                for (let i = 0; i < N; i++) {
                    if (distance < best_dist[i]) {
                        best_dist.splice(i, 0, distance);
                        break;
                    }
                }
            }
        }

        return best_dist[N - 1] * this.amplitude;
    }

    private uintTo01(uint: number): number {
        return uint / (UINT_MAX + 1);
    }

    private xorShift(a: number): number {
        let b = a;
        b ^= b << 13;
        b ^= b << 17;
        b ^= b << 5;
        b %= UINT_MAX;
        return b;
    }
}
