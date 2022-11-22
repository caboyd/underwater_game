import {Texture2D} from "iwo-renderer";
import {Noise, NoiseOptions} from "src/noise/Noise";
import {vec2} from "gl-matrix";

export class NoiseTexture {
    texture: Texture2D;
    constructor(gl: WebGL2RenderingContext, texture_width: number, texture_height: number, noises: Noise[]) {
        let data: number[] = Array(texture_width * texture_height * 4).fill(0);

        let min_noise = 1e20;
        let max_noise = 0;
        for (const noise of noises) {
            for (let y = 0; y < texture_height; y++) {
                for (let x = 0; x < texture_width; x++) {
                    const noise_at = noise.noise(x, y);
                    if (noise_at < min_noise) min_noise = noise_at;
                    if (noise_at > max_noise) max_noise = noise_at;

                    const color = Math.floor(noise_at * 255) / noises.length;
                    data[y * texture_width * 4 + x * 4 + 0] += color;
                    data[y * texture_width * 4 + x * 4 + 1] += color;
                    data[y * texture_width * 4 + x * 4 + 2] += color;
                    data[y * texture_width * 4 + x * 4 + 3] += 255;
                }
            }
        }

        const point = vec2.create();
        const pos = vec2.create();
        for (const noise of noises) {
            for (let y = 0; y < noise.GRID_SIZE; y++) {
                for (let x = 0; x < noise.GRID_SIZE; x++) {
                    vec2.set(pos, x * noise.GRID_SIZE, y * noise.GRID_SIZE);
                    noise.worleyPoint(point, pos);
                    const px = Math.round(point[0]);
                    if (px < 0 || px > texture_width) continue;
                    const py = Math.round(point[1]);
                    if (py < 0 || py > texture_height) continue;
                    data[py * 4 * texture_width + px * 4 + 0] = 255;
                    data[py * 4 * texture_width + px * 4 + 1] = 0;
                    data[py * 4 * texture_width + px * 4 + 2] = 0;
                    data[py * 4 * texture_width + px * 4 + 3] = 255;
                }
            }
        }

        console.log("min:" + min_noise);
        console.log("max:" + max_noise);
        const buffer = new Uint8Array(data);
        this.texture = new Texture2D(gl, buffer, {width: texture_width, height: texture_height});
    }
}
