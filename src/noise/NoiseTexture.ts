import { vec2, vec3 } from "gl-matrix";
import { Texture2D } from "iwo-renderer";
import { DefaultHeightMapOptions, HeightMap, HeightMapOptions } from "src/heightmap/HeightMap";

const temp_pos2 = vec2.create();
const temp_dir2 = vec2.create();
const temp_fov_dir1 = vec2.create();
const temp_fov_dir2 = vec2.create();
const temp_pos_to_chunk_center = vec2.create();
const temp_chunk_center = vec2.create();

export class NoiseTexture implements HeightMapOptions {
    texture: Texture2D;
    x_chunks: number;
    z_chunks: number;
    x_cells: number;
    z_cells: number;
    chunk_width_x: number;
    chunk_width_z: number;
    tex_x_cells: number;
    tex_z_cells: number;
    generated_cells: boolean[][];
    height_map: HeightMap;
    data: Float32Array;
    components: number = 2;

    constructor(gl: WebGL2RenderingContext, options?: Partial<HeightMapOptions>) {
        const opt = { ...DefaultHeightMapOptions, ...options };
        this.x_chunks = opt.x_chunks;
        this.z_chunks = opt.z_chunks;
        this.x_cells = opt.x_cells;
        this.z_cells = opt.z_cells;
        this.chunk_width_x = opt.chunk_width_x;
        this.chunk_width_z = opt.chunk_width_z;
        this.tex_x_cells = opt.tex_x_cells;
        this.tex_z_cells = opt.tex_z_cells;

        this.generated_cells = new Array(this.z_chunks)
            .fill(new Array())
            .map(() => new Array(this.x_chunks).fill(new Array()).map(() => false));

        const width = this.x_cells * this.x_chunks;
        const height = this.z_cells * this.z_chunks;
        this.data = new Float32Array(width * height * this.components).fill(0);

        this.height_map = new HeightMap(gl, {
            x_chunks: this.x_chunks,
            z_chunks: this.z_chunks,
            z_cells: this.x_cells,
            x_cells: this.z_cells,
        });

        this.texture = new Texture2D(gl, undefined, {
            width: width,
            height: height,
            mag_filter: gl.LINEAR,
            min_filter: gl.LINEAR,
            format: gl.RG,
            type: gl.FLOAT,
            internal_format: gl.RG32F,
        });
    }

    public generateCellsInView(
        gl: WebGL2RenderingContext,
        pos: vec3,
        dir: vec3,
        fov_radians: number,
        cell_range: number,
        cell_radius: number
    ): Uint16Array {
        let x_index = Math.floor(pos[0] / this.chunk_width_x);
        let z_index = Math.floor(pos[2] / this.chunk_width_z);
        vec2.set(temp_pos2, pos[0], pos[2]);
        vec2.set(temp_dir2, dir[0], dir[2]);
        vec2.normalize(temp_dir2, temp_dir2);
        vec2.rotate(temp_fov_dir1, temp_dir2, [0, 0], -fov_radians);
        vec2.rotate(temp_fov_dir2, temp_dir2, [0, 0], fov_radians);

        const chunk_coords = [];

        const angle = vec2.angle(temp_fov_dir1, temp_fov_dir2);
        const MAX_DIST_SQ =
            this.chunk_width_x * cell_range * this.chunk_width_x * cell_range +
            this.chunk_width_z * cell_range * this.chunk_width_z * cell_range;

        let did_draw = false;
        //check if every mesh is between both fov dirs
        for (let z = 0; z < this.z_chunks; z++) {
            for (let x = 0; x < this.x_chunks; x++) {
                //check within cell radius first
                if (
                    z < z_index + cell_radius &&
                    z > z_index - cell_radius &&
                    x < x_index + cell_radius &&
                    x > x_index - cell_radius
                ) {
                    chunk_coords.push(x, z);
                    if (this.drawTexture(x, z)) did_draw = true;
                    continue;
                }

                //get center of chunk
                vec2.set(
                    temp_chunk_center,
                    x * this.chunk_width_x + this.chunk_width_x / 2,
                    z * this.chunk_width_z + +this.chunk_width_z
                );

                //if angle between pos and each fov dir is less than angle between both fov dirs we are between
                vec2.sub(temp_pos_to_chunk_center, temp_chunk_center, temp_pos2);
                const dot = vec2.dot(temp_pos_to_chunk_center, temp_dir2);
                if (dot < fov_radians / 2) continue;

                const dist_sq = vec2.sqrLen(temp_pos_to_chunk_center);
                if (dist_sq > MAX_DIST_SQ) continue;
                vec2.normalize(temp_pos_to_chunk_center, temp_pos_to_chunk_center);

                const pos_angle_1 = vec2.angle(temp_pos_to_chunk_center, temp_fov_dir1);
                const pos_angle_2 = vec2.angle(temp_pos_to_chunk_center, temp_fov_dir2);
                if (pos_angle_1 < angle && pos_angle_2 < angle) {
                    chunk_coords.push(x, z);
                    if (this.drawTexture(x, z)) did_draw = true;
                }
            }
        }

        if (did_draw) this.updateTexture2D(gl);
        return new Uint16Array(chunk_coords);
    }

    public drawTexture(x: number, z: number): boolean {
        if (this.generated_cells[z][x] === true) return false;
        this.generated_cells[z][x] = true;

        const width = this.x_cells * this.x_chunks;
        const height = this.z_cells * this.z_chunks;
        const c = this.components;

        for (let iz = z * this.z_cells - 1; iz <= z * this.z_cells + this.z_cells; iz++) {
            for (let ix = x * this.x_cells - 1; ix <= x * this.x_cells + this.x_cells; ix++) {
                const x0 = (ix * this.chunk_width_x) / this.x_cells;
                const z0 = (iz * this.chunk_width_x) / this.z_cells;
                const { floor, ceil } = this.height_map.getFloorAndCeiling(x0, z0);

                const index = iz * width * c + ix * c;
                this.data[index + 0] = ceil;
                this.data[index + 1] = floor;
                //this.data[index + 2] = 0;
                //this.data[index + 3] = 255;
            }
        }
        return true;
    }

    public updateTexture2D(gl: WebGL2RenderingContext) {
        const width = this.x_cells * this.x_chunks;
        const height = this.z_cells * this.z_chunks;
        gl.bindTexture(gl.TEXTURE_2D, this.texture.texture_id);
        //NOTE: must set this state to prevent bugs
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RG, gl.FLOAT, this.data);
    }
}
