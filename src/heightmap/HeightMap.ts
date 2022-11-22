import {MeshInstance, Mesh, PBRMaterial} from "iwo-renderer";
import {HeightMapChunk, HeightMapChunkOptions} from "src/heightmap/HeightMapChunk";
import {Perlin} from "src/noise/Perlin";
import {Worley} from "src/noise/Worley";
import {vec2, vec3, glMatrix} from "gl-matrix";

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

type ActiveHeightMapMesh = {
    active: boolean;
    mesh: MeshInstance;
};

const temp_corners = [vec2.create(), vec2.create(), vec2.create(), vec2.create()];
const temp_pos2 = vec2.create();
const temp_dir2 = vec2.create();
const temp_fov_dir1 = vec2.create();
const temp_fov_dir2 = vec2.create();
const temp_pos_to_corner = vec2.create();

export class HeightMap implements HeightMapOptions {
    public readonly floor_meshes: ActiveHeightMapMesh[][];
    public readonly ceiling_meshes: ActiveHeightMapMesh[][];
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
        this.floor_meshes = [];
        this.ceiling_meshes = [];
        this.material = new PBRMaterial([1, 1, 1], 0.0, 0);

        this.init(gl);
    }

    private init(gl: WebGL2RenderingContext) {
        const perlin = new Perlin(40, 70);
        // const perlin2 = new Perlin(12, 12);
        const worley = new Worley(30, 0.75);
        const width = this.chunk_width_x * this.x_chunks;
        const half_width = width / 2;

        const ceiling_func = (x: number, y: number) => {
            var {s, b, f, w} = calculateHeightVars(x, y);

            if (s <= 0) return b - 3;
            return b * f + s - (w * w * f) / s;
        };
        const floor_func = (x: number, y: number) => {
            var {s, b, f, w} = calculateHeightVars(x, y);

            if (s <= 0) return b + 3;
            return b * f - s + (w * w * f) / s;
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
                this.ceiling_meshes[z].push({mesh: new MeshInstance(m, this.material), active: false});
                m = new Mesh(gl, floor_chunk);
                this.floor_meshes[z].push({mesh: new MeshInstance(m, this.material), active: false});
            }
        }

        function calculateHeightVars(x: number, y: number) {
            //[-35,35]
            const b = perlin.noise(x, y) / 35;
            const w = worley.noise(x, y);
            let s = 0;
            let f = 0;
            //distance to center
            const d = vec2.dist([x, y], [half_width, half_width]);

            if (d > half_width) s = 0; // no tunnls in corners of map
            else if (d > half_width * 0.8)
                s = Math.pow(((half_width - d) / half_width) * 0.2, 0.6) * 3.0; // tunnels near map edge
            else if (d > half_width * 0.4) s = 3.0; // tunnels are constant size
            else s = 3.0 + (1.0 + Math.cos((d / half_width) * 0.4 * Math.PI)) * 10; // cavern in middle

            if (d > half_width * 0.4) f = 1.0; // not in cavern
            else f = 0.75 - Math.cos((d / half_width) * 0.4 * Math.PI) * 0.25; // in cavern
            return {s, b, f, w};
        }
    }

    public activateMeshesInView(
        pos: vec3,
        dir: vec3,
        fov_radians: number,
        cell_range: number,
        cell_radius: number,
    ): void {
        this.deactivateAllHeightMapMeshes();
        vec2.set(temp_pos2, pos[0], pos[2]);
        vec2.set(temp_dir2, dir[0], dir[2]);
        vec2.normalize(temp_dir2, temp_dir2);
        vec2.rotate(temp_fov_dir1, temp_dir2, [0, 0], -fov_radians);
        vec2.rotate(temp_fov_dir2, temp_dir2, [0, 0], fov_radians);

        const angle = vec2.angle(temp_fov_dir1, temp_fov_dir2);
        const MAX_DIST_SQ =
            this.chunk_width_x * cell_range * this.chunk_width_x * cell_range +
            this.chunk_width_z * cell_range * this.chunk_width_z * cell_range;

        //check if every mesh is between both fov dirs
        for (let z = 0; z < this.z_chunks; z++) {
            for (let x = 0; x < this.x_chunks; x++) {
                //four corners of a cell

                vec2.set(temp_corners[0], x * this.chunk_width_x, z * this.chunk_width_z);
                vec2.set(temp_corners[1], x * this.chunk_width_x + this.chunk_width_x, z * this.chunk_width_z);
                vec2.set(temp_corners[2], x * this.chunk_width_x, z * this.chunk_width_z + this.chunk_width_z);
                vec2.set(
                    temp_corners[3],
                    x * this.chunk_width_x + this.chunk_width_x,
                    z * this.chunk_width_z + this.chunk_width_z,
                );

                //if angle between pos and each fov dir is less than angle between both fov dirs we are between
                for (const corner of temp_corners) {
                    //determine if corner is in view direction
                    vec2.sub(temp_pos_to_corner, corner, temp_pos2);
                    const dot = vec2.dot(temp_pos_to_corner, temp_dir2);
                    if (dot < fov_radians / 2) continue;
                    const dist_sq = vec2.sqrLen(temp_pos_to_corner);
                    if (dist_sq > MAX_DIST_SQ) continue;
                    vec2.normalize(temp_pos_to_corner, temp_pos_to_corner);

                    const pos_angle_1 = vec2.angle(temp_pos_to_corner, temp_fov_dir1);
                    const pos_angle_2 = vec2.angle(temp_pos_to_corner, temp_fov_dir2);
                    if (pos_angle_1 < angle && pos_angle_2 < angle) {
                        this.ceiling_meshes[z][x].active = true;
                        this.floor_meshes[z][x].active = true;
                        break;
                    }
                }
            }
        }

        //add cells nearby for when looking down
        let x_index = Math.floor(pos[0] / this.chunk_width_x);
        let z_index = Math.floor(pos[2] / this.chunk_width_z);
        for (let z = z_index - cell_radius; z <= z_index + cell_radius; z++) {
            for (let x = x_index - cell_radius; x <= x_index + cell_radius; x++) {
                if (this.ceiling_meshes[z] && this.ceiling_meshes[z][x]) this.ceiling_meshes[z][x].active = true;
                if (this.floor_meshes[z] && this.floor_meshes[z][x]) this.floor_meshes[z][x].active = true;
            }
        }
    }

    private deactivateAllHeightMapMeshes() {
        for (const arr of this.ceiling_meshes) {
            for (const mesh of arr) mesh.active = false;
        }
        for (const arr of this.floor_meshes) {
            for (const mesh of arr) mesh.active = false;
        }
    }

    // public getMeshesInView(pos: vec3, dir: vec3, fov: number, cell_range: number): MeshInstance[] {
    //     const result_meshes: MeshInstance[] = [];

    //     const dir2 = vec2.fromValues(dir[0], dir[2]);
    //     vec2.normalize(dir2, dir2);
    //     const fov_dir_1 = vec2.rotate(vec2.create(), dir2, [0, 0], -glMatrix.toRadian(fov / 2));
    //     const fov_dir_2 = vec2.rotate(vec2.create(), dir2, [0, 0], glMatrix.toRadian(fov / 2));

    //     const cells_in_range_fov_dir_1: vec2[] = [];
    //     const cells_in_range_fov_dir_2: vec2[] = [];

    //     const MAX_DIST_SQ = this.chunk_width_x * cell_range + this.chunk_width_z * cell_range;
    //     const start_pos = vec2.fromValues(pos[0], pos[2]);
    //     let march_pos = vec2.fromValues(pos[0], pos[2]);

    //     //march to find up to cell_range cells in fov_dir_1 direction
    //     for (let i = 0; i < cell_range; i++) {
    //         while (vec2.sqrDist(start_pos, march_pos) < MAX_DIST_SQ) {
    //             vec2.add(march_pos, march_pos, fov_dir_1);
    //             const ix = Math.floor(march_pos[0] / this.chunk_width_x);
    //             const iz = Math.floor(march_pos[1] / this.chunk_width_z);
    //             const exists = cells_in_range_fov_dir_1.find((v) => v[0] === ix && v[1] === iz);
    //             //add a new found cell
    //             if (!exists) {
    //                 cells_in_range_fov_dir_1.push([ix, iz]);
    //                 break;
    //             }
    //         }
    //     }

    //     march_pos = vec2.fromValues(pos[0], pos[2]);
    //     //march to find up to cell_range cells in fov_dir_2 direction
    //     for (let i = 0; i < cell_range; i++) {
    //         while (vec2.sqrDist(start_pos, march_pos) < MAX_DIST_SQ) {
    //             vec2.add(march_pos, march_pos, fov_dir_2);
    //             const ix = Math.floor(march_pos[0] / this.chunk_width_x);
    //             const iz = Math.floor(march_pos[1] / this.chunk_width_z);
    //             const exists = cells_in_range_fov_dir_2.find((v) => v[0] === ix && v[1] === iz);
    //             //add a new found cell
    //             if (!exists) {
    //                 cells_in_range_fov_dir_2.push([ix, iz]);
    //                 break;
    //             }
    //         }
    //     }

    //     const cells: vec2[] = [];
    //     cells.push(vec2.fromValues(Math.floor(pos[0] / this.chunk_width_x), Math.floor(pos[2] / this.chunk_width_z)));

    //     //find all off the cells between the two lines
    //     for (let i = 0; i < cell_range; i++) {
    //         const cell_1 = cells_in_range_fov_dir_1[i];
    //         const cell_2 = cells_in_range_fov_dir_2[i];

    //         do {

    //         } while (cell_1[0] !== cell_2[0] || cell_1[1] !== cell_2[1]);
    //         continue;
    //     }

    //     //collect meshes for cell in the cone

    //     return result_meshes;
    // }

    public getMeshesInRange(pos: vec3, dir: vec3, cell_radius: number): MeshInstance[] {
        //get x_index, z_index of cell currently in
        let x_index = Math.floor(pos[0] / this.chunk_width_x);
        let z_index = Math.floor(pos[2] / this.chunk_width_z);

        const dir2 = vec2.fromValues(dir[0], dir[2]);
        vec2.normalize(dir2, dir2);

        const offset = cell_radius > 1 ? cell_radius - 1 : 0;

        //move center based on forward direction
        if (vec2.dot(dir2, [1, 0]) > 0.5) {
            x_index += offset;
        } else if (vec2.dot(dir2, [-1, 0]) > 0.5) {
            x_index -= offset;
        }

        if (vec2.dot(dir2, [0, 1]) > 0.5) {
            z_index += offset;
        } else if (vec2.dot(dir2, [0, -1]) > 0.5) {
            z_index -= offset;
        }

        const result_meshes = [];

        for (let z = z_index - cell_radius; z <= z_index + cell_radius; z++) {
            for (let x = x_index - cell_radius; x <= x_index + cell_radius; x++) {
                if (this.ceiling_meshes[z] && this.ceiling_meshes[z][x]) {
                    result_meshes.push(this.ceiling_meshes[z][x].mesh);
                }
                if (this.floor_meshes[z] && this.floor_meshes[z][x]) {
                    result_meshes.push(this.floor_meshes[z][x].mesh);
                }
            }
        }
        return result_meshes;
    }
}
