import { glMatrix, mat4, vec3 } from "gl-matrix";
import * as ImGui from "imgui-js/imgui";
import * as ImGui_Impl from "imgui-js/imgui_impl";
import * as IWO from "iwo-renderer";
import { ChunkEntities } from "src/Entities/ChunkEntities";
import { Crabs } from "src/Entities/Crabs";
import { Doodads } from "src/Entities/Doodads";
import { Rocks } from "src/Entities/Rocks";
import { HeightMapOptions } from "src/heightmap/HeightMap";
import { HeightMapChunkInstanced, HeightMapChunkInstancedOptions } from "src/heightmap/HeightMapChunkInstanced";
import { HeightMapMaterial } from "src/heightmap/HeightMapMaterial";
import { HeightMapShaderSource } from "src/heightmap/HeightMapShader";
import { NoiseTexture } from "src/noise/NoiseTexture";
import { Chests } from "./Entities/Chests";
import { HeightMap } from "./heightmap/HeightMap";
import { Player } from "./Player";
import { RollingAverage } from "./RollingAverage";

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
const PLAYER_SIZE = 0.5;

let renderer: IWO.Renderer;
let player: Player;

let height_map: HeightMap;
let noise_tex: NoiseTexture;
let ceiling_chunk: IWO.MeshInstance;
let floor_chunk: IWO.MeshInstance;
let grid: IWO.MeshInstance;
let chests: Chests;
let crabs: Crabs;
let rocks_array: Rocks[] = [];
let doodads_array: Doodads[] = [];
let chunk_entities: ChunkEntities;
let rolling_delta = new RollingAverage(20);
let light_toggle = true;

let physics_delta = 0;
const UPDATE_RATE = 1000 / 60;
let last_now = performance.now();
let last_chunks: Uint16Array = new Uint16Array();

class Static<T> {
    constructor(public value: T) {}
    access: ImGui.Access<T> = (value: T = this.value): T => (this.value = value);
}

const gui = {
    show_frame_info: new Static<boolean>(true),
    show_game_info: new Static<boolean>(true),
    show_help_info: new Static<boolean>(false),
};

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

    last_now = performance.now();
    requestAnimationFrame(requestUpdate);
})();

