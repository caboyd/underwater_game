import { vec3 } from "gl-matrix";
import * as IWO from "iwo-renderer";

const DRAG_FACTOR = 0.2;
const ACCELERATION = 8;
const MAX_VEL = 8;
const GRAVITY = 5;
const PLAYER_SIZE = 0.75;
const temp_vel = vec3.create();

export class Player extends IWO.FPSControl {
    velocity: vec3 = vec3.create();

    constructor(camera: IWO.Camera, opt: Partial<IWO.FPSControlOptions>) {
        super(camera, opt);
    }

    update(delta_ms: number) {
        throw "dont call player update. call update2";
    }

    resetMouse() {
        this.mouse_x_total = 0;
        this.mouse_y_total = 0;
    }

    update2(
        delta_ms: number,
        floorceilnormal_func: (pos: vec3, collision_radius: number) => { floor: number; ceil: number; normal: vec3 }
    ) {
        this.processMouseMovement(delta_ms);
        this.processKeyboard2(delta_ms, floorceilnormal_func);
    }

    protected processKeyboard2(
        delta_ms: number,
        floorceilnormal_func: (pos: vec3, collision_radius: number) => { floor: number; ceil: number; normal: vec3 }
    ) {
        const delta_s = delta_ms / 1000;
        const binds = this.opt.binds;
        const accel = ACCELERATION * delta_s;
        const last_pos = vec3.clone(this.camera.position);
        let forward = this.camera.getForward();
        let right = this.camera.getRight();

        vec3.set(temp_vel, 0, 0, 0);

        //add velocity in direction
        if (this.active_keys[binds.FORWARD]) {
            if (this.active_keys[binds.SPRINT])
                vec3.scaleAndAdd(temp_vel, temp_vel, forward, accel * this.opt.forward_sprint_modifier);
            else vec3.scaleAndAdd(temp_vel, temp_vel, forward, accel);
        }
        if (this.active_keys[binds.BACKWARD]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, forward, -accel);
        }

        if (this.active_keys[binds.LEFT]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, right, -accel);
        }
        if (this.active_keys[binds.RIGHT]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, right, accel);
        }

        if (this.active_keys[binds.UP]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, this.camera.worldUp, accel);
        }
        if (this.active_keys[binds.DOWN]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, this.camera.worldUp, -accel);
        }

        //add vel to last vel
        vec3.add(this.velocity, this.velocity, temp_vel);

        //cap max vel
        // const len = vec3.len(this.velocity);
        // if (len > 0) {
        //     let scale = (delta_s * MAX_VEL) / vec3.len(this.velocity);
        //     if (this.active_keys[binds.SPRINT]) scale *= this.opt.forward_sprint_modifier;
        //     scale = Math.min(scale, 1);
        //     vec3.scale(this.velocity, this.velocity, scale);
        // }

        //apply velocity
        vec3.scale(temp_vel, this.velocity, delta_s);
        vec3.add(this.camera.position, this.camera.position, temp_vel);

        const { floor, ceil, normal } = floorceilnormal_func(this.camera.position, 0.0);
       

        //apply collision
        if (ceil - floor < PLAYER_SIZE * 2) {
            vec3.set(this.velocity, 0, 0, 0);
            vec3.copy(this.camera.position, last_pos);
        }
        if (ceil - this.camera.position[1] < PLAYER_SIZE) this.camera.position[1] = ceil - PLAYER_SIZE;
        if (this.camera.position[1] - floor < PLAYER_SIZE) {
            this.camera.position[1] = Math.min(floor + PLAYER_SIZE, this.camera.position[1] + PLAYER_SIZE);
            this.velocity[1] = Math.max(0, this.velocity[1]);
        }

        //apply drag
        const drag = Math.pow(DRAG_FACTOR, delta_s);
        vec3.scale(this.velocity, this.velocity, drag);

        //apply gravity
        this.velocity[1] -= GRAVITY * delta_s;
    }
}
