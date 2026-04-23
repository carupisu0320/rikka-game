const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

// ゲームの状態管理
const rooms = new Map();

// リッカ牌の生成（1-6のドミノ牌、42枚）
function createDeck() {
  const deck = [];
  for (let top = 1; top <= 6; top++) {
    for (let bottom = 1; bottom <= 6; bottom++) {
      deck.push({ id: `${top}-${bottom}-a`, top, bottom, flipped: false });
    }
  }
  // 6×6 = 36枚だが、実際は42枚なので特殊牌を追加
  // アークライト公式では1-6が2セット = 42枚なので両面同じ牌6枚を追加
  for (let i = 1; i <= 6; i++) {
    deck.push({ id: `${i}-${i}-b`, top: i, bottom: i, flipped: false });
  }
  return shuffleDeck(deck);
}

function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 役の判定
function checkHand(hand) {
  // 手牌は6枚、各牌の「上」か「下」の値を使う
  // 牌をflipした場合はtopとbottomが入れ替わる
  const values = hand.map(tile => tile.flipped ? tile.bottom : tile.top);
  
  const results = [];
  
  // 六華（全て同じ数字）
  if (values.every(v => v === values[0])) {
    results.push({ name: '六華', points: 6, bonus: 0 });
  }
  
  // 一色（全て同じ数字）- 六華と同じ条件だが六華が最上位
  // 実際のルールでは一色 = 6枚全部同じ上の数字
  
  // 三連（上の数字が連続3つ×2組）
  const sorted = [...values].sort((a, b) => a - b);
  if (isThreeStraight(sorted)) {
    results.push({ name: '三連', points: 3, bonus: 0 });
  }
  
  // 一色（全部同じ）
  const isAllSame = values.every(v => v === values[0]);
  if (isAllSame && results.length === 0) {
    results.push({ name: '一色', points: 2, bonus: 0 });
  }
  
  return results;
}

function isThreeStraight(sorted) {
  // 6枚が3連続×2組
  if (sorted.length !== 6) return false;
  // パターン: [a,a+1,a+2, b,b+1,b+2]
  const counts = {};
  sorted.forEach(v => counts[v] = (counts[v] || 0) + 1);
  
  // 全部ペアになっているか
  const vals = Object.keys(counts).map(Number).sort((a, b) => a - b);
  if (vals.length === 3 && vals.every(v => counts[v] === 2)) {
    // 3つが連続しているか
    return vals[1] === vals[0] + 1 && vals[2] === vals[1] + 1;
  }
  return false;
}

function isIshoku(hand) {
  const values = hand.map(tile => tile.flipped ? tile.bottom : tile.top);
  return values.every(v => v === values[0]);
}

function checkWin(hand) {
  const values = hand.map(tile => tile.flipped ? tile.bottom : tile.top);
  
  // 六華: 全部同じ（6点）
  if (values.every(v => v === values[0])) {
    return { won: true, role: '六華', points: 6 };
  }
  
  // 三連: ソートして3連続×2組（3点）
  const sorted = [...values].sort((a, b) => a - b);
  if (isThreeStraight(sorted)) {
    return { won: true, role: '三連', points: 3 };
  }
  
  // 一色: 全部同じ（実際は上か下で揃える）（2点）
  // 六華と重複するので、ここでは上の数値6枚同じ or 下の数値6枚同じ
  const topValues = hand.map(t => t.top);
  const bottomValues = hand.map(t => t.bottom);
  if (topValues.every(v => v === topValues[0]) || bottomValues.every(v => v === bottomValues[0])) {
    return { won: true, role: '一色', points: 2 };
  }
  
  return { won: false };
}

// HTTPサーバー
const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') filePath = './index.html';
  
  const extname = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
  };
  
  const contentType = contentTypes[extname] || 'text/plain';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// WebSocketサーバー
const wss = new WebSocket.Server({ server });