async function initScene() {
    camera = new IWO.Camera(cPos, [-0.7, 0, -0.7]);
    camera.getViewMatrix(view_matrix);

    player = new Player(camera, { forward_sprint_modifier: 2.2 });

    const intensity = 0.08;
    gl.clearColor(1 / 255, (55 / 255) * intensity, (75 / 255) * intensity, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    renderer.addShaderVariantUniform(IWO.ShaderSource.PBR, "u_light_count", 1);
    renderer.addShaderVariantUniform(HeightMapShaderSource, "u_light_count", 1);

    noise_tex = new NoiseTexture(gl, Height_Opt);

    height_map = new HeightMap(Height_Opt);
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

    const chunk_opt: Partial<HeightMapChunkInstancedOptions> = {
        x_cells: Height_Opt.x_cells,
        z_cells: Height_Opt.z_cells,
        tex_x_cells: Height_Opt.tex_x_cells,
        tex_z_cells: Height_Opt.tex_z_cells,
    };

    const c_chunk = new HeightMapChunkInstanced({ ...chunk_opt, flip_y: true });
    const c_chunk_mesh = new IWO.Mesh(gl, c_chunk);
    ceiling_chunk = new IWO.MeshInstance(c_chunk_mesh, ceiling_mat);

    const floor_mat = new HeightMapMaterial({
        height_map_texture: noise_tex.texture,
        height_map_options: Height_Opt,
        pbr_material_options: { albedo_texture: height_map.material.albedo_texture },
    });

    const f_chunk = new HeightMapChunkInstanced(chunk_opt);
    const f_chunk_mesh = new IWO.Mesh(gl, f_chunk);
    floor_chunk = new IWO.MeshInstance(f_chunk_mesh, floor_mat);

    const grid_geom = new IWO.PlaneGeometry(100, 100);
    const grid_mat = new IWO.GridMaterial();
    const grid_mesh = new IWO.Mesh(gl, grid_geom);
    grid = new IWO.MeshInstance(grid_mesh, grid_mat);
    mat4.translate(grid.model_matrix, grid.model_matrix, [0, -0.01, 0]);

    chunk_entities = new ChunkEntities(Height_Opt);

    const rocks = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"];
    await Promise.all(
        rocks.map((letter) =>
            initRocks(
                `rock${letter}.obj`,
                "iwo-assets/underwater_game/obj/rocks/",
                `rock_${letter}`,
                2000 / rocks.length
            )
        )
    );

    //NOTE: must do after rocks
    chests = await Chests.Create(gl, height_map, chunk_entities, getFloorCeilNormalWithRocks);

    crabs = new Crabs(
        height_map,
        chunk_entities,
        getFloorCeilNormalWithRocks,
        "crab",
        await objInstancedMesh("crab.obj", "iwo-assets/underwater_game/obj/doodads/", [0, 0.02, 0], [0.06, 0.06, 0.06]),
        2000
    );

    const obj_url = root_url + "obj/doodads/";
    const image_url = root_url + "images/";
    const doodad_count_3d = 200;
    const doodad_count_billboard = Math.floor(25000 / 6);

    await initDoodadObj(
        "starfish_low.obj",
        obj_url,
        "starfish_3d",
        doodad_count_3d,
        [0.0015, 0.0015, 0.0015],
        [0, -0.005, 0]
    );
    await initDoodadObj("seashell_low.obj", obj_url, "seashell_3d", doodad_count_3d, [0.02, 0.02, 0.02], [0, 0.005, 0]);
    await initDoodadObj("urchin.obj", obj_url, "urchin_3d", doodad_count_3d, [0.02, 0.02, 0.02], [0, 0.05, 0]);
    // await initDoodadObj("plant3.obj", obj_url, "plant3", doodad_count_3d, [2, 2, 2]);
    // await initDoodadObj("plant6.obj", obj_url, "plant6", doodad_count_3d, [0.6, 0.6, 0.6]);
    // await initDoodadObj("grass.obj", obj_url, "grass", doodad_count_3d, [0.25, 0.25, 0.25]);
    // await initDoodadObj("pale_fan.obj", obj_url, "pale_fan", doodad_count_3d, [0.25, 0.25, 0.25]);
    // await initDoodadObj("dropwort.obj", obj_url, "dropwort_single", doodad_count_3d, [0.25, 0.25, 0.25]);
    await initDoodadBillboard("five_plants.png", image_url, "five_plants", doodad_count_billboard, [1, 1, 1]);
    await initDoodadBillboard("green_algae2.png", image_url, "green_algae2", doodad_count_billboard, [1, 1, 1]);
    await initDoodadBillboard("kelp.png", image_url, "kelp", doodad_count_billboard, [1, 1, 1]);
    await initDoodadBillboard("seaweed_tall.png", image_url, "seaweed_tall", doodad_count_billboard, [1, 1, 1]);
    await initDoodadBillboard("seaweed_wide.png", image_url, "seaweed_wide", doodad_count_billboard, [1, 1, 1]);
    await initDoodadBillboard("together.png", image_url, "together", doodad_count_billboard, [1, 1, 1]);

    async function objInstancedMesh(file_name: string, base_url: string, translate?: vec3, scale?: vec3) {
        const data = await IWO.ObjLoader.promise(file_name, base_url, {
            flip_image_y: true,
        });
        const m = new IWO.Mesh(gl, data.objects[0].geometry);
        const im = new IWO.InstancedMesh(m, data.materials);
        if (translate) mat4.translate(im.model_matrix, im.model_matrix, translate);
        if (scale) mat4.scale(im.model_matrix, im.model_matrix, scale);
        return im;
    }

    async function initRocks(file_name: string, base_url: string, object_name: string, count: number) {
        const im = await objInstancedMesh(file_name, base_url);
        rocks_array.push(new Rocks(height_map, chunk_entities, object_name, im, count));
    }

    async function initDoodadObj(
        file_name: string,
        base_url: string,
        object_name: string,
        count: number,
        scale: vec3 = vec3.fromValues(1, 1, 1),
        offset: vec3 = vec3.create()
    ) {
        const instance = await objInstancedMesh(file_name, base_url, offset, scale);
        doodads_array.push(
            new Doodads(height_map, chunk_entities, getFloorCeilNormalWithRocks, object_name, instance, false, count)
        );
    }

    async function initDoodadBillboard(
        file_name: string,
        base_url: string,
        object_name: string,
        count: number,
        scale: vec3 = vec3.fromValues(1, 1, 1)
    ) {
        const tex = IWO.TextureLoader.load(gl, file_name, base_url, {
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
        doodads_array.push(
            new Doodads(height_map, chunk_entities, getFloorCeilNormalWithRocks, object_name, instance, true, count)
        );
    }
}

function requestUpdate() {
    const now = performance.now();
    let delta = now - last_now;
    last_now = now;
    delta = Math.min(delta, 250);
    physics_delta += delta;
    if (physics_delta - UPDATE_RATE > 0) {
        do {
            update(UPDATE_RATE);
            physics_delta -= UPDATE_RATE;
        } while (physics_delta - UPDATE_RATE > 0);
    }
    rolling_delta.add(delta);

    updateVisibleChunks();
    drawScene();
    drawUI();

    requestAnimationFrame(requestUpdate);
}

function update(delta_ms: number) {
    let io = ImGui.GetIO();
    player.mouse_active = !io.WantCaptureMouse;

    setupLights();

    let ceil = height_map.getFloorAndCeiling(camera.position[0], camera.position[2]).ceil;
    let floor = getFloorCeilNormalWithRocks(camera.position).floor;

    //update player

    player.update2(delta_ms, getFloorCeilNormalWithRocks);

    //find the 4 chunks surrounding player
    const active_chunks = getSurroundingChunks(camera.position);
    const player_pos = vec3.clone(camera.position);
    for (const chunk of active_chunks) {
        const entities = chunk_entities.getChunkEntities(chunk[0], chunk[1]);
        for (const e of entities) {
            if (e.type !== "chest") continue;
            const chest_pos = e.position;
            const dist = vec3.squaredDistance(player_pos, chest_pos);
            if (dist < PLAYER_SIZE + chests.radius * PLAYER_SIZE + chests.radius) {
                chunk_entities.remove(e.id);
                game_info.score += 100;
            }
        }
    }
}

function updateVisibleChunks() {
    const cam_forward = camera.getForward();
    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const fovx = 2 * Math.atan(aspect * Math.tan(FOV / 2));

    //get angle between (0,-1,0) and camera
    let down_angle = Math.max(vec3.angle(cam_forward, [0, 1, 0]), vec3.angle(cam_forward, [0, -1, 0])) / Math.PI;
    //map from 0 to 1
    down_angle = down_angle * 2 - 1;
    const max_cells_radius = 8;
    //increase nearby cell radius when looking up/down so we dont see empty cells
    const cell_radius = Math.ceil(down_angle * (max_cells_radius - 2) + (max_cells_radius - 6));

    const max_cells_range = 14;
    //cell range increased when looking orthogonal to up/down
    const cell_range = Math.ceil(Math.pow(1.0 - down_angle, 1 / 3) * max_cells_range);

    const chunk_coords = noise_tex.generateCellsInView(gl, camera.position, cam_forward, fovx, cell_range, cell_radius);

    if (!arraysEqual(chunk_coords, last_chunks)) {
        ceiling_chunk.mesh.vertexBufferSubData(gl, 1, chunk_coords);
        ceiling_chunk.mesh.instances = chunk_coords.length / 2;
        floor_chunk.mesh.vertexBufferSubData(gl, 1, chunk_coords);
        floor_chunk.mesh.instances = chunk_coords.length / 2;

        chests.updateVisibleInstances(chunk_coords, chunk_entities);
        crabs.updateVisibleInstances(chunk_coords, chunk_entities);
        for (const rocks of rocks_array) rocks.updateVisibleInstances(chunk_coords, chunk_entities);
        for (const doodads of doodads_array) {
            if (doodads.id.includes("3d")) doodads.updateVisibleInstances(chunk_coords, chunk_entities);
        }

        last_chunks = new Uint16Array(chunk_coords);
    }
}

function drawScene() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);

    camera.getViewMatrix(view_matrix);
    const v = view_matrix;
    const p = proj_matrix;

    renderer.setPerFrameUniforms(v, p);

    ceiling_chunk.render(renderer, v, p);
    floor_chunk.render(renderer, v, p);

    chests.instanced_mesh.render(renderer, v, p);
    crabs.instanced_mesh.render(renderer, v, p);
    for (const rocks of rocks_array) rocks.instanced_mesh.render(renderer, v, p);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.SRC_ALPHA, gl.DST_ALPHA);
    for (const doodads of doodads_array) {
        doodads.instanced_mesh.render(renderer, v, p);
    }

    //grid.render(renderer, v, p);
    //console.log(renderer.stats.index_draw_count, renderer.stats.vertex_draw_count);
    renderer.resetStats();
    renderer.resetSaveBindings();
}

