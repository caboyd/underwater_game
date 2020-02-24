import {glMatrix, mat4, vec3} from 'gl-matrix';
import * as IWO from 'ts-pbr-renderer/src/iwo';
// @ts-ignore
import Stats from 'stats.js';

let canvas: HTMLCanvasElement;
let gl: WebGL2RenderingContext;

const view_matrix: mat4 = mat4.create();
const proj_matrix: mat4 = mat4.create();

const cPos: vec3 = vec3.fromValues(0.5, 8, 9.0);
let camera: IWO.Camera;

let mouse_x_total = 0;
let mouse_y_total = 0;
const keys: Array<boolean> = [];

let grid: IWO.MeshInstance;
let renderer: IWO.Renderer;

document.getElementById('loading-text-wrapper')!.remove();

const moveCallback = (e: MouseEvent): void => {
    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;
    if (e.buttons == 1) {
        mouse_x_total += movementX;
        mouse_y_total += movementY;
    }
};

const initGL = (): WebGL2RenderingContext => {
    try {
        gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    } catch (e) {
        throw new Error('GL init error:\n' + e);
    }

    if (!gl) {
        alert('WebGL is not available on your browser.');
    }
    return gl;
};

const initScene = (): void => {
    const plane_geom = new IWO.PlaneGeometry(100, 100, 1, 1, true);
    const plane_mesh = new IWO.Mesh(gl, plane_geom);

    //GRID
    const grid_mat = new IWO.GridMaterial(50);
    grid = new IWO.MeshInstance(plane_mesh, grid_mat);
};

const drawScene = (): void => {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    camera.getViewMatrix(view_matrix);
    renderer.setPerFrameUniforms(view_matrix, proj_matrix);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    grid.render(renderer, view_matrix, proj_matrix);
    gl.disable(gl.BLEND);
};

const update = (): void => {
    if (keys[87]) camera.processKeyboard(IWO.Camera_Movement.FORWARD, 0.001);
    else if (keys[83]) camera.processKeyboard(IWO.Camera_Movement.BACKWARD, 0.001);
    if (keys[65]) camera.processKeyboard(IWO.Camera_Movement.LEFT, 0.001);
    else if (keys[68]) camera.processKeyboard(IWO.Camera_Movement.RIGHT, 0.001);
    if (keys[82]) camera.lookAt(vec3.fromValues(0, 0, 0));
    if (keys[32]) camera.processKeyboard(IWO.Camera_Movement.UP, 0.001);

    camera.processMouseMovement(-mouse_x_total, -mouse_y_total, true);
    mouse_x_total = 0;
    mouse_y_total = 0;

    drawScene();
    requestAnimationFrame(update);
};

(function loadWebGL(): void {
    const stats = new Stats();
    document.body.appendChild(stats.dom);
    requestAnimationFrame(function loop() {
        stats.update();
        requestAnimationFrame(loop);
    });

    canvas = document.getElementById('canvas') as HTMLCanvasElement;
    document.addEventListener('mousemove', moveCallback, false);

    gl = initGL();

    renderer = new IWO.Renderer(gl);

    function resizeCanvas(): void {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        mat4.perspective(
            proj_matrix,
            glMatrix.toRadian(90),
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.1,
            1000.0,
        );
    }

    window.addEventListener('resize', resizeCanvas, false);
    resizeCanvas();

    camera = new IWO.Camera(cPos);

    gl.clearColor(173 / 255, 196 / 255, 221 / 255, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    mat4.perspective(proj_matrix, glMatrix.toRadian(90), gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000.0);

    const sun_dir = [-0.3, 0, 1];
    const sun_intensity = 9;
    const sun_color = [(sun_intensity * 254) / 255, (sun_intensity * 238) / 255, (sun_intensity * 224) / 255];

    const pbrShader = IWO.PBRMaterial.Shader;
    pbrShader.use();
    pbrShader.setUniform('u_lights[0].position', [sun_dir[0], sun_dir[1], sun_dir[2], 0]);
    pbrShader.setUniform('u_lights[0].color', sun_color);
    pbrShader.setUniform('u_light_count', 1);

    initScene();

    requestAnimationFrame(update);
})();

window.onkeydown = function(e: KeyboardEvent): void {
    keys[e.keyCode] = true;
};

window.onkeyup = function(e: KeyboardEvent): void {
    keys[e.keyCode] = false;
};
