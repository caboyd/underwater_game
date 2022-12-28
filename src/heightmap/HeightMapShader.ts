import { ShaderSource } from "iwo-renderer";

//NOTE: Relative import is required for rollup-plugin-node-resolve to resolve these extensions
// @ts-ignore
import heightMapVert from "./shader/heightmap.vert";
// @ts-ignore
import heightMapFrag from "./shader/heightmap.frag";

export const HeightMapShaderSource: ShaderSource = {
    name: "HeightMapShader",
    vert: heightMapVert,
    frag: ShaderSource.PBR.frag,
    valid_define_flags: ShaderSource.Define_Flag.SHADOWS,
    intial_uniforms: {
        ...ShaderSource.PBR.intial_uniforms,
        u_height_map_sampler: 9,
    },
};
