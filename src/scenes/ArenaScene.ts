import Phaser from 'phaser';
import type { FighterConfig, InputSnapshot } from '../types/game';
import { AudioSystem } from '../systems/AudioSystem';
import { resolveAttackHit } from '../systems/CombatSystem';
import { EnemyAI } from '../systems/EnemyAI';
import { FighterController } from '../systems/FighterController';
import { FIGHTER_ROSTER } from '../systems/WeaponsAndRoster';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
}

interface Callout {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface ArenaCallbacks {
  onHudUpdate?: (p1HpPct: number, p1En: number, p2HpPct: number, p2En: number, timer: number) => void;
  onMatchEnd?: (winnerId: string) => void;
}

export class ArenaScene extends Phaser.Scene {
  private canvasTex!: Phaser.Textures.CanvasTexture;
  private ctx!: CanvasRenderingContext2D;
  private audio = new AudioSystem();
  private ai1 = new EnemyAI();
  private ai2 = new EnemyAI();

  public p1!: FighterController;
  public p2!: FighterController;
  public debugMode = false;
  public trainingMode = false;
  public noBlockMode = false;
  public eclipseMode = false;
  public stageKey: 'temple' | 'titan_hall' = 'temple';

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private prevAttacks = { punch: false, kick: false, weapon: false, dodge: false, special: false };
  private touchState: InputSnapshot = {
    left: false, right: false, up: false, down: false,
    punch: false, kick: false, weapon: false, block: false, dodge: false, special: false,
  };

  private stageImgs: Record<string, HTMLImageElement> = {};
  private particles: Particle[] = [];
  private callouts: Callout[] = [];
  private sakura: { x: number; y: number; vx: number; vy: number; s: number; r: number }[] = [];

  private camX = 480;
  private camY = 300;
  private camZoom = 1.06;
  private hitStop = 0;
  private shake = 0;
  private koTimer = 0;
  private koFlash = 0;
  private matchOver = false;
  private timer = 99;
  private timerAcc = 0;
  private callbacks: ArenaCallbacks = {};

  constructor() {
    super({ key: 'ArenaScene' });
  }

  public setCallbacks(cb: ArenaCallbacks): void {
    this.callbacks = cb;
  }

  public setTouchInput(partial: Partial<InputSnapshot>): void {
    Object.assign(this.touchState, partial);
  }

  public create(): void {
    this.canvasTex = this.textures.createCanvas('arena-surface', 960, 540)!;
    this.ctx = this.canvasTex.getContext();
    this.add.image(480, 270, 'arena-surface');

    for (const [k, src] of [['temple', 'assets/stage_temple.jpg'], ['titan_hall', 'assets/stage_titan.jpg']]) {
      const img = new Image();
      img.src = src;
      this.stageImgs[k] = img;
    }

    for (let i = 0; i < 36; i++) {
      this.sakura.push({
        x: Math.random() * 960,
        y: Math.random() * 540,
        vx: 28 + Math.random() * 35,
        vy: 14 + Math.random() * 22,
        s: 2 + Math.random() * 3,
        r: Math.random() * 6.28,
      });
    }

    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys('W,A,S,D,J,K,L,U,B,SPACE,F9,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
      this.keys.F9.on('down', () => {
        this.debugMode = !this.debugMode;
      });
    }

    const f1Cfg: FighterConfig = { ...FIGHTER_ROSTER[0], isAi: false };
    const f2Cfg: FighterConfig = { ...FIGHTER_ROSTER[13], isAi: true };
    this.startMatch(f1Cfg, f2Cfg, 'temple');
  }

  public startMatch(
    c1: FighterConfig,
    c2: FighterConfig,
    stage: 'temple' | 'titan_hall' = 'temple',
    opts?: { training?: boolean; noBlock?: boolean; eclipse?: boolean; p1StartHp?: number },
  ): void {
    this.p1 = new FighterController(c1, 280, true);
    this.p2 = new FighterController(c2, 680, false);
    if (opts?.p1StartHp && opts.p1StartHp > 0) {
      this.p1.hp = Math.min(this.p1.maxHp, opts.p1StartHp);
    }
    this.stageKey = stage;
    this.trainingMode = !!opts?.training;
    this.debugMode = !!opts?.training;
    this.noBlockMode = !!opts?.noBlock;
    this.eclipseMode = !!opts?.eclipse;
    this.particles = [];
    this.callouts = [];
    this.hitStop = 0;
    this.shake = 0;
    this.koTimer = 0;
    this.koFlash = 0;
    this.matchOver = false;
    this.timer = 99;
    this.timerAcc = 0;
    this.camX = 480;
    this.camY = 300;
    this.camZoom = 1.06;
  }

