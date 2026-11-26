const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { FullRankTournament } = require('./tournament');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// In-memory Room State
// roomCode -> { code, hostId, maxPlayers: 16, minPlayers: 2, players: Map(), state: 'lobby'|'tournament'|'ended', tournament: null, activeFight: null }
const rooms = new Map();

function broadcastToRoom(roomCode, payload) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const msg = JSON.stringify(payload);
  room.players.forEach(client => {
    if (client.ws && client.ws.readyState === 1) {
      client.ws.send(msg);
    }
  });
}

function getSanitizedRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    state: room.state,
    minPlayers: room.minPlayers,
    maxPlayers: room.maxPlayers,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      character: p.character,
      weapon: p.weapon,
      isHost: p.id === room.hostId,
      isAi: p.isAi,
      ready: p.ready
    })),
    tournament: room.tournament ? room.tournament.getStatus() : null,
    currentFight: room.activeFight ? {
      matchId: room.activeFight.matchId,
      fighter1: room.activeFight.fighter1,
      fighter2: room.activeFight.fighter2,
      round: room.activeFight.round,
      targetRank: room.activeFight.targetRank
    } : null
  };
}

wss.on('connection', (ws) => {
  let playerContext = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleClientMessage(ws, data, (ctx) => { playerContext = ctx; });
    } catch (e) {
      console.error("Message parse error:", e);
    }
  });

  ws.on('close', () => {
    if (playerContext) {
      const { roomCode, playerId } = playerContext;
      const room = rooms.get(roomCode);
      if (room) {
        room.players.delete(playerId);
        if (room.players.size === 0) {
          rooms.delete(roomCode);
        } else {
          if (room.hostId === playerId) {
            const nextHost = room.players.keys().next().value;
            room.hostId = nextHost;
          }
          broadcastToRoom(roomCode, {
            type: 'ROOM_UPDATE',
            room: getSanitizedRoom(room)
          });
        }
      }
    }
  });
});

