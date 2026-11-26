import Phaser from 'phaser';
import { ArenaScene } from './scenes/ArenaScene';
import { CHALLENGES, STORY_CHAPTERS } from './systems/GameModes';
import { applyProgressionToFighter, awardMatchRewards, getUpgradeCost, upgradeEquipmentSlot } from './systems/ProgressionSystem';
import { type EquipSlot, loadSave, type SaveData, writeSave } from './systems/SaveSystem';
import { FIGHTER_ROSTER, WEAPONS } from './systems/WeaponsAndRoster';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: 960,
  height: 540,
  parent: 'gameContainer',
  backgroundColor: '#070810',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [ArenaScene],
};

const game = new Phaser.Game(config);
let save: SaveData = loadSave();
let activeMode: 'story' | 'duel' | 'survival' | 'challenge' | 'training' | 'tournament' = 'duel';
let survivalWave = 1;
let currentChallengeId = '';

// Custom Room WebSocket state
let ws: WebSocket | null = null;
let myWsId = 'P_' + Math.random().toString(36).slice(2, 8);
let wsRoom: { code: string; hostId: string; players: { id: string; name: string; character: string; isAi: boolean }[] } | null = null;

function getScene(): ArenaScene | null {
  return (game.scene.getScene('ArenaScene') as ArenaScene) || null;
}

function showTab(name: string): void {
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`tab-${name}`)?.classList.add('active');
}

function syncHeader(): void {
  const el = (id: string) => document.getElementById(id);
  const lv = el('hudLevel');
  const co = el('hudCoins');
  const ge = el('hudGems');
  if (lv) lv.textContent = `LV ${save.level}`;
  if (co) co.textContent = `🪙 ${save.coins}`;
  if (ge) ge.textContent = `💎 ${save.gems}`;

  const ch = STORY_CHAPTERS[Math.min(save.storyChapter, STORY_CHAPTERS.length - 1)];
  const sp = el('storyProgressDesc');
  if (sp) sp.textContent = save.storyChapter >= STORY_CHAPTERS.length ? 'All Chapters Cleared!' : ch.title;
  const sb = el('survivalBestDesc');
  if (sb) sb.textContent = `Best Wave: ${save.survivalBest}`;
}

function renderRoster(): void {
  const wrap = document.getElementById('rosterCards');
  if (!wrap) return;
  wrap.innerHTML = '';
  FIGHTER_ROSTER.forEach((f) => {
    const d = document.createElement('div');
    d.className = 'card' + (save.selectedFighterId === f.id ? ' sel' : '');
    d.innerHTML = `<h3>${f.name}</h3><p>${f.title}</p><p>Weapon: <b>${f.weapon.name}</b></p><p>HP: ${f.maxHp} · Style: ${f.archetype}</p>`;
    const btn = document.createElement('button');
    btn.className = save.selectedFighterId === f.id ? 'btn-gold' : '';
    btn.textContent = save.selectedFighterId === f.id ? 'Selected' : 'Select Warrior';
    btn.onclick = () => {
      save.selectedFighterId = f.id;
      writeSave(save);
      renderRoster();
    };
    d.appendChild(btn);
    wrap.appendChild(d);
  });
}

