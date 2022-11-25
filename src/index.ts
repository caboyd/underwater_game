import {glMatrix, mat4, vec3} from "gl-matrix";
import * as IWO from "iwo-renderer";
import {HeightMap} from "./heightmap/HeightMap";
import {NoiseTexture} from "src/noise/NoiseTexture";
import {HeightMapChunk2} from "src/heightmap/HeightMapChunk2";
import {MeshInstance} from "iwo-renderer";
import {HeightMapMaterial} from "src/heightmap/HeightMapMaterial";
import {HeightMapShaderSource} from "src/heightmap/HeightMapShader";
import {HeightMapOptions} from "src/heightmap/HeightMap";

let canvas: HTMLCanvasElement;
let gl: WebGL2RenderingContext;
const FOV = 45 as const;

const view_matrix: mat4 = mat4.create();
const proj_matrix: mat4 = mat4.create();

const Height_Opt: HeightMapOptions = {
    z_chunks: 80,
    x_chunks: 80,
    tex_x_cells: 2,
    tex_z_cells: 2,
    x_cells: 20,
    z_cells: 20,
    chunk_width_z: 6.25,
    chunk_width_x: 6.25,
} as const;

const cPos: vec3 = vec3.fromValues((Height_Opt.x_chunks * 6.25) / 2, 5, (Height_Opt.z_chunks * 6.25) / 2);
//const cPos: vec3 = vec3.fromValues(4, 1, 4);
let camera: IWO.Camera;

let renderer: IWO.Renderer;
let fps_control: IWO.FPSControl;
let doodad_map: Map<string, IWO.MeshInstance> = new Map();
let doodads: Map<string, IWO.MeshInstance[]> = new Map();

let height_map: HeightMap;
let noise_tex: NoiseTexture;
let ceiling_chunk: IWO.MeshInstance;
let floor_chunk: IWO.MeshInstance;
let grid: IWO.MeshInstance;

let map_toggle: boolean = false;
let light_toggle: boolean = true;

await (async function () {
    canvas = document.getElementById("canvas") as HTMLCanvasElement;
    gl = IWO.initGL(canvas);

    renderer = new IWO.Renderer(gl);

    function resizeCanvas(): void {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        mat4.perspective(
            proj_matrix,
            glMatrix.toRadian(FOV),
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.1,
            1000.0,
        );
    }

    window.addEventListener("resize", resizeCanvas, false);

    resizeCanvas();

    await initScene();

    requestAnimationFrame(update);
})();

