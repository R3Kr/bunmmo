import gsap from "gsap";
import {
  serializeMovePacket,
  serializeMousePacket,
  serializeSpawnProjectilePacket,
  serializePickupLootPacket,
} from "./clientpackets";
import {
  SequenceNumber,
  type ControlData,
  type Player,
  type Vector,
  type ClientState,
  type Projectile,
  type NPC,
  type Loot,
} from "./types";
import { deserializeServerPacket } from "./serverpackets";
import {
  SPEED,
  INITIAL_POSITION,
  WORLD,
  SHOOT_COOLDOWN,
  MAX_CLIENT_PROJECTILES,
  DEFAULT_NPC_WIDTH,
  DEFAULT_NPC_HEIGHT,
  LOOT_DISTANCE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from "./constants";
import {
  getPerpendicularVector2D,
  normalizeVector2D,
  drawTriangle,
  scaleVector,
  spawnProjectile,
  MonitoredProjectiles,
} from "./utils";
//import moneybag from "./moneybag.svg"
//@ts-ignore
import map1 from "../maps/map1.txt";
import { WorldMap } from "../maps/maputils";

const NAME = Math.floor(Math.random() * 0xffff);
const socket = new WebSocket(
  `${window.location.hostname !== "localhost" ? "wss" : "ws"}://${
    window.location.hostname === "localhost"
      ? "localhost:3000"
      : window.location.hostname
  }/ws?name=${NAME}`
);
socket.binaryType = "arraybuffer";

const body = document.querySelector("body")!;
const canvas = document.createElement("canvas");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const div = document.createElement("div");
const div2 = document.createElement("div");
body.append(div);
body.append(div2);
body.append(canvas);

const ctx = canvas.getContext("2d")!;

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  plus: false,
  minus: false,
  space: false,
};

const mouse = {
  x: 0,
  y: 0,
};
const projectiles = new MonitoredProjectiles();

const STATE: ClientState = {
  player: {
    name: NAME,
    ...INITIAL_POSITION,
    realX: INITIAL_POSITION.x,
    realY: INITIAL_POSITION.y,
    mouse: mouse,
  },
  otherPlayers: new Map<number, Player>(),
  npcs: new Map<number, NPC>(),
  projectiles: projectiles,
  loot: new Map(),
}; //as const;
let nearbyLoot: Loot[] = [];

const worldmap = WorldMap.new(map1, WORLD.width, WORLD.height);
const camera: Vector = {
  x: 0,
  y: 0,
};

//@ts-ignore
window.state = STATE;

const sequenceNum = new SequenceNumber();
const unprocessedActions = Array<{
  sequenceNum: number;
  controlData: ControlData;
}>();

document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "w":
      keys.w = true;
      break;
    case "a":
      keys.a = true;
      break;
    case "s":
      keys.s = true;
      break;
    case "d":
      keys.d = true;
      break;
    case "+":
      keys.plus = true;
      break;
    case "-":
      keys.minus = true;
      break;
    case " ": {
      keys.space = true;
      break;
    }
    case "e": {
      let didLoot = false;
      for (const [id, l] of STATE.loot.entries()) {
        if (
          Math.sqrt(
            Math.pow(l.position.x - STATE.player.realX, 2) +
              Math.pow(l.position.y - STATE.player.realY, 2)
          ) < LOOT_DISTANCE
        ) {
          socket.send(serializePickupLootPacket(sequenceNum.increase(), l));
          STATE.loot.delete(id);
          didLoot = true;
          break;
        }
      }

      break;
    }
    default:
      console.log(e.key);
  }
});

document.addEventListener("keyup", (e) => {
  switch (e.key) {
    case "w":
      keys.w = false;
      break;
    case "a":
      keys.a = false;
      break;
    case "s":
      keys.s = false;
      break;
    case "d":
      keys.d = false;
      break;
    case "+":
      keys.plus = false;
      break;
    case "-":
      keys.minus = false;
      break;
    case " ": {
      keys.space = false;
      break;
    }
    default:
      console.log(e.key);
  }
});

canvas.addEventListener("mousemove", (ev) => {
  console.log(
    `X: ${ev.x} Offset X: ${ev.offsetX} Y: ${ev.y} Offset Y: ${ev.offsetY}`
  );
  mouse.x = ev.offsetX; //+ camera.x;
  mouse.y = ev.offsetY; //+ camera.y;
});

const handleServerUpdateForSelf = (
  update: Player & { sequenceNum: number }
) => {};

socket.addEventListener("message", (event) => {
  const packet = deserializeServerPacket(event.data);
  packet?.performAction(STATE);
  console.log(packet);
});

