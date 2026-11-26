import type { FighterConfig } from '../types/game';
import type { EquipSlot, SaveData } from './SaveSystem';
import { WEAPONS } from './WeaponsAndRoster';

export interface ComputedStats {
  bonusHp: number;
  damageMult: number;
  speedMult: number;
}

export function getUpgradeCost(level: number): number {
  return 100 + (level - 1) * 85;
}

export function computeEquipStats(save: SaveData): ComputedStats {
  const lv = save.equipLevels;
  const bonusHp = (lv.helmet - 1) * 45 + (lv.armor - 1) * 80 + (lv.boots - 1) * 20;
  const damageMult = 1 + (lv.weapon - 1) * 0.08 + (lv.gloves - 1) * 0.04 + (lv.magic - 1) * 0.03;
  const speedMult = 1 + (lv.boots - 1) * 0.03 + (lv.gloves - 1) * 0.02;
  return { bonusHp, damageMult, speedMult };
}

export function applyProgressionToFighter(base: FighterConfig, save: SaveData): FighterConfig {
  const stats = computeEquipStats(save);
  const wep = WEAPONS[save.equippedWeaponId] || base.weapon;
  return {
    ...base,
    maxHp: Math.round(base.maxHp + stats.bonusHp + (save.level - 1) * 25),
    weapon: {
      ...wep,
      damage: Math.round(wep.damage * stats.damageMult),
      speed: Number((wep.speed * stats.speedMult).toFixed(2)),
    },
  };
}

export function upgradeEquipmentSlot(save: SaveData, slot: EquipSlot): { ok: boolean; save: SaveData; cost: number } {
  const curLv = save.equipLevels[slot] || 1;
  const cost = getUpgradeCost(curLv);
  if (save.coins < cost) return { ok: false, save, cost };
  const next: SaveData = {
    ...save,
    coins: save.coins - cost,
    equipLevels: { ...save.equipLevels, [slot]: curLv + 1 },
  };
  return { ok: true, save: next, cost };
}

export function awardMatchRewards(save: SaveData, won: boolean, mode: string): { save: SaveData; xpGain: number; coinGain: number; gemGain: number; leveledUp: boolean } {
  const baseCoins = won ? (mode === 'story' ? 180 : mode === 'tournament' ? 220 : mode === 'challenge' ? 200 : 120) : 35;
  const baseXp = won ? 140 : 40;
  const gemGain = won && (mode === 'story' || mode === 'challenge' || mode === 'tournament') ? 3 : 0;

  let xp = save.xp + baseXp;
  let level = save.level;
  let leveledUp = false;
  while (xp >= level * 200) {
    xp -= level * 200;
    level++;
    leveledUp = true;
  }

  const next: SaveData = {
    ...save,
    xp,
    level,
    coins: save.coins + baseCoins,
    gems: save.gems + gemGain,
  };
  return { save: next, xpGain: baseXp, coinGain: baseCoins, gemGain, leveledUp };
}