function broadcast(room, message, excludeWs = null) {
  room.players.forEach(player => {
    if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

function broadcastAll(room, message) {
  room.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

function sendGameState(room) {
  room.players.forEach((player, index) => {
    if (player.ws.readyState !== WebSocket.OPEN) return;
    
    const state = {
      type: 'gameState',
      myIndex: index,
      currentTurn: room.currentTurn,
      phase: room.phase,
      scores: room.players.map(p => ({ name: p.name, score: p.score })),
      myHand: player.hand,
      opponents: room.players.map((p, i) => ({
        name: p.name,
        handCount: p.hand.length,
        score: p.score,
        isCurrentTurn: i === room.currentTurn,
      })).filter((_, i) => i !== index),
      fieldFaceUp: room.fieldFaceUp,
      stockCount: room.stock.length,
      fieldFaceDownCount: room.fieldFaceDown.length,
      lastAction: room.lastAction,
    };
    
    player.ws.send(JSON.stringify(state));
  });
}

function startGame(room) {
  const deck = createDeck();
  room.stock = [];
  room.fieldFaceUp = [];
  room.fieldFaceDown = [];
  room.phase = 'playing';
  room.lastAction = null;
  
  // 各プレイヤーに5枚配布
  let deckIndex = 0;
  room.players.forEach(player => {
    player.hand = deck.slice(deckIndex, deckIndex + 5);
    deckIndex += 5;
  });
  
  // 残りをストックに
  room.stock = deck.slice(deckIndex);
  
  // 最初のスタPをランダムに
  room.currentTurn = Math.floor(Math.random() * room.players.length);
  
  broadcastAll(room, { type: 'gameStart', playerNames: room.players.map(p => p.name) });
  sendGameState(room);
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(ws, msg);
    } catch (e) {
      console.error('Parse error:', e);
    }
  });
  
  ws.on('close', () => {
    // ルームからプレイヤーを削除
    for (const [roomId, room] of rooms) {
      const idx = room.players.findIndex(p => p.ws === ws);
      if (idx !== -1) {
        const playerName = room.players[idx].name;
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          broadcastAll(room, { type: 'playerLeft', name: playerName });
          sendGameState(room);
        }
        break;
      }
    }
  });
});

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'join': {
      const { roomId, playerName } = msg;
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          id: roomId,
          players: [],
          phase: 'waiting',
          stock: [],
          fieldFaceUp: [],
          fieldFaceDown: [],
          currentTurn: 0,
          lastAction: null,
        });
      }
      const room = rooms.get(roomId);
      if (room.players.length >= 5) {
        ws.send(JSON.stringify({ type: 'error', message: '部屋が満員です' }));
        return;
      }
      if (room.phase === 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: 'ゲームはすでに開始されています' }));
        return;
      }
      room.players.push({ ws, name: playerName, hand: [], score: 0 });
      ws.send(JSON.stringify({ type: 'joined', roomId, playerName }));
      broadcastAll(room, {
        type: 'lobby',
        players: room.players.map(p => p.name),
        canStart: room.players.length >= 2,
      });
      break;
    }
    
    case 'startGame': {
      const room = findRoom(ws);
      if (!room || room.phase !== 'waiting') return;
      if (room.players.length < 2) {
        ws.send(JSON.stringify({ type: 'error', message: '2人以上必要です' }));
        return;
      }
      startGame(room);
      break;
    }
    
    case 'drawFromStock': {
      const room = findRoom(ws);
      if (!room || room.phase !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.ws === ws);
      if (playerIdx !== room.currentTurn) return;
      
      const player = room.players[playerIdx];
      if (player.hand.length >= 6) return;
      
      if (room.stock.length === 0 && room.fieldFaceDown.length === 0) {
        broadcastAll(room, { type: 'draw', message: 'ストックが尽きました' });
        return;
      }
      
      let tile;
      if (room.stock.length > 0) {
        tile = room.stock.pop();
      } else {
        // フェイスダウンフィールドから
        tile = room.fieldFaceDown.pop();
      }
      
      player.hand.push(tile);
      room.lastAction = { type: 'draw', player: player.name };
      sendGameState(room);
      break;
    }
    
    case 'drawFromField': {
      const room = findRoom(ws);
      if (!room || room.phase !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.ws === ws);
      if (playerIdx !== room.currentTurn) return;
      
      const player = room.players[playerIdx];
      if (player.hand.length >= 6) return;
      
      const { tileId } = msg;
      const fieldIdx = room.fieldFaceUp.findIndex(t => t.id === tileId);
      if (fieldIdx === -1) return;
      
      const tile = room.fieldFaceUp.splice(fieldIdx, 1)[0];
      player.hand.push(tile);
      room.lastAction = { type: 'drawField', player: player.name, tile };
      sendGameState(room);
      break;
    }
    
    case 'discard': {
      const room = findRoom(ws);
      if (!room || room.phase !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.ws === ws);
      if (playerIdx !== room.currentTurn) return;
      
      const player = room.players[playerIdx];
      if (player.hand.length !== 6) return;
      
      const { tileId } = msg;
      const handIdx = player.hand.findIndex(t => t.id === tileId);
      if (handIdx === -1) return;
      
      const discarded = player.hand.splice(handIdx, 1)[0];
      room.fieldFaceUp.push(discarded);
      room.lastAction = { type: 'discard', player: player.name, tile: discarded };
      
      // 次のターンへ
      room.currentTurn = (room.currentTurn + 1) % room.players.length;
      sendGameState(room);
      break;
    }
    
    case 'flipTile': {
      const room = findRoom(ws);
      if (!room) return;
      const playerIdx = room.players.findIndex(p => p.ws === ws);
      const player = room.players[playerIdx];
      
      const { tileId } = msg;
      const tile = player.hand.find(t => t.id === tileId);
      if (tile) {
        tile.flipped = !tile.flipped;
        sendGameState(room);
      }
      break;
    }
    
    case 'declareWin': {
      const room = findRoom(ws);
      if (!room || room.phase !== 'playing') return;
      const playerIdx = room.players.findIndex(p => p.ws === ws);
      if (playerIdx !== room.currentTurn) return;
      
      const player = room.players[playerIdx];
      const winResult = checkWin(player.hand);
      
      if (!winResult.won) {
        ws.send(JSON.stringify({ type: 'error', message: '役が完成していません' }));
        return;
      }
      
      // 得点加算
      player.score += winResult.points;
      
      // ついでに完成チェック
      const bonusPlayers = [];
      room.players.forEach((p, i) => {
        if (i === playerIdx) return;
        // あと1枚で役が完成 + その1枚が場に表向きにある
        // 簡略実装: チェックだけ
      });
      
      room.phase = 'roundEnd';
      
      broadcastAll(room, {
        type: 'win',
        player: player.name,
        role: winResult.role,
        points: winResult.points,
        hand: player.hand,
        scores: room.players.map(p => ({ name: p.name, score: p.score })),
      });
      
      // 10点以上なら勝利
      if (player.score >= 10) {
        broadcastAll(room, {
          type: 'gameOver',
          winner: player.name,
          scores: room.players.map(p => ({ name: p.name, score: p.score })),
        });
        room.phase = 'waiting';
        room.players.forEach(p => p.score = 0);
      }
      break;
    }
    
    case 'nextRound': {
      const room = findRoom(ws);
      if (!room || room.phase !== 'roundEnd') return;
      room.players.forEach(p => p.hand = []);
      startGame(room);
      break;
    }
  }
}

function findRoom(ws) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.ws === ws)) return room;
  }
  return null;
}

server.listen(PORT, () => {
  console.log(`六華サーバー起動: http://localhost:${PORT}`);
});
