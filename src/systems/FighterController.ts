import type {
  AnimState,
  AttackHitbox,
  FighterConfig,
  FighterHurtboxes,
  InputSnapshot,
  SkeletonPose,
} from '../types/game';
import { ANIMS, ATTACK_WINDOWS, lerpPose, POSES } from './PoseLibrary';
import { AudioSystem } from './AudioSystem';

export interface SwingPoint {
  x: number;
  y: number;
  life: number;
}

export interface Afterimage {
  x: number;
  y: number;
  facingRight: boolean;
  pose: SkeletonPose;
  life: number;
}

export class FighterController {
  public readonly config: FighterConfig;
  public x: number;
  public y: number;
  public readonly groundY = 472;
  public vx = 0;
  public vy = 0;
  public facingRight: boolean;

  public hp: number;
  public readonly maxHp: number;
  public shadowEnergy = 0;

  public anim: AnimState = 'idle';
  public animTime = 0;
  public animLooping = true;
  public animDone = false;
  public currentPose: SkeletonPose = { ...POSES.idle_1 };
  private prevPose: SkeletonPose = { ...POSES.idle_1 };
  private blendTime = 0;
  private readonly blendDuration = 0.08;

  public blocking = false;
  public blockDuration = 0;
  public invulnTimer = 0;
  public stunTimer = 0;
  public hitRegistered = false;
  public punchCombo = 0;
  public kickCombo = 0;
  public weaponCombo = 0;
  public hitStreak = 0;
  public hitStreakTimer = 0;

  public swingArc: SwingPoint[] = [];
  public afterimages: Afterimage[] = [];
  public bodyAngle = 0;
  private wasAirborne = false;

  constructor(config: FighterConfig, startX: number, facingRight: boolean) {
    this.config = config;
    this.x = startX;
    this.y = this.groundY;
    this.facingRight = facingRight;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
  }

  public setAnim(name: AnimState): void {
    if (this.anim === name) return;
    const copy = {} as SkeletonPose;
    for (const k of Object.keys(this.currentPose) as (keyof SkeletonPose)[]) {
      copy[k] = { ...this.currentPose[k] };
    }
    this.prevPose = copy;
    this.blendTime = this.blendDuration;
    this.anim = name;
    this.animTime = 0;
    this.animDone = false;
    this.hitRegistered = false;
    this.animLooping = name === 'idle' || name === 'walk_fwd' || name === 'walk_back' || name === 'block' || name === 'crouch';
  }

  public isActionFree(): boolean {
    return (
      this.anim === 'idle' ||
      this.anim === 'walk_fwd' ||
      this.anim === 'walk_back' ||
      this.anim === 'crouch' ||
      this.anim === 'land'
    );
  }