function renderEquip(): void {
  const selW = document.getElementById('selEquipWeapon') as HTMLSelectElement | null;
  if (selW && selW.options.length === 0) {
    Object.values(WEAPONS).forEach((w) => selW.add(new Option(`${w.name} (${w.cls}, DMG ${w.damage})`, w.id)));
    selW.onchange = () => {
      save.equippedWeaponId = selW.value;
      writeSave(save);
      renderEquip();
    };
  }
  if (selW) selW.value = save.equippedWeaponId;

  const wrap = document.getElementById('equipCards');
  if (!wrap) return;
  wrap.innerHTML = '';
  const slots: EquipSlot[] = ['helmet', 'armor', 'gloves', 'boots', 'weapon', 'ranged', 'magic'];
  slots.forEach((slot) => {
    const lv = save.equipLevels[slot] || 1;
    const cost = getUpgradeCost(lv);
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<h3>${slot.toUpperCase()}</h3><p>Level ${lv}</p>`;
    const btn = document.createElement('button');
    btn.className = 'btn-gold';
    btn.textContent = `Upgrade (🪙 ${cost})`;
    btn.disabled = save.coins < cost;
    btn.onclick = () => {
      const res = upgradeEquipmentSlot(save, slot);
      if (res.ok) {
        save = res.save;
        writeSave(save);
        syncHeader();
        renderEquip();
      }
    };
    d.appendChild(btn);
    wrap.appendChild(d);
  });
}

function launchBattle(
  oppId: string,
  stage: 'temple' | 'titan_hall',
  mode: typeof activeMode,
  opts?: { training?: boolean; noBlock?: boolean; eclipse?: boolean; p1StartHp?: number; label?: string },
): void {
  const sc = getScene();
  if (!sc) return;
  activeMode = mode;
  const baseP1 = FIGHTER_ROSTER.find((f) => f.id === save.selectedFighterId) || FIGHTER_ROSTER[0];
  const baseP2 = FIGHTER_ROSTER.find((f) => f.id === oppId) || FIGHTER_ROSTER[1];
  const p1Cfg = applyProgressionToFighter({ ...baseP1, isAi: false }, save);
  const p2Cfg = { ...baseP2, isAi: true };

  const el = (id: string) => document.getElementById(id);
  const f1N = el('f1Name');
  const f2N = el('f2Name');
  const modeLbl = el('arenaModeLabel');
  if (f1N) f1N.textContent = p1Cfg.name;
  if (f2N) f2N.textContent = p2Cfg.name;
  if (modeLbl) modeLbl.textContent = opts?.label || mode.toUpperCase();

  showTab('arena');

  sc.setCallbacks({
    onHudUpdate: (hp1, en1, hp2, en2, timer) => {
      const f1Hp = el('f1Hp');
      const f2Hp = el('f2Hp');
      const f1En = el('f1Energy');
      const f2En = el('f2Energy');
      const tm = el('combatTimer');
      if (f1Hp) f1Hp.style.width = `${hp1}%`;
      if (f2Hp) f2Hp.style.width = `${hp2}%`;
      if (f1En) f1En.style.width = `${en1}%`;
      if (f2En) f2En.style.width = `${en2}%`;
      if (tm) tm.textContent = String(timer);
    },
    onMatchEnd: (winnerId) => {
      if (activeMode === 'training') return;
      const won = winnerId === p1Cfg.id;
      if (activeMode === 'tournament' && ws && wsRoom) {
        ws.send(JSON.stringify({ type: 'MATCH_ROUND_OVER', roomCode: wsRoom.code, winnerId, score: [won ? 1 : 0, won ? 0 : 1] }));
        return;
      }
      if (activeMode === 'survival' && won) {
        const carryHp = Math.min(p1Cfg.maxHp, Math.round(sc.p1.hp + p1Cfg.maxHp * 0.25));
        survivalWave++;
        if (survivalWave - 1 > save.survivalBest) save.survivalBest = survivalWave - 1;
        writeSave(save);
        const nextOpp = FIGHTER_ROSTER[survivalWave % FIGHTER_ROSTER.length];
        launchBattle(nextOpp.id, survivalWave % 2 === 0 ? 'titan_hall' : 'temple', 'survival', {
          p1StartHp: carryHp,
          label: `SURVIVAL WAVE ${survivalWave}`,
        });
        return;
      }

      const rew = awardMatchRewards(save, won, activeMode);
      save = rew.save;
      if (won && activeMode === 'story' && save.storyChapter < STORY_CHAPTERS.length) save.storyChapter++;
      if (won && activeMode === 'challenge' && currentChallengeId && !save.completedChallenges.includes(currentChallengeId)) {
        save.completedChallenges.push(currentChallengeId);
      }
      writeSave(save);
      syncHeader();

      const modal = el('resultModal');
      const title = el('resTitle');
      const body = el('resBody');
      if (title) title.textContent = won ? 'VICTORY!' : 'DEFEAT';
      if (body) body.textContent = `+${rew.xpGain} XP · +${rew.coinGain} Coins${rew.gemGain ? ` · +${rew.gemGain} Gems` : ''}${rew.leveledUp ? ' · LEVEL UP!' : ''}`;
      modal?.classList.add('show');
    },
  });

  sc.startMatch(p1Cfg, p2Cfg, stage, opts);
}

function connectTournamentWs(): void {
  if (ws && ws.readyState === 1) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = location.port === '5173' ? `ws://${location.hostname}:3000` : `${proto}//${location.host}`;
  ws = new WebSocket(url);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'ROOM_CREATED' || msg.type === 'ROOM_JOINED' || msg.type === 'ROOM_UPDATE') {
      if (msg.myId) myWsId = msg.myId;
      wsRoom = msg.room;
      renderTournamentRoom();
    } else if (msg.type === 'MATCH_STARTED') {
      wsRoom = msg.room;
      const m = msg.match;
      const sc = getScene();
      if (!sc) return;
      activeMode = 'tournament';
      const f1Base = FIGHTER_ROSTER.find((f) => f.id === m.fighter1.character) || FIGHTER_ROSTER[0];
      const f2Base = FIGHTER_ROSTER.find((f) => f.id === m.fighter2.character) || FIGHTER_ROSTER[1];
      const f1Cfg = { ...f1Base, id: m.fighter1.id, name: m.fighter1.name, isAi: m.fighter1.isAi };
      const f2Cfg = { ...f2Base, id: m.fighter2.id, name: m.fighter2.name, isAi: m.fighter2.isAi };
      const el = (id: string) => document.getElementById(id);
      if (el('f1Name')) el('f1Name')!.textContent = f1Cfg.name;
      if (el('f2Name')) el('f2Name')!.textContent = f2Cfg.name;
      if (el('arenaModeLabel')) el('arenaModeLabel')!.textContent = `TOURNAMENT [${m.targetRank}]`;
      showTab('arena');
      sc.startMatch(f1Cfg, f2Cfg, 'temple');
    } else if (msg.type === 'MATCH_CONCLUDED' || msg.type === 'TOURNAMENT_COMPLETED') {
      wsRoom = msg.room;
      showTab('tournament');
      const st = document.getElementById('tourStandings');
      const ranks = msg.rankings || msg.tournament?.rankings || [];
      if (st) {
        st.innerHTML = '<h3>Rankings</h3>' + ranks.map((r: { rank: number; player: { name: string } }) => `<div>#${r.rank} — ${r.player.name}</div>`).join('');
      }
    }
  };
}

