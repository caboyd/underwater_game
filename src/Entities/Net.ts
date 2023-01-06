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
    normal: vec3 = vec3.fromValues(0, 1, 0);
    velocity: vec3 = vec3.create();
    has_crab: boolean = false;
    crab_entity_id = -1;

    constructor(pos: vec3, forward: vec3) {
        this.position = vec3.clone(pos);
        vec3.add(this.position, pos, forward);
        this.forward = vec3.clone(forward);
        vec3.scale(this.velocity, this.forward, SPEED);
    }

    catchCrab(crab_entity_id: number, crab_pos: vec3, normal: vec3) {
        this.crab_entity_id = crab_entity_id;
        vec3.copy(this.position, crab_pos);
        vec3.copy(this.normal, normal);
        vec3.scale(this.normal, this.normal, 0.25);

        vec3.sub(this.position, this.position, this.normal);
        vec3.normalize(this.normal, this.normal);
        this.has_crab = true;
    }

    update(
        delta_ms: number,
        floorceilnormal_func: (pos: vec3, collision_radius?: number) => { floor: number; ceil: number; normal: vec3 }
    ): boolean {
        if (this.has_crab) return true;

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
        //mat4.fromTranslation(mesh_instance.model_matrix, this.position);
        const center = vec3.add(vec3.create(), this.position, this.normal);
        mat4.targetTo(mesh_instance.model_matrix, this.position, center, [0, 0, -1]);
        mat4.rotateX(mesh_instance.model_matrix, mesh_instance.model_matrix, -Math.PI / 2);
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

    removeNetWithCrab(crab_entity_id: number) {
        const id = this.nets.findIndex((v) => v.crab_entity_id === crab_entity_id);
        if (id !== -1) this.nets.splice(id, 1);
    }
}