  public handlePlayerInput(input: InputSnapshot, audio: AudioSystem): void {
    if (this.hp <= 0 || this.stunTimer > 0) return;

    if (input.block && this.isActionFree() && this.y >= this.groundY - 2) {
      if (!this.blocking) this.blockDuration = 0;
      this.blocking = true;
      this.vx = 0;
      this.setAnim('block');
      return;
    } else if (!input.block && this.blocking) {
      this.blocking = false;
      if (this.anim === 'block') this.setAnim('idle');
    }

    if (this.anim === 'jump' || this.anim === 'fall') {
      if (input.kick) {
        this.setAnim('jump_kick');
        this.vx = (this.facingRight ? 1 : -1) * 230;
        audio.playWhoosh(230);
      }
      return;
    }

    if (!this.isActionFree()) return;

    if (input.special && this.shadowEnergy >= 100) {
      this.shadowEnergy = 0;
      this.setAnim('special');
      this.vx = (this.facingRight ? 1 : -1) * 180;
      audio.playWhoosh(180);
      return;
    }

    if (input.dodge) {
      this.setAnim('dodge_back');
      this.vx = (this.facingRight ? -1 : 1) * 300;
      this.vy = -340;
      this.invulnTimer = 0.26;
      audio.playWhoosh(320);
      return;
    }

    if (input.weapon) {
      const cycle: AnimState[] = ['weapon_slash', 'weapon_combo', 'weapon_thrust'];
      const atk = input.up ? 'weapon_combo' : input.down ? 'weapon_thrust' : cycle[this.weaponCombo++ % cycle.length];
      this.setAnim(atk);
      this.vx = (this.facingRight ? 1 : -1) * (atk === 'weapon_thrust' ? 210 : 110);
      this.shadowEnergy = Math.min(100, this.shadowEnergy + 7);
      audio.playWhoosh(290 * this.config.weapon.speed);
      return;
    }

    if (input.punch) {
      const cycle: AnimState[] = ['jab', 'hook', 'uppercut'];
      const atk = input.up ? 'uppercut' : cycle[this.punchCombo++ % cycle.length];
      this.setAnim(atk);
      this.vx = (this.facingRight ? 1 : -1) * 90;
      this.shadowEnergy = Math.min(100, this.shadowEnergy + 5);
      audio.playWhoosh(360);
      return;
    }

    if (input.kick) {
      const cycle: AnimState[] = ['front_kick', 'roundhouse', 'low_kick'];
      const atk = input.up ? 'jump_kick' : input.down ? 'low_kick' : cycle[this.kickCombo++ % cycle.length];
      this.setAnim(atk);
      this.vx = (this.facingRight ? 1 : -1) * (atk === 'jump_kick' ? 250 : 120);
      if (atk === 'jump_kick') this.vy = -350;
      this.shadowEnergy = Math.min(100, this.shadowEnergy + 6);
      audio.playWhoosh(240);
      return;
    }

    if (input.up && this.y >= this.groundY - 2) {
      this.setAnim('jump');
      this.vy = -660;
      this.vx = input.left ? -210 : input.right ? 210 : 0;
      return;
    }

    if (input.down && this.y >= this.groundY - 2) {
      this.vx = 0;
      this.setAnim('crouch');
      return;
    }

    if (input.left) {
      this.vx = -230;
      this.setAnim(this.facingRight ? 'walk_back' : 'walk_fwd');
    } else if (input.right) {
      this.vx = 230;
      this.setAnim(this.facingRight ? 'walk_fwd' : 'walk_back');
    } else {
      this.vx = 0;
      this.setAnim('idle');
    }
  }

