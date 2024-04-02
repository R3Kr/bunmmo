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
  color: string,
  camera: Vector
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
  ctx.moveTo(topX - camera.x, topY - camera.y);
  ctx.lineTo(corner1X - camera.x, corner1Y - camera.y);
  ctx.lineTo(corner2X - camera.x, corner2Y - camera.y);
  ctx.fill(); // Fill the triangle

  ctx.fillStyle = "blue";
  ctx.fillRect(middleX - camera.x, middleY - camera.y, 1, 1);
};

export const spawnProjectile = (spawner: Player, state: ClientState, camera?: Vector) => {
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
        spawner.mouse.x + (camera ? camera.x : 0) -
        (spawner === state.player ? state.player.realX : spawner.x),
      y:
        spawner.mouse.y + (camera ? camera.y : 0) -
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

export const fillNPCs = (
  npcs: Array<NPC>,
  amount: number,
  onUpdate: (npc: NPC) => void
) => {
  for (let i = 0; i < amount; i++) {
    npcs.push(
      Math.random() > 0.1
        ? {
            id: i,
            position: {
              x: Math.floor(Math.random() * (WORLD.width - DEFAULT_NPC_WIDTH)),
              y: Math.floor(
                Math.random() * (WORLD.height - DEFAULT_NPC_HEIGHT)
              ),
            },
            state: "alive",
          }
        : new RadNPC(
            i,
            {
              x: Math.floor(Math.random() * (WORLD.width - DEFAULT_NPC_WIDTH)),
              y: Math.floor(
                Math.random() * (WORLD.height - DEFAULT_NPC_HEIGHT)
              ),
            },
            onUpdate
          )
    );
  }
};

class RadNPC implements NPC {
  static readonly radnpcs: Array<WeakRef<RadNPC>> = [];
  id: number;
  position: Vector;
  update: () => void;
  state: "alive" | "dead" = "alive";
  constructor(id: number, position: Vector, onUpdate: (npc: NPC) => void) {
    this.id = id;
    this.position = position;
    this.update = () => {
      if (this.state === "alive") {
        position.x = Math.floor(
          Math.random() * (WORLD.width - DEFAULT_NPC_WIDTH)
        );
        position.y = Math.floor(
          Math.random() * (WORLD.height - DEFAULT_NPC_HEIGHT)
        );
        onUpdate(this);
      }
    };
    if (RadNPC.radnpcs.length === 0) {
      RadNPC.startRadding();
    }
    RadNPC.radnpcs.push(new WeakRef(this));
  }

  static startRadding() {
    setInterval(() => {
      this.radnpcs.forEach((ref) => ref.deref()?.update());
    }, 300);
  }
}

export class DefaultLoot implements Loot {
  static nextId = 0;
  id: number;
  position: Vector;
  constructor(position: Vector) {
    this.position = { ...position };
    this.id = DefaultLoot.nextId++;
  }
}
