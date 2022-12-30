import { mat4, vec3 } from "gl-matrix";
import * as IWO from "iwo-renderer";
import { HeightMap } from "src/heightmap/HeightMap";
import { ChunkEntities } from "./ChunkEntities";

export class Rocks {
    instanced_mesh!: IWO.InstancedMesh;

    private constructor() {}

    public static async Create(
        gl: WebGL2RenderingContext,
        height_map: HeightMap,
        chunked_entities: ChunkEntities,
        count = 2000
    ): Promise<Rocks> {
        const c = new Rocks();

        const data = await IWO.ObjLoader.promise("rockB.obj", "iwo-assets/underwater_game/obj/rocks/", {
            flip_image_y: true,
        });
        const m = new IWO.Mesh(gl, data.objects[0].geometry);
        c.instanced_mesh = new IWO.InstancedMesh(m, data.materials);
        //  mat4.rotateY(c.instanced_mesh.model_matrix, c.instanced_mesh.model_matrix, Math.PI / 2);

        const [w, h] = [height_map.getWidth(), height_map.getHeight()];

        const x = w / 2;
        const z = h / 2;
        const y = height_map.getFloorAndCeiling(x, z).floor;
        const mat = mat4.create();
        const radius = 5;
        const pos = vec3.fromValues(x, y - radius * 0.6, z);

        mat4.translate(mat, mat, pos);
        mat4.scale(mat, mat, [radius, radius, radius]);
        chunked_entities.insert(x, z, { type: "rock", position: pos, instance: mat });

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

                chunked_entities.insert(x, z, { type: "rock", position: pos, instance: mat });
                break;
            }
        }
        return c;
    }

    public updateVisibleInstances(active_chunks: Uint16Array, chunked_entities: ChunkEntities): void {
        this.instanced_mesh.instance_matrix.length = 0;
        for (let i = 0; i < active_chunks.length; i += 2) {
            const x = active_chunks[i];
            const z = active_chunks[i + 1];
            const entities = chunked_entities.getChunkEntities(x, z);
            for (const e of entities) {
                if (e.type !== "rock") continue;
                this.instanced_mesh.addInstance(e.instance);
            }
        }
    }
}
