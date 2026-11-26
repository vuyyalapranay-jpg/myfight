export interface Vec2 {
  x: number;
  y: number;
}

export interface SkeletonPose {
  head: Vec2;
  neck: Vec2;
  chest: Vec2;
  hip: Vec2;
  shoulderR: Vec2;
  elbowR: Vec2;
  handR: Vec2;
  shoulderL: Vec2;
  elbowL: Vec2;
  handL: Vec2;
  hipR: Vec2;
  kneeR: Vec2;
  footR: Vec2;
  hipL: Vec2;
  kneeL: Vec2;
  footL: Vec2;
}

export type AnimState =
  | 'idle'
  | 'walk_fwd'
  | 'walk_back'
  | 'crouch'
  | 'jump'
  | 'fall'
  | 'land'
  | 'dodge_back'
  | 'jab'
  | 'hook'
  | 'uppercut'
  | 'front_kick'
  | 'roundhouse'
  | 'low_kick'
  | 'jump_kick'
  | 'weapon_slash'
  | 'weapon_combo'
  | 'weapon_thrust'
  | 'special'
  | 'block'
  | 'parry'
  | 'counter'
  | 'hit_light'
  | 'hit_head'
  | 'knockdown'
  | 'getup'
  | 'victory'
  | 'defeat';

export interface AnimFrame {
  pose: string;
  dur: number;
}

export type WeaponClass =
  | 'sword'
  | 'dual_swords'
  | 'nunchucks'
  | 'tonfas'
  | 'knives'
  | 'claws'
  | 'staff'
  | 'axe'
  | 'spear';

export interface WeaponDef {
  id: string;
  name: string;
  cls: WeaponClass;
  reach: number;
  damage: number;
  speed: number;
  trailColor: [number, number, number];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AttackHitbox extends Rect {
  damage: number;
  knockbackX: number;
  knockbackY: number;
  isHeadTarget: boolean;
  isHeavy: boolean;
  isMagic: boolean;
}

export interface FighterHurtboxes {
  head: Rect;
  body: Rect;
}

export type AIArchetype =
  | 'fast'
  | 'heavy'
  | 'defensive'
  | 'weapon_master'
  | 'aggressive'
  | 'counter'
  | 'boss';

export interface FighterConfig {
  id: string;
  name: string;
  title: string;
  scale: number;
  maxHp: number;
  headgear: 'headband' | 'kasa' | 'horns' | 'kabuto' | 'crest' | 'hood' | 'crown';
  armorBulk: number;
  weapon: WeaponDef;
  isAi: boolean;
  archetype: AIArchetype;
  accentColor: string;
}

export interface InputSnapshot {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  punch: boolean;
  kick: boolean;
  weapon: boolean;
  block: boolean;
  dodge: boolean;
  special: boolean;
}
