import * as IWO from "iwo-renderer";
import { mat3, mat4, vec3 } from "gl-matrix";
import { HeightMap } from "src/heightmap/HeightMap";

export class Chests {
    instanced_mesh!: IWO.InstancedMesh;
    positions: vec3[] = [];
    radius: number = 0.4;

    private constructor() {}

    public static async Create(gl: WebGL2RenderingContext, height_map: HeightMap, num_chests = 50): Promise<Chests> {
        const c = new Chests();

        const data = await IWO.ObjLoader.promise("treasure_chest.obj", "iwo-assets/underwater_game/obj/doodads/", {
            flip_image_y: true,
        });
        const m = new IWO.Mesh(gl, data.objects[0].geometry);
        c.instanced_mesh = new IWO.InstancedMesh(m, data.materials);
        //  mat4.rotateY(c.instanced_mesh.model_matrix, c.instanced_mesh.model_matrix, Math.PI / 2);

        const [w, h] = [height_map.getWidth(), height_map.getHeight()];
        //put first chest near center
        const x = w / 2 + (Math.random() * 15 - 7.5);
        const z = h / 2 + (Math.random() * 15 - 7.5);
        const y = height_map.getFloorAndCeiling(x, z).floor;
        c.positions.push([x, y, z]);

        const mat = mat4.create();
        const center = vec3.add(vec3.create(), [x, y, z], height_map.getNormalAtFloor(x, z));
        mat4.targetTo(mat, [x, y, z], center, [0, 0, 1]);
        mat4.rotateX(mat, mat, Math.PI / 2);
        c.instanced_mesh.addInstance(mat);

        for (let i = 0; i < num_chests - 1; i++) {
            for (let j = 0; j < 25000; j++) {
                const x = Math.random() * w;
                const z = Math.random() * h;
                const y = height_map.validFloorPosition(x, z, 1);
                if (y === false) continue;
                c.positions.push([x, y, z]);
                mat4.identity(mat);
                //make treasure chest normal match floor
                const center = vec3.add(vec3.create(), [x, y, z], height_map.getNormalAtFloor(x, z));
                mat4.targetTo(mat, [x, y, z], center, [0, 0, 1]);
                mat4.rotateX(mat, mat, Math.PI / 2);
                mat4.rotateY(mat, mat, Math.PI * Math.random());
                //  mat4.translate(mat, mat, [x, y, z]);
                c.instanced_mesh.addInstance(mat);
                break;
            }
        }
        return c;
    }
}
