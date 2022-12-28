import { glMatrix, mat4, vec3 } from "gl-matrix";
import * as ImGui from "imgui-js/imgui";
import * as ImGui_Impl from "imgui-js/imgui_impl";
import * as IWO from "iwo-renderer";
import { HeightMapOptions } from "src/heightmap/HeightMap";
import { HeightMapChunkInstanced } from "src/heightmap/HeightMapChunkInstanced";
import { HeightMapMaterial } from "src/heightmap/HeightMapMaterial";
import { HeightMapShaderSource } from "src/heightmap/HeightMapShader";
import { NoiseTexture } from "src/noise/NoiseTexture";
import { Chests } from "./chests";
import { HeightMap } from "./heightmap/HeightMap";

let gl: WebGL2RenderingContext;
const FOV = 45 as const;

const root_url = "iwo-assets/underwater_game/";
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

const cPos: vec3 = vec3.fromValues((Height_Opt.x_chunks * 6.25) / 2, -20, (Height_Opt.z_chunks * 6.25) / 2);
let camera: IWO.Camera;

let renderer: IWO.Renderer;
let fps_control: IWO.FPSControl;
let doodad_map: Map<string, IWO.InstancedMesh> = new Map();

let height_map: HeightMap;
let noise_tex: NoiseTexture;
let ceiling_chunk: IWO.MeshInstance;
let floor_chunk: IWO.MeshInstance;
let grid: IWO.MeshInstance;
let chests: Chests;

let light_toggle: boolean = true;

class Static<T> {
    constructor(public value: T) {}
    access: ImGui.Access<T> = (value: T = this.value): T => (this.value = value);
}

const game_info = {
    score: 0,
};

(async function () {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    gl = IWO.initGL(canvas);

    renderer = new IWO.Renderer(gl);

    await ImGui.default();
    ImGui.IMGUI_CHECKVERSION();
    ImGui.CreateContext();
    // // Setup style
    ImGui.StyleColorsDark();
    ImGui_Impl.Init(gl);

    function resizeCanvas(): void {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        mat4.perspective(
            proj_matrix,
            glMatrix.toRadian(FOV),
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.1,
            1000.0
        );
    }

    window.addEventListener("resize", resizeCanvas, false);

    resizeCanvas();

    await initScene();

    requestAnimationFrame(update);
})();

