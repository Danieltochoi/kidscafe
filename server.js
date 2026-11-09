const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3010;

// ====================================================
// REAL-TIME ROOM & INSTANCE MANAGER (SANSA ARCHITECTURE)
// 아케이드엑스 오산동탄점 3D 메타버스 멀티서버 엔진 (Render.com 호환)
// ====================================================
const MAX_PLAYERS_PER_INSTANCE = 30;
const rooms = new Map(); // key: "room:instance:region" -> RoomState

const DEFAULT_ROOMS = ['server-1', 'server-2', 'server-3', 'server-4'];

function getRoomKey(room = 'server-1', instance = 0, region = 'kr') {
  return `${room}:${instance}:${region}`;
}

function getOrCreateRoom(room = 'server-1', instance = 0, region = 'kr') {
  const key = getRoomKey(room, instance, region);
  if (!rooms.has(key)) {
    rooms.set(key, {
      room,
      instance: Number(instance) || 0,
      region,
      theme: 'hybrid',
      highScore: 1520,
      highScorer: '클라이밍왕도윤',
      clients: new Map() // clientId -> { id, res, name, score, hat, color, pos, rotY, ride, chat }
    });
  }
  return rooms.get(key);
}

// Initialize default rooms
DEFAULT_ROOMS.forEach((r) => getOrCreateRoom(r, 0, 'kr'));

function getAllServerCounts() {
  const counts = {};
  let totalRealClients = 0;
  DEFAULT_ROOMS.forEach((r) => {
    counts[r] = 0;
  });

  for (const rState of rooms.values()) {
    counts[rState.room] = (counts[rState.room] || 0) + rState.clients.size;
    totalRealClients += rState.clients.size;
  }

  return { counts, totalRealClients };
}

function getPublicRoomSnapshot(roomState) {
  const users = [];
  for (const c of roomState.clients.values()) {
    users.push({
      id: c.id,
      name: c.name,
      score: c.score || 120,
      hat: c.hat || 'cap',
      color: c.color || '#38bdf8',
      pos: c.pos || [0, 0, 10],
      rotY: c.rotY || 0,
      ride: c.ride || 'free',
      chat: c.chat || ''
    });
  }

  const { counts, totalRealClients } = getAllServerCounts();

  return {
    room: roomState.room,
    instance: roomState.instance,
    region: roomState.region,
    theme: roomState.theme,
    highScore: roomState.highScore,
    highScorer: roomState.highScorer,
    roomCount: roomState.clients.size,
    totalOnline: totalRealClients,
    serverCounts: counts,
    users
  };
}

function broadcastToRoom(roomState, eventType, payload) {
  const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of roomState.clients.values()) {
    try {
      client.res.write(data);
    } catch (_) {}
  }
}

function broadcastAllRoomsServerCounts() {
  const summary = getAllServerCounts();
  const data = `event: serverCounts\ndata: ${JSON.stringify(summary)}\n\n`;
  for (const roomState of rooms.values()) {
    for (const client of roomState.clients.values()) {
      try {
        client.res.write(data);
      } catch (_) {}
    }
  }
}

// Keep-alive heartbeat every 10s (for Render.com & proxies)
setInterval(() => {
  for (const roomState of rooms.values()) {
    for (const client of roomState.clients.values()) {
      try {
        client.res.write(`: heartbeat\n\n`);
      } catch (_) {}
    }
  }
}, 10000);

