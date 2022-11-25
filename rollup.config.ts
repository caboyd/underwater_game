//@ts-nocheck
import copy from "rollup-plugin-copy";
import {readFileSync} from "fs-extra";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import sourceMaps from "rollup-plugin-sourcemaps";
import glslify from "rollup-plugin-glslify";
import html from "@rollup/plugin-html";

//Note: Do not use @rollup/plugin-typescript
// Breaks when:
//  - importing anything not relative (file vs ./file)
//  - compiled js files do not exist in the src directory
import typescript from "rollup-plugin-typescript2";

const template = readFileSync("src/index.html", "utf-8");

const output_dir = "docs";
const output_name = "underwater_game";

export default {
    //NOTE: Enable node_modules and src imports to keep in original files and location
    preserveModules: true,
    input: "src/index.ts",
    output: {
        // file: `${output_name}.js`,
        dir: output_dir,
        format: "es",
        sourcemap: true,
    },
    plugins: [
        //NOTE: Breaks when:
        //  - Using subst on windows to shortcut directories
        nodeResolve(),
        typescript(),
        html({
            fileName: `index.html`,
            template: ({attributes, bundle, files, publicPath, title}) => {
                const html = template.replace("</body>", `<script type="module" src="./src/index.js"></script></body>`);
                return html;
            },
        }),
        glslify({
            //compress removes spaces and new line breaks after keywords like 'else' breaking shaders without braces
            compress: false,
        }),
        copy({
            targets: [
                {src: "./iwo-assets/underwater_game/**/*", dest: output_dir},
                {src: ".nojekyll", dest: output_dir},
            ],
            // set flatten to false to preserve folder structure
            flatten: false,
        }),
        sourceMaps(),
    ],
};