async function initScene() {
    camera = new IWO.Camera(cPos, [-0.7, 0, -0.7]);
    camera.getViewMatrix(view_matrix);

    fps_control = new IWO.FPSControl(camera, { forward_sprint_modifier: 5 });

    const intensity = 0.08;
    gl.clearColor(1 / 255, (55 / 255) * intensity, (75 / 255) * intensity, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    renderer.addShaderVariantUniform(IWO.ShaderSource.PBR, "u_light_count", 1);
    renderer.addShaderVariantUniform(HeightMapShaderSource, "u_light_count", 1);

    noise_tex = new NoiseTexture(gl, Height_Opt);

    height_map = new HeightMap(gl, Height_Opt);
    height_map.material.albedo_texture = IWO.TextureLoader.load(gl, "floor.png", root_url + "images/", {
        flip: true,
        format: gl.RGBA,
        internal_format: gl.SRGB8_ALPHA8,
    });

    const ceiling_mat = new HeightMapMaterial({
        height_map_texture: noise_tex.texture,
        is_ceiling: true,
        height_map_options: Height_Opt,
        pbr_material_options: { albedo_texture: height_map.material.albedo_texture },
    });
    const c_chunk = new HeightMapChunkInstanced({ flip_y: true });
    const c_chunk_mesh = new IWO.Mesh(gl, c_chunk);
    ceiling_chunk = new IWO.MeshInstance(c_chunk_mesh, ceiling_mat);

    const floor_mat = new HeightMapMaterial({
        height_map_texture: noise_tex.texture,
        height_map_options: Height_Opt,
        pbr_material_options: { albedo_texture: height_map.material.albedo_texture },
    });

    const f_chunk = new HeightMapChunkInstanced();
    const f_chunk_mesh = new IWO.Mesh(gl, f_chunk);
    floor_chunk = new IWO.MeshInstance(f_chunk_mesh, floor_mat);

    const grid_geom = new IWO.PlaneGeometry(100, 100);
    const grid_mat = new IWO.GridMaterial();
    const grid_mesh = new IWO.Mesh(gl, grid_geom);
    grid = new IWO.MeshInstance(grid_mesh, grid_mat);
    mat4.translate(grid.model_matrix, grid.model_matrix, [0, -0.01, 0]);

    chests = await Chests.Create(gl, height_map);

    const obj_url = root_url + "obj/doodads/";
    const image_url = root_url + "images/";
    await initDoodadObj("starfish_low.obj", obj_url, "starfish", [0.0015, 0.0015, 0.0015]);
    await initDoodadObj("seashell_low.obj", obj_url, "seashell", [0.02, 0.02, 0.02]);
    // await initDoodad("plant3.obj", doodad_url, "plant3", [2, 2, 2]);
    // await initDoodad("plant6.obj", doodad_url, "plant6", [0.6, 0.6, 0.6]);
    // await initDoodad("grass.obj", doodad_url, "grass", [0.25, 0.25, 0.25]);
    // await initDoodad("pale_fan.obj", doodad_url, "pale_fan", [0.25, 0.25, 0.25]);
    // await initDoodad("dropwort.obj", doodad_url, "dropwort_single", [0.25, 0.25, 0.25]);
    await initDoodadBillboard("five_plants.png", image_url, "five_plants", [1, 1, 1]);
    await initDoodadBillboard("green_algae2.png", image_url, "green_algae2", [1, 1, 1]);
    await initDoodadBillboard("kelp.png", image_url, "kelp", [1, 1, 1]);
    await initDoodadBillboard("seaweed_tall.png", image_url, "seaweed_tall", [1, 1, 1]);
    await initDoodadBillboard("seaweed_wide.png", image_url, "seaweed_wide", [1, 1, 1]);
    await initDoodadBillboard("together.png", image_url, "together", [1, 1, 1]);

    //generate random doodads
    const mat = mat4.create();
    for (let i = 0; i < 15000; i++) {
        let key = getRandomKey(doodad_map);
        const instance = doodad_map.get(key)!;

        //place randomly in area 0xz to +500xz
        for (let j = 0; j < 25000; j++) {
            const x = Math.random() * 500;
            const z = Math.random() * 500;
            const y = height_map.validFloorPosition(x, z, 1);
            if (y === false) continue;

            mat4.identity(mat);
            if (key == "starfish" || key == "seashell") {
                const center = vec3.add(vec3.create(), [x, y, z], height_map.getNormalAtFloor(x, z));
                mat4.targetTo(mat, [x, y, z], center, [0, 0, 1]);
                mat4.rotateX(mat, mat, Math.PI / 2);
            } else {
                mat4.fromTranslation(mat, [x, y, z]);
            }
            instance.addInstance(mat);
            break;
        }
    }

    function getRandomKey(collection: Map<string, unknown>) {
        let keys = Array.from(collection.keys());
        let r = Math.floor(Math.random() * keys.length);
        //to lower probability of 3d doodads
        if (r == 0 || r == 1) r = Math.floor(Math.random() * keys.length);
        if (r == 0 || r == 1) r = Math.floor(Math.random() * keys.length);
        return keys[r];
    }

    async function initDoodadObj(
        file_name: string,
        base_url: string,
        object_name: string,
        scale: vec3 = vec3.fromValues(1, 1, 1)
    ) {
        const obj_data = await IWO.ObjLoader.promise(file_name, base_url, { flip_image_y: true });
        const mesh = new IWO.Mesh(gl, obj_data.objects[0].geometry);
        const instance = new IWO.InstancedMesh(mesh, obj_data.materials!);
        mat4.scale(instance.model_matrix, instance.model_matrix, scale);
        doodad_map.set(object_name, instance);
    }

    async function initDoodadBillboard(
        file_name: string,
        base_url: string,
        object_name: string,
        scale: vec3 = vec3.fromValues(1, 1, 1)
    ) {
        const tex = await IWO.TextureLoader.load(gl, file_name, base_url, {
            flip: true,
            format: gl.RGBA,
            internal_format: gl.SRGB8_ALPHA8,
        });
        const mat = new IWO.PBRMaterial({ is_billboard: true, albedo_texture: tex, light_factor: [0.9, 0.9, 0.9] });
        const quad = new IWO.QuadGeometry();
        const mesh = new IWO.Mesh(gl, quad);
        const instance = new IWO.InstancedMesh(mesh, mat);
        mat4.scale(instance.model_matrix, instance.model_matrix, scale);
        mat4.translate(instance.model_matrix, instance.model_matrix, [0, 0.5, 0]);
        doodad_map.set(object_name, instance);
    }
}

let delta = 0;
let last_now = Date.now();

function update() {
    const new_now = Date.now();
    delta = new_now - last_now;
    last_now = new_now;
    delta = Math.min(delta, 20);

    let io = ImGui.GetIO();
    fps_control.mouse_active = !io.WantCaptureMouse;

    //update player position
    const last_pos = vec3.clone(camera.position);
    fps_control.update();
    //check if valid pos
    let { floor, ceil } = height_map.getFloorAndCeiling(camera.position[0], camera.position[2]);
    if (ceil - floor < 1.0) vec3.copy(camera.position, last_pos);
    if (ceil - camera.position[1] < 0.5) camera.position[1] = ceil - 0.5;
    if (camera.position[1] - floor < 0.5) camera.position[1] = floor + 0.5;

    drawScene();
    drawUI();
    requestAnimationFrame(update);
}

function drawScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);

    camera.getViewMatrix(view_matrix);
    const v = view_matrix;
    const p = proj_matrix;

    renderer.setPerFrameUniforms(v, p);

    setupLights();

    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const fovx = 2 * Math.atan(aspect * Math.tan(FOV / 2));

    const chunk_coords = noise_tex.generateCellsInView(gl, camera.position, camera.getForward(), fovx, 12, 4);

    ceiling_chunk.mesh.vertexBufferSubData(gl, 1, chunk_coords);
    ceiling_chunk.mesh.instances = chunk_coords.length / 2;
    floor_chunk.mesh.vertexBufferSubData(gl, 1, chunk_coords);
    floor_chunk.mesh.instances = chunk_coords.length / 2;

    ceiling_chunk.render(renderer, v, p);
    floor_chunk.render(renderer, v, p);

    chests.instanced_mesh.render(renderer, v, p);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_ALPHA, gl.DST_ALPHA);
    for (const [key, doodad] of doodad_map) {
        doodad.render(renderer, v, p);
    }

    //grid.render(renderer, v, p);
    //console.log(renderer.stats.index_draw_count, renderer.stats.vertex_draw_count);
    renderer.resetStats();
    renderer.resetSaveBindings();
}