async function initScene() {
    camera = new IWO.Camera(cPos, [-0.7, 0, -0.7]);

    fps_control = new IWO.FPSControl(camera, {forward_sprint_modifier: 5});

    gl.clearColor(60 / 255, 60 / 255, 95 / 255, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    const pbrShader = renderer.getorCreateShader(IWO.ShaderSource.PBR);
    pbrShader.use();
    pbrShader.setUniform("u_light_count", 1);

    const heightShader = renderer.getorCreateShader(HeightMapShaderSource);
    heightShader.use();
    heightShader.setUniform("u_light_count", 1);

    noise_tex = new NoiseTexture(gl, Height_Opt);
    height_map = new HeightMap(gl, Height_Opt);
    height_map.material.albedo_image = await IWO.ImageLoader.promise("floor.png", "assets/models/");

    const ceiling_mat = new HeightMapMaterial({
        height_map_texture: noise_tex.texture,
        flip_y: true,
        height_map_options: Height_Opt,
        pbr_material_options: {albedo_image: height_map.material.albedo_image},
    });
    const c_chunk = new HeightMapChunk2({flip_y: true});
    const c_chunk_mesh = new IWO.Mesh(gl, c_chunk);
    ceiling_chunk = new IWO.MeshInstance(c_chunk_mesh, ceiling_mat);

    const floor_mat = new HeightMapMaterial({
        height_map_texture: noise_tex.texture,
        height_map_options: Height_Opt,
        pbr_material_options: {albedo_image: height_map.material.albedo_image},
    });

    const f_chunk = new HeightMapChunk2();
    const f_chunk_mesh = new IWO.Mesh(gl, f_chunk);
    floor_chunk = new IWO.MeshInstance(f_chunk_mesh, floor_mat);

    const grid_geom = new IWO.PlaneGeometry(100, 100);
    const grid_mat = new IWO.GridMaterial();
    const grid_mesh = new IWO.Mesh(gl, grid_geom);
    grid = new IWO.MeshInstance(grid_mesh, grid_mat);
    mat4.translate(grid.model_matrix, grid.model_matrix, [0, -0.01, 0]);

    await initDoodad("starfish_low.obj", "assets/models/", "starfish", [0.0015, 0.0015, 0.0015]);
    await initDoodad("seashell_low.obj", "assets/models/", "seashell", [0.02, 0.02, 0.02]);
    await initDoodad("plant3.obj", "assets/models/", "plant3", [2, 2, 2]);
    await initDoodad("plant6.obj", "assets/models/", "plant6", [0.6, 0.6, 0.6]);
    await initDoodad("grass.obj", "assets/models/", "grass", [0.25, 0.25, 0.25]);
    await initDoodad("pale_fan.obj", "assets/models/", "pale_fan", [0.25, 0.25, 0.25]);
    await initDoodad("dropwort_single.obj", "assets/models/", "dropwort_single", [0.25, 0.25, 0.25]);

    //generate random doodads
    const temp_translate = mat4.create();

    for (let i = 0; i < 500; i++) {
        let key = getRandomKey(doodad_map);
        const instance = doodad_map.get(key)!;
        //duplicate instance
        const dupe = new IWO.MeshInstance(instance.mesh, instance.materials);
        dupe.model_matrix = mat4.clone(instance.model_matrix);

        //place randomly in area -50xz to +50xz
        for (let j = 0; j < 25000; j++) {
            const x = Math.random() * 500;
            const z = Math.random() * 500;
            const y = height_map.validFloorPosition(x, z, 1);
            if (y === false) continue;

            const tanslate = mat4.fromTranslation(temp_translate, [x, y, z]);
            mat4.multiply(dupe.model_matrix, tanslate, dupe.model_matrix);

            const arr = doodads.get(key);
            if (!arr) doodads.set(key, [dupe]);
            else arr.push(dupe);
            break;
        }
    }

    function getRandomKey(collection: Map<string, unknown>) {
        let keys = Array.from(collection.keys());
        return keys[Math.floor(Math.random() * keys.length)];
    }

    function randomInt(min: number, max: number) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async function initDoodad(
        file_name: string,
        base_url: string,
        object_name: string,
        scale: vec3 = vec3.fromValues(1, 1, 1),
    ) {
        const obj_data = await IWO.ObjLoader.promise(file_name, base_url, {flip_image_y: true});
        const mesh = new IWO.Mesh(gl, obj_data.objects[0].buffered_geometry);
        const instance = new IWO.MeshInstance(mesh, obj_data.materials!);
        mat4.scale(instance.model_matrix, instance.model_matrix, scale);
        doodad_map.set(object_name, instance);
    }
}

function drawScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    camera.getViewMatrix(view_matrix);
    const v = view_matrix;
    const p = proj_matrix;

    renderer.setPerFrameUniforms(v, p);

    setupLights();

    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const fovx = 2 * Math.atan(aspect * Math.tan(FOV / 2));

    if (map_toggle) {
        height_map.activateMeshesInView(gl, camera.position, camera.getForward(), fovx, 10, 4);
        for (let z = 0; z < height_map.z_chunks; z++) {
            for (let x = 0; x < height_map.x_chunks; x++) {
                const c_mesh = height_map.ceiling_meshes[z][x];
                if (!c_mesh.active) continue;
                c_mesh.mesh?.render(renderer, v, p);
                height_map.floor_meshes[z][x].mesh?.render(renderer, v, p);
            }
        }
    } else {
        const chunk_coords = noise_tex.generateCellsInView(gl, camera.position, camera.getForward(), fovx, 10, 4);

        ceiling_chunk.mesh.updateBuffer(gl, 1, chunk_coords);
        ceiling_chunk.mesh.instances = chunk_coords.length / 2;
        floor_chunk.mesh.updateBuffer(gl, 1, chunk_coords);
        floor_chunk.mesh.instances = chunk_coords.length / 2;

        ceiling_chunk.render(renderer, v, p);
        floor_chunk.render(renderer, v, p);
    }

    for (const [key, value] of doodads) {
        for (const d of value) d.render(renderer, v, p);
    }
    //grid.render(renderer, v, p);
    renderer.resetSaveBindings();
}

let delta = 0;
let last_now = Date.now();

function update() {
    const new_now = Date.now();
    delta = new_now - last_now;
    last_now = new_now;
    delta = Math.min(delta, 20);

    fps_control.update();

    drawScene();
    requestAnimationFrame(update);
}

function setupLights() {
    const shaders = [
        renderer.getorCreateShader(IWO.ShaderSource.PBR),
        renderer.getorCreateShader(HeightMapShaderSource),
    ];
    if (light_toggle) {
        for (const shader of shaders) {
            const ambient_intensity = 0.01;
            const ambient_color = [
                (ambient_intensity * 0) / 255,
                (ambient_intensity * 60) / 255,
                (ambient_intensity * 95) / 255,
            ];
            const light_intensity = 20;
            const light_color = [
                (light_intensity * 254) / 255,
                (light_intensity * 238) / 255,
                (light_intensity * 224) / 255,
            ];
            shader.use();
            shader.setUniform("u_lights[0].position", [camera.position[0], camera.position[1], camera.position[2], 1]);
            shader.setUniform("u_lights[0].color", light_color);
            shader.setUniform("light_ambient", ambient_color);
        }
    } else {
        for (const shader of shaders) {
            const ambient_intensity = 0.4;
            const ambient_color = [
                (ambient_intensity * 60) / 255,
                (ambient_intensity * 60) / 255,
                (ambient_intensity * 95) / 255,
            ];
            const sun_dir = [-1, 0.8, 1];
            const sun_intensity = 6;
            const sun_color = [(sun_intensity * 254) / 255, (sun_intensity * 238) / 255, (sun_intensity * 224) / 255];
            shader.use();
            shader.setUniform("u_lights[0].position", [sun_dir[0], sun_dir[1], sun_dir[2], 0]);
            shader.setUniform("u_lights[0].color", sun_color);
            shader.setUniform("light_ambient", ambient_color);
        }
    }
}

document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "f") map_toggle = !map_toggle;
    if (e.key === "l") light_toggle = !light_toggle;
});