function renderTournamentRoom(): void {
  const st = document.getElementById('wsRoomStatus');
  const grid = document.getElementById('tourRosterGrid');
  const addBot = document.getElementById('btnAddBot') as HTMLButtonElement | null;
  const start = document.getElementById('btnStartTour') as HTMLButtonElement | null;
  if (!wsRoom || !grid) return;
  if (st) st.textContent = `Room: ${wsRoom.code} (${wsRoom.players.length}/16)`;
  const isHost = wsRoom.hostId === myWsId;
  if (addBot) addBot.disabled = !isHost || wsRoom.players.length >= 16;
  if (start) start.disabled = !isHost || wsRoom.players.length < 2;
  grid.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const p = wsRoom.players[i];
    const d = document.createElement('div');
    d.className = 'slot' + (p ? ' occ' : '');
    d.textContent = p ? `#${i + 1} ${p.name}` : `#${i + 1} [Empty]`;
    grid.appendChild(d);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  syncHeader();
  renderRoster();
  renderEquip();
  connectTournamentWs();

  document.querySelectorAll<HTMLButtonElement>('[data-tab], [data-tab-jump]').forEach((b) => {
    b.addEventListener('click', () => {
      const t = b.dataset.tab || b.dataset.tabJump;
      if (t) showTab(t);
    });
  });

  const selDuel = document.getElementById('selDuelOpp') as HTMLSelectElement | null;
  if (selDuel) {
    FIGHTER_ROSTER.forEach((f) => selDuel.add(new Option(`${f.name} (${f.title})`, f.id)));
    selDuel.value = 'kaelor';
  }

  const chWrap = document.getElementById('challengeBtns');
  if (chWrap) {
    CHALLENGES.forEach((ch) => {
      const b = document.createElement('button');
      b.textContent = ch.title;
      b.onclick = () => {
        currentChallengeId = ch.id;
        launchBattle(ch.opponentId, ch.stage, 'challenge', { eclipse: ch.eclipse, noBlock: ch.noBlock, label: ch.title });
      };
      chWrap.appendChild(b);
    });
  }

  document.getElementById('btnPlayStory')?.addEventListener('click', () => {
    const ch = STORY_CHAPTERS[Math.min(save.storyChapter, STORY_CHAPTERS.length - 1)];
    launchBattle(ch.opponentId, ch.stage, 'story', { label: ch.title });
  });
  document.getElementById('btnPlaySurvival')?.addEventListener('click', () => {
    survivalWave = 1;
    launchBattle(FIGHTER_ROSTER[1].id, 'temple', 'survival', { label: 'SURVIVAL WAVE 1' });
  });
  document.getElementById('btnPlayDuel')?.addEventListener('click', () => {
    const opp = selDuel?.value || 'kaelor';
    const st = ((document.getElementById('selStage') as HTMLSelectElement | null)?.value as 'temple' | 'titan_hall') || 'temple';
    launchBattle(opp, st, 'duel');
  });
  document.getElementById('btnPlayTraining')?.addEventListener('click', () => {
    launchBattle('oboro', 'temple', 'training', { training: true, label: 'TRAINING DOJO' });
  });

  document.getElementById('btnDebug')?.addEventListener('click', () => {
    const sc = getScene();
    if (sc) sc.debugMode = !sc.debugMode;
  });
  document.getElementById('btnExitArena')?.addEventListener('click', () => showTab('menu'));
  document.getElementById('btnResContinue')?.addEventListener('click', () => {
    document.getElementById('resultModal')?.classList.remove('show');
    showTab('menu');
  });

  document.getElementById('btnCreateRoom')?.addEventListener('click', () => {
    connectTournamentWs();
    const f = FIGHTER_ROSTER.find((x) => x.id === save.selectedFighterId) || FIGHTER_ROSTER[0];
    ws?.send(JSON.stringify({ type: 'CREATE_ROOM', playerId: myWsId, playerName: f.name, character: f.id, weapon: save.equippedWeaponId }));
  });
  document.getElementById('btnJoinRoom')?.addEventListener('click', () => {
    const code = (document.getElementById('inpRoomCode') as HTMLInputElement | null)?.value.trim();
    if (!code) return;
    const f = FIGHTER_ROSTER.find((x) => x.id === save.selectedFighterId) || FIGHTER_ROSTER[0];
    ws?.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: code, playerId: myWsId, playerName: f.name, character: f.id, weapon: save.equippedWeaponId }));
  });
  document.getElementById('btnAddBot')?.addEventListener('click', () => {
    if (wsRoom) ws?.send(JSON.stringify({ type: 'ADD_AI_BOT', roomCode: wsRoom.code }));
  });
  document.getElementById('btnStartTour')?.addEventListener('click', () => {
    if (wsRoom) ws?.send(JSON.stringify({ type: 'START_TOURNAMENT', roomCode: wsRoom.code }));
  });

  document.querySelectorAll<HTMLButtonElement>('#touchControls button').forEach((btn) => {
    const act = btn.dataset.act;
    btn.addEventListener('pointerdown', () => { if (act) getScene()?.setTouchInput({ [act]: true }); });
    btn.addEventListener('pointerup', () => {
      if (act && (act === 'left' || act === 'right' || act === 'block' || act === 'down' || act === 'up')) {
        getScene()?.setTouchInput({ [act]: false });
      }
    });
  });
});
