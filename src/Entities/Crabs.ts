import { mat4, quat, vec3 } from "gl-matrix";
import * as IWO from "iwo-renderer";
import { HeightMap } from "../heightmap/HeightMap";
import { ChunkEntities } from "./ChunkEntities";
import { InstancedChunkEntity } from "./InstancedChunkEntity";

const tmp = vec3.create();

const CRAB_SIZE = 0.4;

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

                //check if crab at position
                let crab_in_spot = false;
                const x_chunk = Math.floor((x - height_map.chunk_width_x / 2) / height_map.chunk_width_x);
                const z_chunk = Math.floor((z - height_map.chunk_width_z / 2) / height_map.chunk_width_x);
                const entities = chunked_entities.getChunkEntities(x_chunk, z_chunk);
                for (const e of entities) {
                    if (e.type !== this.type) continue;
                    const dist = vec3.sqrDist(e.position, [x, y, z]);
                    if (dist < CRAB_SIZE * CRAB_SIZE) {
                        crab_in_spot = true;
                        break;
                    }
                }
                if (crab_in_spot) continue;
                this.addCrab(chunked_entities, normal, x, y, z);
                break;
            }
        }
    }

    public addCrab(
        chunked_entities: ChunkEntities,
        normal: vec3,
        x: number,
        y: number,
        z: number,
        velocity: vec3 = vec3.fromValues(Math.random() * 2 - 1, 0, Math.random() * 2 - 1),
        forward: vec3 = vec3.fromValues(1, 0, 0)
       
    ) {
        //vec3.normalize(velocity, velocity);
        const mat = mat4.create();
        const pos = vec3.fromValues(x, y + 0.05, z);

        //push crabs out of floor
        //vec3.add(pos, pos, vec3.scale(tmp, normal, 0.04));
        //pos[1] += 0.07;

        let right = vec3.fromValues(1, 0, 0);
        if (vec3.len(velocity) !== 0) {
            
            vec3.normalize(forward, velocity);
        }
        vec3.cross(right, forward, normal);

        const target = vec3.add(tmp, pos, right);
        mat4.targetTo(mat, pos, target, normal);

        //mat4.translate(mat, mat, vec3.scale(normal, normal, 0.1));

        chunked_entities.insert(x, z, {
            type: this.type,
            position: pos,
            instance: mat,
            velocity: vec3.clone(velocity),
            forward: vec3.clone(forward),
        });
    }
}
