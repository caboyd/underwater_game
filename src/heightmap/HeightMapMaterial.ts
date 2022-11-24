import {PBRMaterial, Shader, ShaderSource, Texture2D} from "iwo-renderer";

import {PBRMaterialOptions} from "iwo-renderer/dist/materials/PBRMaterial";
import {DefaultHeightMapChunk2Options, HeightMapChunk2Options} from "src/heightmap/HeightMapChunk2";
import {HeightMapShaderSource} from "./HeightMapShader";

export type HeightMapMaterialOptions = {
    height_map_texture: Texture2D;
    pbr_material_options?: Partial<PBRMaterialOptions>;
    height_map_chunk_options?: Partial<HeightMapChunk2Options>;
};

export class HeightMapMaterial extends PBRMaterial {
    public noise_texture?: Texture2D;
    public height_map_chunk_options: HeightMapChunk2Options;

    constructor(options: HeightMapMaterialOptions) {
        super(options.pbr_material_options);
        this.noise_texture = options.height_map_texture;
        this.height_map_chunk_options = {...DefaultHeightMapChunk2Options, ...options.height_map_chunk_options};
    }

    public activate(gl: WebGL2RenderingContext, shader: Shader): void {
        super.activate(gl, shader);
        this.noise_texture?.bind(gl, 9);

        shader.setUniform("is_floor", !this.height_map_chunk_options.flip_y);
        shader.setUniform("u_tex_cells", this.height_map_chunk_options.tex_x_cells);
        shader.setUniform("u_chunk_width", this.height_map_chunk_options.x_width);
        shader.setUniform("u_cells", this.height_map_chunk_options.x_cells);
    }

    get shaderSource(): ShaderSource {
        return HeightMapShaderSource;
    }
}