// ====================================================
// HTTP + SSE REAL-TIME SERVER (ZERO EXTERNAL PACKAGES)
// ====================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers for Render & cross-origin access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Real-time Stream Endpoint (SSE)
  if (pathname === '/api/stream' && req.method === 'GET') {
    const room = parsedUrl.searchParams.get('room') || 'server-1';
    let instance = Number(parsedUrl.searchParams.get('instance') || 0);
    const region = parsedUrl.searchParams.get('region') || 'kr';
    const clientId =
      parsedUrl.searchParams.get('clientId') ||
      `kid_${Math.random().toString(36).slice(2, 9)}`;
    const name = parsedUrl.searchParams.get('name') || '오산동탄챔피언';
    const score = Number(parsedUrl.searchParams.get('score') || 120);
    const hat = parsedUrl.searchParams.get('hat') || 'cap';
    const color = parsedUrl.searchParams.get('color') || '#38bdf8';

    // Auto-scale to next instance if current instance is full (Sansa auto-sharding)
    let roomState = getOrCreateRoom(room, instance, region);
    while (
      roomState.clients.size >= MAX_PLAYERS_PER_INSTANCE &&
      !roomState.clients.has(clientId) &&
      instance < 99
    ) {
      instance++;
      roomState = getOrCreateRoom(room, instance, region);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const clientObj = {
      id: clientId,
      res,
      name,
      score,
      hat,
      color,
      pos: [0, 0, 10],
      rotY: Math.PI,
      ride: 'free',
      chat: ''
    };

    roomState.clients.set(clientId, clientObj);

    const snapshot = getPublicRoomSnapshot(roomState);
    res.write(`event: init\ndata: ${JSON.stringify({ myId: clientId, snapshot })}\n\n`);

    broadcastToRoom(roomState, 'sync', getPublicRoomSnapshot(roomState));
    broadcastAllRoomsServerCounts();

    req.on('close', () => {
      roomState.clients.delete(clientId);
      broadcastToRoom(roomState, 'sync', getPublicRoomSnapshot(roomState));
      broadcastAllRoomsServerCounts();
    });
    return;
  }

  // 2. Real-time Player Action Endpoint (Move, Score, Tag, Chat, Bell Ring)
  if (pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2e4) req.socket.destroy();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const roomState = getOrCreateRoom(data.room || 'server-1', data.instance || 0, data.region || 'kr');
        const client = roomState.clients.get(data.clientId);

        if (client) {
          if (data.type === 'state') {
            if (Array.isArray(data.pos)) client.pos = data.pos;
            if (typeof data.rotY === 'number') client.rotY = data.rotY;
            if (typeof data.score === 'number') {
              client.score = data.score;
              if (data.score > roomState.highScore) {
                roomState.highScore = data.score;
                roomState.highScorer = client.name;
              }
            }
            if (data.hat) client.hat = data.hat;
            if (data.name) client.name = String(data.name).slice(0, 20);
            if (typeof data.chat === 'string') client.chat = data.chat.slice(0, 60);
            broadcastToRoom(roomState, 'sync', getPublicRoomSnapshot(roomState));
          } else if (data.type === 'chat' && data.text) {
            const text = String(data.text).slice(0, 60);
            client.chat = text;
            broadcastToRoom(roomState, 'chat', {
              clientId: client.id,
              sender: client.name,
              text
            });
          } else if (data.type === 'tagSuccess') {
            client.score = Number(data.score) || client.score;
            broadcastToRoom(roomState, 'effect', {
              effect: 'tagSuccess',
              actorId: client.id,
              actorName: client.name,
              tagName: data.tagName,
              pts: data.pts,
              score: client.score
            });
          } else if (data.type === 'summitBell') {
            broadcastToRoom(roomState, 'effect', {
              effect: 'summitBell',
              actorId: client.id,
              actorName: client.name,
              pts: data.pts || 250
            });
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }

  // 3. Multi-Server Occupancy Summary API
  if (pathname === '/api/rooms' && req.method === 'GET') {
    const summary = getAllServerCounts();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(summary));
    return;
  }

  // 4. Static File Serving
  let safePath = pathname === '/' ? '/index.html' : pathname;
  safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n🎢 [아케이드엑스 오산동탄점 3D 메타버스 서버 가동 완료]`);
  console.log(`👉 로컬 접속 주소: http://localhost:${PORT}/?room=server-1&instance=0&region=kr\n`);
});
