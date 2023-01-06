import { mat4, vec3 } from "gl-matrix";
import * as IWO from "iwo-renderer";
import { HeightMap } from "../heightmap/HeightMap";
import { ChunkEntities } from "./ChunkEntities";
import { InstancedChunkEntity } from "./InstancedChunkEntity";

const tmp = vec3.create();

export class Crabs extends InstancedChunkEntity {
    constructor(
        height_map: HeightMap,
        chunked_entities: ChunkEntities,
        floor_func: (pos: vec3) => { floor: number; normal: vec3 },
        type: string,
        instanced_mesh: IWO.InstancedMesh,
        count: number
    ) {
        super(type, instanced_mesh);

        const [w, h] = [height_map.getWidth(), height_map.getHeight()];
        const mat = mat4.create();

        const tmp = vec3.create();

        for (let i = 0; i < count; i++) {
            for (let j = 0; j < 25000; j++) {
                const x = Math.random() * w;
                const z = Math.random() * h;
                const y = height_map.validFloorPosition(x, z, 1);
                if (y === false) continue;
                const { floor, normal } = floor_func([x, y, z]);
                this.addCrab(chunked_entities, floor, normal, x, y, z);
                break;
            }
        }
    }

    public addCrab(
        chunked_entities: ChunkEntities,
        floor: number,
        normal: vec3,
        x: number,
        y: number,
        z: number,
        velocity: vec3 = vec3.fromValues(Math.random() * 2 - 1, 0, Math.random() * 2 - 1)
        //velocity: vec3 = vec3.fromValues(0.7, 0, -0.7)
    ) {
        vec3.normalize(velocity, velocity);
        const mat = mat4.create();
        const pos = vec3.fromValues(x, floor, z);
        //push crabs out of floor

        vec3.add(pos, pos, vec3.scale(tmp, normal, 0.01));
        pos[1] += 0.07;

        const right = vec3.cross(vec3.create(), velocity, normal);
        const target = vec3.add(tmp, pos, right);
        mat4.targetTo(mat, pos, target, normal);


        chunked_entities.insert(x, z, {
            type: this.type,
            position: pos,
            instance: mat,
            velocity: vec3.clone(velocity),
        });
    }
}