const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  worldmap?.render(ctx, camera);
  //draw main player
  drawTriangle(
    ctx,
    STATE.player.x,
    STATE.player.y,
    STATE.player.width,
    normalizeVector2D({
      x: mouse.x + camera.x - STATE.player.x,
      y: mouse.y + camera.y - STATE.player.y,
    }),
    "black",
    camera
  );

  //draw other players
  for (const p of STATE.otherPlayers.values()) {
    drawTriangle(
      ctx,
      p.x,
      p.y,
      p.width,
      normalizeVector2D({
        x: p.mouse.x - p.x,
        y: p.mouse.y - p.y,
      }),
      "blue",
      camera
    );
  }

  //draw npc
  ctx.fillStyle = "red";
  for (const { position } of STATE.npcs.values()) {
    ctx.fillRect(
      position.x - camera.x,
      position.y - camera.y,
      DEFAULT_NPC_WIDTH,
      DEFAULT_NPC_HEIGHT
    );
  }

  //ctx.fillRect(mouse.x, mouse.y, 30, 30);

  //draw projectiles
  projectiles.forEach((p) => {
    drawTriangle(
      ctx,
      p.position.x,
      p.position.y,
      10,
      p.normalizedVelocity,
      p.spawner === STATE.player ? "green" : "red",
      camera
    );
  });

  //draw nearbyloot
  ctx.fillStyle = "green";
  nearbyLoot.forEach((l) =>
    ctx.fillRect(l.position.x - camera.x, l.position.y - 10 - camera.y, 15, 15)
  );

  //draw loot
  for (const l of STATE.loot.values()) {
    ctx.fillText("💰", l.position.x - camera.x, l.position.y - camera.y);
  }
  requestAnimationFrame(render);
};

let lastPacketWasNoControlData = true;
let lastMouseX = 0;
let lastMouseY = 0;
let canShoot = true;
let lastPlayerX = 0;
let lastPlayerY = 0;
setInterval(() => {
  if (canShoot && keys.space) {
    spawnProjectile(STATE.player, STATE, camera);
    setTimeout(() => {
      canShoot = true;
    }, SHOOT_COOLDOWN);
    canShoot = false;
    socket.send(serializeSpawnProjectilePacket(sequenceNum.increase()));
  }
  if (keys.w) {
    STATE.player.realY =
      STATE.player.realY - SPEED < 0 ? 0 : STATE.player.realY - SPEED;
  }
  if (keys.a) {
    STATE.player.realX =
      STATE.player.realX - SPEED < 0 ? 0 : STATE.player.realX - SPEED;
  }
  if (keys.s) {
    STATE.player.realY =
      STATE.player.realY + SPEED > WORLD.height
        ? WORLD.height
        : STATE.player.realY + SPEED;
  }
  if (keys.d) {
    STATE.player.realX =
      STATE.player.realX + SPEED > WORLD.width
        ? WORLD.width
        : STATE.player.realX + SPEED;
  }
  if (keys.plus) {
    STATE.player.height++;
    STATE.player.width++;
  }
  if (keys.minus) {
    STATE.player.height--;
    STATE.player.width--;
  }
  if (
    keys.w ||
    keys.a ||
    keys.s ||
    keys.d ||
    keys.plus ||
    keys.minus ||
    !lastPacketWasNoControlData
  ) {
    socket.send(serializeMovePacket(sequenceNum.increase(), keys));
    socket.send(serializeMousePacket(sequenceNum.increase(), {
      x: mouse.x + camera.x,
      y: mouse.y + camera.y,
    }))
    //-----Maybe in future
    // unprocessedActions.push({
    //   sequenceNum: sequenceNum.getUInt8(),
    //   controlData: { ...keys },
    // });
    //console.log(unprocessedActions);
    lastPacketWasNoControlData = !(
      keys.w ||
      keys.a ||
      keys.s ||
      keys.d ||
      keys.plus ||
      keys.minus
    );
  }

  gsap.to(STATE.player, {
    x: STATE.player.realX,
    y: STATE.player.realY,
    duration: 0.1,
  });

  projectiles.forEach((p) => {
    p.realPosition.x += p.normalizedVelocity.x * p.speedFactor;
    p.realPosition.y += p.normalizedVelocity.y * p.speedFactor;

    gsap.to(p.position, {
      x: p.realPosition.x,
      y: p.realPosition.y,
      duration: 0.1,
    });
  });

  if (!(lastMouseX === mouse.x && lastMouseY === mouse.y)) {
    socket.send(
      serializeMousePacket(sequenceNum.increase(), {
        x: mouse.x + camera.x,
        y: mouse.y + camera.y,
      })
    );
    console.log("Sent mouse packet");
  }

  lastMouseX = mouse.x;
  lastMouseY = mouse.y;

  if (
    !(lastPlayerX === STATE.player.realX && lastPlayerY === STATE.player.realY)
  ) {
    nearbyLoot = [];
    for (const l of STATE.loot.values()) {
      if (
        Math.sqrt(
          Math.pow(l.position.x - STATE.player.realX, 2) +
            Math.pow(l.position.y - STATE.player.realY, 2)
        ) < LOOT_DISTANCE
      ) {
        nearbyLoot.push(l);
      }
    }

    const newCameraX = STATE.player.realX - CANVAS_WIDTH / 2
    const newCameraY = STATE.player.realY - CANVAS_HEIGHT / 2

    gsap.to(camera, {
      x: newCameraX < 0 ? 0 : newCameraX >= WORLD.width - CANVAS_WIDTH ? WORLD.width - CANVAS_WIDTH : newCameraX ,
      y: newCameraY < 0 ? 0 : newCameraY >= WORLD.height - CANVAS_HEIGHT ? WORLD.height - CANVAS_HEIGHT : newCameraY,
      duration: 1,
    });
  }

  lastPlayerX = STATE.player.realX;
  lastPlayerY = STATE.player.realY;

  div.innerText = `x: ${STATE.player.x} `;
  div2.innerText = `y: ${STATE.player.y} `;
}, 1000 / 30);

render();
