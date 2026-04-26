const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');

const app  = express();
const srv  = http.createServer(app);
const io   = new Server(srv, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

const PORT = process.env.PORT || 3000;

// ── データ ──
const rooms = new Map();  // roomCode → room
const queue = [];         // クイックマッチ待機列

// ── 牌 42枚 ──
function makeDeck() {
  const d = []; let id = 0;
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

// ── 役判定 ──
const eTop = t => t.flip ? t.bot : t.top;
const eBot = t => t.flip ? t.top : t.bot;

function checkWin(hand) {
  if (hand.length !== 6) return null;
  const tops = hand.map(eTop), bots = hand.map(eBot);
  const allBot = bots.every(v => v === bots[0]);
  if (allBot) {
    const st = [...tops].sort((a, b) => a - b);
    if (st.join(',') === '1,2,3,4,5,6') return { role: '六華', pts: 6 };
  }
  if (isSanren(hand)) return { role: '三連', pts: 3 };
  if (allBot) return { role: '一色', pts: 1 };
  return null;
}
function isSanren(hand) {
  for (let m = 0; m < 64; m++) {
    if (popcount(m) !== 3) continue;
    const g1 = [], g2 = [];
    for (let i = 0; i < 6; i++) (m & (1 << i) ? g1 : g2).push(hand[i]);
    if (isSet3(g1) && isSet3(g2)) return true;
  }
  return false;
}
function isSet3(g) {
  if (g.length !== 3) return false;
  const b = g.map(eBot);
  if (!b.every(v => v === b[0])) return false;
  const t = g.map(eTop).sort((a, b) => a - b);
  return t[1] === t[0] + 1 && t[2] === t[1] + 1;
}
function popcount(n) { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; }
function countZorome(hand) { return hand.filter(t => t.top === t.bot).length; }

// ── ルームユーティリティ ──
function genCode() {
  let c;
  do { c = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (rooms.has(c));
  return c;
}
function dealRound(room) {
  const deck = makeDeck(); let idx = 0;
  room.players.forEach(p => { p.hand = deck.slice(idx, idx + 5); idx += 5; });
  room.field = deck.slice(idx);
  room.turn = 0; room.tphase = 'pick'; room.phase = 'playing';
}
function sendState(room) {
  room.players.forEach((player, myIdx) => {
    io.to(player.id).emit('state', {
      myIdx,
      myHand:    player.hand,
      field:     room.field,
      turn:      room.turn,
      tphase:    room.tphase,
      phase:     room.phase,
      scores:    room.players.map(p => ({ name: p.name, score: p.score })),
      oppCounts: room.players.map((p, i) => i === myIdx ? -1 : p.hand.length),
    });
  });
}
function findRoom(sid) {
  for (const r of rooms.values())
    if (r.players.some(p => p.id === sid)) return r;
  return null;
}

// ── Socket.IO ──
io.on('connection', socket => {

  // クイックマッチ
  socket.on('quickmatch', ({ name }) => {
    if (queue.find(q => q.id === socket.id)) return;
    queue.push({ id: socket.id, name });
    socket.emit('queued', { pos: queue.length });

    if (queue.length >= 2) {
      const [p1, p2] = [queue.shift(), queue.shift()];
      const code = genCode();
      const room = {
        code, host: p1.id,
        players: [
          { id: p1.id, name: p1.name, hand: [], score: 0 },
          { id: p2.id, name: p2.name, hand: [], score: 0 },
        ],
        field: [], turn: 0, tphase: 'pick', phase: 'playing',
      };
      rooms.set(code, room);
      socket.join(code);
      io.sockets.sockets.get(p2.id)?.join(code);
      dealRound(room);
      io.to(code).emit('matched', { code, names: room.players.map(p => p.name) });
      sendState(room);
    }
  });

  socket.on('cancel_queue', () => {
    const i = queue.findIndex(q => q.id === socket.id);
    if (i !== -1) queue.splice(i, 1);
    socket.emit('queue_cancelled');
  });

  // ルーム作成
  socket.on('create_room', ({ name }) => {
    const code = genCode();
    rooms.set(code, {
      code, host: socket.id,
      players: [{ id: socket.id, name, hand: [], score: 0 }],
      field: [], turn: 0, tphase: 'pick', phase: 'waiting',
    });
    socket.join(code);
    socket.emit('room_created', { code });
    socket.emit('room_update', { players: [name], code });
  });

  // ルーム参加
  socket.on('join_room', ({ name, code }) => {
    const c = (code || '').toUpperCase().trim();
    const room = rooms.get(c);
    if (!room)                    { socket.emit('err', '部屋が見つかりません'); return; }
    if (room.phase !== 'waiting') { socket.emit('err', 'ゲームはすでに始まっています'); return; }
    if (room.players.length >= 4) { socket.emit('err', '部屋が満員です'); return; }
    room.players.push({ id: socket.id, name, hand: [], score: 0 });
    socket.join(c);
    io.to(c).emit('room_update', { players: room.players.map(p => p.name), code: c });
  });

  // ゲーム開始
  socket.on('start_game', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.host !== socket.id || room.players.length < 2) return;
    dealRound(room);
    io.to(code).emit('game_start', { names: room.players.map(p => p.name) });
    sendState(room);
  });

  // 場から引く
  socket.on('pick', ({ code, fieldIdx }) => {
    const room = rooms.get(code);
    if (!room || room.phase !== 'playing') return;
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi !== room.turn || room.tphase !== 'pick') return;
    if (fieldIdx < 0 || fieldIdx >= room.field.length) return;
    room.players[pi].hand.push(room.field.splice(fieldIdx, 1)[0]);
    room.tphase = 'discard';
    sendState(room);
  });

  // 捨てる
  socket.on('discard', ({ code, tileId }) => {
    const room = rooms.get(code);
    if (!room || room.phase !== 'playing') return;
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi !== room.turn || room.tphase !== 'discard') return;
    const player = room.players[pi];
    const ti = player.hand.findIndex(t => t.id === tileId);
    if (ti === -1 || player.hand.length <= 5) return;
    const tile = player.hand.splice(ti, 1)[0];
    tile.discarded = true;
    room.field.push(tile);
    room.turn = (room.turn + 1) % room.players.length;
    room.tphase = 'pick';
    sendState(room);
  });

  // 反転
  socket.on('flip', ({ code, tileId }) => {
    const room = rooms.get(code);
    if (!room) return;
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi === -1) return;
    const t = room.players[pi].hand.find(t => t.id === tileId);
    if (t) { t.flip = !t.flip; sendState(room); }
  });

  // 上がり
  socket.on('win', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.phase !== 'playing') return;
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi !== room.turn || room.tphase !== 'discard') return;
    const player = room.players[pi];
    if (player.hand.length !== 6) return;
    const res = checkWin(player.hand);
    if (!res) { socket.emit('err', '役が揃っていません'); return; }
    const bonus = countZorome(player.hand);
    player.score += res.pts + bonus;
    room.phase = 'roundEnd';
    io.to(code).emit('round_win', {
      winnerIdx:  pi,
      winnerName: player.name,
      hand:       player.hand,
      role:       res.role,
      pts:        res.pts,
      bonus,
      scores:     room.players.map(p => ({ name: p.name, score: p.score })),
      isGameOver: player.score >= 10,
    });
  });

  // 次のラウンド
  socket.on('next_round', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.phase !== 'roundEnd') return;
    dealRound(room);
    sendState(room);
  });

  // 切断
  socket.on('disconnect', () => {
    const qi = queue.findIndex(q => q.id === socket.id);
    if (qi !== -1) queue.splice(qi, 1);
    const room = findRoom(socket.id);
    if (room) {
      const pi = room.players.findIndex(p => p.id === socket.id);
      if (pi !== -1) {
        io.to(room.code).emit('player_left', { name: room.players[pi].name });
        rooms.delete(room.code);
      }
    }
  });
});

srv.listen(PORT, () => console.log(`🀄 六華サーバー http://localhost:${PORT}`));
