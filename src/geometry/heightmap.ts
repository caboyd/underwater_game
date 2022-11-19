import {vec3} from "gl-matrix";
import {BufferedGeometry, Geometry, GL, StandardAttribute} from "iwo-renderer";

export type HeightMapOptions = {
    x_width: number;
    z_width: number;
    x_cells: number;
    z_cells: number;
    tex_x_cells: number;
    tex_z_cells: number;
};

const DefaultHeightMapOptions = {
    x_width: 20,
    z_width: 20,
    x_cells: 20,
    z_cells: 20,
    tex_x_cells: 5,
    tex_z_cells: 5,
};

export class HeightMap extends Geometry {
    public opt: HeightMapOptions;
    constructor(options?: Partial<HeightMapOptions>) {
        super();
        this.opt = {...DefaultHeightMapOptions, ...options};
        const x_cells = this.opt.x_cells;
        const x_cells_plus1 = x_cells + 1;
        const z_cells = this.opt.z_cells;
        //generate height data
        const verts = [];
        const tex_coords = [];
        const indices = [];
        const normals = Array((z_cells + 1) * (x_cells + 1) * 3).fill(0);

        let i = 0;
        for (let z0 = 0; z0 <= z_cells; ++z0) {
            const z = (z0 * this.opt.z_width) / z_cells;

            for (let x0 = 0; x0 <= x_cells; ++x0) {
                i += 1;
                const x = (x0 * this.opt.x_width) / x_cells;
                const y = Math.sin((x * 2 * Math.PI) / x_cells) + Math.sin((z * 2 * Math.PI) / z_cells);

                verts.push(x, y, z);

                tex_coords.push(
                    (x * this.opt.tex_x_cells) / this.opt.x_width,
                    (z * this.opt.tex_z_cells) / this.opt.z_width,
                );

                //add 2 triangles for the last 4 verts added
                if (x0 !== 0 && z0 !== 0) {
                    //1,2,3
                    indices.push(i - 2 - x_cells_plus1, i - 2, i - 1 - x_cells_plus1);
                    //3,2,4
                    indices.push(i - 1 - x_cells_plus1, i - 2, i - 1);

                    const i1 = (i - 2 - x_cells_plus1) * 3;
                    const i2 = (i - 2) * 3;
                    const i3 = (i - 1 - x_cells_plus1) * 3;
                    const i4 = (i - 1) * 3;

                    //accumulate normals for smooth shading
                    const a1 = vec3.fromValues(verts[i1], verts[i1 + 1], verts[i1 + 2]);
                    const b1 = vec3.fromValues(verts[i2], verts[i2 + 1], verts[i2 + 2]);
                    const c1 = vec3.fromValues(verts[i3], verts[i3 + 1], verts[i3 + 2]);
                    const ab = vec3.sub(vec3.create(), b1, a1);
                    const ac = vec3.sub(vec3.create(), c1, a1);
                    const n1 = vec3.cross(vec3.create(), ab, ac);

                    const a2 = vec3.fromValues(verts[i3], verts[i3 + 1], verts[i3 + 2]);
                    const b2 = vec3.fromValues(verts[i2], verts[i2 + 1], verts[i2 + 2]);
                    const c2 = vec3.fromValues(verts[i4], verts[i4 + 1], verts[i4 + 2]);
                    const ab2 = vec3.sub(vec3.create(), b2, a2);
                    const ac2 = vec3.sub(vec3.create(), c2, a2);
                    const n2 = vec3.cross(vec3.create(), ab2, ac2);

                    normals[i3 + 0] += n1[0];
                    normals[i3 + 1] += n1[1];
                    normals[i3 + 2] += n1[2];

                    normals[i3 + 0] += n2[0];
                    normals[i3 + 1] += n2[1];
                    normals[i3 + 2] += n2[2];
                    normals[i4 + 0] += n2[0];
                    normals[i4 + 1] += n2[1];
                    normals[i4 + 2] += n2[2];

                    if (x0 === 1) {
                        normals[i1 + 0] += n1[0];
                        normals[i1 + 1] += n1[1];
                        normals[i1 + 2] += n1[2];
                        normals[i2 + 0] += n1[0];
                        normals[i2 + 1] += n1[1];
                        normals[i2 + 2] += n1[2];
                        normals[i2 + 0] += n2[0];
                        normals[i2 + 1] += n2[1];
                        normals[i2 + 2] += n2[2];
                    }
                }
            }
        }

        //normalize all normals
        for (let i = 0; i < normals.length - 2; i += 3) {
            const n = vec3.fromValues(normals[i], normals[i + 1], normals[i + 2]);
            vec3.normalize(n, n);
            normals[i] = n[0];
            normals[i + 1] = n[1];
            normals[i + 2] = n[2];
        }
        this.attributes.set(StandardAttribute.Vertex.name, new Float32Array(verts));
        this.attributes.set(StandardAttribute.Tex_Coord.name, new Float32Array(tex_coords));
        this.attributes.set(StandardAttribute.Normal.name, new Float32Array(normals));
        this.indices = indices.length < 65536 ? new Uint16Array(indices) : new Uint32Array(indices);
    }

    getBufferedGeometry(): BufferedGeometry {
        const attr = {
            [StandardAttribute.Vertex.name]: StandardAttribute.Vertex.createAttribute(),
            [StandardAttribute.Tex_Coord.name]: StandardAttribute.Tex_Coord.createAttribute({
                buffer_index: 1,
            }),
            [StandardAttribute.Normal.name]: StandardAttribute.Tex_Coord.createAttribute({
                buffer_index: 2,
            }),
        };

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
