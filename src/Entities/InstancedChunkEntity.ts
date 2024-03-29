import { mat4 } from "gl-matrix";
import * as IWO from "iwo-renderer";
import { ChunkEntities } from "./ChunkEntities";

export class InstancedChunkEntity {
    instanced_mesh: IWO.InstancedMesh;
    type: string;

    constructor(id: string, instanced_mesh: IWO.InstancedMesh) {
        this.type = id;
        this.instanced_mesh = instanced_mesh;
    }

    public updateVisibleInstances(active_chunks: Uint16Array, chunk_entities: ChunkEntities): void {
        const len = this.instanced_mesh.instance_matrix.length;
        let index = 0;

        for (let i = 0; i < active_chunks.length; i += 2) {
            const x = active_chunks[i];
            const z = active_chunks[i + 1];
            const entities = chunk_entities.getChunkEntities(x, z);
            for (const e of entities) {
                if (!e.type.includes(this.type)) continue;

                //reuse existing instances
                if (index < len) {
                    mat4.copy(this.instanced_mesh.instance_matrix[index], e.instance);
                } else {
                    this.instanced_mesh.addInstance(e.instance);
                }

                index++;
            }
        }
        this.instanced_mesh.refreshBuffer();
        this.instanced_mesh.instance_matrix.length = index;
    }
}
