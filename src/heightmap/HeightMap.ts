import {MeshInstance, Mesh, PBRMaterial, IndexBuffer} from "iwo-renderer";
import {HeightMapChunk, HeightMapChunkOptions} from "src/heightmap/HeightMapChunk";
import {Perlin} from "src/noise/Perlin";
import {Worley} from "src/noise/Worley";
import {vec2, vec3, glMatrix} from "gl-matrix";

export interface HeightMapOptions {
    x_chunks: number;
    z_chunks: number;
    chunk_width_x: number;
    chunk_width_z: number;
    x_cells: number;
    z_cells: number;
    tex_x_cells: number;
    tex_z_cells: number;
}

export const DefaultHeightMapOptions: HeightMapOptions = {
    x_chunks: 80,
    z_chunks: 80,
    chunk_width_x: 6.25,
    chunk_width_z: 6.25,
    x_cells: 20,
    z_cells: 20,
    tex_x_cells: 2,
    tex_z_cells: 2,
};

type ActiveHeightMapMesh = {
    active: boolean;
    mesh?: MeshInstance;
};

type Result_SBFW = {
    s: number;
    b: number;
    f: number;
    w: number;
};

const temp_pos2 = vec2.create();
const temp_dir2 = vec2.create();
const temp_fov_dir1 = vec2.create();
const temp_fov_dir2 = vec2.create();
const temp_pos_to_chunk_center = vec2.create();
const temp_chunk_center = vec2.create();
const temp_xy_vec = vec2.create();
const temp_half_width_vec = vec2.create();
const result_sbfw = {s: 0, b: 0, f: 0, w: 0};

export class HeightMap implements HeightMapOptions {
    public readonly floor_meshes: ActiveHeightMapMesh[][];
    public readonly ceiling_meshes: ActiveHeightMapMesh[][];
    readonly x_chunks: number;
    readonly z_chunks: number;
    readonly chunk_width_x: number;
    readonly chunk_width_z: number;
    readonly x_cells: number;
    readonly z_cells: number;
    readonly tex_x_cells: number;
    readonly tex_z_cells: number;
    public material: PBRMaterial;

    private readonly perlin: Perlin;
    private readonly worley: Worley;
    private readonly half_width: number;
    private ceiling_index_buffer: IndexBuffer | undefined;
    private floor_index_buffer: IndexBuffer | undefined;

    constructor(gl: WebGL2RenderingContext, options?: Partial<HeightMapOptions>) {
        const opt = {...DefaultHeightMapOptions, ...options};

        this.x_chunks = opt.x_chunks;
        this.z_chunks = opt.z_chunks;
        this.chunk_width_x = opt.chunk_width_x;
        this.chunk_width_z = opt.chunk_width_z;
        this.x_cells = opt.x_cells;
        this.z_cells = opt.z_cells;
        this.tex_x_cells = opt.tex_x_cells;
        this.tex_z_cells = opt.tex_z_cells;

        this.floor_meshes = new Array(this.z_chunks)
            .fill(new Array())
            .map(() => new Array(this.x_chunks).fill(new Array()).map(() => ({active: false} as ActiveHeightMapMesh)));
        this.ceiling_meshes = new Array(this.z_chunks)
            .fill(new Array())
            .map(() => new Array(this.x_chunks).fill(new Array()).map(() => ({active: false} as ActiveHeightMapMesh)));
        this.material = new PBRMaterial({albedo_color: [1, 1, 1]});
        this.perlin = new Perlin(40, 70);
        const amp = Math.hypot(30, 30) / 2;
        this.worley = new Worley(30, amp);

        const width = this.chunk_width_x * this.x_chunks;
        this.half_width = width / 2;
        vec2.set(temp_half_width_vec, this.half_width, this.half_width);

        //this.init(gl);
    }

    private generateChunkAt(gl: WebGL2RenderingContext, x: number, z: number) {
        const ceiling_chunk = new HeightMapChunk(
            x * this.chunk_width_x,
            z * this.chunk_width_z,
            this.getCeilingNoiseFunc(),
            {
                x_width: this.chunk_width_x,
                z_width: this.chunk_width_z,
                tex_x_cells: this.tex_x_cells,
                tex_z_cells: this.tex_z_cells,
                x_cells: this.x_cells,
                z_cells: this.z_cells,
                flip_y: true,
            },
        );
        const floor_chunk = new HeightMapChunk(
            x * this.chunk_width_x,
            z * this.chunk_width_z,
            this.getFloorNoiseFunc(),
            {
                x_width: this.chunk_width_x,
                z_width: this.chunk_width_z,
                tex_x_cells: this.tex_x_cells,
                tex_z_cells: this.tex_z_cells,
                x_cells: this.x_cells,
                z_cells: this.z_cells,
            },
        );

        let m = new Mesh(gl, ceiling_chunk, {reuse_index_buffer: this.ceiling_index_buffer});
        if (!this.ceiling_index_buffer) this.ceiling_index_buffer = m.index_buffer;
        this.ceiling_meshes[z][x].mesh = new MeshInstance(m, this.material);
        m = new Mesh(gl, floor_chunk, {reuse_index_buffer: this.floor_index_buffer});
        if (!this.floor_index_buffer) this.floor_index_buffer = m.index_buffer;
        this.floor_meshes[z][x].mesh = new MeshInstance(m, this.material);
    }

