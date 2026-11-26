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
    const reactDelay =
      arch === 'boss' ? 0.28 :
      arch === 'fast' ? 0.36 :
      arch === 'heavy' ? 0.55 :
      0.44;
    this.cooldown = reactDelay + Math.random() * 0.24;

    const dx = opponent.x - self.x;
    const dist = Math.abs(dx);
    const reach = self.config.weapon.reach * 1.35;
    const oppAttacking = opponent.getActiveHitbox() !== null;

    const next: InputSnapshot = {
      left: false, right: false, up: false, down: false,
      punch: false, kick: false, weapon: false, block: false, dodge: false, special: false,
    };

    if (self.shadowEnergy >= 100 && dist < 290 && Math.random() < 0.45) {
      next.special = true;
      this.currentInput = next;
      return next;
    }

    if (oppAttacking && dist < reach + 30) {
      const blockChance = arch === 'defensive' || arch === 'counter' ? 0.42 : arch === 'boss' ? 0.38 : 0.22;
      if (Math.random() < blockChance) {
        next.block = true;
        this.currentInput = next;
        return next;
      }
      if (Math.random() < 0.15) {
        next.dodge = true;
        this.currentInput = next;
        return next;
      }
    }

    if (dist > reach + 25) {
      if (dx > 0) next.right = true;
      else next.left = true;
      if (dist < 250 && Math.random() < 0.14) {
        next.up = true;
        next.kick = true;
      }
    } else if (dist < 72) {
      const r = Math.random();
      if (r < 0.28) next.punch = true;
      else if (r < 0.55) next.kick = true;
      else if (r < 0.72) { next.down = true; next.kick = true; }
      else if (r < 0.85) next.dodge = true;
      // else brief idle opening
    } else {
      const r = Math.random();
      if (r < 0.36) next.weapon = true;
      else if (r < 0.58) next.kick = true;
      else if (r < 0.74) next.punch = true;
      else if (r < 0.86) next.block = true;
      // else brief idle opening
    }

    this.currentInput = next;
    return next;
  }
}
