import type { ServerWebSocket } from "bun";

export interface ControlData {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  plus: boolean;
  minus: boolean;
}

export class SequenceNumber {
  //UInt8
  private num = 0;

  increase() {
    this.num++;
    this.num &= 0xff;
    return this.num;
  }

  getUInt8() {
    return this.num;
  }
}

const rect = {
  name: 123,
  width: 50,
  height: 50,
  x: 50,
  y: 50,
};
export type Player = typeof rect & { mouse: MouseData };

export type Vector = { x: number; y: number };

export type MouseData = Vector;

export interface ClientState {
  readonly player: Player & { realX: number; realY: number };
  readonly otherPlayers: Map<number, Player>;
  readonly npcs: Map<number, Omit<NPC, "state">>;
  readonly projectiles: Array<Projectile>;
  readonly loot: Map<number, Loot>
}

export interface ServerState {
  readonly players: Map<ServerWebSocket<number>, Player>;
  readonly npcs: Array<NPC>;
  readonly projectiles: Array<Omit<Projectile, "realPosition">>;
}

export interface ServerPacket {
  data: any;
  performAction: (state: ClientState) => void;
}

export interface Projectile {
  position: Vector;
  realPosition: Vector;
  normalizedVelocity: Vector;
  speedFactor: number;
  spawner: Player;
}

export enum ClientPackets {
  MovePacket,
  MousePacket,
  SpawnProjectilePacket,
  PickupLootPacket
}

export interface NPC {
  id: number;
  position: Vector;
  state: "alive" | "dead"
}

export interface Loot {
  id: number;
  position: Vector;
}