function drawUI(): void {
    //imgui render
    ImGui_Impl.NewFrame(0);
    ImGui.NewFrame();
    const frame_width = 225;
    const frame_height = 150;
    ImGui.SetNextWindowPos(new ImGui.ImVec2(gl.drawingBufferWidth - frame_width, ImGui.Cond.Always));
    ImGui.SetNextWindowSize(new ImGui.ImVec2(frame_width, frame_height), ImGui.Cond.Always);
    ImGui.SetNextWindowSizeConstraints(
        new ImGui.ImVec2(frame_width, frame_height),
        new ImGui.ImVec2(frame_width, frame_height)
    );
    const style = ImGui.GetStyle();
    style.WindowBorderSize = 0.0;

    {
        ImGui.Begin(
            "Game Info",
            null,
            ImGui.ImGuiWindowFlags.AlwaysAutoResize |
                ImGui.ImGuiWindowFlags.NoResize |
                ImGui.ImGuiWindowFlags.NoMove |
                ImGui.ImGuiWindowFlags.NoBackground
        );
        let { x, y, z } = {
            x: camera.position[0].toFixed(2),
            y: camera.position[1].toFixed(2),
            z: camera.position[2].toFixed(2),
        };
        ImGui.PushStyleColor(ImGui.ImGuiCol.Text, new ImGui.ImColor(255, 225, 0, 255));
        ImGui.Text(`pos: ${x}, ${y}, ${z} `);
        ImGui.PopStyleColor();
        ImGui.End();
    }

    ImGui.EndFrame();
    ImGui.Render();

    ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
}

function setupLights() {
    const uniforms = new Map();
    if (light_toggle) {
        const ambient_intensity = 0.02;
        const ambient_color = [
            (ambient_intensity * 0) / 255,
            (ambient_intensity * 60) / 255,
            (ambient_intensity * 95) / 255,
        ];
        const light_intensity = 10;
        const light_color = [(light_intensity * 60) / 255, (light_intensity * 60) / 255, (light_intensity * 75) / 255];
        uniforms.set("u_lights[0].position", [camera.position[0], camera.position[1], camera.position[2], 1]);
        uniforms.set("u_lights[0].color", light_color);
        uniforms.set("light_ambient", ambient_color);
        uniforms.set("u_lights[0].linear_falloff", 0.2);
        uniforms.set("u_lights[0].squared_falloff", 0.004);
    } else {
        const ambient_intensity = 0.2;
        const ambient_color = [
            (ambient_intensity * 60) / 255,
            (ambient_intensity * 60) / 255,
            (ambient_intensity * 95) / 255,
        ];
        const sun_dir = [-1, 0.8, 1];
        const sun_intensity = 6;
        const sun_color = [(sun_intensity * 254) / 255, (sun_intensity * 238) / 255, (sun_intensity * 224) / 255];
        uniforms.set("u_lights[0].position", [sun_dir[0], sun_dir[1], sun_dir[2], 0]);
        uniforms.set("u_lights[0].color", sun_color);
        uniforms.set("light_ambient", ambient_color);
    }
    renderer.addShaderVariantUniforms(IWO.ShaderSource.PBR, uniforms);
    renderer.addShaderVariantUniforms(HeightMapShaderSource, uniforms);
}

document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "l") light_toggle = !light_toggle;
});
