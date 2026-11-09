const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3010;

// ====================================================
// REAL-TIME ROOM & INSTANCE MANAGER (SANSA ARCHITECTURE)
// 아케이드엑스 오산동탄점 3D 메타버스 멀티서버 엔진 (Render.com 호환)
// ====================================================
const MAX_PLAYERS_PER_INSTANCE = 20;
const rooms = new Map(); // key: "room:instance:region" -> RoomState

const DEFAULT_INSTANCES = [0, 1, 2, 3];

function getRoomKey(room = 'arcadex', instance = 0, region = 'kr') {
  return `${room}:${instance}:${region}`;
}

function getOrCreateRoom(room = 'arcadex', instance = 0, region = 'kr') {
  const key = getRoomKey(room, instance, region);
  if (!rooms.has(key)) {
    rooms.set(key, {
      room,
      instance: Number(instance) || 0,
      region,
      theme: 'arcade', // 'arcade' | 'sansa' | 'night'
      clients: new Map() // clientId -> { id, res, name, slotIndex, ride, score, hat, color, togetherWith }
    });
  }
  return rooms.get(key);
}

DEFAULT_INSTANCES.forEach((inst) => getOrCreateRoom('arcadex', inst, 'kr'));

function findAvailableSlotIndex(roomState) {
  const taken = new Set();
  for (const c of roomState.clients.values()) {
    taken.add(c.slotIndex);
  }
  for (let i = 0; i < MAX_PLAYERS_PER_INSTANCE; i++) {
    if (!taken.has(i)) return i;
  }
  return Math.floor(Math.random() * MAX_PLAYERS_PER_INSTANCE);
}

function getAllInstanceCounts() {
  const instanceCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let totalRealOnline = 0;

  for (const rState of rooms.values()) {
    const inst = rState.instance;
    instanceCounts[inst] = (instanceCounts[inst] || 0) + rState.clients.size;
    totalRealOnline += rState.clients.size;
  }

  return { instanceCounts, totalRealOnline };
}

function getPublicRoomSnapshot(roomState) {
  const users = [];
  for (const c of roomState.clients.values()) {
    users.push({
      id: c.id,
      name: c.name,
      slotIndex: c.slotIndex,
      ride: c.ride || 'trampoline',
      score: c.score || 100,
      hat: c.hat || 'cap',
      color: c.color || '#00f5d4',
      togetherWith: c.togetherWith || null
    });
  }

  const { instanceCounts, totalRealOnline } = getAllInstanceCounts();

  return {
    room: roomState.room,
    instance: roomState.instance,
    region: roomState.region,
    theme: roomState.theme || 'arcade',
    roomCount: roomState.clients.size,
    totalOnline: totalRealOnline,
    instanceCounts,
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

function broadcastGlobalCounts() {
  const summary = getAllInstanceCounts();
  const data = `event: serverCounts\ndata: ${JSON.stringify(summary)}\n\n`;
  for (const roomState of rooms.values()) {
    for (const client of roomState.clients.values()) {
      try {
        client.res.write(data);
      } catch (_) {}
    }
  }
}

// Keep-alive heartbeat every 10s for Render.com
setInterval(() => {
  for (const roomState of rooms.values()) {
    for (const client of roomState.clients.values()) {
      try {
        client.res.write(`: heartbeat\n\n`);
      } catch (_) {}
    }
  }
}, 10000);

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

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Real-time SSE Stream (/api/stream)
  if (pathname === '/api/stream' && req.method === 'GET') {
    const room = parsedUrl.searchParams.get('room') || 'arcadex';
    let instance = Number(parsedUrl.searchParams.get('instance') || 0);
    const region = parsedUrl.searchParams.get('region') || 'kr';
    const clientId =
      parsedUrl.searchParams.get('clientId') ||
      `kid_${Math.random().toString(36).slice(2, 9)}`;
    const name = parsedUrl.searchParams.get('name') || '신나는 번개돌이';
    const color = parsedUrl.searchParams.get('color') || '#00f5d4';
    const hat = parsedUrl.searchParams.get('hat') || 'cap';
    const score = Number(parsedUrl.searchParams.get('score') || 100);

    let roomState = getOrCreateRoom(room, instance, region);
    while (
      roomState.clients.size >= MAX_PLAYERS_PER_INSTANCE &&
      !roomState.clients.has(clientId) &&
      instance < 99
    ) {
      instance++;
      roomState = getOrCreateRoom(room, instance, region);
    }

    const slotIndex = findAvailableSlotIndex(roomState);

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
      slotIndex,
      ride: 'trampoline',
      score,
      hat,
      color,
      togetherWith: null
    };

    roomState.clients.set(clientId, clientObj);

    const snapshot = getPublicRoomSnapshot(roomState);
    res.write(
      `event: init\ndata: ${JSON.stringify({ myId: clientId, mySlotIndex: slotIndex, snapshot })}\n\n`
    );

    broadcastToRoom(roomState, 'sync', getPublicRoomSnapshot(roomState));
    broadcastGlobalCounts();

    req.on('close', () => {
      roomState.clients.delete(clientId);
      broadcastToRoom(roomState, 'sync', getPublicRoomSnapshot(roomState));
      broadcastGlobalCounts();
    });
    return;
  }

  // 2. Real-time Action Endpoint (/api/action)
  if (pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2e4) req.socket.destroy();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const roomState = getOrCreateRoom(
          data.room || 'arcadex',
          data.instance || 0,
          data.region || 'kr'
        );
        const client = roomState.clients.get(data.clientId);

        if (client) {
          if (data.type === 'ride') {
            client.ride = data.ride || 'trampoline';
            client.togetherWith = data.togetherWith || null;
            if (typeof data.score === 'number') client.score = data.score;
            broadcastToRoom(roomState, 'sync', getPublicRoomSnapshot(roomState));
            broadcastToRoom(roomState, 'effect', {
              effect: 'startRide',
              actorId: client.id,
              actorName: client.name,
              ride: client.ride,
              together: Boolean(data.together),
              partnerName: data.partnerName || '키즈 친구'
            });
          } else if (data.type === 'scoreUpdate') {
            if (typeof data.score === 'number') client.score = data.score;
            if (data.hat) client.hat = data.hat;
            if (data.name) client.name = String(data.name).slice(0, 20);
            broadcastToRoom(roomState, 'sync', getPublicRoomSnapshot(roomState));
          } else if (data.type === 'highfive') {
            broadcastToRoom(roomState, 'effect', {
              effect: 'highfive',
              actorId: client.id,
              actorName: client.name,
              targetName: data.targetName || '친구'
            });
          } else if (data.type === 'changeTheme' && data.theme) {
            roomState.theme = data.theme;
            broadcastToRoom(roomState, 'effect', {
              effect: 'changeTheme',
              theme: roomState.theme,
              actorName: client.name
            });
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }

  // 3. Server Status & Room Counts API (/api/rooms)
  if (pathname === '/api/rooms' && req.method === 'GET') {
    const summary = getAllInstanceCounts();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, status: 'LIVE', ...summary }));
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
  console.log(`👉 로컬 접속 주소: http://localhost:${PORT}/?room=arcadex&instance=0&region=kr\n`);
});
