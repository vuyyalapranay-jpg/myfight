import type { AttackHitbox, FighterHurtboxes, Rect } from '../types/game';

export interface HitResult {
  connected: boolean;
  zone: 'head' | 'body' | 'none';
  blocked: boolean;
  parried: boolean;
  damage: number;
  isCritical: boolean;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Resolves attack hitbox against defender's head and body hurtboxes.
 * Includes parry window (first 0.16s of block) and head-hit critical bonus.
 */
export function resolveAttackHit(
  hitbox: AttackHitbox,
  hurtboxes: FighterHurtboxes,
  defenderBlocking: boolean,
  blockDuration: number,
  defenderInvuln: boolean,
): HitResult {
  if (defenderInvuln) {
    return { connected: false, zone: 'none', blocked: false, parried: false, damage: 0, isCritical: false };
  }

  const hitHead = rectsOverlap(hitbox, hurtboxes.head);
  const hitBody = rectsOverlap(hitbox, hurtboxes.body);

  if (!hitHead && !hitBody) {
    return { connected: false, zone: 'none', blocked: false, parried: false, damage: 0, isCritical: false };
  }

  const zone: 'head' | 'body' = hitHead ? 'head' : 'body';

  if (defenderBlocking && !hitbox.isMagic) {
    const parried = blockDuration <= 0.16;
    const chip = parried ? 0 : Math.max(1, Math.round(hitbox.damage * 0.18));
    return { connected: true, zone, blocked: true, parried, damage: chip, isCritical: false };
  }

  const headMult = zone === 'head' ? 1.35 : 1.0;
  const dmg = Math.round(hitbox.damage * headMult);
  return {
    connected: true,
    zone,
    blocked: false,
    parried: false,
    damage: dmg,
    isCritical: zone === 'head' || hitbox.isHeavy,
  };
}
