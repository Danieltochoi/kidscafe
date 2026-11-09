// Multi-Server Metaverse Engine (Render.com SSE Server + BroadcastChannel Hybrid)
class MetaverseManager {
  constructor(world, onUIUpdate) {
    this.world = world;
    this.onUIUpdate = onUIUpdate;

    this.clientId =
      sessionStorage.getItem('arcadex_cid') ||
      'kid_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('arcadex_cid', this.clientId);

    const urlParams = new URLSearchParams(window.location.search);
    this.currentServerId = urlParams.get('room') || 'server-1';
    this.currentInstance = Number(urlParams.get('instance') || 0);
    this.currentRegion = urlParams.get('region') || 'kr';

    this.eventSource = null;
    this.serverConnected = false;
    this.realServerCounts = {
      'server-1': 0,
      'server-2': 0,
      'server-3': 0,
      'server-4': 0
    };

    this.servers = [
      {
        id: 'server-1',
        name: '오산동탄 1서버 (메인파크)',
        basePop: 14,
        maxPop: 30,
        themeHint: 'hybrid',
        bots: [
          { name: '동탄번개민준', color: 0xff2a85, hat: 'crown', score: 1240, zone: 'trampoline' },
          { name: '슬라이드요정서연', color: 0x00f5d4, hat: 'cap', score: 980, zone: 'slide' },
          { name: '클라이밍왕도윤', color: 0xfbbf24, hat: 'wings', score: 1520, zone: 'climbing' },
          { name: '볼풀탐험가하은', color: 0xa855f7, hat: 'cap', score: 640, zone: 'ballpit' },
          { name: '스카이워커지호', color: 0x4ade80, hat: 'satgat', score: 1110, zone: 'skywalk' },
          { name: '불멍힐링러시아', color: 0xf97316, hat: 'satgat', score: 530, zone: 'bonfire' }
        ]
      },
      {
        id: 'server-2',
        name: '오산동탄 2서버 (익스트림)',
        basePop: 9,
        maxPop: 30,
        themeHint: 'arcade',
        bots: [
          { name: '짚라인마스터준우', color: 0x38bdf8, hat: 'wings', score: 1890, zone: 'climbing' },
          { name: '점프챔피언채원', color: 0xff2a85, hat: 'crown', score: 1420, zone: 'trampoline' },
          { name: '아케이드히어로유준', color: 0xfbbf24, hat: 'cap', score: 870, zone: 'skywalk' },
          { name: '태그사냥꾼소율', color: 0x00f5d4, hat: 'cap', score: 760, zone: 'ballpit' }
        ]
      },
      {
        id: 'server-3',
        name: '산사(Sansa) 3서버 (힐링파크)',
        basePop: 7,
        maxPop: 30,
        themeHint: 'sansa',
        bots: [
          { name: '산사동자승현우', color: 0xfbbf24, hat: 'satgat', score: 1350, zone: 'bonfire' },
          { name: '범종수호자수아', color: 0x4ade80, hat: 'satgat', score: 1680, zone: 'climbing' },
          { name: '솔바람점퍼예준', color: 0x38bdf8, hat: 'cap', score: 720, zone: 'trampoline' },
          { name: '연등요정다은', color: 0xff2a85, hat: 'wings', score: 940, zone: 'skywalk' }
        ]
      },
      {
        id: 'server-4',
        name: '키즈 챔피언십 4서버 (랭커전)',
        basePop: 19,
        maxPop: 30,
        themeHint: 'hybrid',
        bots: [
          { name: '전국1등태양', color: 0xfbbf24, hat: 'crown', score: 2650, zone: 'climbing' },
          { name: '오산전설건우', color: 0xff2a85, hat: 'wings', score: 2180, zone: 'skywalk' },
          { name: '동탄여제서아', color: 0x00f5d4, hat: 'crown', score: 1940, zone: 'trampoline' },
          { name: '하이플라이어시우', color: 0xa855f7, hat: 'wings', score: 1710, zone: 'slide' }
        ]
      }
    ];

    this.activeBotEntities = [];
    this.remotePeers = new Map(); // clientId -> { mesh, labelEl, lastSeen, data }
    this.chatMessages = [
      { sender: '시스템', text: '아케이드엑스 오산동탄점 3D 실시간 멀티플레이 서버에 연결되었습니다!' },
      { sender: '동탄번개민준', text: '트램펄린에서 연속 점프하면 높은 태그 링도 먹을 수 있어!' },
      { sender: '클라이밍왕도윤', text: '클라이밍 꼭대기 황금범종 태그하면 한방에 +250점이야!' }
    ];

    this.botPhrases = [
      '우와 다이내믹 슬라이드 진짜 빠르다! 😆',
      '트램펄린 슈퍼점프 성공!! 🚀',
      '정상 황금범종 소리 대박 신비로워 🔔',
      '불멍 화로 앞에서 쉬니까 힐링된다 🔥',
      '스카이워크 출렁다리 떨리는데 재밌어!',
      '팔찌 태그 콤보 터졌다!! ✨',
      '볼풀장 공 튀기는 거 너무 재밌어 ㅋㅋ',
      '같이 클라이밍 정상까지 경주할 사람~?'
    ];

    this.initBroadcastChannel();
    this.spawnServerBots(this.currentServerId);
    this.connectServerStream();
  }

