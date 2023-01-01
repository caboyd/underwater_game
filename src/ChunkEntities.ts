import { mat4, vec3 } from "gl-matrix";
import { HeightMapOptions } from "src/heightmap/HeightMap";

export type Entity = {
    id: number;
    type: "chest" | "rock" | string;
    position: vec3;
    instance: mat4;
    radius?: number;
};

export class ChunkEntities {
    public entities: Entity[][][];
    private opt: HeightMapOptions;
    constructor(height_map_options: HeightMapOptions) {
        this.opt = height_map_options;
        this.entities = new Array(height_map_options.z_chunks)
            .fill(0)
            .map(() => new Array(height_map_options.x_chunks).fill(0).map(() => new Array()));
    }

    public getChunkEntities(x: number, z: number): Entity[] {
        return this.entities[z][x];
    }

    public insert(x_pos: number, z_pos: number, entity: Omit<Entity, "id">): void {
        const x_chunk = Math.floor(x_pos / this.opt.chunk_width_x);
        const z_chunk = Math.floor(z_pos / this.opt.chunk_width_z);
        if (x_chunk >= this.opt.x_chunks || z_chunk >= this.opt.z_chunks) throw "chunk out of bounds";

        const id = z_chunk * 10_000_000 + x_chunk * 100_000 + this.entities[z_chunk][x_chunk].length;
        const e = entity as Entity;
        e.id = id;
        this.entities[z_chunk][x_chunk].push(e);
    }

    public remove(index: number): boolean {
        const z_chunk = Math.floor(index / 10_000_000);
        const x_chunk = Math.floor((index % 10_000_000) / 100_000);
        const cell_index = index % 100_000;
        const chunk_entities = this.entities[z_chunk][x_chunk];
        if (cell_index >= chunk_entities.length) return false;
        if (this.entities.length >= 2) {
            //swap last element into this spot and update its entity id
            const e = chunk_entities.pop()!;
            e.id = index;
            chunk_entities[cell_index] = e;
        }
        chunk_entities.length--;
        return true;
    }
}
