import { vec3 } from "gl-matrix";
import * as IWO from "iwo-renderer";

const DRAG_FACTOR = 0.2;
const ACCEL = 8;
const MAX_VEL = 8;
const GRAVITY = 5;
const temp_vel = vec3.create();

export class Player extends IWO.FPSControl {
    velocity: vec3 = vec3.create();

    constructor(camera: IWO.Camera, opt: Partial<IWO.FPSControlOptions>) {
        super(camera, opt);
    }

    update(delta_ms: number) {
        this.processMouseMovement(delta_ms);
        this.processKeyboard(delta_ms);
    }

    protected processKeyboard(delta_ms: number) {
        const delta_s = delta_ms / 1000;
        const binds = this.opt.binds;
        const a = ACCEL * delta_s;

        let forward = this.camera.getForward();
        let right = this.camera.getRight();

        vec3.set(temp_vel, 0, 0, 0);

        //add velocity in direction
        if (this.active_keys[binds.FORWARD]) {
            if (this.active_keys[binds.SPRINT])
                vec3.scaleAndAdd(temp_vel, temp_vel, forward, a * this.opt.forward_sprint_modifier);
            else vec3.scaleAndAdd(temp_vel, temp_vel, forward, a);
        }
        if (this.active_keys[binds.BACKWARD]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, forward, -a);
        }

        if (this.active_keys[binds.LEFT]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, right, -a);
        }
        if (this.active_keys[binds.RIGHT]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, right, a);
        }

        if (this.active_keys[binds.UP]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, this.camera.worldUp, a);
        }
        if (this.active_keys[binds.DOWN]) {
            vec3.scaleAndAdd(temp_vel, temp_vel, this.camera.worldUp, -a);
        }

        //add vel to last vel
        vec3.add(this.velocity, this.velocity, temp_vel);

        //apply drag
        const drag = Math.pow(DRAG_FACTOR, delta_s);
        vec3.scale(this.velocity, this.velocity, drag);

        //apply gravity
        this.velocity[1] -= GRAVITY * delta_s;

        //cap max vel
        const len = vec3.len(this.velocity);
        if (len > 0) {
            let scale = (delta_s * MAX_VEL) / vec3.len(this.velocity);
            if (this.active_keys[binds.SPRINT]) scale *= this.opt.forward_sprint_modifier;
            scale = Math.min(scale, 1);
            vec3.scale(this.velocity, this.velocity, scale);
        }

        //apply velocity
        vec3.add(this.camera.position, this.camera.position, this.velocity);

        console.log(`speed: ${(vec3.len(this.velocity) * 1000) / delta_ms}`);
    }
}
