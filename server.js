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

function checkWin(hand, optRoles, forTsuide){
  // forTsuide: true のときだけ三色の直接完成を許可（ついでに完成でのみ成立する役のため）
  if(hand.length!==6)return null;
  const tops=hand.map(eTop),bots=hand.map(eBot),allBot=bots.every(v=>v===bots[0]);
  const use=r=>optRoles===null||optRoles.includes(r);
  if(use('無双')&&isMusou(hand))return{role:'無双',pts:3};
  if(allBot){const st=[...tops].sort((a,b)=>a-b);if(st.join(',') === '1,2,3,4,5,6')return{role:'六華',pts:6};}
  if(use('輝光')&&isKikou(hand))return{role:'輝光',pts:5,noBonus:true};
  if(isSanren(hand))return{role:'三連',pts:3};
  if(use('三色')&&forTsuide&&isSanshiki(hand))return{role:'三色',pts:3,noBonus:true};
  if(use('三対')&&isSantui(hand))return{role:'三対',pts:2}; // ← 5から修正（クライアント側・ルールブック表示と一致させる）
  if(allBot)return{role:'一色',pts:1};
  return null;
}
function checkTsuide(hand5, field, optRoles, riichi){
  if(hand5.length!==5)return null;
  const discards=field.filter(t=>t.discarded);
  let bestRes=null,bestPts=-1;
  discards.forEach(t=>{
    const found=findRonWinServer(hand5,t,optRoles,true); // ついでに完成でのみ三色を許可
    if(found&&found.res.pts>bestPts){
      bestPts=found.res.pts;
      const bonus=(found.res.noBonus?0:countZorome(found.hand))+(riichi?1:0);
      bestRes={role:found.res.role,pts:found.res.pts,bonus,total:found.res.pts+bonus};
    }
  });
  return bestRes;
}
function canRonServer(hand5, tile, optR){
  if(!tile) return false;
  const hand6 = [...hand5, tile];
  const lim = Math.min(1 << 6, 64);
  for(let m = 0; m < lim; m++){
    const h = hand6.map((t,i) => ({...t, flip:!!(m&(1<<i))}));
    const w = checkWin(h, optR);
    if(w) return true;
  }
  return false;
}
// canRonServerと違い、実際に上がれるフリップの組み合わせ(res・hand)を返す
// forTsuide: true のときだけ三色の完成を許可（ついでに完成専用の呼び出しで使う）
function findRonWinServer(hand5, tile, optR, forTsuide){
  if(!tile) return null;
  const hand6 = [...hand5, tile];
  const lim = Math.min(1 << 6, 64);
  for(let m = 0; m < lim; m++){
    const h = hand6.map((t,i) => ({...t, flip:!!(m&(1<<i))}));
    const w = checkWin(h, optR, forTsuide);
    if(w) return {res:w, hand:h};
  }
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
function isMusou(hand){
  if(!hand.every(t=>t.top===t.bot))return false;
  return new Set(hand.map(t=>t.top)).size===6;
}
function isKikou(hand){return hand.every(t=>t.top===t.bot);}
function isSanshiki(hand){
  const v=new Set();
  hand.forEach(t=>{v.add(eTop(t));v.add(eBot(t));});
  return v.size===3;
}
function isSantui(hand){
  const f={};
  hand.forEach(t=>{const k=`${eTop(t)},${eBot(t)}`;f[k]=(f[k]||0)+1;});
  return Object.values(f).every(v=>v%2===0);
}
// ── ロンの得点授受・同時ロン判定 ──
// ロンで得た点数は、ストックからではなく捨てた本人の得点チップから奪う。
// 相手の点数が足りない場合は奪えるだけ奪う（相手が0点なら何ももらえない）。
function applyRonScoreTransfer(winner, discarder, amount) {
  const taken = Math.max(0, Math.min(amount, discarder.score));
  winner.score += taken;
  discarder.score -= taken;
  return taken;
}
// 複数人が同時にロン可能でも、捨てた人（discardedByIdx）から時計回りで最も近い1人だけが有効。
function pickRonWinnerIdx(players, discardedByIdx, tile, optR) {
  const n = players.length;
  let bestIdx = -1, bestDist = Infinity;
  players.forEach((p, i) => {
    if (i === discardedByIdx) return;
    if (!canRonServer(p.hand, tile, optR)) return;
    const dist = (i - discardedByIdx + n) % n;
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  });
  return bestIdx;
}
// 手番プレイヤー(pi)がtileを捨てたあとの共通処理：ロン可能チェック→次の手番へ。
// 手動の捨て・リーチ中の自動捨て、どちらからも呼ばれる。
function resolveDiscard(room, code, pi, tile) {
  tile.discarded = true;
  room.field.push(tile);
  const discardedTile = room.field.filter(t => t.discarded).slice(-1)[0];
  const optR = room.roles !== undefined ? room.roles : null;
  const winnerIdx = room.useRon ? pickRonWinnerIdx(room.players, pi, discardedTile, optR) : -1;
  // ターンは即座に次の人へ進める（ロン判定待ちで全員の画面が固まらないようにするため）。
  // ロンが成立しうる場合はronPendingを立てておき、5秒経つか次の人が牌を取るまでロン受付を続ける
  // （実際に閉じる処理は pick ハンドラ側と、下のタイムアウトの両方で行う）。
  room.turn = (pi + 1) % room.players.length;
  room.tphase = 'pick';
  if (winnerIdx !== -1) {
    room.ronPending = { tile: discardedTile, discardedByIdx: pi, winnerIdx };
    io.to(room.players[winnerIdx].id).emit('ron_available', { tile: discardedTile, discardedByIdx: pi, timeout: 5000 });
    room.ronTimer = setTimeout(() => {
      if (!room.ronPending) return; // 既に宣言 or 次の人のpickで閉じられている
      room.ronPending = null;
      room.ronTimer = null;
      io.to(code).emit('ron_timeout');
    }, 5000);
  }
  sendState(room);
}
// 手牌がその時点で上がれる状態かどうか（全フリップ組み合わせを試す）
function canWinNow(hand, optR) {
  const lim = Math.min(1 << hand.length, 64);
  for (let m = 0; m < lim; m++) {
    const h = hand.map((t, i) => ({ ...t, flip: !!(m & (1 << i)) }));
    if (checkWin(h, optR)) return true;
  }
  return false;
}
// 5枚の手牌がテンパイ（あと1枚で上がれる状態）かどうか。クライアント側isTenpaiと同じロジック。
// リーチ宣言時にサーバー側でも本当にテンパイしているか検証するために使う。
function isTenpaiServer(hand5, optR) {
  if (hand5.length !== 5) return false;
  for (let top = 1; top <= 6; top++)
    for (let bot = 1; bot <= 6; bot++) {
      const t = { id: 8888, top, bot, flip: false, discarded: false };
      if (canRonServer(hand5, t, optR)) return true;
    }
  return false;
}

// ── ルームユーティリティ ──
// 場の背景に使う画像URLの簡易サニタイズ。http(s)のみ許可し、
// url(...)やHTML属性から抜け出せる引用符・バックスラッシュ・括弧を含むものは拒否する。
function sanitizeFieldBg(url) {
  if (typeof url !== 'string') return '';
  url = url.trim();
  if (url.length === 0 || url.length > 500) return '';
  if (!/^https:\/\//i.test(url)) return '';
  if (/["'\\()<>]/.test(url)) return '';
  return url;
}
function genCode() {
  let c;
  do { c = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (rooms.has(c));
  return c;
}
function dealRound(room) {
  const deck = makeDeck(); let idx = 0;
  room.players.forEach(p => { p.hand = deck.slice(idx, idx + 5); idx += 5; p.riichi = false; });
  room.field = deck.slice(idx);
  room.turn = Math.floor(Math.random() * room.players.length); // ← ランダムに変更
  room.tphase = 'pick';
  room.phase = 'playing';
  if (room.forcedDiscardTimer) { clearTimeout(room.forcedDiscardTimer); room.forcedDiscardTimer = null; }
  room.forcedDiscardTileId = null;
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
      scores:    room.players.map(p => ({ name: p.name, score: p.score, fieldBg: p.fieldBg || '' })),
      oppCounts: room.players.map((p, i) => i === myIdx ? -1 : p.hand.length),
      code:      room.code,
      optRoles:  room.roles !== undefined ? room.roles : null,
      useRiichi: room.useRiichi || false,
      useRon:    room.useRon    || false,
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
  socket.on('quickmatch', ({ name, fieldBg }) => {
    if (queue.find(q => q.id === socket.id)) return;
    queue.push({ id: socket.id, name, fieldBg: sanitizeFieldBg(fieldBg) });
    socket.emit('queued', { pos: queue.length });

if (queue.length >= 2) {
  const [p1, p2] = [queue.shift(), queue.shift()];
  const code = genCode();
  const room = {
    code, host: p1.id,
    roles: [], // クイックマッチ: 基本役のみ
    players: [
      { id: p1.id, name: p1.name, hand: [], score: 0, fieldBg: p1.fieldBg || '' },
      { id: p2.id, name: p2.name, hand: [], score: 0, fieldBg: p2.fieldBg || '' },
    ],
    field: [], turn: 0, tphase: 'pick', phase: 'playing',
  };
  rooms.set(code, room);
  io.sockets.sockets.get(p1.id)?.join(code);  // ← p1を追加（これが抜けていた）
  socket.join(code);                           // ← p2（現在のsocket）
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
socket.on('create_room', ({ name, roles, goal, useRiichi, useRon, fieldBg }) => {
    const code = genCode();
    rooms.set(code, {
      code, host: socket.id,
      roles: roles || [],
      goal: [5,10,15,20,30].includes(goal) ? goal : 10,
      useRiichi: useRiichi || false,
      useRon: useRon || false,
      players: [{ id: socket.id, name, hand: [], score: 0, riichi: false, fieldBg: sanitizeFieldBg(fieldBg) }],
      field: [], turn: 0, tphase: 'pick', phase: 'waiting',
    });
    socket.join(code);
    socket.emit('room_created', { code });
    socket.emit('room_update', { players: [name], code });
  });

  // ルーム参加
  socket.on('join_room', ({ name, code, fieldBg }) => {
    const c = (code || '').toUpperCase().trim();
    const room = rooms.get(c);
    if (!room)                    { socket.emit('err', '部屋が見つかりません'); return; }
    if (room.phase !== 'waiting') { socket.emit('err', 'ゲームはすでに始まっています'); return; }
    if (room.players.length >= 4) { socket.emit('err', '部屋が満員です'); return; }
    if (room.players.some(p => p.id === socket.id)) { socket.emit('err', 'すでに参加しています'); return; }
    if (room.players.some(p => p.name === name)) { socket.emit('err', 'この名前はすでに使われています'); return; }
    room.players.push({ id: socket.id, name, hand: [], score: 0, riichi: false, fieldBg: sanitizeFieldBg(fieldBg) });
    socket.join(c);
    io.to(c).emit('room_update', { players: room.players.map(p => p.name), code: c });
  });

  // 場の背景画像を変更（対局中でも変更可能）
  socket.on('set_field_bg', ({ code, url }) => {
    const room = rooms.get(code);
    if (!room) return;
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi === -1) return;
    room.players[pi].fieldBg = sanitizeFieldBg(url);
    // まだ待機中（ゲーム未開始）の場合はstateを送らない。送ると、まだ配られていない
    // ゲーム画面にクライアントが強制的に切り替わってしまうため。開始時に自然に反映される。
    if (room.phase !== 'waiting') sendState(room);
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
  if (!room) { socket.emit('err', `[pick] ルームなし code=${code}`); return; }
  if (room.phase !== 'playing') { socket.emit('err', `[pick] phase=${room.phase}`); return; }
  const pi = room.players.findIndex(p => p.id === socket.id);
  if (pi === -1) { socket.emit('err', `[pick] プレイヤー不明 sid=${socket.id}`); return; }
  if (pi !== room.turn) { socket.emit('err', `[pick] ターン違い pi=${pi} turn=${room.turn}`); return; }
  if (room.tphase !== 'pick') { socket.emit('err', `[pick] tphase=${room.tphase}`); return; }
  if (fieldIdx < 0 || fieldIdx >= room.field.length) { socket.emit('err', `[pick] インデックス範囲外 fi=${fieldIdx} len=${room.field.length}`); return; }
  // 次の人が牌を取った時点で、前の捨て牌に対するロン受付を締め切る
  if (room.ronPending) {
    room.ronPending = null;
    clearTimeout(room.ronTimer);
    room.ronTimer = null;
    io.to(code).emit('ron_timeout');
  }
  const picked = room.field.splice(fieldIdx, 1)[0];
  const player = room.players[pi];
  player.hand.push(picked);
  room.tphase = 'discard';
  room.forcedDiscardTileId = null;
  if (room.forcedDiscardTimer) { clearTimeout(room.forcedDiscardTimer); room.forcedDiscardTimer = null; }

  // リーチ中：上がれる牌でない限り、引いた牌をそのまま自動で捨てる
  if (player.riichi) {
    const optR = room.roles !== undefined ? room.roles : null;
    if (!canWinNow(player.hand, optR)) {
      room.forcedDiscardTileId = picked.id;
      sendState(room);
      room.forcedDiscardTimer = setTimeout(() => {
        if (!room || room.phase !== 'playing' || room.tphase !== 'discard') return;
        const idx = player.hand.indexOf(picked);
        if (idx === -1) return; // 手動で先に捨てられていた場合
        room.forcedDiscardTileId = null;
        const tile = player.hand.splice(idx, 1)[0];
        resolveDiscard(room, code, pi, tile);
      }, 600);
      return;
    }
  }
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
    // リーチ中は、自動で捨てるはずの牌以外を選ぶことはできない
    if (player.riichi && room.forcedDiscardTileId != null && tileId !== room.forcedDiscardTileId) {
      socket.emit('err', 'リーチ中は引いた牌をそのまま捨てる必要があります');
      return;
    }
    if (room.forcedDiscardTimer) { clearTimeout(room.forcedDiscardTimer); room.forcedDiscardTimer = null; }
    room.forcedDiscardTileId = null;
    const tile = player.hand.splice(ti, 1)[0];
    resolveDiscard(room, code, pi, tile);
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
// 開発者ツール: 六華強制セット
  socket.on('dev_rikka', ({ code, hand }) => {
    const room = rooms.get(code);
    if (!room || room.phase !== 'playing') return;
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi === -1) return;
    room.players[pi].hand = hand && hand.length === 6
      ? hand.map((t,i) => ({id:9000+i, top:t.top, bot:t.bot, flip:false, discarded:false}))
      : Array.from({length:6}, (_, i) => ({id:9000+i, top:i+1, bot:3, flip:false, discarded:false}));
    room.turn = pi;
    room.tphase = 'discard';
    sendState(room);
  });
  socket.on('rematch_request', ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (!room.rematchVotes) room.rematchVotes = new Set();
    room.rematchVotes.add(socket.id);
    const total = room.players.length;
    const waiting = room.rematchVotes.size;
    io.to(code).emit('rematch_waiting', { waiting, total });
    if (waiting >= total) {
      room.rematchVotes = new Set();
      room.players.forEach(p => { p.hand = []; p.score = 0; p.riichi = false; });
      const deck = makeDeck();
      let idx = 0;
      room.players.forEach(p => { p.hand = deck.slice(idx, idx + 5); idx += 5; });
      room.field = deck.slice(idx);
      room.turn = 0;
      room.tphase = 'pick';
      room.phase = 'playing';
      io.to(code).emit('rematch_start');
      sendState(room);
    }
  });
  // リーチ宣言
  socket.on('riichi', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.phase !== 'playing' || !room.useRiichi) return;
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi === -1) return;
    const player = room.players[pi];
    // 自分の手番・捨てる前（6枚)・未リーチであることをサーバー側でも確認する
    if (player.riichi || pi !== room.turn || room.tphase !== 'discard' || player.hand.length !== 6) return;
    const optR = room.roles !== undefined ? room.roles : null;
    let tenpai = false;
    player.hand.forEach((_, i) => {
      if (isTenpaiServer(player.hand.filter((_, j) => j !== i), optR)) tenpai = true;
    });
    if (!tenpai) { socket.emit('err', 'テンパイしていません'); return; }
    player.riichi = true;
    io.to(code).emit('player_riichi', { name: player.name, idx: pi });
    sendState(room);
  });

  // ロン宣言
  socket.on('ron_declare', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.phase !== 'playing' || !room.ronPending) return;
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi === -1) return;
    const { tile, discardedByIdx, winnerIdx } = room.ronPending;
    if (pi !== winnerIdx) { socket.emit('err', 'ロンできません'); return; } // 同時ロン時は最も近い1人だけが有効
    const found = findRonWinServer(room.players[pi].hand, tile, room.roles !== undefined ? room.roles : null);
    if (!found) { socket.emit('err', 'ロンできません'); return; }
    const { res, hand: hand6 } = found;
    room.ronPending = null;
    clearTimeout(room.ronTimer);
    const bonus = (res.noBonus ? 0 : countZorome(hand6)) + (room.players[pi].riichi ? 1 : 0);
    const discarder = room.players[discardedByIdx];
    room.players[pi].hand = hand6;
    const taken = applyRonScoreTransfer(room.players[pi], discarder, res.pts + bonus);
    // 実際に奪えた額に emit する pts/bonus を合わせる（ボーナス分から先に削る）
    const cappedBonus = Math.max(0, bonus - ((res.pts + bonus) - taken));
    const cappedPts = taken - cappedBonus;
    room.phase = 'roundEnd';
    const tsuideList = [];
    room.players.forEach((p, i) => {
      if (i === pi || i === discardedByIdx) return;
      const tr = checkTsuide(p.hand, room.field, room.roles !== undefined ? room.roles : null, p.riichi);
      if (tr) { p.score += tr.total; tsuideList.push({ name: p.name, role: tr.role, pts: tr.pts, bonus: tr.bonus, total: tr.total }); }
    });
    const isGameOver = room.players.some(p => p.score >= (room.goal || 10));
    io.to(code).emit('round_win', {
      winnerIdx: pi, winnerName: room.players[pi].name,
      hand: hand6, role: res.role, pts: cappedPts, bonus: cappedBonus,
      scores: room.players.map(p => ({ name: p.name, score: p.score })),
      isGameOver, tsuideList, ron: true, ronFrom: discarder.name, riichi: room.players[pi].riichi
    });
  });
  socket.on('chat', ({ code, msg }) => {
    const room = rooms.get(code);
    if (!room || room.phase !== 'playing') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (typeof msg !== 'string' || msg.trim().length === 0) return;
    const safeMsg = msg.trim().slice(0, 100);
    io.to(code).emit('chat', { name: player.name, msg: safeMsg });
  });
  // 上がり
  socket.on('win', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.phase !== 'playing') return;
    const pi = room.players.findIndex(p => p.id === socket.id);
    if (pi !== room.turn || room.tphase !== 'discard') return;
    const player = room.players[pi];
    if (player.hand.length !== 6) return;
const res = checkWin(player.hand, room.roles !== undefined ? room.roles : null);if (!res) { socket.emit('err', '役が揃っていません'); return; }
const bonus = (res.noBonus ? 0 : countZorome(player.hand)) + (player.riichi ? 1 : 0);
player.score += res.pts + bonus;
    room.phase = 'roundEnd';
    // ついでに完成チェック
    const tsuideList=[];
    room.players.forEach((p,i)=>{
      if(i===pi)return;
      const tr=checkTsuide(p.hand,room.field,room.roles!==undefined?room.roles:null,p.riichi);
      if(tr){
        p.score+=tr.total;
        tsuideList.push({name:p.name,role:tr.role,pts:tr.pts,bonus:tr.bonus,total:tr.total});
      }
    });
    io.to(code).emit('round_win', {
      winnerIdx:  pi,
      winnerName: player.name,
      hand:       player.hand,
      role:       res.role,
      pts:        res.pts,
      bonus,
      scores:     room.players.map(p => ({ name: p.name, score: p.score })),
      isGameOver: room.players.some(p => p.score >= (room.goal || 10)),
      tsuideList,
      riichi:     player.riichi,
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
