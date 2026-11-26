export type EquipSlot = 'helmet' | 'armor' | 'gloves' | 'boots' | 'weapon' | 'ranged' | 'magic';

export interface SaveData {
  version: number;
  xp: number;
  level: number;
  coins: number;
  gems: number;
  selectedFighterId: string;
  equippedWeaponId: string;
  equipLevels: Record<EquipSlot, number>;
  storyChapter: number;
  survivalBest: number;
  completedChallenges: string[];
  achievements: string[];
  settings: {
    muted: boolean;
    debugHitboxes: boolean;
  };
}

const SAVE_KEY = 'eclipse_blades_save_v1';
const CURRENT_VERSION = 1;

export function createDefaultSave(): SaveData {
  return {
    version: CURRENT_VERSION,
    xp: 0,
    level: 1,
    coins: 500,
    gems: 15,
    selectedFighterId: 'kurogane',
    equippedWeaponId: 'katana',
    equipLevels: {
      helmet: 1,
      armor: 1,
      gloves: 1,
      boots: 1,
      weapon: 1,
      ranged: 1,
      magic: 1,
    },
    storyChapter: 0,
    survivalBest: 0,
    completedChallenges: [],
    achievements: [],
    settings: {
      muted: false,
      debugHitboxes: false,
    },
  };
}

export function loadSave(storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null): SaveData {
  const def = createDefaultSave();
  if (!storage) return def;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== CURRENT_VERSION) return def;
    return {
      ...def,
      ...parsed,
      equipLevels: { ...def.equipLevels, ...(parsed.equipLevels || {}) },
      settings: { ...def.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return def;
  }
}

export function writeSave(data: SaveData, storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null): void {
  if (!storage) return;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
}
