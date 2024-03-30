import {
  DEFAULT_NPC_HEIGHT,
  DEFAULT_NPC_WIDTH,
  DEFAULT_PROJECTILE_SPEED,
  WORLD,
} from "./constants";
import type {
  ClientState,
  Vector,
  Player,
  Projectile,
  ServerState,
  NPC,
  Loot,
} from "./types";

export function normalizeVector2D(vector: Vector) {
  const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

export function getPerpendicularVector2D(vector: Vector) {
  return { x: -vector.y, y: vector.x };
}

export function scaleVector(vector: Vector, factor: number) {
  return {
    x: vector.x * factor,
    y: vector.y * factor,
  };
}

export const drawTriangle = (
  ctx: CanvasRenderingContext2D,
  middleX: number,
  middleY: number,
  size: number,
  normedVec: Vector,
  color: string
) => {
  const perpVec = getPerpendicularVector2D(normedVec);
  const topX = middleX + normedVec.x * size;
  const topY = middleY + normedVec.y * size;

  const corner1X = middleX + perpVec.x * size * 2;
  const corner1Y = middleY + perpVec.y * size * 2;

  const corner2X = middleX + perpVec.x * -size * 2;
  const corner2Y = middleY + perpVec.y * -size * 2;

  // Draw a triangle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(corner1X, corner1Y);
  ctx.lineTo(corner2X, corner2Y);
  ctx.fill(); // Fill the triangle

  ctx.fillStyle = "blue";
  ctx.fillRect(middleX, middleY, 1, 1);
};

export const spawnProjectile = (spawner: Player, state: ClientState) => {
  const projectile = {
    position: {
      x: spawner === state.player ? state.player.realX : spawner.x,
      y: spawner === state.player ? state.player.realY : spawner.y,
    },
    realPosition: {
      x: spawner === state.player ? state.player.realX : spawner.x,
      y: spawner === state.player ? state.player.realY : spawner.y,
    },
    normalizedVelocity: normalizeVector2D({
      x:
        spawner.mouse.x -
        (spawner === state.player ? state.player.realX : spawner.x),
      y:
        spawner.mouse.y -
        (spawner === state.player ? state.player.realY : spawner.y),
    }),
    speedFactor: DEFAULT_PROJECTILE_SPEED,
    spawner,
  };
  state.projectiles.push(projectile);
};

export const spawnServerProjectile = (
  spawner: Player,
  { projectiles }: ServerState
) => {
  const projectile = {
    position: {
      x: spawner.x,
      y: spawner.y,
    },
    normalizedVelocity: normalizeVector2D({
      x: spawner.mouse.x - spawner.x,
      y: spawner.mouse.y - spawner.y,
    }),
    speedFactor: DEFAULT_PROJECTILE_SPEED,
    spawner,
  };
  projectiles.push(projectile);
};

export class MonitoredProjectiles extends Array<Projectile> {
  //readonly maxlength: number;
  constructor() {
    super();
    setInterval(() => this.garbageCollect(), 1000);
    //this.maxlength = maxlength;
  }

  garbageCollect() {
    while (
      this.length > 0 &&
      (this[0].position.x < 0 ||
        this[0].position.x >= WORLD.width ||
        this[0].position.y < 0 ||
        this[0].position.y >= WORLD.height)
    ) {
      this.shift(); // Remove the first projectile if it's out of bounds
    }
  }
  // push(...items: Projectile[]): number {
  //   items.forEach((i) => super.push(i));
  //   this.length > this.maxlength && this.shift();
  //   return this.length;
  // }
}

export const collidesWith = (
  point: Vector,
  rect: { topLeftPos: Vector; width: number; height: number }
) => {
  if (
    point.x < rect.topLeftPos.x ||
    point.y < rect.topLeftPos.y ||
    point.x >= WORLD.width ||
    point.y >= WORLD.width
  ) {
    //console.log("Didnt collide");
    return false;
  }
  if (
    point.x >= rect.topLeftPos.x &&
    point.x < rect.topLeftPos.x + rect.width &&
    point.y >= rect.topLeftPos.y &&
    point.y < rect.topLeftPos.y + rect.height
  ) {
    //console.log("Collision happened!!!!");
    return true;
  }

  return false;
};

export const fillNPCs = (npcs: Array<NPC>, amount: number) => {
  for (let i = 0; i < amount; i++) {
    npcs.push({
      id: i,
      position: {
        x: Math.floor(Math.random() * (WORLD.width - DEFAULT_NPC_WIDTH)),
        y: Math.floor(Math.random() * (WORLD.height - DEFAULT_NPC_HEIGHT)),
      },
    });
  }
};

export class DefaultLoot implements Loot {
  static nextId = 0;
  id: number;
  position: Vector;
  constructor(position: Vector) {
    this.position = {...position}
    this.id = DefaultLoot.nextId++
  }
}
