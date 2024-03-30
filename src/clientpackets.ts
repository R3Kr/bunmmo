import type { ControlData, Loot, MouseData } from "./types";
import { ClientPackets } from "./types";

export const deserializeClientPacket = (buffer: Buffer) => {
  switch (buffer.readUInt8()) {
    case ClientPackets.MovePacket:
      return {
        type: ClientPackets.MovePacket,
        packet: deserializeMovePacket(buffer),
      };
    case ClientPackets.MousePacket:
      return {
        type: ClientPackets.MousePacket,
        packet: deserializeMousePacket(buffer),
      };
    case ClientPackets.SpawnProjectilePacket:
      return {
        type: ClientPackets.SpawnProjectilePacket,
        packet: deserializeSpawnProjectilePacket(buffer),
      };
    case ClientPackets.PickupLootPacket:
      return {
        type: ClientPackets.PickupLootPacket,
        packet: deserializePickupLootPacket(buffer),
      };
    default:
      console.log("unknown packet");
  }
};

export const serializeMousePacket = (
  sequenceNumUInt8: number,
  { x, y }: MouseData
) => {
  const view = new DataView(new ArrayBuffer(2 + 2 * 2));
  view.setUint8(0, 1);
  view.setUint8(1, sequenceNumUInt8);
  view.setUint16(2, x);
  view.setUint16(4, y);

  return view;
};

const deserializeMousePacket = (buffer: Buffer) => {
  return {
    sequenceNum: buffer.readUInt8(1),
    x: buffer.readUInt16BE(2),
    y: buffer.readUInt16BE(4),
  };
};

const deserializeMovePacket = (buffer: Buffer) => {
  const bits = buffer.readUInt8(2);
  const w = (bits & 0b100000) >> 5 === 1;
  const a = (bits & 0b10000) >> 4 === 1;
  const s = (bits & 0b1000) >> 3 === 1;
  const d = (bits & 0b100) >> 2 === 1;
  const plus = (bits & 0b10) >> 1 === 1;
  const minus = (bits & 0b1) === 1;
  return { sequenceNum: buffer.readUInt8(1), w, a, s, d, plus, minus };
};

export const serializeMovePacket = (
  sequenceNumUInt8: number,
  { w, a, s, d, plus, minus }: ControlData
) => {
  const arr = new Uint8Array(3);
  arr[1] = sequenceNumUInt8;
  let bits = 0;

  bits |= (w ? 1 : 0) << 5;
  bits |= (a ? 1 : 0) << 4;
  bits |= (s ? 1 : 0) << 3;
  bits |= (d ? 1 : 0) << 2;
  bits |= (plus ? 1 : 0) << 1;
  bits |= (minus ? 1 : 0) << 0;

  arr[2] = bits;
  return arr;
};

export const serializeSpawnProjectilePacket = (sequenceNumUInt8: number) => {
  const arr = new Uint8Array(2);
  arr[0] = ClientPackets.SpawnProjectilePacket;
  arr[1] = sequenceNumUInt8;
  return arr;
};

const deserializeSpawnProjectilePacket = (buffer: Buffer) => {
  return { sequenceNum: buffer.readUInt8(1) };
};

export const serializePickupLootPacket = (
  sequenceNumUInt8: number,
  loot: Loot
) => {
  const view = new DataView(new ArrayBuffer(4));

  view.setUint8(0, ClientPackets.PickupLootPacket);
  view.setUint8(1, sequenceNumUInt8);
  view.setUint16(2, loot.id);

  return view;
};

const deserializePickupLootPacket = (buffer: Buffer) => {
  const sequenceNum = buffer.readUInt8(1);
  const lootId = buffer.readUInt16BE(2);

  return {
    sequenceNum,
    lootId,
  };
};

// const data = serializeMovePacket({ w: true, a: true, s: true, d: false });

// const data2 = deserializePacket(Buffer.from(data))

// console.log(data2)
