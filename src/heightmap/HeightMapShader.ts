import {PBRShader, ShaderSource} from "iwo-renderer";

//NOTE: Relative import is required for rollup-plugin-node-resolve to resolve these extensions
// @ts-ignore
import heightMapVert from "./heightmap.vert";

export class HeightMapShader extends PBRShader {
    constructor(
        gl: WebGL2RenderingContext,
        vert: string = HeightMapShaderSource.vert,
        frag: string = HeightMapShaderSource.frag,
    ) {
        super(gl, vert, frag);
        this.use();
        this.setUniform("u_height_map_sampler", 9);
    }

    public use(): void {
        super.use();
    }
}

export const HeightMapShaderSource: ShaderSource = {
    name: "HeightMapShader",
    vert: heightMapVert,
    frag: ShaderSource.PBR.frag,
    subclass: HeightMapShader,
};
