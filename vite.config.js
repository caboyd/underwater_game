// vite.config.js
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import vitePluginString from "vite-plugin-string";

export default defineConfig({
    build: {},
    base: "./", //for proper relative links
    server: {
        port: 8080,
        open: true,
    },
    resolve: {
        alias: [
            { find: "src", replacement: "/src" },
            { find: "imgui-js", replacement: "/lib/imgui-js" },
        ],
    },
    plugins: [
        vitePluginString({
            include: [`**/*.vert`, `**/*.frag`],
        }),
        viteStaticCopy({
            targets: [{ src: "iwo-assets/underwater_game/**/*", dest: "iwo-assets" }],
            flatten: false,
        }),
    ],
});
