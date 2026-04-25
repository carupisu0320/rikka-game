const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname)));

const PORT     = process.env.PORT || 3000;
const WIN_SCORE = 10;

// ── ルーム管理 ──────────────────────────────────────
// rooms: Map<roomId, RoomState>
// RoomState = {
//   players: [{socketId, name, hand, score}],
//   field:    [{id,top,bot,flip,discarded}],  // 全牌
//   turn:     number,   // players index
//   tphase:   'pick'|'discard',
//   phase:    'waiting'|'playing'|'roundEnd'|'gameOver',
// }
const rooms = new Map();

// ── デッキ生成 42枚 ──────────────────────────────────
function makeDeck() {
  const d = [];
  let id = 0;
  for (let t = 1; t <= 6; t++)
    for (let b = 1; b <= 6; b++) {
      d.push({ id: id++, top: t, bot: b, flip: false, discarded: false });
      if (t === b) d.push({ id: id++, top: t, bot: b, flip: false, discarded: false });
    }
  return shuffle(d);
}
function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function eTop(t) { return t.flip ? t.bot : t.top; }
function eBot(t) { return t.flip ? t.top : t.bot; }

// ── 役判定 ───────────────────────────────────────────
function checkWin(hand) {
  if (hand.length !== 6) return null;
  const tops = hand.map(eTop);
  const bots = hand.map(eBot);
  const allBotSame = bots.every(v => v === bots[0]);

  if (allBotSame) {
    const st = [...tops].sort((a, b) => a - b);
    if (st.join(',') === '1,2,3,4,5,6') return { role: '六華', pts: 6 };
  }
  if (isSanren(hand)) return { role: '三連', pts: 3 };
  if (allBotSame) return { role: '一色', pts: 1 };
  return null;
}
function isSanren(hand) {
  for (let mask = 0; mask < (1 << 6); mask++) {
    if (popcount(mask) !== 3) continue;
    const g1 = [], g2 = [];
    for (let i = 0; i < 6; i++) (mask & (1 << i) ? g1 : g2).push(hand[i]);
    if (isSet3(g1) && isSet3(g2)) return true;
  }
  return false;
}
function isSet3(g) {
  if (g.length !== 3) return false;
  const bots = g.map(eBot);
  if (!bots.every(v => v === bots[0])) return false;
  const tops = g.map(eTop).sort((a, b) => a - b);
  return tops[1] === tops[0] + 1 && tops[2] === tops[1] + 1;
}
function popcount(n) { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; }
function countZorome(hand) { return hand.filter(t => t.top === t.bot).length; }

// ── ゲーム開始 ───────────────────────────────────────
function dealRound(room) {
  const deck = makeDeck();
  let idx = 0;
  room.players.forEach(p => { p.hand = deck.slice(idx, idx + 5); idx += 5; });
  room.field  = deck.slice(idx);
  room.turn   = 0;
  room.tphase = 'pick';
  room.phase  = 'playing';
}

// ── 各クライアントへ state 送信 ──────────────────────
function sendState(room) {
  room.players.forEach((p, myIdx) => {
    const opp = room.players.map((q, qi) => ({
      name:      q.name,
      score:     q.score,
      handCount: q.hand.length,
      isCurrentTurn: qi === room.turn,
    })).filter((_, qi) => qi !== myIdx);

    const normalCount  = room.field.filter(t => !t.discarded).length;
    const discardTiles = room.field.filter(t =>  t.discarded);

    io.to(p.socketId).emit('game_state', {
      myHand:       p.hand,
      myIndex:      myIdx,
      currentTurn:  room.turn,
      tphase:       room.tphase,
      phase:        room.phase,
      scores:       room.players.map(q => ({ name: q.name, score: q.score })),
      opponents:    opp,
      normalCount,       // 裏向き枚数
      discardTiles,      // 捨て牌（表向き）
    });
  });
}

function broadcastRoom(roomId, event, data) {
  io.to(roomId).emit(event, data);
}

function lobbyState(room) {
  return {
    players:  room.players.map(p => p.name),
    canStart: room.players.length >= 2,
  };
}

