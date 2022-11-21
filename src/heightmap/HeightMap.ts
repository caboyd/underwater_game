import {MeshInstance, Mesh, PBRMaterial} from "iwo-renderer";
import {HeightMapChunk, HeightMapChunkOptions} from "src/heightmap/HeightMapChunk";
import {Perlin} from "src/noise/Perlin";
import {vec3} from "gl-matrix";

export interface HeightMapOptions {
    x_chunks: number;
    z_chunks: number;
    chunk_width_x: number;
    chunk_width_z: number;
}

const DefaultHeightMapOptions: HeightMapOptions = {
    x_chunks: 80,
    z_chunks: 80,
    chunk_width_x: 6.25,
    chunk_width_z: 6.25,
};

export class HeightMap implements HeightMapOptions {
    private floor_chunks: HeightMapChunk[][];
    private ceiling_chunks: HeightMapChunk[][];
    public readonly floor_meshes: MeshInstance[][];
    public readonly ceiling_meshes: MeshInstance[][];
    readonly x_chunks: number;
    readonly z_chunks: number;
    readonly chunk_width_x: number;
    readonly chunk_width_z: number;
    public material: PBRMaterial;

    constructor(gl: WebGL2RenderingContext, options?: Partial<HeightMapOptions>) {
        const opt = {...DefaultHeightMapOptions, ...options};

        this.x_chunks = opt.x_chunks;
        this.z_chunks = opt.z_chunks;
        this.chunk_width_x = opt.chunk_width_x;
        this.chunk_width_z = opt.chunk_width_z;
        this.floor_chunks = Array(this.x_chunks).fill([]);
        this.ceiling_chunks = Array(this.x_chunks).fill([]);
        this.floor_meshes = [];
        this.ceiling_meshes = [];
        this.material = new PBRMaterial([1, 1, 1], 0.0, 0);

        this.init(gl);
    }

    private init(gl: WebGL2RenderingContext) {
        //const perlin = new Perlin(40, 70);
        const ceiling_func = (x: number, y: number) => {
            return 3;
        };
        const floor_func = (x: number, y: number) => {
            return -3;
        };

        for (let z = 0; z < this.z_chunks; z++) {
            this.floor_meshes[z] = [];
            this.ceiling_meshes[z] = [];
            for (let x = 0; x < this.x_chunks; x++) {
                const ceiling_chunk = new HeightMapChunk(x * this.chunk_width_x, z * this.chunk_width_z, ceiling_func, {
                    x_width: this.chunk_width_x,
                    z_width: this.chunk_width_z,
                    tex_x_cells: 2,
                    tex_z_cells: 2,
                    flip_y: true,
                });
                const floor_chunk = new HeightMapChunk(x * this.chunk_width_x, z * this.chunk_width_z, floor_func, {
                    x_width: this.chunk_width_x,
                    z_width: this.chunk_width_z,
                    tex_x_cells: 2,
                    tex_z_cells: 2,
                });
                //this.ceiling_chunks[z].push(ceiling_chunk);
                //this.floor_chunks[z].push(floor_chunk);

                let m = new Mesh(gl, ceiling_chunk);
                this.ceiling_meshes[z].push(new MeshInstance(m, this.material));
                m = new Mesh(gl, floor_chunk);
                this.floor_meshes[z].push(new MeshInstance(m, this.material));
            }
        }
    }

    public getMeshesInRange(pos: vec3, cell_radius: number): MeshInstance[] {
        //get x_index, z_index of cell currently in
        const x_index = Math.floor(pos[0] / this.chunk_width_x);
        const z_index = Math.floor(pos[2] / this.chunk_width_z);

        const result_meshes = [];

        for (let z = z_index - cell_radius; z <= z_index + cell_radius; z++) {
            for (let x = x_index - cell_radius; x <= x_index + cell_radius; x++) {
                if (this.ceiling_meshes[z][x]) result_meshes.push(this.ceiling_meshes[z][x]);
                if (this.floor_meshes[z][x]) result_meshes.push(this.floor_meshes[z][x]);
            }
        }
        return result_meshes;
    }
}
