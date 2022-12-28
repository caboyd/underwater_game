import { PBRMaterial, Shader, ShaderSource, Texture2D } from "iwo-renderer";

import { PBRMaterialOptions } from "iwo-renderer/dist/materials/PBRMaterial";
import { DefaultHeightMapOptions, HeightMapOptions } from "src/heightmap/HeightMap";
import { HeightMapShaderSource } from "./HeightMapShader";

export type HeightMapMaterialOptions = {
    height_map_texture: Texture2D;
    pbr_material_options?: Partial<PBRMaterialOptions>;
    height_map_options?: Partial<HeightMapOptions>;
    is_ceiling?: boolean;
};

export class HeightMapMaterial extends PBRMaterial {
    public height_map_texture?: Texture2D;
    public is_ceiling: boolean;
    height_map_options: HeightMapOptions;

    constructor(options: HeightMapMaterialOptions) {
        super(options.pbr_material_options);
        this.height_map_texture = options.height_map_texture;
        this.is_ceiling = options.is_ceiling ?? false;
        this.height_map_options = { ...DefaultHeightMapOptions, ...options.height_map_options };
    }

    public activate(gl: WebGL2RenderingContext, shader: Shader): void {
        super.activate(gl, shader);
        this.height_map_texture?.bind(gl, 9);

        shader.setUniform("is_ceiling", this.is_ceiling);
        shader.setUniform("u_tex_cells", this.height_map_options.tex_x_cells);
        shader.setUniform("u_chunk_width", this.height_map_options.chunk_width_x);
        shader.setUniform("u_cells", this.height_map_options.x_cells);
        shader.setUniform("u_chunks", this.height_map_options.x_chunks);
    }

    get shaderSource(): ShaderSource {
        return HeightMapShaderSource;
    }
}
