import type { ServerWebSocket } from "bun";
import { deserializeClientPacket } from "./src/clientpackets";
import {
  ClientPackets,
  type ControlData,
  type Player,
  type NPC,
  type ServerState,
  type Projectile,
} from "./src/types";
import {
  serializeDisconnectPacket,
  serializeNPCPacket,
  serializePlayerPacket,
  serializeSpawnProjectilePacket,
} from "./src/serverpackets";
import {
  SPEED,
  INITIAL_POSITION,
  WORLD,
  DEFAULT_NPC_WIDTH,
  DEFAULT_NPC_HEIGHT,
} from "./src/constants";
import {
  MonitoredProjectiles,
  collidesWith,
  normalizeVector2D,
  scaleVector,
  spawnServerProjectile,
} from "./src/utils";

const ico = Bun.file("./favicon.ico");
const html = Bun.file("./src/index.html");
const getJs = async () => {
  return await Bun.build({
    entrypoints: ["./src/index.ts"],
    minify: process.env.NODE_ENV === "development",
  });
};

const players = new Map<ServerWebSocket<number>, Player>();



const projectiles = new MonitoredProjectiles();
const STATE: ServerState = {
  players: players,
  npcs: Array(40)
    .fill(0)
    .map<NPC>((v, i) => {
      return { id: i, position: { x: 0, y: 0 } };
    }),
  projectiles: projectiles,
};
const actionBuffer = [];

const js = await (await getJs()).outputs[0].text();
const server = Bun.serve<number>({
  fetch: async (req, server) => {
    const url = new URL(req.url);
    switch (url.pathname) {
      case "/index.js":
        const resp =
          process.env.NODE_ENV === "development"
            ? new Response(await (await getJs()).outputs[0].text())
            : new Response(js);
        return resp;
      case "/favicon.ico":
        return new Response(ico);
      case "/ws":
        const asd = server.upgrade(req, { data: url.searchParams.get("name") });
        return new Response(asd ? "ok" : "error");

      default:
        return new Response(html);
    }
  },
  websocket: {
    open(ws) {
      ws.subscribe("global");
      for (const s of players.keys()) {
        s.subscribe(ws.data.toString());
        ws.subscribe(s.data.toString());
        ws.send(serializePlayerPacket(0, players.get(s)!));
      }
      for (const npc of STATE.npcs.values()) {
        ws.send(serializeNPCPacket(npc));
      }
      players.set(ws, {
        name: ws.data,
        ...INITIAL_POSITION,
        mouse: { x: 0, y: 0 },
      });
    },
    message(ws, message) {
      if (!(message instanceof Buffer)) return;
      const { type, packet } = deserializeClientPacket(message)!;
      //players.set(ws, { ...players.get(ws)!, ...controlData });
      const p = players.get(ws)!;
      if (type === ClientPackets.MovePacket) {
        const { sequenceNum, w, a, s, d, plus, minus } = packet as {
          sequenceNum: number;
          w: boolean;
          a: boolean;
          s: boolean;
          d: boolean;
          plus: boolean;
          minus: boolean;
        };
        if (w) {
          p.y = p.y - SPEED < 0 ? 0 : p.y - SPEED;
        }
        if (a) {
          p.x = p.x - SPEED < 0 ? 0 : p.x - SPEED;
        }
        if (s) {
          p.y = p.y + SPEED > WORLD.height ? WORLD.height : p.y + SPEED;
        }
        if (d) {
          p.x = p.x + SPEED > WORLD.width ? WORLD.width : p.x + SPEED;
        }

        if (plus) {
          p.height++;
          p.width++;
        }
        if (minus) {
          p.height--;
          p.width--;
        }
        server.publish(
          ws.data.toString(),
          serializePlayerPacket(sequenceNum, p)
        );
      }

      if (type === ClientPackets.MousePacket) {
        const { sequenceNum, x, y } = packet as {
          sequenceNum: number;
          x: number;
          y: number;
        };
        p.mouse.x = x;
        p.mouse.y = y;
        server.publish(
          ws.data.toString(),
          serializePlayerPacket(sequenceNum, p)
        );
      }

      if (type === ClientPackets.SpawnProjectilePacket) {
        const { sequenceNum } = packet;
        spawnServerProjectile(p, STATE);
        server.publish(p.name.toString(), serializeSpawnProjectilePacket(p));
      }
    },
    close(ws, code, reason) {
      server.publish(
        ws.data.toString(),
        serializeDisconnectPacket({ name: ws.data })
      );
      console.log(ws.data + " disconnected");

      //annars sjuk jävla bug där servern inte hinner publisha innan den har unsubscribat
      setTimeout(() => {
        for (const s of players.keys()) {
          s.unsubscribe(ws.data.toString());
        }
      }, 1000);
      players.delete(ws);
    },
  },
});

setInterval(() => {
  projectiles.forEach((p) => {
    p.position.x += p.normalizedVelocity.x * p.speedFactor;
    p.position.y += p.normalizedVelocity.y * p.speedFactor;

    for (const npc of STATE.npcs.values()) {
      const collisionHappend = collidesWith(p.position, {
        topLeftPos: npc.position,
        width: DEFAULT_NPC_WIDTH,
        height: DEFAULT_NPC_HEIGHT,
      });
      if (collisionHappend) {
        npc.position.x = Math.floor(
          Math.random() * (WORLD.width - DEFAULT_NPC_WIDTH)
        );
        npc.position.y = Math.floor(
          Math.random() * (WORLD.height - DEFAULT_NPC_HEIGHT)
        );
        server.publish("global", serializeNPCPacket(npc));
      }
    }
  });
}, 1000 / 30);

// setInterval(() => {
//   for (const npc of STATE.npcs.values()) {
//     const moveVec = scaleVector(
//       normalizeVector2D({
//         x: Math.random() < 0.5 ? Math.random() : -Math.random(),
//         y: Math.random() < 0.5 ? Math.random() : -Math.random(),
//       }),
//       Math.random() * 10
//     );
//     npc.position.x += moveVec.x;
//     npc.position.y += moveVec.y;
//     server.publish("global", serializeNPCPacket(npc));
//   }
// }, 1000/4);

console.log(`Server started on: ${server.port}`);

for await (const line of console) {
  for (const p of players.values()) {
    console.log(`${p.name}: x: ${p.x} y:${p.y}`);
  }
  console.log(projectiles.length);
  projectiles.forEach((p) => {
    console.log(`x: ${p.position.x} y: ${p.position.y}`);
  });
}
