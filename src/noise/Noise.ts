import {vec2} from "gl-matrix";

export interface Noise {
    GRID_SIZE: number;
    amplitude: number;
    SEED_X1: number;
    SEED_X2: number;
    SEED_Y1: number;
    SEED_Y2: number;
    SEED_Q0: number;
    SEED_Q1: number;
    SEED_Q2: number;
    noise(x: number, y: number): number;
    worleyPoint(out:vec2, pos: vec2): vec2;
}

export type PositionWithPseudos = {
    pos: vec2;
    psuedo: number[];
};

export type NoiseOptions = {
    SEED_X1: number;
    SEED_X2: number;
    SEED_Y1: number;
    SEED_Y2: number;
    SEED_Q0: number;
    SEED_Q1: number;
    SEED_Q2: number;
};

export const DefaultNoiseOptions = {
    SEED_X1: 1273472206,
    SEED_X2: 4278162623,
    SEED_Y1: 1440014778,
    SEED_Y2: 524485263,
    SEED_Q0: 1498573726,
    SEED_Q1: 3476519523,
    SEED_Q2: 3905844518,
};
