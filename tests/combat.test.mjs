import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { FullRankTournament } = require('../server/tournament.js');

test('FullRankTournament classifies all 4 players into ranks 1..4', () => {
  const players = [
    { id: 'p1', name: 'A', character: 'kurogane', isAi: false },
    { id: 'p2', name: 'B', character: 'kitsune', isAi: true },
    { id: 'p3', name: 'C', character: 'tetsuo', isAi: true },
    { id: 'p4', name: 'D', character: 'kaelor', isAi: true },
  ];
  const t = new FullRankTournament('TEST', players);
  while (!t.isCompleted) {
    const m = t.getNextPendingMatch();
    assert.ok(m, 'Pending match must exist before completion');
    t.submitMatchResult(m.id, m.player1.id, [2, 0]);
  }
  const ranks = t.getStatus().rankings.map((r) => r.rank);
  assert.deepEqual(ranks, [1, 2, 3, 4]);
});

test('FullRankTournament classifies all 16 players into unique ranks 1..16', () => {
  const players = Array.from({ length: 16 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Fighter ${i + 1}`,
    character: 'kurogane',
    isAi: i > 0,
  }));
  const t = new FullRankTournament('TEST16', players);
  while (!t.isCompleted) {
    const m = t.getNextPendingMatch();
    assert.ok(m);
    t.submitMatchResult(m.id, m.player1.id, [2, 0]);
  }
  const ranks = t.getStatus().rankings.map((r) => r.rank);
  assert.deepEqual(ranks, Array.from({ length: 16 }, (_, i) => i + 1));
});