let backup_gl_state: ImGui_Impl.GLBackupState | undefined = undefined;

function drawUI(): void {
    const window_flags =
        ImGui.ImGuiWindowFlags.AlwaysAutoResize |
        ImGui.ImGuiWindowFlags.NoResize |
        ImGui.ImGuiWindowFlags.NoMove |
        ImGui.ImGuiWindowFlags.NoBackground;
    const style = ImGui.GetStyle();
    style.WindowBorderSize = 0.0;

    //imgui render
    ImGui_Impl.NewFrame(0);
    ImGui.NewFrame();
    {
        const frame_width = 200;
        ImGui.SetNextWindowPos(new ImGui.ImVec2(0, 0), ImGui.Cond.Always);
        ImGui.SetNextWindowSize(new ImGui.ImVec2(0, 0), ImGui.Cond.Always);
        ImGui.Begin("Menu Window", null, window_flags | ImGui.WindowFlags.MenuBar | ImGui.WindowFlags.NoTitleBar);

        if (ImGui.BeginMenuBar()) {
            if (ImGui.BeginMenu("Menu", true)) {
                ImGui.MenuItem("Frame Info", null, gui.show_frame_info.access);
                ImGui.MenuItem("Game Info", null, gui.show_game_info.access);
                ImGui.MenuItem("How To Play", null, gui.show_help_info.access);
                ImGui.EndMenu();
            }
            ImGui.EndMenuBar();
        }

        ImGui.End();
    }

    if (gui.show_game_info.value) {
        const frame_width = 225;
        ImGui.SetNextWindowPos(new ImGui.ImVec2(gl.drawingBufferWidth - frame_width, 0), ImGui.Cond.Always);
        ImGui.SetNextWindowSize(new ImGui.ImVec2(frame_width, 0), ImGui.Cond.Always);

        {
            ImGui.Begin("Game Info", null, window_flags);
            let { x, y, z } = {
                x: camera.position[0].toFixed(2),
                y: camera.position[1].toFixed(2),
                z: camera.position[2].toFixed(2),
            };
            ImGui.PushStyleColor(ImGui.ImGuiCol.Text, new ImGui.ImColor(255, 225, 0, 255));
            ImGui.Text(`Pos: ${x}, ${y}, ${z} `);
            ImGui.Text(`Score: ${game_info.score} `);
            ImGui.PopStyleColor();
            ImGui.End();
        }
    }
    if (gui.show_frame_info.value) {
        ImGui.SetNextWindowPos(new ImGui.ImVec2(0, 18), ImGui.Cond.Always);
        {
            ImGui.Begin("Frame Info", null, window_flags | ImGui.WindowFlags.NoTitleBar);
            ImGui.PushStyleColor(ImGui.ImGuiCol.Text, new ImGui.ImColor(255, 225, 0, 255));

            let fps_text = `FPS ${Math.round(1000 / rolling_delta.avg())}`;

            fps_text = fps_text.padEnd(9, " ");
            fps_text += `${rolling_delta.avg().toFixed(2)}ms`;
            ImGui.Text(fps_text);
            ImGui.Text(`Updates/s: ${Math.round(1000 / UPDATE_RATE)}`);
            ImGui.PopStyleColor();
            ImGui.End();
        }
    }
    if (gui.show_help_info.value) {
        const main_viewport = ImGui.GetMainViewport();
        const frame_width = 350;
        ImGui.SetNextWindowPos(
            new ImGui.ImVec2(
                main_viewport.GetCenter().x - frame_width / 2,
                main_viewport.GetCenter().y - frame_width / 2
            ),
            ImGui.Cond.FirstUseEver
        );
        ImGui.SetNextWindowSize(new ImGui.ImVec2(frame_width, frame_width), ImGui.Cond.FirstUseEver);
        {
            ImGui.Begin("How To Play", gui.show_help_info.access, ImGui.WindowFlags.AlwaysAutoResize);

            ImGui.TextWrapped("Move around and collect treasture chests to increase the score.");
            ImGui.Separator();
            ImGui.Text("Controls");
            {
                ImGui.Indent(5);
                if (ImGui.BeginTable("Controls Table", 2, ImGui.TableFlags.BordersInner | ImGui.TableFlags.Borders)) {
                    TableRowTwoColumn("Look Around", "Hold Left Click");
                    TableRowTwoColumn("Strafe Left", "A");
                    TableRowTwoColumn("Strafe Right", "D");
                    TableRowTwoColumn("Forward", "W");
                    TableRowTwoColumn("Backwards", "S");
                    TableRowTwoColumn("Float Up", "Space Bar");
                    TableRowTwoColumn("Speed Boost Modifier", "Shift");
                    ImGui.EndTable();
                }
                ImGui.Unindent(5);
            }

            ImGui.End();
        }
    }
    ImGui.EndFrame();
    ImGui.Render();

    if (backup_gl_state === undefined) backup_gl_state = ImGui_Impl.GetBackupGLState();
    ImGui_Impl.RenderDrawData(ImGui.GetDrawData(), backup_gl_state);

    function TableRowTwoColumn(text1: string, text2: string) {
        ImGui.TableNextRow();
        ImGui.TableSetColumnIndex(0);
        ImGui.Text(text1);
        ImGui.TableSetColumnIndex(1);
        ImGui.Text(text2);
    }
}