  private readPlayerInput(): InputSnapshot {
    if (!this.keys) return { ...this.touchState };
    const punchNow = this.keys.U.isDown || this.touchState.punch;
    const kickNow = this.keys.K.isDown || this.touchState.kick;
    const weaponNow = this.keys.J.isDown || this.touchState.weapon;
    const dodgeNow = this.keys.SPACE.isDown || this.touchState.dodge;
    const specialNow = this.keys.L.isDown || this.touchState.special;

    const snap: InputSnapshot = {
      left: this.keys.A.isDown || this.keys.LEFT.isDown || this.touchState.left,
      right: this.keys.D.isDown || this.keys.RIGHT.isDown || this.touchState.right,
      up: this.keys.W.isDown || this.keys.UP.isDown || this.touchState.up,
      down: this.keys.S.isDown || this.keys.DOWN.isDown || this.touchState.down,
      block: this.keys.B.isDown || this.touchState.block,
      punch: punchNow && !this.prevAttacks.punch,
      kick: kickNow && !this.prevAttacks.kick,
      weapon: weaponNow && !this.prevAttacks.weapon,
      dodge: dodgeNow && !this.prevAttacks.dodge,
      special: specialNow && !this.prevAttacks.special,
    };

    this.prevAttacks = { punch: punchNow, kick: kickNow, weapon: weaponNow, dodge: dodgeNow, special: specialNow };
    this.touchState.punch = false;
    this.touchState.kick = false;
    this.touchState.weapon = false;
    this.touchState.dodge = false;
    this.touchState.special = false;
    return snap;
  }

  public override update(_time: number, deltaMs: number): void {
    let dt = Math.min(deltaMs / 1000, 0.05);

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.renderFrame();
      return;
    }

    if (this.koTimer > 0) {
      this.koTimer -= dt;
      this.koFlash = Math.max(0, this.koFlash - dt * 2.4);
      dt *= 0.22;
      if (this.koTimer <= 0 && !this.matchOver) {
        this.matchOver = true;
        const winner = this.p1.hp >= this.p2.hp ? this.p1 : this.p2;
        winner.setAnim('victory');
        this.callbacks.onMatchEnd?.(winner.config.id);
      }
    } else if (!this.matchOver) {
      this.timerAcc += dt;
      if (this.timerAcc >= 1) {
        this.timer = Math.max(0, this.timer - 1);
        this.timerAcc -= 1;
      }
      if (this.timer <= 0) {
        this.koTimer = 0.7;
        this.audio.playKO();
      }
    }

    if (!this.matchOver && this.koTimer <= 0) {
      const inp1 = this.p1.config.isAi ? this.ai1.decide(dt, this.p1, this.p2) : this.readPlayerInput();
      if (this.noBlockMode) inp1.block = false;
      const inp2 = this.trainingMode
        ? { left: false, right: false, up: false, down: false, punch: false, kick: false, weapon: false, block: false, dodge: false, special: false }
        : (this.p2.config.isAi ? this.ai2.decide(dt, this.p2, this.p1) : this.readPlayerInput());
      this.p1.handlePlayerInput(inp1, this.audio);
      this.p2.handlePlayerInput(inp2, this.audio);
    }

    if (this.trainingMode && this.p2.hp < this.p2.maxHp && this.p2.isActionFree()) {
      this.p2.hp = Math.min(this.p2.maxHp, this.p2.hp + 160 * dt);
    }

    this.p1.update(dt, this.p2.x);
    this.p2.update(dt, this.p1.x);

