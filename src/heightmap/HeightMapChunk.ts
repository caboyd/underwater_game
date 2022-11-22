import {vec3} from "gl-matrix";
import {BufferedGeometry, Geometry, GL, StandardAttribute} from "iwo-renderer";

export type HeightMapChunkOptions = {
    x_width: number;
    z_width: number;
    x_cells: number;
    z_cells: number;
    tex_x_cells: number;
    tex_z_cells: number;
    flip_y: boolean;
};

const DefaultHeightMapChunkOptions = {
    x_width: 20,
    z_width: 20,
    x_cells: 20,
    z_cells: 20,
    tex_x_cells: 5,
    tex_z_cells: 5,
    flip_y: false,
};

const temp_a = vec3.create();
const temp_ab = vec3.create();
const temp_ac = vec3.create();
const temp_n1 = vec3.create();
const temp_n2 = vec3.create();

export class HeightMapChunk extends Geometry {
    static indices?: Uint16Array | Uint32Array;
    static indices_flip_y?: Uint16Array | Uint32Array;

    public opt: HeightMapChunkOptions;
    constructor(
        x_offset: number,
        z_offset: number,
        height_fn: (x: number, z: number) => number,
        options?: Partial<HeightMapChunkOptions>,
    ) {
        super();
        this.opt = {...DefaultHeightMapChunkOptions, ...options};
        const x_cells = this.opt.x_cells;
        const x_cells_plus1 = x_cells + 1;
        const z_cells = this.opt.z_cells;
        //generate height data
        const verts = Array((z_cells + 1) * (x_cells + 1) * 3);
        const tex_coords = Array((z_cells + 1) * (x_cells + 1) * 2);
        const indices = [];
        const normals = Array((z_cells + 1) * (x_cells + 1) * 3).fill(0);

        let i = 0;
        for (let z0 = 0; z0 <= z_cells; ++z0) {
            const z = (z0 * this.opt.z_width) / z_cells;

            for (let x0 = 0; x0 <= x_cells; ++x0) {
                i += 1;
                const x = (x0 * this.opt.x_width) / x_cells;
                const y = height_fn(x + x_offset, z + z_offset);

                verts[z0 * x_cells_plus1 * 3 + x0 * 3 + 0] = x + x_offset;
                verts[z0 * x_cells_plus1 * 3 + x0 * 3 + 1] = y;
                verts[z0 * x_cells_plus1 * 3 + x0 * 3 + 2] = z + z_offset;

                tex_coords[z0 * x_cells_plus1 * 2 + x0 * 2 + 0] = (x * this.opt.tex_x_cells) / this.opt.x_width;
                tex_coords[z0 * x_cells_plus1 * 2 + x0 * 2 + 1] = (z * this.opt.tex_z_cells) / this.opt.z_width;

                //add 2 triangles for the last 4 verts added
                if (x0 !== 0 && z0 !== 0) {
                    const v1 = i - 2 - x_cells_plus1;
                    const v2 = i - 2;
                    const v3 = i - 1 - x_cells_plus1;
                    const v4 = i - 1;

                    if (this.opt.flip_y) {
                        if (!HeightMapChunk.indices_flip_y) {
                            //upside down, cw
                            indices.push(v1, v3, v2);
                            indices.push(v2, v3, v4);
                        }
                    } else {
                        if (!HeightMapChunk.indices) {
                            //ccw
                            indices.push(v1, v2, v3);
                            indices.push(v2, v4, v3);
                        }
                    }

                    const i1 = (i - 2 - x_cells_plus1) * 3;
                    const i2 = (i - 2) * 3;
                    const i3 = (i - 1 - x_cells_plus1) * 3;
                    const i4 = (i - 1) * 3;

                    //accumulate normals for smooth shading
                    //const a1 = vec3.fromValues(verts[i1], verts[i1 + 1], verts[i1 + 2]);
                    vec3.set(temp_a, verts[i1], verts[i1 + 1], verts[i1 + 2]);
                    // const b1 = vec3.fromValues(verts[i2], verts[i2 + 1], verts[i2 + 2]);
                    vec3.set(temp_ab, verts[i2], verts[i2 + 1], verts[i2 + 2]);
                    //const c1 = vec3.fromValues(verts[i3], verts[i3 + 1], verts[i3 + 2]);
                    vec3.set(temp_ac, verts[i3], verts[i3 + 1], verts[i3 + 2]);
                    vec3.sub(temp_ab, temp_ab, temp_a);
                    vec3.sub(temp_ac, temp_ac, temp_a);
                    vec3.cross(temp_n1, temp_ab, temp_ac);
                    if (this.opt.flip_y) vec3.negate(temp_n1, temp_n1);

                    //const a2 = vec3.fromValues(verts[i3], verts[i3 + 1], verts[i3 + 2]);
                    vec3.set(temp_a, verts[i3], verts[i3 + 1], verts[i3 + 2]);
                    //const b2 = vec3.fromValues(verts[i2], verts[i2 + 1], verts[i2 + 2]);
                    vec3.set(temp_ab, verts[i2], verts[i2 + 1], verts[i2 + 2]);
                    //const c2 = vec3.fromValues(verts[i4], verts[i4 + 1], verts[i4 + 2]);
                    vec3.set(temp_ac, verts[i4], verts[i4 + 1], verts[i4 + 2]);
                    vec3.sub(temp_ab, temp_ab, temp_a);
                    vec3.sub(temp_ac, temp_ac, temp_a);
                    vec3.cross(temp_n2, temp_ab, temp_ac);
                    if (this.opt.flip_y) vec3.negate(temp_n2, temp_n2);

                    normals[i3 + 0] += temp_n1[0];
                    normals[i3 + 1] += temp_n1[1];
                    normals[i3 + 2] += temp_n1[2];

                    normals[i3 + 0] += temp_n2[0];
                    normals[i3 + 1] += temp_n2[1];
                    normals[i3 + 2] += temp_n2[2];
                    normals[i4 + 0] += temp_n2[0];
                    normals[i4 + 1] += temp_n2[1];
                    normals[i4 + 2] += temp_n2[2];

                    if (x0 === 1) {
                        normals[i1 + 0] += temp_n1[0];
                        normals[i1 + 1] += temp_n1[1];
                        normals[i1 + 2] += temp_n1[2];
                        normals[i2 + 0] += temp_n1[0];
                        normals[i2 + 1] += temp_n1[1];
                        normals[i2 + 2] += temp_n1[2];
                        normals[i2 + 0] += temp_n2[0];
                        normals[i2 + 1] += temp_n2[1];
                        normals[i2 + 2] += temp_n2[2];
                    }
                }
            }
        }

        //normalize all normals
        for (let i = 0; i < normals.length - 2; i += 3) {
            vec3.set(temp_n1, normals[i], normals[i + 1], normals[i + 2]);
            vec3.normalize(temp_n1, temp_n1);
            normals[i] = temp_n1[0];
            normals[i + 1] = temp_n1[1];
            normals[i + 2] = temp_n1[2];
        }
        this.attributes.set(StandardAttribute.Vertex.name, new Float32Array(verts));
        this.attributes.set(StandardAttribute.Tex_Coord.name, new Float32Array(tex_coords));
        this.attributes.set(StandardAttribute.Normal.name, new Float32Array(normals));

        if (!HeightMapChunk.indices_flip_y && this.opt.flip_y)
            HeightMapChunk.indices_flip_y =
                indices.length < 65536 ? new Uint16Array(indices) : new Uint32Array(indices);
        if (!HeightMapChunk.indices && !this.opt.flip_y)
            HeightMapChunk.indices = indices.length < 65536 ? new Uint16Array(indices) : new Uint32Array(indices);

        this.indices = this.opt.flip_y ? HeightMapChunk.indices_flip_y : HeightMapChunk.indices;
    }

    getBufferedGeometry(): BufferedGeometry {
        const attr = StandardAttribute.MultiBufferApproach();

        return {
            attributes: attr,
            draw_mode: GL.TRIANGLES,
            index_buffer: {buffer: this.indices, target: GL.ELEMENT_ARRAY_BUFFER},
            buffers: [
                {buffer: this.attributes.get(StandardAttribute.Vertex.name), target: GL.ARRAY_BUFFER},
                {buffer: this.attributes.get(StandardAttribute.Tex_Coord.name), target: GL.ARRAY_BUFFER},
                {buffer: this.attributes.get(StandardAttribute.Normal.name), target: GL.ARRAY_BUFFER},
            ],
        } as BufferedGeometry;
    }
}
