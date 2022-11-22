import {glMatrix, mat4, vec3} from "gl-matrix";
import * as IWO from "iwo-renderer";
import {HeightMap} from "./heightmap/HeightMap";

let canvas: HTMLCanvasElement;
let gl: WebGL2RenderingContext;
const FOV = 45 as const;

const view_matrix: mat4 = mat4.create();
const proj_matrix: mat4 = mat4.create();

const chunks = 80;

const cPos: vec3 = vec3.fromValues((chunks * 6.25) / 2, 0, (chunks * 6.25) / 2);
let camera: IWO.Camera;

let renderer: IWO.Renderer;
let fps_control: IWO.FPSControl;
let doodad_map: Map<string, IWO.MeshInstance> = new Map();
let doodads: Map<string, IWO.MeshInstance[]> = new Map();

let height_map: HeightMap;

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
    fps_control = new IWO.FPSControl(camera);

    gl.clearColor(173 / 255, 196 / 255, 221 / 255, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    const sun_dir = [-1, 0.8, 1];
    const sun_intensity = 6;
    const sun_color = [(sun_intensity * 254) / 255, (sun_intensity * 238) / 255, (sun_intensity * 224) / 255];

    const pbrShader = renderer.getorCreateShader(IWO.ShaderSource.PBR);
    pbrShader.use();
    pbrShader.setUniform("u_lights[0].position", [sun_dir[0], sun_dir[1], sun_dir[2], 0]);
    pbrShader.setUniform("u_lights[0].color", sun_color);
    pbrShader.setUniform("u_light_count", 1);
    pbrShader.setUniform("light_ambient", [0.01, 0.01, 0.01]);

    // await initDoodad("starfish_low.obj", "assets/models/", "starfish", [0.0015, 0.0015, 0.0015]);
    // await initDoodad("seashell_low.obj", "assets/models/", "seashell", [0.02, 0.02, 0.02]);
    // await initDoodad("plant3.obj", "assets/models/", "plant3", [2, 2, 2]);
    // await initDoodad("plant6.obj", "assets/models/", "plant6", [0.6, 0.6, 0.6]);
    // await initDoodad("grass.obj", "assets/models/", "grass", [0.25, 0.25, 0.25]);
    // await initDoodad("pale_fan.obj", "assets/models/", "pale_fan", [0.25, 0.25, 0.25]);
    // await initDoodad("dropwort_single.obj", "assets/models/", "dropwort_single", [0.25, 0.25, 0.25]);

    //generate random doodads
    // for (let i = 0; i < 500; i++) {
    //     let key = getRandomKey(doodad_map);
    //     const instance = doodad_map.get(key)!;
    //     //duplicate instance
    //     const dupe = new IWO.MeshInstance(instance.mesh, instance.materials);
    //     dupe.model_matrix = mat4.clone(instance.model_matrix);

    //     //place randomly in area -50xz to +50xz
    //     const x = randomInt(0, 100);
    //     const z = randomInt(0, 100);
    //     const y = Math.sin((x * 2 * Math.PI) / x_cells) + Math.sin((z * 2 * Math.PI) / z_cells);

    //     const trans = mat4.fromTranslation(mat4.create(), [x, y, z]);
    //     mat4.multiply(dupe.model_matrix, trans, dupe.model_matrix);

    //     const arr = doodads.get(key);
    //     if (!arr) doodads.set(key, [dupe]);
    //     else arr.push(dupe);
    // }

    function getRandomKey(collection: Map<string, unknown>) {
        let keys = Array.from(collection.keys());
        return keys[Math.floor(Math.random() * keys.length)];
    }

    function randomInt(min: number, max: number) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    height_map = new HeightMap(gl, {z_chunks: chunks, x_chunks: chunks});
    height_map.material.albedo_image = await IWO.ImageLoader.promise("floor.png", "assets/models/");

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

    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const fovx = 2 * Math.atan(aspect * Math.tan(FOV / 2));
    height_map.activateMeshesInView(camera.position, camera.getForward(), fovx, 12, 4);

    for (const arr of height_map.ceiling_meshes) {
        for (const mesh of arr) if (mesh.active) mesh.mesh.render(renderer, v, p);
    }
    for (const arr of height_map.floor_meshes) {
        for (const mesh of arr) if (mesh.active) mesh.mesh.render(renderer, v, p);
    }

    // for (const [key, value] of doodads) {
    //     for (const d of value) d.render(renderer, v, p);
    // }
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