  // Connect to Node.js SSE Real-Time Server (/api/stream) just like 불멍
  connectServerStream(playerProfile = {}) {
    if (window.location.protocol === 'file:') return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    const name = encodeURIComponent(playerProfile.name || localStorage.getItem('arcadex_name') || '오산동탄챔피언');
    const score = encodeURIComponent(playerProfile.score || localStorage.getItem('arcadex_score') || 120);
    const hat = encodeURIComponent(playerProfile.hat || localStorage.getItem('arcadex_hat') || 'cap');

    const streamUrl = `/api/stream?room=${this.currentServerId}&instance=${this.currentInstance}&region=${this.currentRegion}&clientId=${this.clientId}&name=${name}&score=${score}&hat=${hat}`;

    try {
      const es = new EventSource(streamUrl);
      this.eventSource = es;

      es.addEventListener('init', (ev) => {
        this.serverConnected = true;
        const data = JSON.parse(ev.data);
        if (data.snapshot) {
          this.applyRoomSnapshot(data.snapshot);
        }
      });

      es.addEventListener('sync', (ev) => {
        this.serverConnected = true;
        const snapshot = JSON.parse(ev.data);
        this.applyRoomSnapshot(snapshot);
      });

      es.addEventListener('serverCounts', (ev) => {
        const data = JSON.parse(ev.data);
        if (data.counts) {
          this.realServerCounts = data.counts;
          if (this.onUIUpdate) this.onUIUpdate();
        }
      });

      es.addEventListener('chat', (ev) => {
        const data = JSON.parse(ev.data);
        if (data.clientId !== this.clientId) {
          this.addChatMessage(data.sender, data.text);
        }
      });

      es.addEventListener('effect', (ev) => {
        const data = JSON.parse(ev.data);
        if (data.actorId !== this.clientId) {
          if (data.effect === 'summitBell') {
            this.addChatMessage('전광판 알림', `🔔 ${data.actorName}님이 정상 황금범종 등반(+${data.pts}점)에 성공했습니다!`);
            window.soundEngine.playTempleBell();
          }
        }
      });

      es.onerror = () => {
        this.serverConnected = false;
      };
    } catch (_) {
      this.serverConnected = false;
    }
  }

