import type { FighterConfig, WeaponDef } from '../types/game';

export const WEAPONS: Record<string, WeaponDef> = {
  katana: { id: 'katana', name: 'Ashwind Katana', cls: 'sword', reach: 105, damage: 62, speed: 1.05, trailColor: [255, 225, 160] },
  twin_blades: { id: 'twin_blades', name: 'Eclipse Daisho', cls: 'dual_swords', reach: 95, damage: 72, speed: 1.15, trailColor: [255, 110, 110] },
  nunchaku: { id: 'nunchaku', name: 'Iron Nunchaku', cls: 'nunchucks', reach: 78, damage: 52, speed: 1.35, trailColor: [255, 215, 70] },
  tonfas: { id: 'tonfas', name: 'Oak Tonfas', cls: 'tonfas', reach: 74, damage: 56, speed: 1.25, trailColor: [180, 230, 255] },
  knives: { id: 'knives', name: 'Viper Sai', cls: 'knives', reach: 76, damage: 58, speed: 1.3, trailColor: [160, 255, 190] },
  claws: { id: 'claws', name: 'Night Claws', cls: 'claws', reach: 82, damage: 64, speed: 1.25, trailColor: [215, 130, 255] },
  staff: { id: 'staff', name: 'Temple Bo Staff', cls: 'staff', reach: 128, damage: 60, speed: 1.0, trailColor: [255, 240, 180] },
  axe: { id: 'axe', name: 'Obsidian Cleaver', cls: 'axe', reach: 112, damage: 88, speed: 0.78, trailColor: [255, 120, 60] },
  spear: { id: 'spear', name: 'Crimson Naginata', cls: 'spear', reach: 140, damage: 78, speed: 0.9, trailColor: [200, 150, 255] },
};

export const FIGHTER_ROSTER: Omit<FighterConfig, 'isAi'>[] = [
  { id: 'kurogane', name: 'Kurogane', title: 'Wandering Blade', scale: 2.15, maxHp: 1000, headgear: 'headband', armorBulk: 1.0, weapon: WEAPONS.katana, archetype: 'fast', accentColor: '#ffd740' },
  { id: 'kitsune', name: 'Kitsune', title: 'Nine-Tail Assassin', scale: 2.05, maxHp: 940, headgear: 'horns', armorBulk: 0.92, weapon: WEAPONS.claws, archetype: 'fast', accentColor: '#e040fb' },
  { id: 'tetsuo', name: 'Tetsuo', title: 'Iron Shogunate', scale: 2.24, maxHp: 1120, headgear: 'kabuto', armorBulk: 1.18, weapon: WEAPONS.twin_blades, archetype: 'weapon_master', accentColor: '#ff5252' },
  { id: 'vipera', name: 'Vipera', title: 'Venom Fang', scale: 2.02, maxHp: 920, headgear: 'hood', armorBulk: 0.9, weapon: WEAPONS.knives, archetype: 'counter', accentColor: '#69f0ae' },
  { id: 'oboro', name: 'Oboro', title: 'Mist Hermit', scale: 2.1, maxHp: 980, headgear: 'kasa', armorBulk: 0.98, weapon: WEAPONS.staff, archetype: 'defensive', accentColor: '#40c4ff' },
  { id: 'daichi', name: 'Daichi', title: 'Mountain Breaker', scale: 2.32, maxHp: 1200, headgear: 'crest', armorBulk: 1.24, weapon: WEAPONS.axe, archetype: 'heavy', accentColor: '#ff6e40' },
  { id: 'rin', name: 'Rin', title: 'Lotus Striker', scale: 2.04, maxHp: 950, headgear: 'headband', armorBulk: 0.92, weapon: WEAPONS.tonfas, archetype: 'counter', accentColor: '#ff80ab' },
  { id: 'kazan', name: 'Kazan', title: 'Ember Lancer', scale: 2.18, maxHp: 1050, headgear: 'kabuto', armorBulk: 1.1, weapon: WEAPONS.spear, archetype: 'weapon_master', accentColor: '#ffab40' },
  { id: 'mantis', name: 'Mantis', title: 'Whirlwind Monk', scale: 2.08, maxHp: 960, headgear: 'kasa', armorBulk: 0.94, weapon: WEAPONS.nunchaku, archetype: 'aggressive', accentColor: '#ffd740' },
  { id: 'valkyrie', name: 'Valkyrie', title: 'Storm Halberd', scale: 2.14, maxHp: 1020, headgear: 'crest', armorBulk: 1.06, weapon: WEAPONS.spear, archetype: 'aggressive', accentColor: '#80d8ff' },
  { id: 'shiro', name: 'Shiro', title: 'Frost Fang', scale: 2.12, maxHp: 990, headgear: 'hood', armorBulk: 0.98, weapon: WEAPONS.katana, archetype: 'defensive', accentColor: '#84ffff' },
  { id: 'asura', name: 'Asura', title: 'Crimson Demon', scale: 2.26, maxHp: 1150, headgear: 'horns', armorBulk: 1.2, weapon: WEAPONS.twin_blades, archetype: 'aggressive', accentColor: '#ff1744' },
  { id: 'zeph', name: 'Zeph', title: 'Gale Shadow', scale: 2.06, maxHp: 950, headgear: 'headband', armorBulk: 0.94, weapon: WEAPONS.nunchaku, archetype: 'fast', accentColor: '#b388ff' },
  { id: 'kaelor', name: 'Kaelor', title: 'Void Overlord', scale: 2.48, maxHp: 1320, headgear: 'crown', armorBulk: 1.32, weapon: WEAPONS.axe, archetype: 'boss', accentColor: '#ffd740' },
];
