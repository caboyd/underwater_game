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
        //generate height data
        const verts = [];
        const tex_coords = [];
        const indices = [];

        let i = 0;
        for (let z0 = 0; z0 < this.opt.z_cells; ++z0) {
            const z = (z0 * this.opt.z_width) / this.opt.z_cells;
            const z1 = ((z0 + 1) * this.opt.z_width) / this.opt.z_cells;

            for (let x0 = 0; x0 <= this.opt.x_cells; ++x0) {
                i += 2;
                const x = (x0 * this.opt.x_width) / this.opt.x_cells;
                const y =
                    Math.sin((x * 2 * Math.PI) / this.opt.x_cells) + Math.sin((z * 2 * Math.PI) / this.opt.z_cells);
                const y1 =
                    Math.sin((x * 2 * Math.PI) / this.opt.x_cells) + Math.sin((z1 * 2 * Math.PI) / this.opt.z_cells);

                verts.push(x, y, z);
                verts.push(x, y1, z1);

                tex_coords.push(
                    (x * this.opt.tex_x_cells) / this.opt.x_width,
                    (z * this.opt.tex_z_cells) / this.opt.z_width,
                );
                tex_coords.push(
                    (x * this.opt.tex_x_cells) / this.opt.x_width,
                    (z1 * this.opt.tex_z_cells) / this.opt.z_width,
                );

                //add 2 triangles for the last 4 verts added
                if (x0 !== 0) {
                    indices.push(i - 4, i - 3, i - 2, i - 2, i - 3, i - 1);
                }
            }
        }

        this.attributes.set(StandardAttribute.Vertex.name, new Float32Array(verts));
        this.attributes.set(StandardAttribute.Tex_Coord.name, new Float32Array(tex_coords));
        this.indices = indices.length < 65536 ? new Uint16Array(indices) : new Uint32Array(indices);
    }

    getBufferedGeometry(): BufferedGeometry {
        const attr = {
            [StandardAttribute.Vertex.name]: StandardAttribute.Vertex.createAttribute(),
            [StandardAttribute.Tex_Coord.name]: StandardAttribute.Tex_Coord.createAttribute({
                buffer_index: 1,
            }),
        };

        return {
            attributes: attr,
            draw_mode: GL.TRIANGLES,
            index_buffer: {buffer: this.indices, target: GL.ELEMENT_ARRAY_BUFFER},
            buffers: [
                {buffer: this.attributes.get(StandardAttribute.Vertex.name), target: GL.ARRAY_BUFFER},
                {buffer: this.attributes.get(StandardAttribute.Tex_Coord.name), target: GL.ARRAY_BUFFER},
            ],
        } as BufferedGeometry;
    }
}