    private init(gl: WebGL2RenderingContext) {
        let ceiling_index_buffer: IndexBuffer | undefined;
        let floor_index_buffer: IndexBuffer | undefined;

        const floor_func = this.getFloorNoiseFunc();
        const ceiling_func = this.getCeilingNoiseFunc();

        for (let z = 0; z < this.z_chunks; z++) {
            this.floor_meshes[z] = [];
            this.ceiling_meshes[z] = [];
            for (let x = 0; x < this.x_chunks; x++) {
                const ceiling_chunk = new HeightMapChunk(x * this.chunk_width_x, z * this.chunk_width_z, ceiling_func, {
                    x_width: this.chunk_width_x,
                    z_width: this.chunk_width_z,
                    x_cells: this.x_cells,
                    z_cells: this.z_cells,
                    flip_y: true,
                });
                const floor_chunk = new HeightMapChunk(x * this.chunk_width_x, z * this.chunk_width_z, floor_func, {
                    x_width: this.chunk_width_x,
                    z_width: this.chunk_width_z,
                    x_cells: this.x_cells,
                    z_cells: this.z_cells,
                });

                let m = new Mesh(gl, ceiling_chunk, {reuse_index_buffer: ceiling_index_buffer});
                if (!ceiling_index_buffer) ceiling_index_buffer = m.index_buffer;
                this.ceiling_meshes[z][x].mesh = new MeshInstance(m, this.material);
                m = new Mesh(gl, floor_chunk, {reuse_index_buffer: floor_index_buffer});
                if (!floor_index_buffer) floor_index_buffer = m.index_buffer;
                this.floor_meshes[z][x].mesh = new MeshInstance(m, this.material);
            }
        }
    }

    private calculateHeightVars(result: Result_SBFW, x: number, y: number) {
        //[-35,35]
        const b = this.perlin.noise(x, y) - 35;
        const w = this.worley.noise(x, y);
        const half_w = this.half_width;
        let s = 0;
        let f = 0;
        //distance to center
        vec2.set(temp_xy_vec, x, y);
        const d = vec2.dist(temp_xy_vec, temp_half_width_vec);

        if (d > half_w) s = 0; // no tunnls in corners of map
        else if (d > half_w * 0.8) s = Math.pow((half_w - d) / (half_w * 0.2), 0.6) * 3.0; // tunnels near map edge
        else if (d > half_w * 0.4) s = 3.0; // tunnels are constant size
        else s = 3.0 + (1.0 + Math.cos((d / (half_w * 0.4)) * Math.PI)) * 10; // cavern in middle

        if (d > half_w * 0.4) f = 1.0; // not in cavern
        else f = 0.75 - Math.cos((d / (half_w * 0.4)) * Math.PI) * 0.25; // in cavern
        result.s = s;
        result.b = b;
        result.f = f;
        result.w = w;
        return result;
    }

    public getFloorAndCeiling(x: number, z: number) {
        this.calculateHeightVars(result_sbfw, x, z);
        const {s, b, f, w} = result_sbfw;

        let floor;
        if (s <= 0) floor = b + 3;
        else floor = b * f - s + (w * w * f) / s;

        let ceil;
        if (s <= 0) ceil = b - 3;
        else ceil = b * f + s - (w * w * f) / s;

        return {floor, ceil};
    }

    private getFloorNoiseFunc() {
        return (x: number, z: number) => {
            this.calculateHeightVars(result_sbfw, x, z);
            const {s, b, f, w} = result_sbfw;

            if (s <= 0) return b + 3;
            return b * f - s + (w * w * f) / s;
        };
    }
    private getCeilingNoiseFunc() {
        return (x: number, z: number) => {
            this.calculateHeightVars(result_sbfw, x, z);
            const {s, b, f, w} = result_sbfw;

            if (s <= 0) return b - 3;
            return b * f + s - (w * w * f) / s;
        };
    }

    /**
     *
     * @return floor height if valid else false
     */
    public validFloorPosition(x: number, z: number, distance: number): number | false {
        this.calculateHeightVars(result_sbfw, x, z);
        const {s, b, f, w} = result_sbfw;

        if (s <= 0) return false;
        const floor = b * f - s + (w * w * f) / s;
        const ceiling = b * f + s - (w * w * f) / s;
        return ceiling - floor >= distance ? floor : false;
    }

    public activateMeshesInView(
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

        //check if every mesh is between both fov dirs
        for (let z = 0; z < this.z_chunks; z++) {
            for (let x = 0; x < this.x_chunks; x++) {
                this.deactiveMesh(x, z);

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
                    this.activateMesh(gl, x, z);
                }
            }
        }

        //add cells nearby for when looking down
        let x_index = Math.floor(pos[0] / this.chunk_width_x);
        let z_index = Math.floor(pos[2] / this.chunk_width_z);
        for (let z = z_index - cell_radius; z <= z_index + cell_radius; z++) {
            for (let x = x_index - cell_radius; x <= x_index + cell_radius; x++) {
                if (
                    this.ceiling_meshes[z] &&
                    this.ceiling_meshes[z][x] &&
                    this.floor_meshes[z] &&
                    this.floor_meshes[z][x]
                )
                    this.activateMesh(gl, x, z);
            }
        }
    }

    private activateMesh(gl: WebGL2RenderingContext, x: number, z: number) {
        const c = this.ceiling_meshes[z][x];
        c.active = true;
        if (!c.mesh) this.generateChunkAt(gl, x, z);
        const f = this.floor_meshes[z][x];
        f.active = true;
        if (!f.mesh) this.generateChunkAt(gl, x, z);
    }

    private deactiveMesh(x: number, z: number) {
        this.ceiling_meshes[z][x].active = false;
        this.floor_meshes[z][x].active = false;
    }
}
