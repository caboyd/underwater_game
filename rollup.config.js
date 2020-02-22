// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import serve from 'rollup-plugin-serve';
import livereload from 'rollup-plugin-livereload';

export default {
    input: ['src/index.ts'],
    output: {
        dir: 'build',
        entryFileNames: '[name].mjs',
        format: 'esm',
    },
    extensions: ['.ts, .frag, .vert'],

    plugins: [
        typescript(),
        copy({
            targets: [{src: 'src/index.html', dest: 'build'}],
        }),
        serve('build'),
        livereload({
            watch: 'build',
        }),
    ],
};
