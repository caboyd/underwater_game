import { mat4, vec3 } from "gl-matrix";
import * as IWO from "iwo-renderer";
import { HeightMap } from "../heightmap/HeightMap";
import { ChunkEntities } from "./ChunkEntities";
import { InstancedChunkEntity } from "./InstancedChunkEntity";

export class Doodads extends InstancedChunkEntity {
    constructor(
        height_map: HeightMap,
        chunked_entities: ChunkEntities,
        floor_func: (pos: vec3) => { floor: number; normal: vec3 },
        id: string,
        instanced_mesh: IWO.InstancedMesh,
        is_billboard: boolean,
        count: number
    ) {
        super(id, instanced_mesh);

        const [w, h] = [height_map.getWidth(), height_map.getHeight()];

        for (let i = 0; i < count; i++) {
            for (let j = 0; j < 25000; j++) {
                const x = Math.random() * w;
                const z = Math.random() * h;
                let y = height_map.validFloorPosition(x, z, 1);
                if (y === false) continue;
                let { floor: floor, normal: normal } = floor_func([x, y, z]);
                const pos = vec3.fromValues(x, floor, z);

                const mat = mat4.create();
                if (is_billboard) {
                    mat4.fromTranslation(mat, pos);
                } else {
                    const center = vec3.add(vec3.create(), pos, normal);
                    mat4.targetTo(mat, pos, center, [0, 0, 1]);
                    mat4.rotateX(mat, mat, Math.PI / 2);
                }
                chunked_entities.insert(x, z, { type: this.id, position: pos, instance: mat });
                break;
            }
        }
    }
}