const light_uniforms = new Map();
function setupLights() {
    if (light_toggle) {
        const ambient_intensity = 0.02;
        const ambient_color = [
            (ambient_intensity * 0) / 255,
            (ambient_intensity * 60) / 255,
            (ambient_intensity * 95) / 255,
        ];
        const light_intensity = 10;
        const light_color = [(light_intensity * 60) / 255, (light_intensity * 60) / 255, (light_intensity * 75) / 255];
        light_uniforms.set("u_lights[0].position", [camera.position[0], camera.position[1], camera.position[2], 1]);
        light_uniforms.set("u_lights[0].color", light_color);
        light_uniforms.set("light_ambient", ambient_color);
        light_uniforms.set("u_lights[0].linear_falloff", 0.2);
        light_uniforms.set("u_lights[0].squared_falloff", 0.004);
    } else {
        const ambient_intensity = 0.4;
        const ambient_color = [
            (ambient_intensity * 60) / 255,
            (ambient_intensity * 60) / 255,
            (ambient_intensity * 95) / 255,
        ];
        const sun_dir = [-1, 0.8, 1];
        const sun_intensity = 2;
        const sun_color = [(sun_intensity * 254) / 255, (sun_intensity * 238) / 255, (sun_intensity * 224) / 255];
        light_uniforms.set("u_lights[0].position", [sun_dir[0], sun_dir[1], sun_dir[2], 0]);
        light_uniforms.set("u_lights[0].color", sun_color);
        light_uniforms.set("light_ambient", ambient_color);
    }
    renderer.addShaderVariantUniforms(IWO.ShaderSource.PBR, light_uniforms);
    renderer.addShaderVariantUniforms(HeightMapShaderSource, light_uniforms);
}