    // Pushbox separation
    const airborne = this.p1.y < this.p1.groundY - 45 || this.p2.y < this.p2.groundY - 45;
    if (!airborne) {
      const minSep = 78;
      const dx = this.p2.x - this.p1.x;
      if (Math.abs(dx) < minSep) {
        const push = (minSep - Math.abs(dx)) * 0.5;
        const sign = dx >= 0 ? 1 : -1;
        this.p1.x = Math.max(70, Math.min(890, this.p1.x - sign * push));
        this.p2.x = Math.max(70, Math.min(890, this.p2.x + sign * push));
      }
    }

    if (!this.matchOver && this.koTimer <= 0) {
      this.checkCombatHit(this.p1, this.p2);
      this.checkCombatHit(this.p2, this.p1);
      if (this.p1.hp <= 0 || this.p2.hp <= 0) {
        this.koTimer = 0.85;
        this.koFlash = 1;
        this.shake = 16;
        this.audio.playKO();
      }
    }

    // Dynamic camera
    const midX = (this.p1.x + this.p2.x) * 0.5;
    const midY = Math.min(this.p1.y, this.p2.y) - 115;
    const dist = Math.abs(this.p1.x - this.p2.x);
    const targetZoom = this.koTimer > 0 ? 1.3 : Math.max(1.0, Math.min(1.24, 1.3 - dist / 1450));
    const lerp = Math.min(1, dt * 6);
    this.camX += (midX - this.camX) * lerp;
    this.camY += (midY - this.camY) * lerp;
    this.camZoom += (targetZoom - this.camZoom) * lerp;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      this.callouts[i].y -= 42 * dt;
      this.callouts[i].life -= dt;
      if (this.callouts[i].life <= 0) this.callouts.splice(i, 1);
    }
    for (const s of this.sakura) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += 1.5 * dt;
      if (s.x > 980) s.x = -10;
      if (s.y > 560) s.y = -10;
    }

    this.callbacks.onHudUpdate?.(
      (this.p1.hp / this.p1.maxHp) * 100,
      this.p1.shadowEnergy,
      (this.p2.hp / this.p2.maxHp) * 100,
      this.p2.shadowEnergy,
      this.timer,
    );

    this.renderFrame();
  }

  private checkCombatHit(atk: FighterController, def: FighterController): void {
    const hb = atk.getActiveHitbox();
    if (!hb) return;
    const res = resolveAttackHit(hb, def.getHurtboxes(), def.blocking, def.blockDuration, def.invulnTimer > 0);
    if (!res.connected) return;

    atk.hitRegistered = true;
    def.hp = Math.max(0, def.hp - res.damage);
    def.shadowEnergy = Math.min(100, def.shadowEnergy + 12);

    const pushDir = def.x >= atk.x ? 1 : -1;
    if (res.parried) {
      this.audio.playBlock(true);
      atk.stunTimer = 0.35;
      atk.setAnim('hit_light');
      def.setAnim('parry');
      this.callouts.push({ x: def.x, y: def.y - 245, text: 'PARRY!', color: '#ffd740', life: 0.9 });
    } else if (res.blocked) {
      this.audio.playBlock(false);
      def.vx = pushDir * 85;
      this.hitStop = 0.025;
      this.callouts.push({ x: def.x, y: def.y - 235, text: 'BLOCKED', color: '#80deea', life: 0.7 });
    } else {
      this.audio.playHit(res.isCritical);
      atk.hitStreak++;
      atk.hitStreakTimer = 1.8;
      this.hitStop = res.isCritical ? 0.055 : 0.025;
      this.shake = res.isCritical ? 14 : 7;
      def.vx = pushDir * hb.knockbackX;
      if (hb.isHeavy || res.zone === 'head') {
        def.vy = hb.knockbackY || -210;
        def.setAnim(hb.isHeavy ? 'knockdown' : 'hit_head');
        def.invulnTimer = hb.isHeavy ? 0.55 : 0.22;
      } else {
        def.setAnim('hit_light');
        def.invulnTimer = 0.18;
      }
      if (hb.isMagic) this.callouts.push({ x: def.x, y: def.y - 250, text: 'SHADOW STRIKE!', color: '#4dd0e1', life: 0.9 });
      else if (res.zone === 'head') this.callouts.push({ x: def.x, y: def.y - 250, text: 'HEAD HIT!', color: '#ffab40', life: 0.85 });
      else if (atk.hitStreak >= 3) this.callouts.push({ x: def.x, y: def.y - 250, text: `${atk.hitStreak} HIT COMBO!`, color: '#ffd740', life: 0.85 });
    }

    for (let i = 0; i < (res.isCritical ? 20 : 12); i++) {
      this.particles.push({
        x: hb.x + hb.w * 0.5,
        y: hb.y + hb.h * 0.5,
        vx: (Math.random() - 0.5) * 480,
        vy: (Math.random() - 0.8) * 480,
        size: 1.5 + Math.random() * 3,
        life: 0.25 + Math.random() * 0.25,
        color: res.blocked ? '#80deea' : '#ffe082',
      });
    }
  }

  private renderFrame(): void {
    const c = this.ctx;
    const W = 960;
    const H = 540;
    c.clearRect(0, 0, W, H);
    c.save();

    const z = this.camZoom;
    const maxX = (W * (z - 1)) / (2 * z);
    const maxY = (H * (z - 1)) / (2 * z);
    const cx = Math.max(W / 2 - maxX, Math.min(W / 2 + maxX, this.camX));
    const cy = Math.max(H / 2 - maxY, Math.min(H / 2 + maxY, this.camY));
    c.translate(W / 2, H / 2);
    c.scale(z, z);
    c.translate(-cx, -cy);
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    const bg = this.stageImgs[this.stageKey];
    if (bg && bg.complete && bg.naturalWidth > 0) {
      c.drawImage(bg, 0, 0, W, H);
    } else {
      const grad = c.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#1e243b');
      grad.addColorStop(0.6, '#7a5a68');
      grad.addColorStop(1, '#141016');
      c.fillStyle = grad;
      c.fillRect(0, 0, W, H);
    }
    if (this.eclipseMode) {
      c.fillStyle = 'rgba(130, 12, 35, 0.22)';
      c.fillRect(0, 0, W, H);
    }

    c.fillStyle = '#050507';
    c.fillRect(0, 472, W, H - 472);

    for (const s of this.sakura) {
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.r);
      c.fillStyle = 'rgba(255,210,225,0.45)';
      c.beginPath();
      c.ellipse(0, 0, s.s, s.s * 0.45, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    this.p1.drawSilhouette(c);
    this.p2.drawSilhouette(c);

    for (const p of this.particles) {
      c.fillStyle = p.color;
      c.globalAlpha = Math.max(0, p.life / 0.4);
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    for (const co of this.callouts) {
      c.save();
      c.globalAlpha = Math.min(1, co.life * 2);
      c.font = '900 22px Cinzel, serif';
      c.textAlign = 'center';
      c.fillStyle = '#000';
      c.fillText(co.text, co.x + 2, co.y + 2);
      c.fillStyle = co.color;
      c.fillText(co.text, co.x, co.y);
      c.restore();
    }

    if (this.debugMode) {
      for (const f of [this.p1, this.p2]) {
        const hb = f.getHurtboxes();
        c.strokeStyle = '#00e5ff';
        c.lineWidth = 1.5;
        c.strokeRect(hb.head.x, hb.head.y, hb.head.w, hb.head.h);
        c.strokeStyle = '#69f0ae';
        c.strokeRect(hb.body.x, hb.body.y, hb.body.w, hb.body.h);
        const atk = f.getActiveHitbox();
        if (atk) {
          c.strokeStyle = '#ff1744';
          c.fillStyle = 'rgba(255,23,68,0.22)';
          c.fillRect(atk.x, atk.y, atk.w, atk.h);
          c.strokeRect(atk.x, atk.y, atk.w, atk.h);
        }
        c.fillStyle = '#ffd740';
        c.font = 'bold 12px monospace';
        c.fillText(`${f.config.name} [${f.anim}]`, f.x - 40, f.y - 245);
      }
    }

    if (this.koFlash > 0) {
      c.fillStyle = `rgba(255,40,30,${this.koFlash * 0.28})`;
      c.fillRect(0, 0, W, H);
    }

    c.restore();
    this.canvasTex.refresh();
  }
}
