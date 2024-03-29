import gsap from "gsap";
import {
  serializeMovePacket,
  serializeMousePacket,
  serializeSpawnProjectilePacket,
} from "./clientpackets";
import {
  SequenceNumber,
  type ControlData,
  type Player,
  type Vector,
  type ClientState,
  type Projectile,
  type NPC,
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
canvas.width = WORLD.width;
canvas.height = WORLD.height;

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

const state: ClientState = {
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
}; //as const;

//@ts-ignore
window.state = state;

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
  mouse.x = ev.offsetX;
  mouse.y = ev.offsetY;
});

const handleServerUpdateForSelf = (
  update: Player & { sequenceNum: number }
) => {};

socket.addEventListener("message", (event) => {
  const packet = deserializeServerPacket(event.data);
  packet?.performAction(state);
  console.log(packet);
});

const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillText("🤑", 100, 100, 100)
  //draw main player
  drawTriangle(
    ctx,
    state.player.x,
    state.player.y,
    state.player.width,
    normalizeVector2D({
      x: mouse.x - state.player.x,
      y: mouse.y - state.player.y,
    }),
    "black"
  );

  //draw other players
  for (const p of state.otherPlayers.values()) {
    drawTriangle(
      ctx,
      p.x,
      p.y,
      p.width,
      normalizeVector2D({
        x: p.mouse.x - p.x,
        y: p.mouse.y - p.y,
      }),
      "blue"
    );
  }

  //draw npc
  ctx.fillStyle = "red";
  for (const { position } of state.npcs.values()) {
    ctx.fillRect(position.x, position.y, DEFAULT_NPC_WIDTH, DEFAULT_NPC_HEIGHT);
  }

  ctx.fillRect(mouse.x, mouse.y, 30, 30);

  projectiles.forEach((p) => {
    drawTriangle(
      ctx,
      p.position.x,
      p.position.y,
      10,
      p.normalizedVelocity,
      p.spawner === state.player ? "green" : "red"
    );
  });

  requestAnimationFrame(render);
};

let lastPacketWasNoControlData = true;
let lastMouseX = 0;
let lastMouseY = 0;
let canShoot = true;
setInterval(() => {
  if (canShoot && keys.space) {
    spawnProjectile(state.player, state);
    setTimeout(() => {
      canShoot = true;
    }, SHOOT_COOLDOWN);
    canShoot = false;
    socket.send(serializeSpawnProjectilePacket(sequenceNum.increase()));
  }
  if (keys.w) {
    state.player.realY =
      state.player.realY - SPEED < 0 ? 0 : state.player.realY - SPEED;
  }
  if (keys.a) {
    state.player.realX =
      state.player.realX - SPEED < 0 ? 0 : state.player.realX - SPEED;
  }
  if (keys.s) {
    state.player.realY =
      state.player.realY + SPEED > WORLD.height
        ? WORLD.height
        : state.player.realY + SPEED;
  }
  if (keys.d) {
    state.player.realX =
      state.player.realX + SPEED > WORLD.width
        ? WORLD.width
        : state.player.realX + SPEED;
  }
  if (keys.plus) {
    state.player.height++;
    state.player.width++;
  }
  if (keys.minus) {
    state.player.height--;
    state.player.width--;
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

  gsap.to(state.player, {
    x: state.player.realX,
    y: state.player.realY,
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
    socket.send(serializeMousePacket(sequenceNum.increase(), mouse));
    console.log("Sent mouse packet");
  }

  lastMouseX = mouse.x;
  lastMouseY = mouse.y;

  div.innerText = `x: ${state.player.x} `;
  div2.innerText = `y: ${state.player.y} `;
}, 1000 / 30);

render();