  applyRoomSnapshot(snapshot) {
    if (snapshot.serverCounts) {
      this.realServerCounts = snapshot.serverCounts;
    }

    const activeIds = new Set();
    if (Array.isArray(snapshot.users)) {
      snapshot.users.forEach((u) => {
        if (u.id === this.clientId) return;
        activeIds.add(u.id);
        this.upsertRemotePeer({
          clientId: u.id,
          serverId: snapshot.room,
          name: u.name,
          score: u.score,
          hat: u.hat,
          pos: u.pos || [0, 0, 10],
          rotY: u.rotY || 0,
          chat: u.chat || ''
        });
      });
    }

    // Remove disconnected server users
    for (const [cid, peer] of this.remotePeers.entries()) {
      if (peer.fromServer && !activeIds.has(cid)) {
        this.world.scene.remove(peer.mesh);
        if (peer.labelEl) peer.labelEl.remove();
        this.remotePeers.delete(cid);
      }
    }

    if (this.onUIUpdate) this.onUIUpdate();
  }

  upsertRemotePeer(msg, fromServer = true) {
    let peer = this.remotePeers.get(msg.clientId);
    if (!peer) {
      const mesh = this.world.createKidAvatar({
        shirtColor: 0x22c55e,
        hatType: msg.hat || 'cap',
        bandColor: 0xfbbf24,
        isMe: false
      });
      this.world.scene.add(mesh);

      const labelEl = document.createElement('div');
      labelEl.className = 'avatar-label';
      document.getElementById('floating-labels').appendChild(labelEl);

      peer = { mesh, labelEl, lastSeen: performance.now(), data: msg, fromServer };
      this.remotePeers.set(msg.clientId, peer);
      this.addChatMessage('실시간 입장', `🟢 ${msg.name}님이 현재 서버에 입장했습니다!`);
    }

    peer.lastSeen = performance.now();
    peer.data = msg;
    if (Array.isArray(msg.pos)) {
      peer.mesh.position.set(msg.pos[0], msg.pos[1], msg.pos[2]);
    }
    if (typeof msg.rotY === 'number') {
      peer.mesh.rotation.y = msg.rotY;
    }
  }

  initBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('arcadex_metaverse_v1');
      this.channel.onmessage = (ev) => this.handlePeerMessage(ev.data);
    }
  }

  broadcastMyState(playerState) {
    const payload = {
      type: 'state',
      clientId: this.clientId,
      room: this.currentServerId,
      instance: this.currentInstance,
      region: this.currentRegion,
      name: playerState.name,
      score: playerState.score,
      hat: playerState.hat,
      pos: [
        Number(playerState.pos.x.toFixed(2)),
        Number(playerState.pos.y.toFixed(2)),
        Number(playerState.pos.z.toFixed(2))
      ],
      rotY: Number(playerState.rotY.toFixed(2)),
      chat: playerState.chatBubble || ''
    };

    // 1. Send to Render / Local Node Server if connected
    if (window.location.protocol !== 'file:') {
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }

    // 2. Also broadcast via BroadcastChannel for offline file:// multi-tab testing
    if (this.channel) {
      this.channel.postMessage({
        ...payload,
        type: 'STATE_SYNC',
        serverId: this.currentServerId
      });
    }
  }

  broadcastChat(sender, text) {
    this.addChatMessage(sender, text);

    if (window.location.protocol !== 'file:') {
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          clientId: this.clientId,
          room: this.currentServerId,
          instance: this.currentInstance,
          region: this.currentRegion,
          sender,
          text
        })
      }).catch(() => {});
    }

    if (this.channel) {
      this.channel.postMessage({
        type: 'CHAT',
        clientId: this.clientId,
        serverId: this.currentServerId,
        sender,
        text
      });
    }
  }

  handlePeerMessage(msg) {
    if (!msg || msg.clientId === this.clientId) return;
    if (this.serverConnected) return; // SSE server handles sync when running on http

    if (msg.type === 'CHAT') {
      this.addChatMessage(msg.sender, msg.text);
      return;
    }

    if (msg.type === 'STATE_SYNC') {
      if (msg.serverId !== this.currentServerId) {
        if (this.remotePeers.has(msg.clientId)) {
          const peer = this.remotePeers.get(msg.clientId);
          this.world.scene.remove(peer.mesh);
          if (peer.labelEl) peer.labelEl.remove();
          this.remotePeers.delete(msg.clientId);
        }
        return;
      }
      this.upsertRemotePeer(msg, false);
    }
  }

  addChatMessage(sender, text) {
    this.chatMessages.push({ sender, text });
    if (this.chatMessages.length > 25) {
      this.chatMessages.shift();
    }
    if (this.onUIUpdate) this.onUIUpdate();
  }

  switchServer(serverId, playerProfile = {}) {
    if (this.currentServerId === serverId) return null;
    this.currentServerId = serverId;

    // Update URL query string cleanly (just like 불멍) so link sharing works per server!
    if (window.history && window.history.replaceState && window.location.protocol !== 'file:') {
      const newUrl = `${window.location.pathname}?room=${serverId}&instance=${this.currentInstance}&region=${this.currentRegion}`;
      window.history.replaceState({}, '', newUrl);
    }

    this.remotePeers.forEach((peer) => {
      this.world.scene.remove(peer.mesh);
      if (peer.labelEl) peer.labelEl.remove();
    });
    this.remotePeers.clear();

    this.spawnServerBots(serverId);
    this.connectServerStream(playerProfile);

    const srv = this.servers.find((s) => s.id === serverId);
    if (srv) {
      this.addChatMessage(
        '서버 이동',
        `[${srv.name}] 채널로 접속했습니다! (현재 ${this.getServerPopulation(srv)}명 놀이중)`
      );
    }
    if (this.onUIUpdate) this.onUIUpdate();
    return srv;
  }

  spawnServerBots(serverId) {
    this.activeBotEntities.forEach((b) => {
      this.world.scene.remove(b.mesh);
      if (b.labelEl) b.labelEl.remove();
    });
    this.activeBotEntities = [];

    const srv = this.servers.find((s) => s.id === serverId) || this.servers[0];
    const labelsRoot = document.getElementById('floating-labels');

    srv.bots.forEach((botSpec, idx) => {
      const mesh = this.world.createKidAvatar({
        shirtColor: botSpec.color,
        hatType: botSpec.hat,
        bandColor: 0x00f5d4,
        isMe: false
      });

      const targetZone = this.world.rideZones[botSpec.zone] || this.world.rideZones.trampoline;
      const startX = targetZone.pos.x + (Math.random() - 0.5) * 6;
      const startZ = targetZone.pos.z + (Math.random() - 0.5) * 6;
      mesh.position.set(startX, 0, startZ);
      this.world.scene.add(mesh);

      const labelEl = document.createElement('div');
      labelEl.className = 'avatar-label';
      if (labelsRoot) labelsRoot.appendChild(labelEl);

      this.activeBotEntities.push({
        id: `bot_${idx}`,
        name: botSpec.name,
        score: botSpec.score,
        zoneKey: botSpec.zone,
        mesh,
        labelEl,
        targetPos: new THREE.Vector3(startX, 0, startZ),
        waitTimer: Math.random() * 2,
        jumpPhase: Math.random() * Math.PI * 2,
        chatText: '',
        chatTimer: 0
      });
    });
  }

  getServerPopulation(srv) {
    const realCount = this.realServerCounts[srv.id] || (srv.id === this.currentServerId ? this.remotePeers.size + 1 : 0);
    return Math.min(srv.maxPop, srv.basePop + realCount);
  }

  getTotalOnlineCount() {
    return this.servers.reduce((acc, s) => acc + this.getServerPopulation(s), 0);
  }

  getRankings(myPlayer) {
    const list = [
      {
        name: `${myPlayer.name} (나)`,
        score: myPlayer.score,
        isMe: true
      }
    ];

    this.remotePeers.forEach((peer) => {
      list.push({
        name: peer.data.name,
        score: peer.data.score || 0,
        isMe: false
      });
    });

    this.activeBotEntities.forEach((b) => {
      list.push({
        name: b.name,
        score: b.score,
        isMe: false
      });
    });

    list.sort((a, b) => b.score - a.score);
    return list;
  }

  update(dt, elapsed, myPlayer) {
    if (Math.random() < dt * 0.35) {
      const randomBot =
        this.activeBotEntities[Math.floor(Math.random() * this.activeBotEntities.length)];
      if (randomBot) {
        const gain = [30, 50, 80, 150][Math.floor(Math.random() * 4)];
        randomBot.score += gain;
        if (Math.random() < 0.45) {
          randomBot.chatText =
            this.botPhrases[Math.floor(Math.random() * this.botPhrases.length)];
          randomBot.chatTimer = 4.5;
        }
        if (this.onUIUpdate) this.onUIUpdate();
      }
    }

    const zoneKeys = ['trampoline', 'ballpit', 'bonfire', 'climbing'];
    this.activeBotEntities.forEach((bot, idx) => {
      bot.waitTimer -= dt;
      if (bot.waitTimer <= 0) {
        if (Math.random() < 0.28) {
          bot.zoneKey = zoneKeys[Math.floor(Math.random() * zoneKeys.length)];
        }
        const zInfo = this.world.rideZones[bot.zoneKey] || this.world.rideZones.trampoline;
        bot.targetPos.set(
          zInfo.pos.x + (Math.random() - 0.5) * 7.5,
          0,
          zInfo.pos.z + (Math.random() - 0.5) * 7.5
        );
        bot.waitTimer = 3.0 + Math.random() * 4.0;
      }

      const dx = bot.targetPos.x - bot.mesh.position.x;
      const dz = bot.targetPos.z - bot.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.4) {
        const speed = 4.8;
        bot.mesh.position.x += (dx / dist) * speed * dt;
        bot.mesh.position.z += (dz / dist) * speed * dt;
        bot.mesh.rotation.y = Math.atan2(dx, dz);

        const swing = Math.sin(elapsed * 10 + idx) * 0.55;
        bot.mesh.userData.leftLeg.rotation.x = swing;
        bot.mesh.userData.rightLeg.rotation.x = -swing;
        bot.mesh.userData.leftArm.rotation.x = -swing;
        bot.mesh.userData.rightArm.rotation.x = swing;
      }

      if (bot.zoneKey === 'trampoline') {
        bot.mesh.position.y = 0.68 + Math.abs(Math.sin(elapsed * 4.2 + bot.jumpPhase)) * 3.4;
      } else {
        bot.mesh.position.y = Math.abs(Math.sin(elapsed * 3.0 + bot.jumpPhase)) * 0.35;
      }

      if (bot.chatTimer > 0) {
        bot.chatTimer -= dt;
        if (bot.chatTimer <= 0) bot.chatText = '';
      }

      this.projectLabel(bot.mesh.position, bot.labelEl, bot.name, bot.score, bot.chatText, false);
    });

    const now = performance.now();
    this.remotePeers.forEach((peer, cid) => {
      if (!peer.fromServer && now - peer.lastSeen > 8000) {
        this.world.scene.remove(peer.mesh);
        if (peer.labelEl) peer.labelEl.remove();
        this.remotePeers.delete(cid);
        return;
      }
      this.projectLabel(
        peer.mesh.position,
        peer.labelEl,
        peer.data.name,
        peer.data.score,
        peer.data.chat,
        false
      );
    });
  }

  projectLabel(pos3D, el, name, score, chatText, isMe) {
    if (!el) return;
    const tempV = pos3D.clone();
    tempV.y += 2.75;
    tempV.project(this.world.camera);

    if (tempV.z > 1) {
      el.style.opacity = '0';
      return;
    }

    const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(tempV.y * 0.5) + 0.5) * window.innerHeight;

    el.style.opacity = '1';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const chatHtml = chatText ? `<div class="avatar-chat-bubble">${chatText}</div>` : '';
    el.innerHTML = `
      ${chatHtml}
      <div class="avatar-name-tag ${isMe ? 'me-tag' : ''}">
        <span>${name}</span>
        <span class="avatar-score-badge">${(score || 0).toLocaleString()}P</span>
      </div>
    `;
  }
}

window.MetaverseManager = MetaverseManager;
