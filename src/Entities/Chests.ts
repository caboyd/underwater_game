import { mat4, vec3 } from "gl-matrix";
import * as IWO from "iwo-renderer";
import { HeightMap } from "src/heightmap/HeightMap";
import { ChunkEntities } from "./ChunkEntities";

export class Chests {
    instanced_mesh!: IWO.InstancedMesh;
    radius: number = 1.5;

    private constructor() {}

    public static async Create(
        gl: WebGL2RenderingContext,
        height_map: HeightMap,
        chunked_entities: ChunkEntities,
        floor_func: (pos: vec3) => { floor: number; normal: vec3 },
        num_chests = 50
    ): Promise<Chests> {
        const c = new Chests();

        const data = await IWO.ObjLoader.promise("treasure_chest.obj", "iwo-assets/underwater_game/obj/doodads/", {
            flip_image_y: true,
        });
        const m = new IWO.Mesh(gl, data.objects[0].geometry);
        c.instanced_mesh = new IWO.InstancedMesh(m, data.materials);
        //  mat4.rotateY(c.instanced_mesh.model_matrix, c.instanced_mesh.model_matrix, Math.PI / 2);

        const [w, h] = [height_map.getWidth(), height_map.getHeight()];
        //put first chest near center
        const x = w / 2 - 9.5;
        const z = h / 2 - 9.5;
        const y = height_map.getFloorAndCeiling(x, z).floor;
        const pos = vec3.fromValues(x, y, z);

        const mat = mat4.create();
        const center = vec3.add(vec3.create(), [x, y, z], height_map.getNormalAtFloor(x, z));
        mat4.targetTo(mat, [x, y, z], center, [0, 0, 1]);
        mat4.rotateX(mat, mat, Math.PI / 2);
        chunked_entities.insert(x, z, { type: "chest", position: pos, instance: mat4.clone(mat) });

        for (let i = 0; i < num_chests - 1; i++) {
            for (let j = 0; j < 25000; j++) {
                const x = Math.random() * w;
                const z = Math.random() * h;
                const y = height_map.validFloorPosition(x, z, 1);
                if (y === false) continue;
                const { floor: floor, normal: normal } = floor_func([x, y, z]);
                mat4.identity(mat);
                //make treasure chest normal match floor
                const pos = vec3.fromValues(x, floor, z);
                const center = vec3.add(vec3.create(), pos, normal);
                mat4.targetTo(mat, pos, center, [0, 0, 1]);
                if (y === floor) mat4.rotateX(mat, mat, Math.PI / 2);
                else mat4.rotateX(mat, mat, -Math.PI / 2);
                mat4.rotateY(mat, mat, Math.PI * Math.random());
                chunked_entities.insert(x, z, { type: "chest", position: pos, instance: mat4.clone(mat) });
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
                if (e.type !== "chest") continue;
                this.instanced_mesh.addInstance(e.instance);
            }
        }
    }
}
