import type { InputSnapshot } from '../types/game';
import { FighterController } from './FighterController';

export class EnemyAI {
  private cooldown = 0;
  private currentInput: InputSnapshot = {
    left: false, right: false, up: false, down: false,
    punch: false, kick: false, weapon: false, block: false, dodge: false, special: false,
  };

  public decide(dt: number, self: FighterController, opponent: FighterController): InputSnapshot {
    this.cooldown -= dt;
    if (this.cooldown > 0) {
      // Clear one-shot triggers between decisions, keep movement/block
      return {
        ...this.currentInput,
        punch: false,
        kick: false,
        weapon: false,
        dodge: false,
        special: false,
      };
    }

    const arch = self.config.archetype;
    const reactDelay = arch === 'fast' ? 0.14 : arch === 'boss' ? 0.13 : arch === 'heavy' ? 0.28 : 0.2;
    this.cooldown = reactDelay + Math.random() * 0.16;

    const dx = opponent.x - self.x;
    const dist = Math.abs(dx);
    const reach = self.config.weapon.reach * 1.35;
    const oppAttacking = opponent.getActiveHitbox() !== null || opponent.anim.includes('slash') || opponent.anim.includes('kick');

    const next: InputSnapshot = {
      left: false, right: false, up: false, down: false,
      punch: false, kick: false, weapon: false, block: false, dodge: false, special: false,
    };

    if (self.shadowEnergy >= 100 && dist < 300 && Math.random() < 0.65) {
      next.special = true;
      this.currentInput = next;
      return next;
    }

    if (oppAttacking && dist < reach + 35) {
      const blockChance = arch === 'defensive' || arch === 'counter' ? 0.72 : arch === 'boss' ? 0.6 : 0.35;
      if (Math.random() < blockChance) {
        next.block = true;
        this.currentInput = next;
        return next;
      }
      if (Math.random() < 0.35) {
        next.dodge = true;
        this.currentInput = next;
        return next;
      }
    }

    if (dist > reach + 25) {
      if (dx > 0) next.right = true;
      else next.left = true;
      if (dist < 260 && Math.random() < 0.2) {
        next.up = true;
        next.kick = true;
      }
    } else if (dist < 72) {
      const r = Math.random();
      if (r < 0.35) next.punch = true;
      else if (r < 0.68) next.kick = true;
      else if (r < 0.85) { next.down = true; next.kick = true; }
      else next.dodge = true;
    } else {
      const r = Math.random();
      if (r < 0.48) next.weapon = true;
      else if (r < 0.74) next.kick = true;
      else if (r < 0.9) next.punch = true;
      else next.block = true;
    }

    this.currentInput = next;
    return next;
  }
}
