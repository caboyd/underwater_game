import { mat4, vec3 } from "gl-matrix";
import * as IWO from "iwo-renderer";
import { HeightMap } from "../heightmap/HeightMap";
import { ChunkEntities } from "./ChunkEntities";
import { InstancedChunkEntity } from "./InstancedChunkEntity";

export class Rocks extends InstancedChunkEntity {
    constructor(
        height_map: HeightMap,
        chunked_entities: ChunkEntities,
        id: string,
        instanced_mesh: IWO.InstancedMesh,
        count = 2000
    ) {
        super(id, instanced_mesh);

        const [w, h] = [height_map.getWidth(), height_map.getHeight()];

        const x = w / 2;
        const z = h / 2;
        const y = height_map.getFloorAndCeiling(x, z).floor;
        const mat = mat4.create();
        const radius = 5;
        const pos = vec3.fromValues(x, y - radius * 0.6, z);

        mat4.translate(mat, mat, pos);
        mat4.scale(mat, mat, [radius, radius, radius]);
        chunked_entities.insert(x, z, { type: this.type, position: pos, instance: mat, radius: radius });

        for (let i = 0; i < count - 1; i++) {
            for (let j = 0; j < 25000; j++) {
                const x = Math.random() * w;
                const z = Math.random() * h;
                const y = height_map.validFloorPosition(x, z, 1);
                if (y === false) continue;
                const mat = mat4.create();
                const radius = Math.random() * 3 + 2; //2 to 5
                const pos = vec3.fromValues(x, y - radius * 0.6, z);
                mat4.translate(mat, mat, pos);
                mat4.scale(mat, mat, [radius, radius, radius]);
                mat4.rotateX(mat, mat, Math.PI * Math.random());
                mat4.rotateY(mat, mat, Math.PI * Math.random());

                chunked_entities.insert(x, z, { type: this.type, position: pos, instance: mat, radius: radius });
                break;
            }
        }
    }
}
