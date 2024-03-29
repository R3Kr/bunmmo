export const SPEED = 5;
export const INITIAL_POSITION = {
  width: 20,
  height: 20,
  x: 50,
  y: 50,
} as const;

export const WORLD = {
  width: 600 * 1.5,
  height: 400 * 1.5,
} as const;

export const SHOOT_COOLDOWN = 125;
export const MAX_CLIENT_PROJECTILES = 100;
export const DEFAULT_PROJECTILE_SPEED = 20;
export const DEFAULT_NPC_WIDTH = 50;
export const DEFAULT_NPC_HEIGHT = DEFAULT_NPC_WIDTH;
