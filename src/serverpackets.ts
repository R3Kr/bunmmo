import type { ClientState, Loot, NPC, Player, ServerPacket } from "./types";
import gsap from "gsap";
import { spawnProjectile } from "./utils";

enum ServerPackets {
  PlayerPacket,
  DisconnectPacket,
  NPCPacket,
  SpawnProjectilePacket,
  KillNPCPacket,
  SpawnLootPacket,
  RemoveLootPacket,
}

export const serializeDisconnectPacket = ({ name }: Pick<Player, "name">) => {
  const view = new DataView(new ArrayBuffer(3));
  view.setUint8(0, ServerPackets.DisconnectPacket);
  view.setUint16(1, name);

  return view;
};

const deserializeDisconnectPacket = (buffer: ArrayBufferLike) => {
  const view = new DataView(buffer);
  const name = view.getUint16(1);
  return {
    data: name,
    performAction: ({ otherPlayers }: ClientState) => {
      otherPlayers.delete(name);
    },
  };
};

export const serializePlayerPacket = (sequenceNum: number, player: Player) => {
  const view = new DataView(new ArrayBuffer(1 + 1 + 2 * 6));

  view.setUint8(1, sequenceNum);
  view.setUint16(2, player.name);
  view.setUint8(4, player.width);
  view.setUint8(5, player.height);
  view.setUint16(6, player.x);
  view.setUint16(8, player.y);
  view.setUint16(10, player.mouse.x);
  view.setUint16(12, player.mouse.y);

  return view;
};

export const serializeNPCPacket = (npc: NPC) => {
  const view = new DataView(new ArrayBuffer(7));

  view.setUint8(0, ServerPackets.NPCPacket);
  view.setUint16(1, npc.id);
  view.setUint16(3, npc.position.x);
  view.setUint16(5, npc.position.y);

  return view;
};

const deserializeNPCPacket = (buffer: ArrayBufferLike) => {
  const view = new DataView(buffer);

  const id = view.getUint16(1);
  const x = view.getUint16(3);
  const y = view.getUint16(5);

  return {
    data: { id: id, position: { x, y } },
    performAction: ({ npcs }: ClientState) => {
      const npc = npcs.get(id);
      if (!npc) {
        npcs.set(id, { id, position: { x, y } });
      }
      gsap.to(npc?.position!, {
        x: x,
        y: y,
        duration: 0.1,
        overwrite: "auto",
      });
    },
  };
};

const deserializePlayerPacket = (buffer: ArrayBufferLike) => {
  const view = new DataView(buffer);

  const sequenceNum = view.getUint8(1);
  const name = view.getUint16(2);
  const width = view.getUint8(4);
  const height = view.getUint8(5);
  const x = view.getUint16(6);
  const y = view.getUint16(8);
  const mousex = view.getUint16(10);
  const mousey = view.getUint16(12);

  return {
    data: {
      sequenceNum,
      name,
      width,
      height,
      x,
      y,
      mouse: { x: mousex, y: mousey },
    },
    performAction: ({ player, otherPlayers }: ClientState) => {
      if (name === player.name) {
        //handleServerUpdateForSelf(p);
        return;
      }
      const otherPlayer = otherPlayers.get(name);
      if (!otherPlayer) {
        otherPlayers.set(name, {
          name,
          width,
          height,
          x,
          y,
          mouse: { x: mousex, y: mousey },
        });
      }
      gsap.to(otherPlayer!, {
        x: x,
        y: y,
        width: width,
        height: height,
        duration: 0.1,
        overwrite: "auto",
      });
      gsap.to(otherPlayer?.mouse!, {
        x: mousex,
        y: mousey,
        duration: 0.1,
        overwrite: "auto",
      });
    },
  };
};

export const deserializeServerPacket: (
  buffer: ArrayBufferLike
) => ServerPacket | undefined = (buffer: ArrayBufferLike) => {
  const view = new DataView(buffer);

  switch (view.getUint8(0)) {
    case ServerPackets.PlayerPacket:
      return deserializePlayerPacket(buffer);
    case ServerPackets.DisconnectPacket:
      return deserializeDisconnectPacket(buffer);
    case ServerPackets.NPCPacket:
      return deserializeNPCPacket(buffer);
    case ServerPackets.SpawnProjectilePacket:
      return deserializeSpawnProjectilePacket(buffer);
    case ServerPackets.KillNPCPacket:
      return deserializeKillNPCpacket(buffer);
    case ServerPackets.SpawnLootPacket:
      return deserializeSpawnLootPacket(buffer);
    case ServerPackets.RemoveLootPacket:
      return deserializeRemoveLoot(buffer);
    default:
      console.log("unknown packet");
  }
};

export const serializeSpawnProjectilePacket = (player: Player) => {
  const view = new DataView(new ArrayBuffer(3));

  view.setUint8(0, ServerPackets.SpawnProjectilePacket);
  view.setUint16(1, player.name);

  return view;
};

const deserializeSpawnProjectilePacket: (
  buffer: ArrayBufferLike
) => ServerPacket = (buffer: ArrayBufferLike) => {
  const view = new DataView(buffer);

  const name = view.getUint16(1);

  return {
    data: name,
    performAction(state) {
      const player = state.otherPlayers.get(name);
      if (player) {
        spawnProjectile(player, state);
      }
    },
  };
};

export const serializeKillNPCpacket = (npc: NPC) => {
  const view = new DataView(new ArrayBuffer(3));

  view.setUint8(0, ServerPackets.KillNPCPacket);
  view.setUint16(1, npc.id);

  return view;
};

const deserializeKillNPCpacket: (buffer: ArrayBufferLike) => ServerPacket = (
  buffer: ArrayBufferLike
) => {
  const view = new DataView(buffer);
  const id = view.getUint16(1);

  return {
    data: id,
    performAction(state) {
      state.npcs.delete(id);
    },
  };
};

export const serializeSpawnLootPacket = (loot: Loot) => {
  const view = new DataView(new ArrayBuffer(7));

  view.setUint8(0, ServerPackets.SpawnLootPacket);
  view.setUint16(1, loot.id);
  view.setUint16(3, loot.position.x);
  view.setUint16(5, loot.position.y);

  return view;
};

const deserializeSpawnLootPacket: (buffer: ArrayBufferLike) => ServerPacket = (
  buffer
) => {
  const view = new DataView(buffer);

  const id = view.getUint16(1);
  const x = view.getUint16(3);
  const y = view.getUint16(5);

  return {
    data: {
      id: id,
      position: {
        x,
        y,
      },
    },
    performAction(state) {
      state.loot.set(id, {
        id: id,
        position: {
          x,
          y,
        },
      });
    },
  };
};

export const serializeRemoveLoot = (loot: Loot) => {
  const view = new DataView(new ArrayBuffer(3));

  view.setUint8(0, ServerPackets.RemoveLootPacket);
  view.setUint16(1, loot.id);

  return view;
};

const deserializeRemoveLoot: (buffer: ArrayBufferLike) => ServerPacket = (
  buffer
) => {
  const view = new DataView(buffer);
  const lootId = view.getUint16(1);

  return {
    data: { lootId },
    performAction(state) {
      console.log("Removed loot");
      state.loot.delete(lootId);
    },
  };
};
// const data = {
//   name: 1338,
// };

// const raw = serializeDisconnectPacket(data)

// console.log(deserializeServerPacket(raw.buffer))
