import { WORLD } from "../src/constants";
import type { Vector } from "../src/types";
//@ts-ignore
import content from "./map1.txt";

const validMap = (map: string) => {
  const map_parts = map.split("\n").map((l) => l.split(""));
  const isSymmetrical = map_parts.every(
    (l) => map_parts[0].length === l.length
  );
  const hasValidTopBottomBorder = map_parts[0]
    .concat(map_parts[map_parts.length - 1])
    .every((char) => char === "-");
  const hasValidSideBorders = map_parts.every((l, i) => {
    return (
      i === 0 ||
      i === map_parts.length - 1 ||
      (l[0] === "|" && l[l.length - 1] === "|")
    );
  });

  return isSymmetrical && hasValidTopBottomBorder && hasValidSideBorders;
};

interface Terrain {
  position: Vector;
  width: number;
  height: number;
}

export class WorldMap {
  readonly mapchars: string[][];
  readonly world_width: number;
  readonly world_height: number;
  readonly tile_width: number;
  readonly tile_height: number;
  readonly terrain: Terrain[];
  private constructor(mapchars: string[][], width: number, height: number) {
    this.mapchars = mapchars;
    this.world_width = width;
    this.world_height = height;
    this.tile_width = width / mapchars[0].length;
    this.tile_height = height / mapchars.length;
    this.terrain = this.genTerrain();
  }

  genTerrain() {
    const terrains = [];
    for (let i = 0; i < this.mapchars.length; i++) {
      let terrainStart = -1;
      for (let j = 0; j < this.mapchars[i].length; j++) {
        if (this.mapchars[i][j] !== " " && terrainStart === -1) {
          terrainStart = j;
        }
        if (this.mapchars[i][j] === " " && terrainStart !== -1) {
          const terr: Terrain = {
            position: {
              x: terrainStart * this.tile_width,
              y: i * this.tile_height,
            },
            height: this.tile_height,
            width: (j - terrainStart) * this.tile_width,
          };
          terrains.push(terr);
          terrainStart = -1;
        }
      }

      if (terrainStart !== -1) {
        const terr: Terrain = {
          position: {
            x: terrainStart * this.tile_width,
            y: i * this.tile_height,
          },
          height: this.tile_height,
          width: (this.mapchars[i].length - terrainStart) * this.tile_width,
        };
        terrains.push(terr);
      }
    }
    return terrains;
  }

  render(ctx: CanvasRenderingContext2D, camera: Vector) {
    ctx.fillStyle = "cyan";
    this.terrain.forEach((t) =>
      ctx.fillRect(t.position.x - camera.x, t.position.y - camera.y, t.width, t.height)
    );
  }

  static new(map: string, width: number, height: number) {
    if (!validMap(map)) {
      return undefined;
    }
    const string_arr = map.split("\n").map((l) => l.split(""));
    string_arr.pop();
    string_arr.shift();
    string_arr.forEach((l) => {
      l.pop();
      l.shift();
    });
    return new this(string_arr, width, height);
  }
}

//WorldMap.new(mapstring, WORLD.width, WORLD.height)?.render()
