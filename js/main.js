// Main Game Loop, Ride Physics, X-Tag Scoring & Intuitive Kid Controls
class KidsCafeApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.world = new ArcadeWorld(this.container);

    // Load saved player profile or create default
    const savedScore = parseInt(localStorage.getItem('arcadex_score') || '120', 10);
    const savedHat = localStorage.getItem('arcadex_hat') || 'cap';
    const savedName = localStorage.getItem('arcadex_name') || '오산동탄챔피언';

    this.player = {
      name: savedName,
      score: isNaN(savedScore) ? 120 : savedScore,
      combo: 1,
      comboTimer: 0,
      level: 1,
      hat: savedHat,
      unlockedHats: JSON.parse(localStorage.getItem('arcadex_unlocked') || '["cap"]'),
      pos: new THREE.Vector3(0, 0, 10),
      vel: new THREE.Vector3(0, 0, 0),
      rotY: Math.PI,
      isGrounded: true,
      trampolineBounceCount: 0,
      state: 'FREE', // 'FREE' | 'AUTO_WALK' | 'CLIMBING' | 'SLIDING' | 'ZIPLINE' | 'DROPPING'
      autoTarget: null,
      autoNextState: null,
      climbProgress: 0,
      slideProgress: 0,
      zipProgress: 0,
      bonfireHealTimer: 0,
      chatBubble: '',
      chatTimer: 0
    };

    // Create My 3D Kid Avatar
    this.playerMesh = this.world.createKidAvatar({
      shirtColor: 0x38bdf8,
      hatType: this.player.hat,
      bandColor: 0x00f5d4,
      isMe: true
    });
    this.playerMesh.position.copy(this.player.pos);
    this.world.scene.add(this.playerMesh);

    this.myLabelEl = document.createElement('div');
    this.myLabelEl.className = 'avatar-label';
    document.getElementById('floating-labels').appendChild(this.myLabelEl);

    // Camera orbit parameters
    this.camYaw = 0;
    this.camPitch = 0.42;
    this.camDist = 14.5;
    this.isDraggingCam = false;
    this.prevPointer = { x: 0, y: 0 };

    // Input state
    this.keys = {};
    this.joyVec = { x: 0, y: 0 };

    // Initialize Multi-Server Metaverse
    this.metaverse = new MetaverseManager(this.world, () => this.refreshHUD());

    this.bindInputs();
    this.bindUIEvents();
    this.refreshHUD();

    this.lastTime = performance.now();
    this.syncTimer = 0;
    this.animate();
  }

  bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        this.handlePrimaryAction();
      }
      if (e.code === 'KeyE' || e.code === 'Enter') {
        this.triggerNearbyTagPulse();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Camera Drag on Canvas
    const dom = this.world.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      this.isDraggingCam = true;
      this.prevPointer = { x: e.clientX, y: e.clientY };
      window.soundEngine.init();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDraggingCam) return;
      const dx = e.clientX - this.prevPointer.x;
      const dy = e.clientY - this.prevPointer.y;
      this.prevPointer = { x: e.clientX, y: e.clientY };
      this.camYaw -= dx * 0.0065;
      this.camPitch = Math.max(0.15, Math.min(1.15, this.camPitch + dy * 0.005));
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingCam = false;
    });

    window.addEventListener('wheel', (e) => {
      this.camDist = Math.max(7, Math.min(26, this.camDist + e.deltaY * 0.01));
    });

    // Virtual Touch Joystick
    const joyZone = document.getElementById('joystick-zone');
    const joyKnob = document.getElementById('joystick-knob');
    let joyActive = false;

    const updateJoy = (clientX, clientY) => {
      const rect = joyZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const maxR = 36;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joyVec.x = dx / maxR;
      this.joyVec.y = dy / maxR;
      if (dist > 4 && this.player.state === 'AUTO_WALK') {
        this.player.state = 'FREE';
      }
    };

    joyZone.addEventListener('pointerdown', (e) => {
      joyActive = true;
      joyZone.setPointerCapture(e.pointerId);
      updateJoy(e.clientX, e.clientY);
    });

    joyZone.addEventListener('pointermove', (e) => {
      if (!joyActive) return;
      updateJoy(e.clientX, e.clientY);
    });

    const resetJoy = () => {
      joyActive = false;
      joyKnob.style.transform = 'translate(0px, 0px)';
      this.joyVec.x = 0;
      this.joyVec.y = 0;
    };
    joyZone.addEventListener('pointerup', resetJoy);
    joyZone.addEventListener('pointercancel', resetJoy);
  }

  bindUIEvents() {
    // Entry Overlay (불멍 스타일 입장 모달)
    const randomNames = [
      '오산동탄챔피언',
      '번개점퍼민준',
      '클라이밍요정서연',
      '스카이워커도윤',
      '슬라이드스타하은',
      '황금범종수호자',
      '슈퍼짚라인지호',
      '아케이드히어로'
    ];
    const previewEl = document.getElementById('previewNickname');
    if (previewEl) previewEl.textContent = this.player.name;

    const rerollBtn = document.getElementById('rerollNameBtn');
    if (rerollBtn) {
      rerollBtn.addEventListener('click', () => {
        const pick = randomNames[Math.floor(Math.random() * randomNames.length)] + Math.floor(Math.random() * 90 + 10);
        this.player.name = pick;
        localStorage.setItem('arcadex_name', pick);
        if (previewEl) previewEl.textContent = pick;
        this.refreshHUD();
      });
    }

    const enterBtn = document.getElementById('enterParkBtn');
    if (enterBtn) {
      enterBtn.addEventListener('click', () => {
        window.soundEngine.init();
        window.soundEngine.playTagSuccess(3, 2);
        document.getElementById('entryOverlay').classList.add('hidden');
        this.metaverse.connectServerStream(this.player);
        this.showToast(`🎉 환영합니다, ${this.player.name}님! 원하는 놀이기구를 눌러 점수를 올려보세요!`);
      });
    }

    const copyLinkBtn = document.getElementById('copy-room-link-btn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${this.metaverse.currentServerId}&instance=0&region=kr`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).catch(() => {});
        }
        this.showToast(`🔗 서버 초대 주소가 복사되었습니다! (${shareUrl})`);
      });
    }

    // Jump / Challenge Action Button
    document.getElementById('btn-jump').addEventListener('click', () => {
      window.soundEngine.init();
      this.handlePrimaryAction();
    });

    // Wristband X-Tag Pulse Button
    document.getElementById('btn-tag').addEventListener('click', () => {
      window.soundEngine.init();
      this.triggerNearbyTagPulse();
    });

    // Challenge Big Button (inside Climbing / Zipline modal overlay)
    document.getElementById('challenge-action-btn').addEventListener('click', () => {
      window.soundEngine.init();
      this.handlePrimaryAction();
    });

    // Quick Ride Cards on Bottom Dock
    document.querySelectorAll('.ride-card').forEach((card) => {
      card.addEventListener('click', () => {
        window.soundEngine.init();
        const rideKey = card.getAttribute('data-ride');
        this.navigateToRide(rideKey);

        document.querySelectorAll('.ride-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
      });
    });

    // Theme Switcher Button (실사+산사 융합 ↔ 산사 자연힐링 ↔ 아케이드 네온)
    document.getElementById('btn-theme').addEventListener('click', () => {
      const mode = this.world.cycleTheme();
      const labelMap = {
        hybrid: '🏯 테마: 실사+산사 융합',
        sansa: '🌲 테마: 산사(山寺) 숲속힐링',
        arcade: '⚡ 테마: 아케이드 네온'
      };
      document.getElementById('btn-theme').textContent = labelMap[mode];
      this.showToast(`${labelMap[mode]} 모드로 전환되었습니다!`);
    });

    // Sound Toggle Button
    document.getElementById('btn-sound').addEventListener('click', () => {
      const muted = window.soundEngine.toggleMute();
      document.getElementById('btn-sound').textContent = muted ? '🔇 소리 켜기' : '🔊 사운드 ON';
    });

    // Reward Kiosk / Avatar Customizer Modal
    document.getElementById('btn-shop').addEventListener('click', () => {
      this.renderShopModal();
      document.getElementById('shop-modal').classList.add('open');
    });

    document.getElementById('close-shop-btn').addEventListener('click', () => {
      document.getElementById('shop-modal').classList.remove('open');
    });

    // Chat Input
    const chatInput = document.getElementById('chat-input');
    const sendChat = () => {
      const txt = chatInput.value.trim();
      if (!txt) return;
      chatInput.value = '';
      this.player.chatBubble = txt;
      this.player.chatTimer = 4.5;
      this.metaverse.broadcastChat(this.player.name, txt);
    };
    document.getElementById('chat-send-btn').addEventListener('click', sendChat);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChat();
    });
  }

  // Navigate or teleport/run directly to any Ride when kid clicks a bottom Ride Card!
  navigateToRide(rideKey) {
    const zone = this.world.rideZones[rideKey];
    if (!zone) return;

    this.updateMissionGuide(zone.name, `난이도 ★×${zone.diff} | 기본 +${zone.basePts}점 미션에 도전하세요!`);

    if (rideKey === 'slide') {
      // Take player to Top of Mega Slide and start sliding!
      this.player.pos.set(-16.2, 7.2, -12.2);
      this.startSlideRide();
      return;
    }

    if (rideKey === 'skywalk') {
      // Place player at the start of the high-altitude Skywalk Bridge
      this.player.pos.set(-10.5, 7.2, -15);
      this.player.vel.set(0, 0, 0);
      this.player.state = 'FREE';
      this.hideChallengeOverlay();
      this.showToast('🌉 다이내믹 스카이워크 출발! 흔들리는 다리를 건너 태그 박스를 터치하세요!');
      return;
    }

    if (rideKey === 'climbing') {
      // Place player at base of Climbing Wall and begin Climbing Challenge
      this.player.pos.set(0, 0, -20.2);
      this.player.rotY = Math.PI;
      this.startClimbingChallenge();
      return;
    }

    if (rideKey === 'zipline') {
      // Place player at Summit Zipline Launchpad and start Zipline Flight!
      this.startZiplineRide();
      return;
    }

    // For ground zones (trampoline, ballpit, bonfire), smoothly run there or jump right in!
    this.player.autoTarget = zone.pos.clone();
    this.player.state = 'AUTO_WALK';
    this.hideChallengeOverlay();
    this.showToast(`🏃 [${zone.name}](으)로 이동합니다!`);
  }

  handlePrimaryAction() {
    if (this.player.state === 'CLIMBING') {
      // Advance climbing gauge!
      this.player.climbProgress += 0.14;
      window.soundEngine.playClimbStep(this.player.climbProgress);
      this.player.pos.y = Math.min(14.5, this.player.climbProgress * 14.5);
      this.updateChallengeGauge(this.player.climbProgress * 100);

      if (this.player.climbProgress >= 1.0) {
        this.completeClimbingSummit();
      }
      return;
    }

    if (this.player.state === 'ZIPLINE') {
      // Trigger Dynamic Drop onto the Bullseye Airbag Target!
      this.triggerZiplineDrop();
      return;
    }

    // Standard or Trampoline Jump
    if (this.player.isGrounded) {
      const inTrampoline =
        Math.abs(this.player.pos.x - -18) < 6.4 && Math.abs(this.player.pos.z - 8) < 6.4;

      if (inTrampoline) {
        this.player.trampolineBounceCount = Math.min(4, this.player.trampolineBounceCount + 1);
        const jumpVel = 10.5 + this.player.trampolineBounceCount * 2.6;
        this.player.vel.y = jumpVel;
        this.player.isGrounded = false;
        window.soundEngine.playJump(true);
        this.showToast(`🚀 트램펄린 슈퍼 점프 x${this.player.trampolineBounceCount}!`);
      } else {
        this.player.vel.y = 9.2;
        this.player.isGrounded = false;
        window.soundEngine.playJump(false);
      }
    }
  }

  triggerNearbyTagPulse() {
    // Pulse wristband light and tag any box within generous range (3.8m)
    const band = this.playerMesh.userData.wristBand;
    if (band) {
      band.scale.setScalar(1.8);
      setTimeout(() => band.scale.setScalar(1.0), 260);
    }

    let taggedAny = false;
    this.world.tagBoxes.forEach((box) => {
      if (box.userData.cooldown <= 0) {
        const dist = this.player.pos.distanceTo(box.position);
        if (dist < 4.2) {
          this.collectTagBox(box);
          taggedAny = true;
        }
      }
    });

    if (!taggedAny) {
      // Find nearest active tag box and guide player
      let nearest = null;
      let minD = Infinity;
      this.world.tagBoxes.forEach((b) => {
        if (b.userData.cooldown <= 0) {
          const d = this.player.pos.distanceTo(b.position);
          if (d < minD) {
            minD = d;
            nearest = b;
          }
        }
      });
      if (nearest) {
        this.player.autoTarget = new THREE.Vector3(nearest.position.x, 0, nearest.position.z);
        if (nearest.position.y < 5) {
          this.player.state = 'AUTO_WALK';
        }
        this.showToast(`⌚ 태그 팔찌 스캔! [${nearest.userData.name}] 방향으로 안내합니다!`);
      }
    }
  }

  startSlideRide() {
    this.player.state = 'SLIDING';
    this.player.slideProgress = 0;
    window.soundEngine.playSlideWhoosh();
    this.showToast('🎢 다이내믹 메가 슬라이드 출발! 신나게 내려갑니다!');
  }

  startClimbingChallenge() {
    this.player.state = 'CLIMBING';
    this.player.climbProgress = 0.05;
    this.player.vel.set(0, 0, 0);
    this.showChallengeOverlay(
      '🧗 다이내믹 클라이밍 (난이도 ★★★★★)',
      '스페이스바 또는 [등반 파워업!] 버튼을 연타해 산사 범종 정상까지 올라가세요!',
      '⚡ 등반 파워업! (SPACE)'
    );
  }

  completeClimbingSummit() {
    this.player.state = 'FREE';
    this.player.pos.set(0, 14.8, -21.2);
    this.hideChallengeOverlay();

    // Ring the Golden Temple Bell (산사 황금 범종 타종!)
    window.soundEngine.playTempleBell();
    this.world.spawnCelebrationBurst(new THREE.Vector3(0, 16.5, -21), 0xfbbf24);
    this.awardPoints(250, '🔔 산사(山寺) 정상 황금범종 등반 완주!', 5);

    this.player.chatBubble = '산사 정상 황금범종 등반 +250점 성공!! 🔔✨';
    this.player.chatTimer = 4.5;
    this.metaverse.broadcastChat(this.player.name, this.player.chatBubble);
  }

  startZiplineRide() {
    this.player.state = 'ZIPLINE';
    this.player.zipProgress = 0;
    this.player.pos.copy(this.world.zipStart);
    window.soundEngine.playSlideWhoosh();
    this.showChallengeOverlay(
      '🦅 다이내믹 플라잉 짚라인 (최고난도 ★★★★★★)',
      '바닥의 원형 과녁 중앙 위를 지날 때 [드롭 착지!] 버튼을 누르면 최대 +400점!',
      '🎯 지금 다이내믹 드롭! (SPACE)'
    );
  }

  triggerZiplineDrop() {
    this.player.state = 'DROPPING';
    this.hideChallengeOverlay();
    window.soundEngine.playJump(true);
  }

  showChallengeOverlay(title, sub, btnText) {
    const el = document.getElementById('ride-action-overlay');
    document.getElementById('challenge-title').textContent = title;
    document.getElementById('challenge-sub').textContent = sub;
    document.getElementById('challenge-action-btn').textContent = btnText;
    this.updateChallengeGauge(0);
    el.classList.add('visible');
  }

  updateChallengeGauge(percent) {
    const fill = document.getElementById('challenge-gauge-fill');
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  hideChallengeOverlay() {
    document.getElementById('ride-action-overlay').classList.remove('visible');
  }

  collectTagBox(box) {
    box.userData.cooldown = 7.5; // Respawns after 7.5 seconds

    // Increase Combo if within timer
    if (this.player.comboTimer > 0) {
      this.player.combo = Math.min(5, this.player.combo + 1);
    } else {
      this.player.combo = 1;
    }
    this.player.comboTimer = 14.0;

    const basePts = box.userData.pts;
    const multiplier = 1 + (this.player.combo - 1) * 0.25;
    const finalPts = Math.round(basePts * multiplier);

    window.soundEngine.playTagSuccess(box.userData.diff, this.player.combo);
    this.world.spawnCelebrationBurst(box.position, box.userData.color);
    this.awardPoints(finalPts, `⌚ [X-태그] ${box.userData.name}`, box.userData.diff);
  }

  awardPoints(pts, label, difficulty = 1) {
    this.player.score += pts;
    localStorage.setItem('arcadex_score', String(this.player.score));

    // Spawn floating 3D->2D score popup
    const pop = document.createElement('div');
    pop.className = 'score-float-pop';
    const stars = '★'.repeat(Math.min(6, difficulty));
    pop.textContent = `${stars} ${label} +${pts}점!`;

    const screenPos = this.player.pos.clone();
    screenPos.y += 3.2;
    screenPos.project(this.world.camera);
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;

    document.getElementById('floating-labels').appendChild(pop);
    setTimeout(() => pop.remove(), 1300);

    // Pop combo pill
    const comboEl = document.getElementById('hud-combo');
    if (comboEl) {
      comboEl.classList.add('pop');
      setTimeout(() => comboEl.classList.remove('pop'), 250);
    }

    this.refreshHUD();
  }

  updateMissionGuide(title, desc) {
    const tEl = document.getElementById('mission-title');
    const dEl = document.getElementById('mission-desc');
    if (tEl) tEl.textContent = title;
    if (dEl) dEl.textContent = desc;
  }

  showToast(msg) {
    const banner = document.getElementById('toast-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => banner.classList.remove('show'), 2800);
  }

  refreshHUD() {
    // Score & Level calculation
    document.getElementById('hud-score').textContent = this.player.score.toLocaleString();
    const mult = (1 + (this.player.combo - 1) * 0.25).toFixed(2).replace(/\.00$/, '');
    document.getElementById('hud-combo').textContent = `🔥 ${this.player.combo}콤보 (x${mult}배)`;

    const level = Math.floor(this.player.score / 500) + 1;
    const xpPercent = ((this.player.score % 500) / 500) * 100;
    const titles = [
      '키즈 탐험가',
      '트램펄린 루키',
      '슬라이드 레이서',
      '스카이워커',
      '산사 클라이밍 마스터',
      '아케이드엑스 전설'
    ];
    const titleName = titles[Math.min(titles.length - 1, level - 1)];
    document.getElementById('hud-level').textContent = `Lv.${level} ${titleName}`;
    document.getElementById('hud-xp-fill').style.width = `${xpPercent}%`;

    // Multi-Server List & Online Player Counts
    const totalOnline = this.metaverse.getTotalOnlineCount();
    document.getElementById('total-online-badge').textContent = `전체 ${totalOnline}명 접속중`;

    const srvContainer = document.getElementById('server-list');
    srvContainer.innerHTML = '';
    this.metaverse.servers.forEach((srv) => {
      const pop = this.metaverse.getServerPopulation(srv);
      const ratio = pop / srv.maxPop;
      let statusClass = 'smooth';
      let dotClass = '';
      let statusText = '원활';
      if (ratio >= 0.85) {
        statusClass = 'crowded';
        dotClass = 'crowded';
        statusText = '혼잡';
      } else if (ratio >= 0.55) {
        statusClass = 'normal';
        dotClass = 'busy';
        statusText = '보통';
      }

      const item = document.createElement('div');
      item.className = `server-item ${srv.id === this.metaverse.currentServerId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="server-name-wrap">
          <span class="status-dot ${dotClass}"></span>
          <span class="server-name">${srv.name}</span>
        </div>
        <div class="server-pop">
          <span>${pop}/${srv.maxPop}명</span>
          <span class="congestion-tag ${statusClass}">${statusText}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        const switched = this.metaverse.switchServer(srv.id);
        if (switched) {
          this.showToast(`🌐 [${switched.name}] 서버로 이동했습니다! (현재 ${this.metaverse.getServerPopulation(switched)}명)`);
          this.refreshHUD();
        }
      });
      srvContainer.appendChild(item);
    });

    // Live Rankings & 3D Wall Scoreboard Sync
    const rankings = this.metaverse.getRankings(this.player);
    const rankListEl = document.getElementById('rank-list');
    rankListEl.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉', '4', '5'];
    rankings.slice(0, 5).forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = `rank-item ${r.isMe ? 'me' : ''}`;
      row.innerHTML = `
        <div class="rank-left">
          <span class="rank-medal">${medals[idx] || idx + 1}</span>
          <span>${r.name}</span>
        </div>
        <span class="rank-score">${r.score.toLocaleString()}점</span>
      `;
      rankListEl.appendChild(row);
    });

    const curSrv = this.metaverse.servers.find((s) => s.id === this.metaverse.currentServerId);
    if (curSrv) {
      this.world.updateWallScoreboard(
        rankings,
        curSrv.name,
        this.metaverse.getServerPopulation(curSrv)
      );
    }

    // Live Chat Feed
    const feedEl = document.getElementById('live-feed');
    if (feedEl) {
      feedEl.innerHTML = this.metaverse.chatMessages
        .slice(-6)
        .map((m) => `<div class="feed-msg"><strong>${m.sender}:</strong> ${m.text}</div>`)
        .join('');
      feedEl.scrollTop = feedEl.scrollHeight;
    }
  }

  renderShopModal() {
    const items = [
      { id: 'cap', icon: '🧢', title: '아케이드 스포츠캡', desc: '기본 스포티 모자', cost: 0 },
      { id: 'satgat', icon: '👒', title: '산사(山寺) 힐링 삿갓', desc: '산사 컨셉 전통 삿갓', cost: 200 },
      { id: 'crown', icon: '👑', title: '황금 챔피언 왕관', desc: '오산동탄 랭커용 왕관', cost: 450 },
      { id: 'wings', icon: '🦋', title: '사이버 네온 날개', desc: '고난도 정복자 빛의 날개', cost: 800 }
    ];

    document.getElementById('shop-my-points').textContent = `${this.player.score.toLocaleString()} P`;
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = '';

    items.forEach((it) => {
      const unlocked = this.player.unlockedHats.includes(it.id);
      const equipped = this.player.hat === it.id;

      const card = document.createElement('div');
      card.className = `shop-item ${equipped ? 'equipped' : ''}`;
      let btnLabel = equipped ? '착용중 ✓' : unlocked ? '착용하기' : `${it.cost}P 교환`;

      card.innerHTML = `
        <div class="shop-item-icon">${it.icon}</div>
        <div class="shop-item-title">${it.title}</div>
        <div class="shop-item-desc">${it.desc}</div>
        <button class="shop-buy-btn">${btnLabel}</button>
      `;

      card.querySelector('button').addEventListener('click', () => {
        if ( unlocked ) {
          this.player.hat = it.id;
          localStorage.setItem('arcadex_hat', it.id);
          this.playerMesh.userData.applyAccessory(it.id);
          this.renderShopModal();
          this.showToast(`✨ [${it.title}] 아이템을 착용했습니다!`);
        } else if (this.player.score >= it.cost) {
          this.player.score -= it.cost;
          this.player.unlockedHats.push(it.id);
          this.player.hat = it.id;
          localStorage.setItem('arcadex_score', String(this.player.score));
          localStorage.setItem('arcadex_unlocked', JSON.stringify(this.player.unlockedHats));
          localStorage.setItem('arcadex_hat', it.id);
          this.playerMesh.userData.applyAccessory(it.id);
          window.soundEngine.playTagSuccess(4, 3);
          this.renderShopModal();
          this.refreshHUD();
          this.showToast(`🎉 [${it.title}] 교환 및 착용 완료!`);
        } else {
          this.showToast(`포인트가 부족합니다! (필요: ${it.cost}P) 놀이기구에서 태그 점수를 모아보세요!`);
        }
      });

      grid.appendChild(card);
    });
  }

  getFloorHeightAt(x, z, currentY) {
    // 1. Summit Temple Pavilion Deck (around X: -4.8..4.8, Z: -25..-18.5, Y >= 13.5)
    if (Math.abs(x) < 4.8 && z > -25.5 && z < -18.5 && currentY >= 13.2) {
      return 14.8;
    }
    // 2. Left Adventure Tower & Skywalk Bridge & Right Tower (Y = 7.2)
    if (z > -19.2 && z < -10.8 && x > -19.5 && x < 18.5 && currentY >= 5.8) {
      return 7.2;
    }
    // 3. Stairs up to Left Tower (X: -9.5 to -14.5, Z: -14.2 to -11.8)
    if (z > -14.4 && z < -11.6 && x <= -9.0 && x >= -14.8) {
      const ratio = (-9.0 - x) / 5.8;
      return Math.max(0, Math.min(7.2, ratio * 7.2));
    }
    // 4. Jungle Gym 2nd Floor Deck above Ball Pit (X: 12.6..23.4, Z: 2.6..13.4, Y >= 3.8)
    if (x > 12.6 && x < 23.4 && z > 2.6 && z < 13.4 && currentY >= 3.6) {
      return 4.8;
    }
    // 5. Jungle Gym Ramp (X: 10.5..13.2, Z: 4.0..12.0)
    if (x > 10.5 && x < 13.2 && z > 4.0 && z < 12.0) {
      const r = (12.0 - z) / 8.0;
      return Math.max(0, Math.min(4.8, r * 4.8));
    }
    // 6. Trampoline Bed surface
    if (Math.abs(x - -18) < 6.5 && Math.abs(z - 8) < 6.5) {
      return 0.72;
    }
    return 0;
  }

  updatePlayer(dt, elapsed) {
    // Combo countdown
    if (this.player.comboTimer > 0) {
      this.player.comboTimer = Math.max(0, this.player.comboTimer - dt);
      if (this.player.comboTimer === 0 && this.player.combo > 1) {
        this.player.combo = 1;
        this.refreshHUD();
      }
    }

    if (this.player.chatTimer > 0) {
      this.player.chatTimer -= dt;
      if (this.player.chatTimer <= 0) this.player.chatBubble = '';
    }

    // Handle Special Ride States
    if (this.player.state === 'SLIDING') {
      this.player.slideProgress += dt * 0.58;
      const t = Math.min(1, this.player.slideProgress);
      this.player.pos.x = -16.2 + Math.sin(t * Math.PI * 4) * 0.45;
      this.player.pos.y = 7.2 * (1 - t) + 0.4 * t;
      this.player.pos.z = -12.0 + t * 14.5;
      this.player.rotY = 0;

      if (t >= 1) {
        this.player.state = 'FREE';
        this.player.vel.set(0, 6.5, 4.5);
        this.awardPoints(80, '🎢 다이내믹 슬라이드 완주 보너스!', 3);
      }
    } else if (this.player.state === 'CLIMBING') {
      // Gently decay climb progress if idle, encouraging rhythmic presses
      this.player.pos.x = 0;
      this.player.pos.z = -20.5;
      this.player.rotY = Math.PI;
      const swing = Math.sin(elapsed * 14) * 0.6;
      this.playerMesh.userData.leftArm.rotation.x = -2.2 + swing;
      this.playerMesh.userData.rightArm.rotation.x = -2.2 - swing;
    } else if (this.player.state === 'ZIPLINE') {
      this.player.zipProgress += dt * 0.28;
      const t = this.player.zipProgress;
      this.player.pos.lerpVectors(this.world.zipStart, this.world.zipEnd, Math.min(1, t));
      this.player.pos.y -= 1.4; // Hang below trolley
      this.world.ziplineTrolley.position.lerpVectors(
        this.world.zipStart,
        this.world.zipEnd,
        Math.min(1, t)
      );
      this.player.rotY = 0;

      // Gauge shows how close we are to the Bullseye Target at Z = 2.0 (around t = 0.91)
      const accuracy = Math.max(0, 1 - Math.abs(t - 0.91) * 3.5);
      this.updateChallengeGauge(accuracy * 100);

      if (t >= 1.0) {
        this.triggerZiplineDrop();
      }
    } else if (this.player.state === 'DROPPING') {
      this.player.pos.y -= 18 * dt;
      if (this.player.pos.y <= 0.4) {
        this.player.pos.y = 0.4;
        this.player.state = 'FREE';
        this.world.ziplineTrolley.position.copy(this.world.zipStart);

        // Calculate distance to Bullseye Center (0, 0, 2.0)
        const dist = Math.hypot(this.player.pos.x - 0, this.player.pos.z - 2.0);
        let dropPts = 150;
        let msg = '🎯 다이내믹 드롭 착지 성공!';
        if (dist < 2.2) {
          dropPts = 400;
          msg = '👑 다이내믹 드롭 골든 불스아이 정중앙 명중!!';
        } else if (dist < 4.5) {
          dropPts = 280;
          msg = '🔥 다이내믹 드롭 고득점 과녁 명중!';
        }
        window.soundEngine.playTagSuccess(6, 4);
        this.world.spawnCelebrationBurst(this.player.pos.clone(), 0xff2a85);
        this.awardPoints(dropPts, msg, 6);
      }
    } else {
      // FREE or AUTO_WALK Movement
      let moveX = this.joyVec.x;
      let moveZ = this.joyVec.y;

      if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

      if (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05) {
        this.player.state = 'FREE';
      }

      if (this.player.state === 'AUTO_WALK' && this.player.autoTarget) {
        const dx = this.player.autoTarget.x - this.player.pos.x;
        const dz = this.player.autoTarget.z - this.player.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.1) {
          this.player.state = 'FREE';
          this.player.autoTarget = null;
        } else {
          moveX = dx / dist;
          moveZ = dz / dist;
        }
      }

      const moveLen = Math.hypot(moveX, moveZ);
      const speed = 9.6;

      if (moveLen > 0.05) {
        const nx = moveX / Math.max(1, moveLen);
        const nz = moveZ / Math.max(1, moveLen);

        // Rotate movement by camera yaw if manual input
        let worldMoveX = nx;
        let worldMoveZ = nz;
        if (this.player.state !== 'AUTO_WALK') {
          const cos = Math.cos(this.camYaw);
          const sin = Math.sin(this.camYaw);
          worldMoveX = nx * cos + nz * sin;
          worldMoveZ = -nx * sin + nz * cos;
        }

        this.player.pos.x += worldMoveX * speed * dt;
        this.player.pos.z += worldMoveZ * speed * dt;
        this.player.rotY = Math.atan2(worldMoveX, worldMoveZ);

        // Limb running swing
        const swing = Math.sin(elapsed * 13) * 0.65;
        this.playerMesh.userData.leftLeg.rotation.x = swing;
        this.playerMesh.userData.rightLeg.rotation.x = -swing;
        this.playerMesh.userData.leftArm.rotation.x = -swing;
        this.playerMesh.userData.rightArm.rotation.x = swing;
      } else {
        this.playerMesh.userData.leftLeg.rotation.x *= 0.85;
        this.playerMesh.userData.rightLeg.rotation.x *= 0.85;
        this.playerMesh.userData.leftArm.rotation.x *= 0.85;
        this.playerMesh.userData.rightArm.rotation.x *= 0.85;
      }

      // Gravity & Floor/Platform Collision
      const floorY = this.getFloorHeightAt(
        this.player.pos.x,
        this.player.pos.z,
        this.player.pos.y
      );
      this.player.vel.y -= 22.0 * dt;
      this.player.pos.y += this.player.vel.y * dt;

      if (this.player.pos.y <= floorY) {
        this.player.pos.y = floorY;
        this.player.vel.y = 0;
        this.player.isGrounded = true;

        // Auto-bounce when on Trampoline Zone!
        if (Math.abs(this.player.pos.x - -18) < 6.2 && Math.abs(this.player.pos.z - 8) < 6.2) {
          this.player.vel.y = 8.8;
          this.player.isGrounded = false;
        } else {
          this.player.trampolineBounceCount = 0;
        }
      }

      // Auto-trigger Slide if walking onto slide entry at (-16.2, 7.2, -11.5)
      if (
        this.player.pos.y > 6.5 &&
        Math.abs(this.player.pos.x - -16.2) < 1.6 &&
        Math.abs(this.player.pos.z - -11.8) < 1.6
      ) {
        this.startSlideRide();
      }

      // Auto-prompt Climbing if walking right up to the Climbing Wall base
      if (
        this.player.pos.y < 2.0 &&
        Math.abs(this.player.pos.x) < 3.2 &&
        Math.abs(this.player.pos.z - -20.5) < 1.4
      ) {
        this.startClimbingChallenge();
      }

      // Bonfire ("불멍") Cozy Healing Bonus when relaxing near the fire pit (0, 0, 15)
      const distToFire = Math.hypot(this.player.pos.x - 0, this.player.pos.z - 15);
      if (distToFire < 4.5) {
        this.player.bonfireHealTimer += dt;
        if (this.player.bonfireHealTimer >= 4.0) {
          this.player.bonfireHealTimer = 0;
          this.awardPoints(40, '🔥 산사 불멍 힐링 에너지 충전', 1);
        }
      } else {
        this.player.bonfireHealTimer = 0;
      }

      // Clamp inside park bounds
      this.player.pos.x = Math.max(-34, Math.min(34, this.player.pos.x));
      this.player.pos.z = Math.max(-29, Math.min(29, this.player.pos.z));
    }

    // Check Automatic X-Tag Box Collisions
    this.world.tagBoxes.forEach((box) => {
      if (box.userData.cooldown <= 0) {
        const dist = this.player.pos.distanceTo(box.position);
        if (dist < 2.35) {
          this.collectTagBox(box);
        }
      }
    });

    // Sync mesh position & rotation
    this.playerMesh.position.copy(this.player.pos);
    this.playerMesh.rotation.y = this.player.rotY;

    // Project My Nameplate & Score
    this.metaverse.projectLabel(
      this.player.pos,
      this.myLabelEl,
      `${this.player.name} (나)`,
      this.player.score,
      this.player.chatBubble,
      true
    );

    // Smooth 3rd-Person Camera Follow
    const targetCamX =
      this.player.pos.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const targetCamY =
      this.player.pos.y + Math.sin(this.camPitch) * this.camDist + 2.2;
    const targetCamZ =
      this.player.pos.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;

    this.world.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.12);
    this.world.camera.lookAt(
      this.player.pos.x,
      this.player.pos.y + 1.8,
      this.player.pos.z
    );
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const elapsed = now / 1000;

    this.updatePlayer(dt, elapsed);
    this.world.updateWorldElements(dt, elapsed, this.player.pos);
    this.metaverse.update(dt, elapsed, this.player);

    this.syncTimer += dt;
    if (this.syncTimer > 0.15) {
      this.syncTimer = 0;
      this.metaverse.broadcastMyState(this.player);
    }

    this.world.renderer.render(this.world.scene, this.world.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new KidsCafeApp();
});