document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "l") light_toggle = !light_toggle;
});

function getSurroundingChunks(pos: vec3): [number, number][] {
    const result: [number, number][] = [];

    const x0 = Math.floor((pos[0] - Height_Opt.chunk_width_x / 2) / Height_Opt.chunk_width_x);
    const z0 = Math.floor((pos[2] - Height_Opt.chunk_width_z / 2) / Height_Opt.chunk_width_x);
    const x1 = Math.floor((pos[0] + Height_Opt.chunk_width_x / 2) / Height_Opt.chunk_width_x);
    const z1 = Math.floor((pos[2] + Height_Opt.chunk_width_z / 2) / Height_Opt.chunk_width_x);
    //assert in bounds
    if (x0 < Height_Opt.x_chunks && x0 >= 0) {
        //bottom left
        if (z0 < Height_Opt.z_chunks && z0 >= 0) result.push([x0, z0]);
        //top left
        if (z1 < Height_Opt.z_chunks && z1 >= 0) result.push([x0, z1]);
    }
    if (x1 < Height_Opt.x_chunks && x1 >= 0) {
        //bottom right
        if (z0 < Height_Opt.z_chunks && z0 >= 0) result.push([x1, z0]);
        //top right
        if (z1 < Height_Opt.z_chunks && z1 >= 0) result.push([x1, z1]);
    }

    return result;
}