function handleClientMessage(ws, data, setContext) {
  switch (data.type) {
    case 'CREATE_ROOM': {
      const roomCode = 'ROOM_' + Math.floor(1000 + Math.random() * 9000);
      const player = {
        id: data.playerId || 'P_' + Date.now(),
        name: data.playerName || 'Shadow Master',
        character: data.character || 'shadow',
        weapon: data.weapon || 'katana',
        ready: true,
        isAi: false,
        ws
      };

      const room = {
        code: roomCode,
        hostId: player.id,
        minPlayers: 2,
        maxPlayers: 16,
        state: 'lobby',
        players: new Map([[player.id, player]]),
        tournament: null,
        activeFight: null
      };

      rooms.set(roomCode, room);
      setContext({ roomCode, playerId: player.id });

      ws.send(JSON.stringify({
        type: 'ROOM_CREATED',
        room: getSanitizedRoom(room),
        myId: player.id
      }));
      break;
    }

    case 'JOIN_ROOM': {
      const room = rooms.get(data.roomCode);
      if (!room) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
      }
      if (room.players.size >= room.maxPlayers) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full (max 16 players)' }));
      }
      if (room.state !== 'lobby') {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Tournament already in progress' }));
      }

      const player = {
        id: data.playerId || 'P_' + Date.now(),
        name: data.playerName || ('Ninja ' + (room.players.size + 1)),
        character: data.character || 'ninja',
        weapon: data.weapon || 'nunchaku',
        ready: true,
        isAi: false,
        ws
      };

      room.players.set(player.id, player);
      setContext({ roomCode: room.code, playerId: player.id });

      ws.send(JSON.stringify({
        type: 'ROOM_JOINED',
        room: getSanitizedRoom(room),
        myId: player.id
      }));

      broadcastToRoom(room.code, {
        type: 'ROOM_UPDATE',
        room: getSanitizedRoom(room)
      });
      break;
    }

    case 'ADD_AI_BOT': {
      const room = rooms.get(data.roomCode);
      if (!room || room.players.size >= room.maxPlayers) return;
      const botNames = ['Lynx Disciple', 'Shogun Guard', 'Hermit Sage', 'Butcher Minion', 'Wasp Stinger', 'Titan Slayer', 'Ronin', 'Kunoichi'];
      const weapons = ['katana', 'kusarigama', 'nunchaku', 'daisho', 'magicspear'];
      const chars = ['shadow', 'lynx', 'shogun', 'titan', 'monk'];
      const botIdx = room.players.size + 1;
      const botId = 'BOT_' + botIdx + '_' + Date.now().toString(36);

      const bot = {
        id: botId,
        name: botNames[(botIdx - 1) % botNames.length] + ' #' + botIdx,
        character: chars[botIdx % chars.length],
        weapon: weapons[botIdx % weapons.length],
        ready: true,
        isAi: true,
        ws: null
      };

      room.players.set(bot.id, bot);
      broadcastToRoom(room.code, {
        type: 'ROOM_UPDATE',
        room: getSanitizedRoom(room)
      });
      break;
    }

    case 'START_TOURNAMENT': {
      const room = rooms.get(data.roomCode);
      if (!room) return;
      if (room.players.size < room.minPlayers) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Need at least 2 players to start tournament' }));
      }

      const playerList = Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        character: p.character,
        weapon: p.weapon,
        isAi: p.isAi
      }));

      room.tournament = new FullRankTournament(room.code, playerList);
      room.state = 'tournament';

      // Start first pending match
      startNextMatchInRoom(room);
      break;
    }

    case 'COMBAT_ACTION': {
      // Broadcast real-time inputs / combat updates to spectators and opponent in room
      const room = rooms.get(data.roomCode);
      if (!room || !room.activeFight) return;
      
      broadcastToRoom(room.code, {
        type: 'COMBAT_UPDATE',
        action: data.action, // attack, move, block, hit, state
        variant: data.variant,
        sourceId: data.sourceId,
        state: data.state
      });
      break;
    }

    case 'MATCH_ROUND_OVER': {
      const room = rooms.get(data.roomCode);
      if (!room || !room.activeFight) return;

      const { winnerId, score } = data;
      room.tournament.submitMatchResult(room.activeFight.matchId, winnerId, score || [2, 0]);
      room.activeFight = null;

      if (room.tournament.isCompleted) {
        room.state = 'ended';
        broadcastToRoom(room.code, {
          type: 'TOURNAMENT_COMPLETED',
          rankings: room.tournament.getStatus().rankings,
          room: getSanitizedRoom(room)
        });
      } else {
        broadcastToRoom(room.code, {
          type: 'MATCH_CONCLUDED',
          tournament: room.tournament.getStatus(),
          room: getSanitizedRoom(room)
        });
        // small timeout before next 1v1 match starts
        setTimeout(() => {
          if (room && room.state === 'tournament') {
            startNextMatchInRoom(room);
          }
        }, 3000);
      }
      break;
    }
  }
}

function startNextMatchInRoom(room) {
  const nextMatch = room.tournament.getNextPendingMatch();
  if (!nextMatch) {
    if (room.tournament.isCompleted) {
      room.state = 'ended';
      broadcastToRoom(room.code, {
        type: 'TOURNAMENT_COMPLETED',
        rankings: room.tournament.getStatus().rankings,
        room: getSanitizedRoom(room)
      });
    }
    return;
  }

  nextMatch.state = 'in_progress';
  room.activeFight = {
    matchId: nextMatch.id,
    fighter1: nextMatch.player1,
    fighter2: nextMatch.player2,
    round: nextMatch.round,
    targetRank: nextMatch.rankRange ? `${nextMatch.rankRange[0]} - ${nextMatch.rankRange[1]}` : 'Placement'
  };

  broadcastToRoom(room.code, {
    type: 'MATCH_STARTED',
    match: room.activeFight,
    tournament: room.tournament.getStatus(),
    room: getSanitizedRoom(room)
  });
}

server.listen(PORT, () => {
  console.log(`Shadow Fight 2 Tournament Server running on http://localhost:${PORT}`);
});
