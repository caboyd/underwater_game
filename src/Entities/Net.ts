import { vec3, mat4 } from "gl-matrix";
import * as IWO from "iwo-renderer";
import { ChunkEntities } from "./ChunkEntities";

const DRAG_FACTOR = 0.2;
const SPEED = 10;
const GRAVITY = 5;
const NET_SIZE = 0;
const tmp = vec3.create();

class Net {
    position: vec3;
    forward: vec3;
    velocity: vec3 = vec3.create();

    constructor(pos: vec3, forward: vec3) {
        this.position = vec3.clone(pos);
        vec3.add(this.position, pos, forward);
        this.forward = vec3.clone(forward);
        vec3.scale(this.velocity, this.forward, SPEED);
    }

    update(
        delta_ms: number,
        floorceilnormal_func: (pos: vec3, collision_radius?: number) => { floor: number; ceil: number; normal: vec3 }
    ): boolean {
        const delta_s = delta_ms / 1000;

        //apply velocity
        vec3.scale(tmp, this.velocity, delta_s);
        vec3.add(this.position, this.position, tmp);

        const { floor, ceil, normal } = floorceilnormal_func(this.position);

        //apply collision
        if (ceil - floor < NET_SIZE) return false;
        if (ceil - this.position[1] < NET_SIZE) return false;
        if (this.position[1] - floor < NET_SIZE) return false;

        //apply drag
        const drag = Math.pow(DRAG_FACTOR, delta_s);
        vec3.scale(this.velocity, this.velocity, drag);

        //apply gravity
        this.velocity[1] -= GRAVITY * delta_s;

        return true;
    }

    render(mesh_instance: IWO.MeshInstance, renderer: IWO.Renderer, view: mat4, proj: mat4) {
        mat4.fromTranslation(mesh_instance.model_matrix, this.position);
        mesh_instance.render(renderer, view, proj);
    }
}

export class NetManager {
    mesh_instance: IWO.MeshInstance;
    nets: Net[] = [];

    constructor(mesh_instance: IWO.MeshInstance) {
        this.mesh_instance = mesh_instance;
    }

    addNet(pos: vec3, forward: vec3) {
        this.nets.push(new Net(pos, forward));
    }

    update(
        delta_ms: number,
        floorceilnormal_func: (pos: vec3, collision_radius?: number) => { floor: number; ceil: number; normal: vec3 }
    ) {
        for (let i = this.nets.length - 1; i >= 0; i--) {
            if (!this.nets[i].update(delta_ms, floorceilnormal_func)) {
                //delete net
                this.nets.splice(i, 1);
            }
        }
    }

    render(renderer: IWO.Renderer, view: mat4, proj: mat4) {
        for (const net of this.nets) {
            net.render(this.mesh_instance, renderer, view, proj);
        }
    }
}