function getFloorCeilNormalWithRocks(
    pos: vec3,
    collision_radius: number = 0
): { floor: number; ceil: number; normal: vec3 } {
    const surrounding_chunks = getSurroundingChunks(pos);
    let { floor: best_floor, ceil } = height_map.getFloorAndCeiling(pos[0], pos[2]);
    let best_normal = height_map.getNormalAtFloor(pos[0], pos[2]);
    const floor_pos = vec3.fromValues(pos[0], best_floor, pos[2]);
    const dir = vec3.create();
    for (const chunk of surrounding_chunks) {
        const entities = chunk_entities.getChunkEntities(chunk[0], chunk[1]);

        for (const e of entities) {
            if (!e.type.includes("rock")) continue;
            if (!e.radius) throw "missing radius on rock";

            //check intersection with pos at floor level;
            const dist = vec3.dist(floor_pos, e.position);

            const r = e.radius + collision_radius; //to prevent objects/camera going inside
            if (dist < r) {
                //equation of the sphere is x2 + y2 + z2 = r2

                //floor_pos relative to sphere center
                vec3.sub(dir, floor_pos, e.position);

                //solve upper hemisphere y in equation for sphere at floor_pos inside sphere
                dir[1] = Math.sqrt(r * r - dir[0] * dir[0] - dir[2] * dir[2]);
                let floor = dir[1] + e.position[1];

                if (floor > best_floor) {
                    vec3.normalize(best_normal, dir);
                    best_floor = floor;
                }
            }
        }
    }
    return { floor: best_floor, ceil: ceil, normal: best_normal };
}

function arraysEqual(a: IWO.TypedArray | unknown[], b: IWO.TypedArray | unknown[]) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}
