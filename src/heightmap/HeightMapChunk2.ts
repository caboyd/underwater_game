import {BufferedGeometry, Geometry, GL, createAttribute, Attributes} from "iwo-renderer";

export type HeightMapChunk2Options = {
    x_cells: number;
    z_cells: number;
    tex_x_cells: number;
    tex_z_cells: number;
    flip_y: boolean;
};

export const DefaultHeightMapChunk2Options = {
    x_cells: 20,
    z_cells: 20,
    tex_x_cells: 5,
    tex_z_cells: 5,
    flip_y: false,
};

export class HeightMapChunk2 extends Geometry {
    static tex_coords?: Float32Array;

    public opt: HeightMapChunk2Options;
    constructor(options?: Partial<HeightMapChunk2Options>) {
        super();
        this.opt = {...DefaultHeightMapChunk2Options, ...options};
        const x_cells = this.opt.x_cells;
        const x_cells_plus1 = x_cells + 1;
        const z_cells = this.opt.z_cells;
        //generate height data
        const components = 2;
        const verts = Array((z_cells + 1) * (x_cells + 1) * components);
        const indices = [];

        let i = 0;
        for (let z0 = 0; z0 <= z_cells; ++z0) {
            for (let x0 = 0; x0 <= x_cells; ++x0) {
                i += 1;

                verts[z0 * x_cells_plus1 * components + x0 * components + 0] = z0;
                verts[z0 * x_cells_plus1 * components + x0 * components + 1] = x0;

                //add 2 triangles for the last 4 verts added
                if (x0 !== 0 && z0 !== 0) {
                    const v1 = i - 2 - x_cells_plus1;
                    const v2 = i - 2;
                    const v3 = i - 1 - x_cells_plus1;
                    const v4 = i - 1;

                    if (!this.opt.flip_y) {
                        //upside down, cw
                        indices.push(v1, v3, v2);
                        indices.push(v2, v3, v4);
                    } else {
                        //ccw
                        indices.push(v1, v2, v3);
                        indices.push(v2, v4, v3);
                    }
                }
            }
        }

        this.attributes.set("position", new Float32Array(verts));
        //2x2 grid
        this.attributes.set("chunk_coord", new Uint16Array(8000));

        this.indices = indices.length < 65536 ? new Uint16Array(indices) : new Uint32Array(indices);
    }

    getBufferedGeometry(): BufferedGeometry {
        const attr: Attributes = {
            position: createAttribute("position", {component_count: 2, buffer_index: 0, divisor: 0, enabled: true}),
            chunk_coord: createAttribute("chunk_coord", {
                enabled: true,
                component_count: 2,
                buffer_index: 1,
                component_type: GL.UNSIGNED_SHORT,
                divisor: 1,
            }),
        };

        const result: BufferedGeometry = {
            attributes: attr,
            draw_mode: GL.TRIANGLES,
            index_buffer: {buffer: this.indices, target: GL.ELEMENT_ARRAY_BUFFER},
            buffers: [
                {buffer: this.attributes.get("position"), target: GL.ARRAY_BUFFER},
                {buffer: this.attributes.get("chunk_coord"), target: GL.ARRAY_BUFFER},
            ],
            instances: 1,
        } as BufferedGeometry;
        return result;
    }
}
