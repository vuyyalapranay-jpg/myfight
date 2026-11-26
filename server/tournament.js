/**
 * Tournament Bracket Engine with Complete Placement Classification (1st through Nth rank)
 * Supports 2 to 16 players (powers of 2: 2, 4, 8, 16, or any arbitrary N with byes).
 * 
 * Rules:
 * - Match phase 1v1.
 * - Winners advance to face other winners until 1 winner remains -> 1st Place!
 * - Losers face other losers in parallel sub-brackets to establish exact places (2nd, 3rd, 4th, ... down to 16th).
 */

class FullRankTournament {
  constructor(roomCode, players) {
    this.roomCode = roomCode;
    // players: array of { id, name, character, isAi, rating }
    this.initialPlayers = [...players];
    this.totalPlayers = players.length;
    
    // Normalize to power of 2 if needed (2, 4, 8, 16)
    this.size = this.calculateBracketSize(this.totalPlayers);
    this.matches = [];
    this.currentMatchIndex = 0;
    this.finalRankings = []; // ordered 1st to Nth
    this.isCompleted = false;

    this.initializeTournament();
  }

  calculateBracketSize(count) {
    if (count <= 2) return 2;
    if (count <= 4) return 4;
    if (count <= 8) return 8;
    return 16;
  }

  initializeTournament() {
    // Fill with byes or AI if not exact power of 2
    const roster = [...this.initialPlayers];
    let aiIndex = 1;
    while (roster.length < this.size) {
      roster.push({
        id: `bot_${aiIndex}`,
        name: `Shadow Ninja ${aiIndex}`,
        character: ['ninja', 'monk', 'lynx', 'titan', 'shogun'][aiIndex % 5],
        isAi: true,
        rating: 1200 + Math.floor(Math.random() * 300)
      });
      aiIndex++;
    }

    // Bracket trees:
    // We model rounds as levels.
    // At level 0, we have size/2 matches.
    // Each match has a tier/rankRange it resolves: e.g. [1, 16] -> winners fight for [1, 8], losers fight for [9, 16]
    this.matches = [];
    this.activeMatches = [];
    
    this.createBracketStage(roster, 1, this.size, 1);
  }

  createBracketStage(competitors, minRank, maxRank, roundNumber) {
    if (competitors.length === 1) {
      this.finalRankings.push({
        rank: minRank,
        player: competitors[0]
      });
      return;
    }

    if (competitors.length === 2) {
      const match = {
        id: `M_${minRank}_${maxRank}_R${roundNumber}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        player1: competitors[0],
        player2: competitors[1],
        round: roundNumber,
        rankRange: [minRank, maxRank],
        winnerTargetRank: minRank,
        loserTargetRank: maxRank,
        state: 'ready', // 'ready', 'in_progress', 'completed'
        winner: null,
        loser: null,
        score: [0, 0]
      };
      this.matches.push(match);
      return;
    }

    // For N > 2:
    // Pair up competitors
    const half = competitors.length / 2;
    const midRank = minRank + half - 1;

    for (let i = 0; i < competitors.length; i += 2) {
      const match = {
        id: `M_R${roundNumber}_P${i}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        player1: competitors[i],
        player2: competitors[i + 1],
        round: roundNumber,
        rankRange: [minRank, maxRank],
        winnerSubRange: [minRank, midRank],
        loserSubRange: [midRank + 1, maxRank],
        state: 'ready',
        winner: null,
        loser: null,
        score: [0, 0]
      };
      this.matches.push(match);
    }
  }

  getNextPendingMatch() {
    return this.matches.find(m => m.state === 'ready');
  }

  submitMatchResult(matchId, winnerId, score = [2, 0]) {
    const match = this.matches.find(m => m.id === matchId);
    if (!match || match.state === 'completed') return null;

    const winner = match.player1.id === winnerId ? match.player1 : match.player2;
    const loser = match.player1.id === winnerId ? match.player2 : match.player1;

    match.winner = winner;
    match.loser = loser;
    match.score = score;
    match.state = 'completed';

    // If this was a 2-person classification match:
    if (match.winnerTargetRank !== undefined) {
      this.finalRankings.push({ rank: match.winnerTargetRank, player: winner });
      this.finalRankings.push({ rank: match.loserTargetRank, player: loser });
    }

    // Check if current round stage matches are all completed to trigger next tier brackets
    this.checkAndGenerateNextStage();

    return match;
  }

  checkAndGenerateNextStage() {
    // Check if any sub-ranges have accumulated enough winners/losers
    const completedMatches = this.matches.filter(m => m.state === 'completed');
    const pendingMatches = this.matches.filter(m => m.state === 'ready' || m.state === 'in_progress');

    if (pendingMatches.length === 0) {
      // Group completed matches that need follow up
      const unadvancedRounds = {};
      completedMatches.forEach(m => {
        if (!m.advanced && m.winnerSubRange) {
          const keyW = `W_${m.winnerSubRange[0]}_${m.winnerSubRange[1]}`;
          const keyL = `L_${m.loserSubRange[0]}_${m.loserSubRange[1]}`;
          
          if (!unadvancedRounds[keyW]) unadvancedRounds[keyW] = { range: m.winnerSubRange, players: [], sourceMatches: [] };
          if (!unadvancedRounds[keyL]) unadvancedRounds[keyL] = { range: m.loserSubRange, players: [], sourceMatches: [] };

          unadvancedRounds[keyW].players.push(m.winner);
          unadvancedRounds[keyW].sourceMatches.push(m);

          unadvancedRounds[keyL].players.push(m.loser);
          unadvancedRounds[keyL].sourceMatches.push(m);
        }
      });

      let generatedAny = false;
      for (const key in unadvancedRounds) {
        const group = unadvancedRounds[key];
        const expectedCount = group.range[1] - group.range[0] + 1;
        if (group.players.length === expectedCount && expectedCount > 1) {
          group.sourceMatches.forEach(m => m.advanced = true);
          this.createBracketStage(group.players, group.range[0], group.range[1], (this.matches[this.matches.length - 1]?.round || 1) + 1);
          generatedAny = true;
        }
      }

      // Check if tournament is completely resolved
      if (!generatedAny && this.matches.every(m => m.state === 'completed')) {
        this.isCompleted = true;
        this.finalRankings.sort((a, b) => a.rank - b.rank);
      }
    }
  }

  getStatus() {
    return {
      roomCode: this.roomCode,
      totalPlayers: this.totalPlayers,
      bracketSize: this.size,
      matches: this.matches,
      rankings: [...this.finalRankings].sort((a, b) => a.rank - b.rank),
      isCompleted: this.isCompleted
    };
  }
}

module.exports = { FullRankTournament };
