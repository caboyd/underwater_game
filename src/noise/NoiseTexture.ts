import {vec2, vec3} from "gl-matrix";
import {Texture2D} from "iwo-renderer";
import {DefaultHeightMapOptions, HeightMap, HeightMapOptions} from "src/heightmap/HeightMap";

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
    generated_cells: boolean[][];
    height_map: HeightMap;
    data: Uint8Array;

    constructor(gl: WebGL2RenderingContext, options?: Partial<HeightMapOptions>) {
        const opt = {...DefaultHeightMapOptions, ...options};
        this.x_chunks = opt.x_chunks;
        this.z_chunks = opt.z_chunks;
        this.x_cells = opt.x_cells;
        this.z_cells = opt.z_cells;
        this.chunk_width_x = opt.chunk_width_x;
        this.chunk_width_z = opt.chunk_width_z;

        this.generated_cells = new Array(this.z_chunks)
            .fill(new Array())
            .map(() => new Array(this.x_chunks).fill(new Array()).map(() => false));

        const width = this.x_cells * this.x_chunks;
        const height = this.z_cells * this.z_chunks;
        this.data = new Uint8Array(width * height * 2);

        this.height_map = new HeightMap(gl, {
            x_chunks: this.x_chunks,
            z_chunks: this.z_chunks,
            z_cells: this.x_cells,
            x_cells: this.z_cells,
        });

        this.texture = new Texture2D(gl, undefined, {
            width: width,
            height: height,
            format: gl.RG,
            internal_format: gl.RG8,
        });
    }

    public generateCellsInView(
        gl: WebGL2RenderingContext,
        pos: vec3,
        dir: vec3,
        fov_radians: number,
        cell_range: number,
        cell_radius: number,
    ): void {
        vec2.set(temp_pos2, pos[0], pos[2]);
        vec2.set(temp_dir2, dir[0], dir[2]);
        vec2.normalize(temp_dir2, temp_dir2);
        vec2.rotate(temp_fov_dir1, temp_dir2, [0, 0], -fov_radians);
        vec2.rotate(temp_fov_dir2, temp_dir2, [0, 0], fov_radians);

        const angle = vec2.angle(temp_fov_dir1, temp_fov_dir2);
        const MAX_DIST_SQ =
            this.chunk_width_x * cell_range * this.chunk_width_x * cell_range +
            this.chunk_width_z * cell_range * this.chunk_width_z * cell_range;

        let did_draw = false;
        //check if every mesh is between both fov dirs
        for (let z = 0; z < this.z_chunks; z++) {
            for (let x = 0; x < this.x_chunks; x++) {
                //get center of chunk
                vec2.set(
                    temp_chunk_center,
                    x * this.chunk_width_x + this.chunk_width_x / 2,
                    z * this.chunk_width_z + +this.chunk_width_z,
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
                    if (this.drawTexture(x, z)) did_draw = true;
                }
            }
        }

        //add cells nearby for when looking down
        let x_index = Math.floor(pos[0] / this.chunk_width_x);
        let z_index = Math.floor(pos[2] / this.chunk_width_z);
        for (let z = z_index - cell_radius; z <= z_index + cell_radius; z++) {
            for (let x = x_index - cell_radius; x <= x_index + cell_radius; x++) {
                if (this.drawTexture(x, z)) did_draw = true;
            }
        }

        if (did_draw) this.updateTexture2D(gl);
    }

    public drawTexture(x: number, z: number): boolean {
        if (this.generated_cells[z][x] === true) return false;
        this.generated_cells[z][x] = true;

        const width = this.x_cells * this.x_chunks;
        const height = this.z_cells * this.z_chunks;

        for (let iz = z * this.z_chunks; iz < z * this.z_chunks + this.z_cells; iz++) {
            for (let ix = x * this.x_chunks; ix < x * this.x_chunks + this.x_cells; ix++) {
                const {floor, ceil} = this.height_map.getFloorAndCeiling(ix, iz);

                const c_color = Math.floor(ceil * 255);
                const f_color = Math.floor(floor * 255);
                this.data[iz * width * 4 + ix * 4 + 0] = c_color;
                this.data[iz * width * 4 + ix * 4 + 1] = f_color;
            }
        }
        return true;
    }

    public updateTexture2D(gl: WebGL2RenderingContext) {
        const width = this.x_cells * this.x_chunks;
        const height = this.z_cells * this.z_chunks;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RG, gl.UNSIGNED_BYTE, this.data);
    }
}