// ── Socket.IO ────────────────────────────────────────
io.on('connection', (socket) => {
  let myRoomId = null;

  // ── 入室 ──
  socket.on('join_room', ({ roomId, playerName }) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { players: [], field: [], turn: 0, tphase: 'pick', phase: 'waiting' });
    }
    const room = rooms.get(roomId);
    if (room.phase !== 'waiting') {
      socket.emit('error_msg', 'すでにゲームが始まっています');
      return;
    }
    if (room.players.length >= 4) {
      socket.emit('error_msg', '部屋が満員です（最大4人）');
      return;
    }
    room.players.push({ socketId: socket.id, name: playerName, hand: [], score: 0 });
    socket.join(roomId);
    myRoomId = roomId;
    socket.emit('joined', { roomId, playerName });
    broadcastRoom(roomId, 'room_update', lobbyState(room));
  });

  // ── ゲーム開始 ──
  socket.on('start_game', () => {
    const room = myRoomId && rooms.get(myRoomId);
    if (!room || room.phase !== 'waiting' || room.players.length < 2) return;
    dealRound(room);
    broadcastRoom(myRoomId, 'game_start', { playerNames: room.players.map(p => p.name) });
    sendState(room);
  });

  // ── 裏向き場牌をピック（サーバーがランダムに選ぶ） ──
  socket.on('pick_field', () => {
    const room = myRoomId && rooms.get(myRoomId);
    if (!room || room.phase !== 'playing') return;
    const pi = room.players.findIndex(p => p.socketId === socket.id);
    if (pi !== room.turn || room.tphase !== 'pick') return;
    const p = room.players[pi];
    if (p.hand.length >= 6) { socket.emit('error_msg', 'もう持てないよ！'); return; }

    const normals = room.field.map((t, i) => ({ t, i })).filter(x => !x.t.discarded);
    if (normals.length === 0) { socket.emit('error_msg', '場に牌がありません'); return; }
    const { t: tile, i: fi } = normals[Math.floor(Math.random() * normals.length)];
    room.field.splice(fi, 1);
    p.hand.push(tile);
    room.tphase = 'discard';

    // 引いた牌だけその人に通知
    socket.emit('picked_tile', { tile });
    sendState(room);
  });

  // ── 捨て牌をピック ──
  socket.on('pick_discard', ({ tileId }) => {
    const room = myRoomId && rooms.get(myRoomId);
    if (!room || room.phase !== 'playing') return;
    const pi = room.players.findIndex(p => p.socketId === socket.id);
    if (pi !== room.turn || room.tphase !== 'pick') return;
    const p = room.players[pi];
    if (p.hand.length >= 6) { socket.emit('error_msg', 'もう持てないよ！'); return; }

    const fi = room.field.findIndex(t => t.discarded && t.id === tileId);
    if (fi === -1) return;
    const [tile] = room.field.splice(fi, 1);
    tile.discarded = false;
    p.hand.push(tile);
    room.tphase = 'discard';
    socket.emit('picked_tile', { tile });
    sendState(room);
  });

  // ── 捨て牌 ──
  socket.on('discard_tile', ({ tileId }) => {
    const room = myRoomId && rooms.get(myRoomId);
    if (!room || room.phase !== 'playing') return;
    const pi = room.players.findIndex(p => p.socketId === socket.id);
    if (pi !== room.turn || room.tphase !== 'discard') return;
    const p = room.players[pi];
    if (p.hand.length <= 5) { socket.emit('error_msg', 'これ以上捨てれないよ！'); return; }

    const hi = p.hand.findIndex(t => t.id === tileId);
    if (hi === -1) return;
    const [tile] = p.hand.splice(hi, 1);
    tile.discarded = true;
    room.field.push(tile);
    room.turn   = (room.turn + 1) % room.players.length;
    room.tphase = 'pick';
    sendState(room);
  });

  // ── 上がり宣言 ──
  socket.on('declare_win', ({ flips }) => {
    // flips: [{tileId, flip}] — クライアントの反転状態をサーバーに送る
    const room = myRoomId && rooms.get(myRoomId);
    if (!room || room.phase !== 'playing') return;
    const pi = room.players.findIndex(p => p.socketId === socket.id);
    if (pi !== room.turn || room.tphase !== 'discard') return;
    const p = room.players[pi];
    if (p.hand.length !== 6) return;

    // フリップ状態を反映してから判定
    if (flips) flips.forEach(({ tileId, flip }) => {
      const t = p.hand.find(x => x.id === tileId);
      if (t) t.flip = flip;
    });

    const res = checkWin(p.hand);
    if (!res) { socket.emit('error_msg', 'まだ役が揃っていません'); return; }

    const bonus = countZorome(p.hand);
    res.bonus = bonus;
    p.score += res.pts + bonus;
    room.phase = 'roundEnd';

    broadcastRoom(myRoomId, 'round_win', {
      playerName: p.name,
      role:       res.role,
      pts:        res.pts,
      bonus,
      hand:       p.hand,
      scores:     room.players.map(q => ({ name: q.name, score: q.score })),
      isGameOver: p.score >= WIN_SCORE,
      winner:     p.score >= WIN_SCORE ? p.name : null,
    });
  });

  // ── 手牌の並び替えをサーバーに同期 ──
  socket.on('reorder_hand', ({ order }) => {
    const room = myRoomId && rooms.get(myRoomId);
    if (!room) return;
    const p = room.players.find(x => x.socketId === socket.id);
    if (!p) return;
    // order: [0,2,1,3,4,5] のような並び替えindex
    const newHand = order.map(i => p.hand[i]).filter(Boolean);
    if (newHand.length === p.hand.length) p.hand = newHand;
  });

  // ── 次のラウンド ──
  socket.on('next_round', () => {
    const room = myRoomId && rooms.get(myRoomId);
    if (!room || room.phase !== 'roundEnd') return;
    dealRound(room);
    broadcastRoom(myRoomId, 'game_start', { playerNames: room.players.map(p => p.name) });
    sendState(room);
  });

  // ── 切断 ──
  socket.on('disconnect', () => {
    const room = myRoomId && rooms.get(myRoomId);
    if (!room) return;
    const pi = room.players.findIndex(p => p.socketId === socket.id);
    if (pi === -1) return;
    const name = room.players[pi].name;
    room.players.splice(pi, 1);

    if (room.players.length === 0) {
      rooms.delete(myRoomId);
    } else {
      broadcastRoom(myRoomId, 'player_left', { name });
      if (room.phase === 'playing') {
        // ゲーム中に抜けたらそのまま続行（人数が1人になったら終了）
        if (room.players.length < 2) {
          room.phase = 'waiting';
          broadcastRoom(myRoomId, 'room_update', lobbyState(room));
        } else {
          if (room.turn >= room.players.length) room.turn = 0;
          sendState(room);
        }
      } else {
        broadcastRoom(myRoomId, 'room_update', lobbyState(room));
      }
    }
  });
});

server.listen(PORT, () => console.log(`六華サーバー起動 → http://localhost:${PORT}`));