  public update(dt: number, opponentX: number): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt);
    if (this.blocking) this.blockDuration += dt;
    if (this.hitStreakTimer > 0) {
      this.hitStreakTimer -= dt;
      if (this.hitStreakTimer <= 0) this.hitStreak = 0;
    }

    if (this.isActionFree() || this.anim === 'block' || this.anim === 'jump' || this.anim === 'fall') {
      this.facingRight = opponentX >= this.x;
    }

    // Vertical physics & landing detection
    if (this.y < this.groundY || this.vy < 0) {
      this.wasAirborne = true;
      this.vy += 1550 * dt;
      this.y += this.vy * dt;
      if (this.vy > 60 && this.anim === 'jump') {
        this.setAnim('fall');
      }
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        if (this.wasAirborne && (this.anim === 'jump' || this.anim === 'fall' || this.anim === 'jump_kick')) {
          this.setAnim('land');
        }
        this.wasAirborne = false;
      }
    }

    // Horizontal motion
    this.x += this.vx * dt;
    this.x = Math.max(70, Math.min(890, this.x));
    if (!this.isActionFree() && this.anim !== 'jump' && this.anim !== 'fall') {
      this.vx *= Math.pow(0.08, dt);
    }

    if (this.animDone && !this.animLooping) {
      if (this.anim === 'knockdown' && this.hp > 0) {
        this.setAnim('getup');
      } else if (this.hp > 0) {
        this.setAnim('idle');
      }
    }

    this.updatePose(dt);
    this.updateTrails(dt);
  }

  private updatePose(dt: number): void {
    const spd = ATTACK_WINDOWS[this.anim] ? this.config.weapon.speed : 1.0;
    this.animTime += dt * spd;
    const seq = ANIMS[this.anim] || ANIMS.idle;
    const total = seq.reduce((s, f) => s + f.dur, 0);

    let t = this.animTime;
    if (this.animLooping) {
      t = t % total;
    } else if (t >= total) {
      t = total - 0.001;
      this.animDone = true;
    }

    let target: SkeletonPose = { ...POSES[seq[seq.length - 1].pose] };
    let elapsed = 0;
    for (let i = 0; i < seq.length; i++) {
      const f = seq[i];
      if (t < elapsed + f.dur) {
        const nextIdx = (i + 1) % seq.length;
        const pA = POSES[f.pose];
        const pB = POSES[seq[nextIdx].pose];
        const frac = (t - elapsed) / f.dur;
        const smooth = frac * frac * (3 - 2 * frac);
        target = lerpPose(pA, pB, smooth);
        break;
      }
      elapsed += f.dur;
    }

    if (this.blendTime > 0) {
      this.blendTime = Math.max(0, this.blendTime - dt);
      const b = 1 - this.blendTime / this.blendDuration;
      this.currentPose = this.constrainSkeleton(lerpPose(this.prevPose, target, b));
    } else {
      this.currentPose = this.constrainSkeleton(target);
    }

    // Dynamic whole-body lean / knockdown rotation (learned from SF2 choreography)
    let targetAngle = 0;
    if (this.anim === 'knockdown' || this.anim === 'defeat') targetAngle = -1.25;
    else if (this.anim === 'hit_head') targetAngle = -0.35;
    else if (this.anim === 'hit_light') targetAngle = -0.2;
    else if (this.anim === 'weapon_thrust' || this.anim === 'walk_fwd') targetAngle = 0.14;
    else if (this.anim === 'roundhouse' || this.anim === 'uppercut') targetAngle = -0.16;
    else if (this.anim === 'dodge_back') targetAngle = -0.55;
    this.bodyAngle += (targetAngle - this.bodyAngle) * Math.min(1, dt * 14);
  }

  /** Enforces constant human bone lengths so swinging limbs trace true arcs instead of shrinking. */
  private constrainSkeleton(p: SkeletonPose): SkeletonPose {
    const fix = (root: { x: number; y: number }, child: { x: number; y: number }, len: number) => {
      const dx = child.x - root.x;
      const dy = child.y - root.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: root.x + (dx / d) * len, y: root.y + (dy / d) * len };
    };
    const out: SkeletonPose = { ...p };
    out.elbowR = fix(out.shoulderR, out.elbowR, 18);
    out.handR = fix(out.elbowR, out.handR, 17);
    out.elbowL = fix(out.shoulderL, out.elbowL, 18);
    out.handL = fix(out.elbowL, out.handL, 17);
    out.kneeR = fix(out.hipR, out.kneeR, 24);
    out.footR = fix(out.kneeR, out.footR, 24);
    out.kneeL = fix(out.hipL, out.kneeL, 24);
    out.footL = fix(out.kneeL, out.footL, 24);
    return out;
  }

  private updateTrails(dt: number): void {
    if (ATTACK_WINDOWS[this.anim]) {
      const sc = this.config.scale;
      const dir = this.facingRight ? 1 : -1;
      const isKick = this.anim.includes('kick') || this.anim === 'roundhouse';
      const tip = isKick ? this.currentPose.footR : this.currentPose.handR;
      const isWeapon = this.anim.startsWith('weapon') || this.anim === 'counter';
      const dx = this.currentPose.handR.x - this.currentPose.elbowR.x;
      const dy = this.currentPose.handR.y - this.currentPose.elbowR.y;
      const ang = Math.atan2(dy, dx);
      const ext = isWeapon ? this.config.weapon.reach * 0.52 : 0;

      this.swingArc.push({
        x: this.x + (tip.x + Math.cos(ang) * ext) * sc * dir,
        y: this.y + (tip.y + Math.sin(ang) * ext) * sc,
        life: 0.16,
      });
      if (this.swingArc.length > 10) this.swingArc.shift();
    }

    for (let i = this.swingArc.length - 1; i >= 0; i--) {
      this.swingArc[i].life -= dt;
      if (this.swingArc[i].life <= 0) this.swingArc.splice(i, 1);
    }

    if ((this.anim === 'dodge_back' || this.anim === 'jump_kick' || this.anim === 'special') && Math.random() < 0.45) {
      this.afterimages.push({
        x: this.x,
        y: this.y,
        facingRight: this.facingRight,
        pose: { ...this.currentPose },
        life: 0.15,
      });
      if (this.afterimages.length > 5) this.afterimages.shift();
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }
  }

  public getActiveHitbox(): AttackHitbox | null {
    if (this.hitRegistered) return null;
    const win = ATTACK_WINDOWS[this.anim];
    if (!win) return null;

    const seq = ANIMS[this.anim];
    const total = seq.reduce((s, f) => s + f.dur, 0);
    const frac = this.animTime / total;
    if (frac < win.start || frac > win.end) return null;

    const sc = this.config.scale;
    const dir = this.facingRight ? 1 : -1;

    if (this.anim === 'special') {
      return {
        x: this.facingRight ? this.x + 20 : this.x - 320,
        y: this.y - 230,
        w: 320,
        h: 190,
        damage: this.config.weapon.damage * win.dmgMult,
        knockbackX: 280,
        knockbackY: -260,
        isHeadTarget: false,
        isHeavy: true,
        isMagic: true,
      };
    }

    const isKick = this.anim.includes('kick') || this.anim === 'roundhouse';
    const isWeapon = this.anim.startsWith('weapon') || this.anim === 'counter';
    const joint = isKick ? this.currentPose.footR : this.anim === 'jab' ? this.currentPose.handL : this.currentPose.handR;
    const reach = isWeapon ? this.config.weapon.reach * 1.35 : isKick ? 92 : 76;
    const bx = this.x + joint.x * sc * dir;
    const by = this.y + joint.y * sc;

    return {
      x: dir > 0 ? bx - 16 : bx - reach + 16,
      y: by - 42,
      w: reach,
      h: 82,
      damage: (isWeapon ? this.config.weapon.damage : 48) * win.dmgMult,
      knockbackX: win.heavy ? 240 : 120,
      knockbackY: win.heavy ? -220 : 0,
      isHeadTarget: win.isHead,
      isHeavy: win.heavy,
      isMagic: false,
    };
  }

  public getHurtboxes(): FighterHurtboxes {
    const sc = this.config.scale;
    const crouchScale = this.anim === 'crouch' || this.anim === 'low_kick' ? 0.68 : 1.0;
    const headY = this.y + this.currentPose.head.y * sc - 24;
    return {
      head: { x: this.x - 24, y: headY, w: 48, h: 46 },
      body: {
        x: this.x - 28 * (sc / 2.15),
        y: headY + 46,
        w: 56 * (sc / 2.15),
        h: Math.max(40, this.y - (headY + 46)) * crouchScale,
      },
    };
  }

  public drawSilhouette(c: CanvasRenderingContext2D): void {
    // Draw bright SF2 white-core + colored-edge swing arc
    if (this.swingArc.length > 1) {
      const [r, g, b] = this.config.weapon.trailColor;
      for (let i = 1; i < this.swingArc.length; i++) {
        const p0 = this.swingArc[i - 1];
        const p1 = this.swingArc[i];
        const frac = i / this.swingArc.length;
        const alpha = Math.min(0.9, p1.life * 5.5 * frac);
        c.save();
        c.lineCap = 'round';
        c.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.7})`;
        c.lineWidth = 4 + frac * 14;
        c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
        c.strokeStyle = `rgba(255,255,255,${alpha})`;
        c.lineWidth = 1.5 + frac * 5;
        c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
        c.restore();
      }
    }

    // Draw afterimages
    for (const ag of this.afterimages) {
      c.save();
      c.globalAlpha = Math.max(0, ag.life * 1.4);
      this.drawPoseInternal(c, ag.x, ag.y, ag.facingRight, ag.pose, '#1b1d28', false);
      c.restore();
    }

    this.drawPoseInternal(c, this.x, this.y, this.facingRight, this.currentPose, '#050507', true);
  }

  private drawPoseInternal(
    c: CanvasRenderingContext2D,
    fx: number,
    fy: number,
    facingRight: boolean,
    p: SkeletonPose,
    fillCol: string,
    drawExtras: boolean,
  ): void {
    const sc = this.config.scale;
    const bulk = this.config.armorBulk;
    c.save();
    c.translate(fx, fy);
    c.scale(facingRight ? sc : -sc, sc);
    if (drawExtras && this.bodyAngle !== 0) {
      c.translate(0, -38);
      c.rotate(this.bodyAngle);
      c.translate(0, 38);
    }
    c.fillStyle = fillCol;
    c.strokeStyle = fillCol;

    if (drawExtras && this.shadowEnergy >= 90) {
      const ag = c.createRadialGradient(0, -55, 8, 0, -55, 62);
      ag.addColorStop(0, 'rgba(77,208,225,0.28)');
      ag.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = ag;
      c.beginPath();
      c.arc(0, -55, 62, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = fillCol;
    }

    // Back leg + arm (natural asymmetric calf/thigh, no puppet notches)
    this.drawMuscleLimb(c, p.hipL, p.kneeL, 7.6 * bulk, 5.4 * bulk, 1.12);
    this.drawMuscleLimb(c, p.kneeL, p.footL, 5.2 * bulk, 3.0, 1.15);
    this.drawFoot(c, p.footL);
    this.drawMuscleLimb(c, p.shoulderL, p.elbowL, 4.6 * bulk, 3.6 * bulk, 1.1);
    this.drawMuscleLimb(c, p.elbowL, p.handL, 3.6 * bulk, 2.5, 1.08);
    c.beginPath();
    c.arc(p.handL.x, p.handL.y, 3.4, 0, Math.PI * 2);
    c.fill();

    // Flowing sash
    if (drawExtras) {
      const wave = Math.sin(performance.now() * 0.005 + (this.facingRight ? 0 : 2)) * 5;
      c.beginPath();
      c.moveTo(p.hip.x - 4, p.hip.y - 2);
      c.quadraticCurveTo(p.hip.x - 18, p.hip.y + 8 + wave, p.hip.x - 24, p.hip.y + 20 + wave);
      c.lineTo(p.hip.x - 19, p.hip.y + 22 + wave);
      c.quadraticCurveTo(p.hip.x - 12, p.hip.y + 10 + wave, p.hip.x - 2, p.hip.y + 2);
      c.closePath();
      c.fill();
    }

    // Seamless torso + martial-arts tunic/hakama skirt (unifies torso -> hips -> upper thighs)
    const waistW = 8.2 * bulk;
    c.beginPath();
    c.moveTo(p.shoulderL.x * bulk, p.shoulderL.y + 1);
    c.quadraticCurveTo(p.neck.x - 5, p.neck.y - 2, p.neck.x + 1, p.neck.y - 3);
    c.quadraticCurveTo(p.neck.x + 6, p.neck.y - 2, p.shoulderR.x * bulk, p.shoulderR.y + 1);
    c.quadraticCurveTo(p.chest.x + 11 * bulk, p.chest.y, p.hip.x + waistW, p.hip.y);
    c.lineTo(p.hipR.x + 7 * bulk, p.hipR.y + 13);
    c.quadraticCurveTo(p.hip.x, p.hip.y + 15, p.hipL.x - 7 * bulk, p.hipL.y + 13);
    c.lineTo(p.hip.x - waistW, p.hip.y);
    c.quadraticCurveTo(p.chest.x - 11 * bulk, p.chest.y, p.shoulderL.x * bulk, p.shoulderL.y + 1);
    c.closePath();
    c.fill();
    this.drawMuscleLimb(c, p.neck, p.head, 4.4, 3.8, 1.0);

    // Front leg + arm
    this.drawMuscleLimb(c, p.hipR, p.kneeR, 7.8 * bulk, 5.5 * bulk, 1.12);
    this.drawMuscleLimb(c, p.kneeR, p.footR, 5.4 * bulk, 3.0, 1.15);
    this.drawFoot(c, p.footR);
    this.drawMuscleLimb(c, p.shoulderR, p.elbowR, 4.8 * bulk, 3.7 * bulk, 1.1);
    this.drawMuscleLimb(c, p.elbowR, p.handR, 3.8 * bulk, 2.5, 1.08);
    c.beginPath();
    c.arc(p.handR.x, p.handR.y, 3.6, 0, Math.PI * 2);
    c.fill();

    // Subtle 2.5D rim highlight on leading edge so silhouette has armor volume
    if (drawExtras) {
      c.save();
      c.strokeStyle = 'rgba(210, 225, 255, 0.14)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(p.shoulderR.x * bulk, p.shoulderR.y + 2);
      c.quadraticCurveTo(p.chest.x + 10 * bulk, p.chest.y, p.hip.x + waistW, p.hip.y);
      c.stroke();
      c.restore();
    }

    // Head + jawline
    c.beginPath();
    c.ellipse(p.head.x - 1, p.head.y - 1, 8.5, 9.8, 0.1, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(p.head.x + 2, p.head.y - 4);
    c.lineTo(p.head.x + 9, p.head.y + 1);
    c.lineTo(p.head.x + 5, p.head.y + 8);
    c.lineTo(p.head.x - 3, p.head.y + 7);
    c.closePath();
    c.fill();

    if (drawExtras) {
      this.drawHeadgear(c, p);
      this.drawWeapon(c, p);
    }

    c.restore();
  }

  private drawHeadgear(c: CanvasRenderingContext2D, p: SkeletonPose): void {
    const hg = this.config.headgear;
    const wave = Math.sin(performance.now() * 0.005) * 4;
    if (hg === 'headband') {
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(p.head.x - 7, p.head.y - 3);
      c.quadraticCurveTo(p.head.x - 22, p.head.y - 6 + wave, p.head.x - 36, p.head.y + 2 + wave);
      c.stroke();
    } else if (hg === 'kasa') {
      c.beginPath();
      c.moveTo(p.head.x - 24, p.head.y - 3);
      c.quadraticCurveTo(p.head.x + 1, p.head.y - 22, p.head.x + 26, p.head.y - 1);
      c.closePath();
      c.fill();
    } else if (hg === 'horns') {
      c.beginPath();
      c.moveTo(p.head.x - 4, p.head.y - 9);
      c.lineTo(p.head.x - 10, p.head.y - 22);
      c.lineTo(p.head.x, p.head.y - 7);
      c.fill();
      c.beginPath();
      c.moveTo(p.head.x + 4, p.head.y - 9);
      c.lineTo(p.head.x + 11, p.head.y - 21);
      c.lineTo(p.head.x + 7, p.head.y - 7);
      c.fill();
    } else if (hg === 'kabuto' || hg === 'crest') {
      c.beginPath();
      c.moveTo(p.head.x - 12, p.head.y - 4);
      c.quadraticCurveTo(p.head.x, p.head.y - 14, p.head.x + 12, p.head.y - 4);
      c.lineTo(p.head.x + 15, p.head.y + 3);
      c.lineTo(p.head.x - 15, p.head.y + 3);
      c.fill();
      c.beginPath();
      c.moveTo(p.head.x + 2, p.head.y - 10);
      c.lineTo(p.head.x + 10, p.head.y - 24);
      c.lineTo(p.head.x + 7, p.head.y - 8);
      c.fill();
    } else if (hg === 'crown') {
      c.fillRect(p.head.x - 12, p.head.y - 14, 24, 6);
    }
  }

  private drawWeapon(c: CanvasRenderingContext2D, p: SkeletonPose): void {
    const dx = p.handR.x - p.elbowR.x;
    const dy = p.handR.y - p.elbowR.y;
    const angle = Math.atan2(dy, dx);
    const cls = this.config.weapon.cls;

    c.save();
    c.translate(p.handR.x, p.handR.y);
    c.rotate(angle);
    c.lineCap = 'round';

    if (cls === 'sword') {
      c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(-12, 0); c.lineTo(0, 0); c.stroke();
      c.fillRect(-2, -6, 4, 12);
      c.beginPath(); c.moveTo(2, 0); c.quadraticCurveTo(36, -3, 68, -8); c.stroke();
    } else if (cls === 'dual_swords') {
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(32, -5, 62, -10); c.stroke();
      c.beginPath(); c.moveTo(0, 3); c.quadraticCurveTo(26, 2, 48, 7); c.stroke();
    } else if (cls === 'nunchucks') {
      c.fillRect(-6, -3, 22, 6);
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(16, 0); c.quadraticCurveTo(22, -8, 28, -14); c.stroke();
      c.fillRect(24, -18, 20, 6);
    } else if (cls === 'tonfas') {
      c.fillRect(-10, -3, 34, 6);
      c.fillRect(-2, -3, 6, 12);
    } else if (cls === 'knives') {
      c.fillRect(-6, -2, 10, 4);
      c.beginPath(); c.moveTo(4, -4); c.lineTo(34, 0); c.lineTo(4, 4); c.closePath(); c.fill();
    } else if (cls === 'claws') {
      c.lineWidth = 2;
      for (const oy of [-4, 0, 4]) {
        c.beginPath(); c.moveTo(0, oy); c.lineTo(30, oy - 2); c.stroke();
      }
    } else if (cls === 'staff') {
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(-36, 0); c.lineTo(74, 0); c.stroke();
    } else if (cls === 'axe') {
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(-16, 0); c.lineTo(56, 0); c.stroke();
      c.beginPath(); c.moveTo(38, -2); c.quadraticCurveTo(58, -22, 62, 6); c.lineTo(40, 8); c.closePath(); c.fill();
    } else {
      c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(-28, 0); c.lineTo(84, 0); c.stroke();
      c.beginPath(); c.moveTo(84, -7); c.lineTo(102, 0); c.lineTo(84, 7); c.closePath(); c.fill();
    }
    c.restore();
  }

  private drawMuscleLimb(
    c: CanvasRenderingContext2D,
    j1: { x: number; y: number },
    j2: { x: number; y: number },
    w1: number,
    w2: number,
    bulge: number,
  ): void {
    const dx = j2.x - j1.x;
    const dy = j2.y - j1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const mx = (j1.x + j2.x) * 0.5;
    const my = (j1.y + j2.y) * 0.5;
    const mw = (w1 + w2) * 0.5 * bulge;

    c.beginPath();
    c.moveTo(j1.x + nx * w1, j1.y + ny * w1);
    c.quadraticCurveTo(mx + nx * mw, my + ny * mw, j2.x + nx * w2, j2.y + ny * w2);
    c.lineTo(j2.x - nx * w2, j2.y - ny * w2);
    c.quadraticCurveTo(mx - nx * mw * 0.9, my - ny * mw * 0.9, j1.x - nx * w1, j1.y - ny * w1);
    c.closePath();
    c.fill();
    c.beginPath();
    c.arc(j1.x, j1.y, w1 * 0.85, 0, Math.PI * 2);
    c.fill();
  }

  private drawFoot(c: CanvasRenderingContext2D, joint: { x: number; y: number }): void {
    c.beginPath();
    c.moveTo(joint.x - 4, joint.y);
    c.lineTo(joint.x + 14, joint.y);
    c.lineTo(joint.x + 14, joint.y + 4.5);
    c.lineTo(joint.x - 4, joint.y + 4.5);
    c.closePath();
    c.fill();
  }
}
