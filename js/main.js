// Ultra-Smooth 1-Click Co-Op Ride Engine, Camera Controller & Real-Time Metaverse Sync
const ADJECTIVES = ['신나는', '용감한', '해맑은', '번개같은', '날쌘', '행복한', '든든한', '반짝이는'];
const NOUNS = ['번개돌이', '점프왕', '슬라이더', '클라이머', '탐험가', '챔피언', '다람쥐', '히어로'];

function generateRandomNickname() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n}`;
}

class KidsCafeApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.world = new ArcadeWorld(this.container);

    const savedScore = parseInt(localStorage.getItem('arcadex_score') || '120', 10);
    const savedHat = localStorage.getItem('arcadex_hat') || 'cap';
    const savedName = localStorage.getItem('arcadex_name') || generateRandomNickname();

    this.state = {
      name: savedName,
      score: isNaN(savedScore) ? 120 : savedScore,
      combo: 1.0,
      hat: savedHat,
      unlockedHats: JSON.parse(localStorage.getItem('arcadex_unlocked') || '["cap"]'),
      currentRide: 'trampoline', // 'trampoline' | 'ballpit' | 'slide' | 'skywalk' | 'climbing' | 'zipline' | 'bonfire' | 'highfive'
      rideStartTime: performance.now(),
      rideCycleCount: 0,
      togetherMode: true,
      partnerName: '단짝 민준',
      povMode: 'closeup', // 'closeup' | 'front' | 'summit' | 'wide'
      zenMode: false
    };

    // Map of all 3D character entities in the scene: id -> avatarObj
    this.avatars = new Map();

    // Smooth Camera Controller (불멍 스타일 부드러운 시점 보간)
    this.camControl = {
      currentPos: new THREE.Vector3(0, 10, 22),
      currentLook: new THREE.Vector3(-16, 2, 7),
      orbitOffset: 0,
      pitchOffset: 0,
      zoomOffset: 0,
      isDragging: false,
      dragMoved: false,
      lastX: 0,
      lastY: 0,
      pinchStartDist: 0,
      pinchStartZoom: 0
    };

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Initialize Real-Time Metaverse Manager
    this.metaverse = new MetaverseManager(this.world, (ev) => this.handleMetaverseEvent(ev));

    this.rebuildAvatars();
    this.bindUIEvents();
    this.bindPointerAndZoom();
    this.updateHUD();

    this.lastTime = performance.now();
    this.animate();
  }

  // Build & Sync 3D Avatars (Me + Real Server Users + Friendly Kid Playmates)
  rebuildAvatars() {
    const activeList = [];

    // 1. Always include Me first
    activeList.push({
      id: this.metaverse.clientId,
      name: this.state.name,
      score: this.state.score,
      hat: this.state.hat,
      color: 0x38bdf8,
      ride: this.state.currentRide,
      isMe: true,
      isReal: true
    });

    // 2. Add other Real Users connected to this server instance
    this.metaverse.realUsers.forEach((u) => {
      if (u.id === this.metaverse.clientId) return;
      activeList.push({
        id: u.id,
        name: u.name || '키즈 친구',
        score: u.score || 120,
        hat: u.hat || 'cap',
        color: 0x22c55e,
        ride: u.ride || 'trampoline',
        isMe: false,
        isReal: true
      });
    });

    // 3. Add Friendly Kid Companions if enabled
    if (this.metaverse.enableCompanions) {
      this.metaverse.companionSpecs.forEach((comp, idx) => {
        // First companion rides WITH you when Together Mode is ON!
        const rideWithMe = this.state.togetherMode && idx === 0;
        activeList.push({
          id: comp.id,
          name: comp.name,
          score: comp.baseScore + Math.floor(this.state.score * 0.4),
          hat: comp.hat,
          color: comp.color,
          ride: rideWithMe ? this.state.currentRide : comp.defaultRide,
          isMe: false,
          isReal: false,
          isMyPartner: rideWithMe
        });
      });
    }

    // If there is another real player in the room and togetherMode is on, pick partner name
    const otherReal = activeList.find((a) => !a.isMe && a.isReal);
    if (otherReal) {
      this.state.partnerName = otherReal.name;
      otherReal.isMyPartner = this.state.togetherMode;
    } else {
      this.state.partnerName = '단짝 민준';
    }

    const activeIds = new Set();
    const labelsRoot = document.getElementById('floating-labels');

    activeList.forEach((spec, idx) => {
      activeIds.add(spec.id);
      let av = this.avatars.get(spec.id);
      if (!av) {
        const mesh = this.world.createKidAvatar({
          id: spec.id,
          shirtColor: spec.color,
          hatType: spec.hat,
          bandColor: spec.isMe ? 0x00f5d4 : 0xfbbf24,
          isMe: spec.isMe
        });
        this.world.scene.add(mesh);

        const labelEl = document.createElement('div');
        labelEl.className = 'avatar-label';
        labelsRoot.appendChild(labelEl);

        av = {
          id: spec.id,
          mesh,
          labelEl,
          currentPos: new THREE.Vector3(0, 0, 10),
          targetPos: new THREE.Vector3(0, 0, 10),
          rotY: 0,
          phaseOffset: idx * 1.1
        };
        this.avatars.set(spec.id, av);
      }

      av.name = spec.name;
      av.score = spec.score;
      av.hat = spec.hat;
      av.ride = spec.ride;
      av.isMe = spec.isMe;
      av.isReal = spec.isReal;
      av.isMyPartner = Boolean(spec.isMyPartner);
      av.mesh.userData.applyAccessory(spec.hat);
    });

    // Remove stale avatars
    for (const [id, av] of this.avatars.entries()) {
      if (!activeIds.has(id)) {
        this.world.scene.remove(av.mesh);
        if (av.labelEl) av.labelEl.remove();
        this.avatars.delete(id);
      }
    }

    this.updateHUD();
  }

  handleMetaverseEvent(ev) {
    if (!ev) return;
    if (ev.type === 'sync' || ev.type === 'counts' || ev.type === 'error') {
      this.rebuildAvatars();
    } else if (ev.type === 'effect' && ev.effect) {
      const eff = ev.effect;
      if (eff.actorId !== this.metaverse.clientId) {
        if (eff.effect === 'startRide') {
          const z = this.world.rideZones[eff.ride];
          if (z) {
            this.showToast(`🎢 ${eff.actorName}님이 [${z.name}] 놀이를 시작했습니다!`);
          }
        } else if (eff.effect === 'highfive') {
          window.soundEngine.playTagSuccess(3, 2);
          this.showToast(`🙌 ${eff.actorName}님이 반갑게 하이파이브를 보냅니다!`);
        } else if (eff.effect === 'changeTheme' && eff.theme) {
          this.applyTheme(eff.theme, false);
        }
      }
    }
  }

  // Start a Ride (1-Click Smooth Co-Op Ride!)
  selectRide(rideKey) {
    window.soundEngine.init();

    if (rideKey === 'highfive') {
      this.state.currentRide = 'highfive';
      this.state.rideStartTime = performance.now();
      window.soundEngine.playTagSuccess(3, 2);
      this.awardPoints(50, `🙌 ${this.state.partnerName}와 우정의 하이파이브!`, 2);
      this.metaverse.sendAction({ type: 'highfive', targetName: this.state.partnerName });
      this.rebuildAvatars();
      return;
    }

    const zone = this.world.rideZones[rideKey];
    if (!zone) return;

    this.state.currentRide = rideKey;
    this.state.rideStartTime = performance.now();
    this.state.rideCycleCount = 0;

    // Reset camera orbit so it frames the new ride nicely
    this.camControl.orbitOffset = 0;

    // Update active button state on bottom dock
    document.querySelectorAll('#dockActionsContainer .action-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.ride === rideKey);
    });

    if (rideKey === 'slide' || rideKey === 'zipline') {
      window.soundEngine.playSlideWhoosh();
    } else {
      window.soundEngine.playJump(true);
    }

    const togetherTxt = this.state.togetherMode
      ? `🤝 ${this.state.partnerName}와 함께 [${zone.name}] 출발! (같이 타기 보너스 2배!)`
      : `🏃 [${zone.name}] 출발!`;
    this.showToast(togetherTxt);

    this.rebuildAvatars();
    this.metaverse.sendAction({
      type: 'ride',
      ride: rideKey,
      together: this.state.togetherMode,
      partnerName: this.state.partnerName,
      score: this.state.score
    });
  }

  awardPoints(basePts, reasonText, difficulty = 1) {
    const togetherMult = this.state.togetherMode ? 2 : 1;
    this.state.combo = Math.min(2.5, Number((this.state.combo + 0.1).toFixed(1)));
    const totalPts = Math.round(basePts * togetherMult * this.state.combo);

    this.state.score += totalPts;
    localStorage.setItem('arcadex_score', String(this.state.score));

    const myAv = this.avatars.get(this.metaverse.clientId);
    if (myAv) {
      myAv.score = this.state.score;
      this.world.spawnCelebrationBurst(
        myAv.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
        0xfbbf24
      );

      // Floating 2D Score Popup
      const pop = document.createElement('div');
      pop.className = 'score-float-pop';
      const stars = '★'.repeat(Math.min(6, difficulty));
      pop.textContent = `${stars} ${reasonText} +${totalPts}점!`;

      const screenPos = myAv.mesh.position.clone();
      screenPos.y += 3.1;
      screenPos.project(this.world.camera);
      const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
      pop.style.left = `${x}px`;
      pop.style.top = `${y}px`;
      document.getElementById('floating-labels').appendChild(pop);
      setTimeout(() => pop.remove(), 1450);
    }

    this.metaverse.sendAction({
      type: 'scoreUpdate',
      score: this.state.score,
      hat: this.state.hat,
      name: this.state.name
    });

    this.updateHUD();
  }

  // Smoothly animate every avatar on their current ride (Co-Op Side-by-Side!)
  updateAvatarsAndRides(dt, now, elapsed) {
    const rideElapsed = (now - this.state.rideStartTime) / 1000;

    // Group avatars by ride so riders on the same ride stand/slide/climb side-by-side!
    const rideGroups = {};
    for (const av of this.avatars.values()) {
      const r = av.ride || 'trampoline';
      if (!rideGroups[r]) rideGroups[r] = [];
      rideGroups[r].push(av);
    }

    const allPositions = [];

    for (const av of this.avatars.values()) {
      const r = av.ride || 'trampoline';
      const groupList = rideGroups[r] || [av];
      const slotInRide = groupList.indexOf(av);
      // Offset side-by-side (-1.15m for Me, +1.15m for Partner!)
      const sideOffset =
        groupList.length === 1
          ? 0
          : (slotInRide - (groupList.length - 1) / 2) * 2.1;

      const t = av.isMe || av.isMyPartner ? rideElapsed : elapsed + av.phaseOffset;

      let targetX = 0;
      let targetY = 0;
      let targetZ = 0;
      let targetRotY = 0;
      let targetPose = {
        torsoLean: 0,
        leftArmX: 0,
        rightArmX: 0,
        leftLegX: 0,
        rightLegX: 0,
        bodyY: 0
      };
      let bubbleHTML = '';

      if (r === 'trampoline') {
        // 1. TRAMPOLINE CO-OP BOUNCING
        const cycle = t % 4.5;
        const bounceWave = Math.abs(Math.sin(t * 3.6));
        const jumpHeight = bounceWave * 4.2;

        targetX = -16 + sideOffset;
        targetY = 0.72 + jumpHeight;
        targetZ = 7 + (slotInRide > 1 ? 2.5 : 0);
        targetRotY = 0;

        if (jumpHeight > 1.2) {
          // Arms up in the air, knees slightly tucked!
          targetPose.leftArmX = -2.5;
          targetPose.rightArmX = -2.5;
          targetPose.leftLegX = 0.45;
          targetPose.rightLegX = 0.45;
        } else {
          // Landing crouch
          targetPose.torsoLean = 0.2;
          targetPose.leftArmX = -0.5;
          targetPose.rightArmX = -0.5;
        }

        const pct = Math.min(100, Math.floor((cycle / 4.2) * 100));
        if (av.isMe) {
          bubbleHTML = this.state.togetherMode
            ? `🤸 ${this.state.partnerName}와 트램펄린 슈퍼점프! <span class="prog-bar"><span class="prog-fill" style="width:${pct}%"></span></span>`
            : `🤸 트램펄린 점프 태그 중! (${pct}%)`;
        } else if (av.isMyPartner) {
          bubbleHTML = `🙌 "우와! 진짜 높이 뛴다!!"`;
        }
      } else if (r === 'ballpit') {
        // 2. BALL PIT DIVING & SWIMMING
        const cycle = t % 5.0;
        const wadeAngle = t * 1.8 + slotInRide * 1.2;
        targetX = 16 + Math.cos(wadeAngle) * 2.4 + sideOffset * 0.5;
        targetZ = 7 + Math.sin(wadeAngle) * 2.2;
        targetY = 0.35 + Math.abs(Math.sin(t * 4.5)) * 0.85;
        targetRotY = -wadeAngle + Math.PI / 2;

        const swimSwing = Math.sin(t * 8) * 0.85;
        targetPose.torsoLean = 0.35;
        targetPose.leftArmX = -1.2 + swimSwing;
        targetPose.rightArmX = -1.2 - swimSwing;
        targetPose.leftLegX = -swimSwing * 0.6;
        targetPose.rightLegX = swimSwing * 0.6;

        const pct = Math.min(100, Math.floor((cycle / 4.6) * 100));
        if (av.isMe) {
          bubbleHTML = `🟣 컬러 볼풀 보물찾기 다이빙! <span class="prog-bar"><span class="prog-fill" style="width:${pct}%"></span></span>`;
        } else if (av.isMyPartner) {
          bubbleHTML = `😆 "공이 사방으로 튀어! 재밌다!"`;
        }
      } else if (r === 'slide') {
        // 3. TWIN 2-LANE MEGA SLIDE (Sitting side-by-side & racing down!)
        const cycleDuration = 5.2;
        const cycle = t % cycleDuration;
        const laneX = slotInRide % 2 === 0 ? -16.6 : -14.3;

        if (cycle < 1.1) {
          // Sitting at top of Twin Slide getting ready ("3, 2, 1 출발!")
          targetX = laneX;
          targetY = 7.1;
          targetZ = -11.2;
          targetRotY = 0;
          targetPose.torsoLean = -0.15;
          targetPose.leftLegX = -1.35;
          targetPose.rightLegX = -1.35;
          targetPose.leftArmX = -2.4;
          targetPose.rightArmX = -2.4;
          if (av.isMe) bubbleHTML = `🎢 ${this.state.partnerName}와 나란히 출발 준비! (3, 2, 1~!)`;
          else if (av.isMyPartner) bubbleHTML = `🙌 "누가 더 빠른지 같이 내려가자!"`;
        } else {
          // Sliding down the chute!
          const slideP = Math.min(1, (cycle - 1.1) / 3.4);
          targetX = laneX;
          targetY = 7.1 * (1 - slideP) + 0.4 * slideP;
          targetZ = -11.2 + slideP * 14.2;
          targetRotY = 0;
          targetPose.torsoLean = -0.25;
          targetPose.leftLegX = -1.4;
          targetPose.rightLegX = -1.4;
          targetPose.leftArmX = -2.6;
          targetPose.rightArmX = -2.6;
          targetPose.bodyY = -0.25;

          const pct = Math.floor(slideP * 100);
          if (av.isMe) {
            bubbleHTML = `🎢 트윈 슬라이드 동시 활강! ${pct}% <span class="prog-bar"><span class="prog-fill" style="width:${pct}%"></span></span>`;
          } else if (av.isMyPartner) {
            bubbleHTML = `🚀 "와아아아!! 바람 가르는 소리 대박!!"`;
          }
        }
      } else if (r === 'skywalk') {
        // 4. DYNAMIC SKYWALK SUSPENDED BRIDGE (Crossing side-by-side!)
        const cycleDuration = 6.0;
        const cycle = t % cycleDuration;
        const prog = Math.min(1, cycle / 5.2);

        targetX = -9.5 + prog * 19.0;
        targetY = 7.2 + Math.abs(Math.sin(t * 7)) * 0.18;
        targetZ = -14 + (slotInRide % 2 === 0 ? -0.65 : 0.65);
        targetRotY = Math.PI / 2;

        // Balancing arms out & walking legs
        const step = Math.sin(t * 9) * 0.55;
        targetPose.torsoLean = 0.12;
        targetPose.leftArmX = -0.9 + step * 0.3;
        targetPose.rightArmX = -0.9 - step * 0.3;
        targetPose.leftLegX = step;
        targetPose.rightLegX = -step;

        const pct = Math.floor(prog * 100);
        if (av.isMe) {
          bubbleHTML = `🌉 공중 출렁다리 건너기 ${pct}% <span class="prog-bar"><span class="prog-fill" style="width:${pct}%"></span></span>`;
        } else if (av.isMyPartner) {
          bubbleHTML = `🤝 "내 손 꼭 잡아! 거의 다 건넜어!"`;
        }
      } else if (r === 'climbing') {
        // 5. DUAL LED CLIMBING WALL & GOLDEN BELL SUMMIT
        const cycleDuration = 6.5;
        const cycle = t % cycleDuration;
        const laneX = slotInRide % 2 === 0 ? -1.4 : 1.4;

        if (cycle < 5.0) {
          const climbP = cycle / 5.0;
          targetX = laneX;
          targetY = 0.5 + climbP * 14.0;
          targetZ = -20.2;
          targetRotY = Math.PI;

          // Hand-over-hand climbing motion!
          const reach = Math.sin(t * 10);
          targetPose.torsoLean = -0.15;
          targetPose.leftArmX = -2.4 + reach * 0.55;
          targetPose.rightArmX = -2.4 - reach * 0.55;
          targetPose.leftLegX = -reach * 0.45;
          targetPose.rightLegX = reach * 0.45;

          const pct = Math.floor(climbP * 100);
          if (av.isMe) {
            bubbleHTML = `🧗 듀얼 암벽 등반 중 ${pct}% <span class="prog-bar"><span class="prog-fill" style="width:${pct}%"></span></span>`;
          } else if (av.isMyPartner) {
            bubbleHTML = `🔥 "영차영차! 정상 황금범종이 눈앞이야!"`;
          }
        } else {
          // At the Summit Pavilion celebrating & ringing the Golden Bell!
          targetX = laneX * 0.9;
          targetY = 14.8 + Math.abs(Math.sin(t * 8)) * 0.45;
          targetZ = -20.5;
          targetRotY = 0;
          targetPose.leftArmX = -2.7;
          targetPose.rightArmX = -2.7;

          if (av.isMe) bubbleHTML = `🔔 산사(山寺) 정상 황금범종 타종 성공!! (+250P)`;
          else if (av.isMyPartner) bubbleHTML = `🎉 "야호!! 우리가 정상 정복했다!!"`;
        }
      } else if (r === 'zipline') {
        // 6. TWIN FLYING ZIPLINE & BULLSEYE DROP
        const cycleDuration = 6.2;
        const cycle = t % cycleDuration;
        const isLaneA = slotInRide % 2 === 0;
        const startV = isLaneA ? this.world.zipStartA : this.world.zipStartB;
        const endV = isLaneA ? this.world.zipEndA : this.world.zipEndB;

        if (cycle < 4.4) {
          const zipP = cycle / 4.4;
          const curV = new THREE.Vector3().lerpVectors(startV, endV, zipP);
          targetX = curV.x;
          targetY = curV.y - 1.85;
          targetZ = curV.z;
          targetRotY = 0;

          // Update 3D Trolley position!
          if (isLaneA && this.world.ziplineTrolleyA) {
            this.world.ziplineTrolleyA.position.copy(curV);
          } else if (!isLaneA && this.world.ziplineTrolleyB) {
            this.world.ziplineTrolleyB.position.copy(curV);
          }

          // Both arms raised holding the zipline handle bar!
          targetPose.leftArmX = -2.85;
          targetPose.rightArmX = -2.85;
          targetPose.leftLegX = 0.35 + Math.sin(t * 6) * 0.15;
          targetPose.rightLegX = 0.35 - Math.sin(t * 6) * 0.15;

          const pct = Math.floor(zipP * 100);
          if (av.isMe) {
            bubbleHTML = `🦅 트윈 짚라인 동시 활강! ${pct}% <span class="prog-bar"><span class="prog-fill" style="width:${pct}%"></span></span>`;
          } else if (av.isMyPartner) {
            bubbleHTML = `🦅 "하늘을 나는 기분이야!! 과녁 준비~!"`;
          }
        } else {
          // Dynamic Drop onto the Bullseye Airbag Target!
          const dropP = Math.min(1, (cycle - 4.4) / 0.8);
          targetX = isLaneA ? -1.1 : 1.1;
          targetY = 7.0 * (1 - dropP) + 0.45 * dropP + (dropP >= 1 ? Math.abs(Math.sin(t * 10)) * 0.6 : 0);
          targetZ = 3.0;
          targetRotY = 0;
          targetPose.leftArmX = -2.5;
          targetPose.rightArmX = -2.5;

          if (av.isMe) bubbleHTML = `🎯 다이내믹 드롭 과녁 정중앙 착지!! (+400P)`;
          else if (av.isMyPartner) bubbleHTML = `👑 "골든 불스아이 동시 착지 대성공!!"`;
        }
      } else if (r === 'bonfire') {
        // 7. SANSA BONFIRE HEALING ZONE (Sitting & warming hands like 불멍!)
        const seatAng = (slotInRide / 4) * Math.PI * 2 + Math.PI / 4;
        targetX = Math.cos(seatAng) * 3.4;
        targetY = 0.25;
        targetZ = 14 + Math.sin(seatAng) * 3.4;
        targetRotY = -seatAng - Math.PI / 2;

        const rub = Math.sin(t * 5) * 0.12;
        targetPose.torsoLean = 0.22;
        targetPose.leftArmX = -1.1 + rub;
        targetPose.rightArmX = -1.1 - rub;
        targetPose.leftLegX = -1.25;
        targetPose.rightLegX = -1.25;
        targetPose.bodyY = -0.22;

        if (av.isMe) bubbleHTML = `🔥 따뜻한 산사 모닥불에 손 녹이며 힐링 중 🤲`;
        else if (av.isMyPartner) bubbleHTML = `☺️ "불멍하니까 마음이 편해진다~"`;
      } else if (r === 'highfive') {
        // 8. HIGH-FIVE TOGETHER!
        targetX = sideOffset * 0.65;
        targetY = Math.abs(Math.sin(t * 8)) * 0.55;
        targetZ = 9.5;
        targetRotY = slotInRide % 2 === 0 ? 0.6 : -0.6;
        targetPose.leftArmX = -2.5;
        targetPose.rightArmX = -2.5;

        if (av.isMe) bubbleHTML = `🙌 "${this.state.partnerName}야 최고야! 하이파이브!!"`;
        else if (av.isMyPartner) bubbleHTML = `🙌 "우리 환상의 콤비네!! 짝짝!"`;
      }

      // Award automatic cycle completion points for Me!
      if (av.isMe && r !== 'highfive') {
        const cycleLenMap = {
          trampoline: 4.5,
          ballpit: 5.0,
          slide: 5.2,
          skywalk: 6.0,
          climbing: 6.5,
          zipline: 6.2,
          bonfire: 5.5
        };
        const cLen = cycleLenMap[r] || 5.0;
        const completedCycles = Math.floor(rideElapsed / cLen);
        if (completedCycles > this.state.rideCycleCount) {
          this.state.rideCycleCount = completedCycles;
          const zone = this.world.rideZones[r];
          if (zone) {
            if (r === 'climbing') {
              window.soundEngine.playTempleBell();
            } else {
              window.soundEngine.playTagSuccess(zone.diff, Math.floor(this.state.combo));
            }
            this.awardPoints(zone.basePts, `${zone.name} X-태그 성공`, zone.diff);
          }
        }
      }

      // Smoothly interpolate position & rotation (Silky 60fps movement!)
      av.targetPos.set(targetX, targetY, targetZ);
      av.currentPos.lerp(av.targetPos, 0.16);
      av.mesh.position.copy(av.currentPos);

      // Smooth angle lerp
      let diffRot = targetRotY - av.rotY;
      while (diffRot > Math.PI) diffRot -= Math.PI * 2;
      while (diffRot < -Math.PI) diffRot += Math.PI * 2;
      av.rotY += diffRot * 0.16;
      av.mesh.rotation.y = av.rotY;

      // Blend articulated limbs smoothly
      this.world.blendAvatarPose(av.mesh, targetPose, 0.18);

      allPositions.push(av.currentPos);

      // Project 3D Label & Action Bubble to Screen
      this.projectAvatarOverlay(av, bubbleHTML);
    }

    return allPositions;
  }

  projectAvatarOverlay(av, bubbleHTML) {
    const el = av.labelEl;
    if (!el) return;

    if (this.state.zenMode) {
      el.style.opacity = '0';
      return;
    }

    const topPos = av.mesh.position.clone();
    topPos.y += 2.65;
    topPos.project(this.world.camera);

    if (topPos.z > 1) {
      el.style.opacity = '0';
      return;
    }

    const x = (topPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(topPos.y * 0.5) + 0.5) * window.innerHeight;

    el.style.opacity = '1';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const actionHtml = bubbleHTML ? `<div class="char-action-bubble">${bubbleHTML}</div>` : '';
    el.innerHTML = `
      ${actionHtml}
      <div class="avatar-name-tag ${av.isMe ? 'me-tag' : ''}">
        <span>${av.isMe ? '⭐ ' : ''}${av.name}</span>
        <span class="avatar-score-badge">${(av.score || 0).toLocaleString()}P</span>
      </div>
    `;
  }

  // Smooth Camera Update (4 POV Modes + Orbit & Zoom)
  updateCamera() {
    const myAv = this.avatars.get(this.metaverse.clientId);
    const myPos = myAv ? myAv.currentPos : new THREE.Vector3(0, 0, 10);
    const zone = this.world.rideZones[this.state.currentRide] || this.world.rideZones.trampoline;

    let desiredLook = new THREE.Vector3(myPos.x, myPos.y + 1.4, myPos.z);
    let baseDist = 9.5 + this.camControl.zoomOffset;
    let baseYaw = this.camControl.orbitOffset;
    let basePitch = 0.34 + this.camControl.pitchOffset;

    if (this.state.povMode === 'closeup') {
      // Frames both You and your Co-Op Partner clearly on the active ride!
      desiredLook.set(myPos.x * 0.65 + zone.center.x * 0.35, myPos.y + 1.4, myPos.z);
      baseDist = 8.8 + this.camControl.zoomOffset;
      basePitch = 0.28 + this.camControl.pitchOffset;
    } else if (this.state.povMode === 'front') {
      // Close-up front view of your character
      desiredLook.set(myPos.x, myPos.y + 1.35, myPos.z);
      baseDist = 5.4 + this.camControl.zoomOffset;
      baseYaw = myAv ? myAv.rotY + this.camControl.orbitOffset : 0;
      basePitch = 0.18 + this.camControl.pitchOffset;
    } else if (this.state.povMode === 'summit') {
      // Views Giant Live Wall Scoreboard & Golden Bell Summit
      desiredLook.set(0, 11.5, -21);
      baseDist = 22 + this.camControl.zoomOffset;
      basePitch = 0.2 + this.camControl.pitchOffset;
    } else if (this.state.povMode === 'wide') {
      // Wide overview of the entire 3D Kids Cafe
      desiredLook.set(0, 3.5, -2);
      baseDist = 32 + this.camControl.zoomOffset;
      basePitch = 0.48 + this.camControl.pitchOffset;
    }

    baseDist = Math.max(3.8, Math.min(44, baseDist));
    basePitch = Math.max(0.08, Math.min(1.2, basePitch));

    const desiredPos = new THREE.Vector3(
      desiredLook.x + Math.sin(baseYaw) * Math.cos(basePitch) * baseDist,
      desiredLook.y + Math.sin(basePitch) * baseDist,
      desiredLook.z + Math.cos(baseYaw) * Math.cos(basePitch) * baseDist
    );

    this.camControl.currentPos.lerp(desiredPos, 0.09);
    this.camControl.currentLook.lerp(desiredLook, 0.11);

    this.world.camera.position.copy(this.camControl.currentPos);
    this.world.camera.lookAt(this.camControl.currentLook);
  }

  bindPointerAndZoom() {
    const dom = this.world.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.camControl.isDragging = true;
      this.camControl.dragMoved = false;
      this.camControl.lastX = e.clientX;
      this.camControl.lastY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.camControl.isDragging) return;
      const dx = e.clientX - this.camControl.lastX;
      const dy = e.clientY - this.camControl.lastY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.camControl.dragMoved = true;

      this.camControl.orbitOffset -= dx * 0.006;
      this.camControl.pitchOffset = Math.max(
        -0.25,
        Math.min(0.75, this.camControl.pitchOffset + dy * 0.004)
      );
      this.camControl.lastX = e.clientX;
      this.camControl.lastY = e.clientY;
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.camControl.isDragging) return;
      this.camControl.isDragging = false;
      if (this.camControl.dragMoved) return;

      // Raycast Click in 3D Scene: Click any 3D Ride or Friend to play together!
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.world.camera);

      const rideHits = this.raycaster.intersectObjects(this.world.rideHitMeshes, false);
      if (rideHits.length > 0) {
        const rk = rideHits[0].object.userData.rideKey;
        if (rk) {
          this.selectRide(rk);
          return;
        }
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        this.camControl.zoomOffset = Math.max(
          -4.0,
          Math.min(14.0, this.camControl.zoomOffset + e.deltaY * 0.006)
        );
      },
      { passive: true }
    );

    // Mobile 2-finger pinch zoom
    dom.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          this.camControl.isDragging = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.camControl.pinchStartDist = Math.hypot(dx, dy);
          this.camControl.pinchStartZoom = this.camControl.zoomOffset;
        }
      },
      { passive: true }
    );

    dom.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && this.camControl.pinchStartDist > 0) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const delta = (this.camControl.pinchStartDist - dist) * 0.025;
          this.camControl.zoomOffset = Math.max(
            -4.0,
            Math.min(14.0, this.camControl.pinchStartZoom + delta)
          );
        }
      },
      { passive: true }
    );
  }

  bindUIEvents() {
    // Entry Overlay
    const previewEl = document.getElementById('previewNickname');
    if (previewEl) previewEl.textContent = this.state.name;

    document.getElementById('rerollNameBtn').addEventListener('click', () => {
      this.state.name = generateRandomNickname();
      localStorage.setItem('arcadex_name', this.state.name);
      if (previewEl) previewEl.textContent = this.state.name;
      this.rebuildAvatars();
    });

    document.getElementById('enterParkBtn').addEventListener('click', () => {
      window.soundEngine.init();
      window.soundEngine.playTagSuccess(3, 2);
      document.getElementById('entryOverlay').classList.add('hidden');
      document.getElementById('topBar').classList.remove('hidden');
      document.getElementById('bottomDock').classList.remove('hidden');
      this.metaverse.connectStream({
        name: this.state.name,
        score: this.state.score,
        hat: this.state.hat,
        ride: this.state.currentRide
      });
      this.showToast(`🎉 환영합니다, ${this.state.name}님! 하단 버튼을 눌러 친구들과 놀이기구를 타보세요!`);
    });

    // Bottom Dock 1-Click Ride Buttons
    document.querySelectorAll('#dockActionsContainer .action-btn[data-ride]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectRide(btn.dataset.ride);
      });
    });

    // Toggle Together Mode (같이 타기 ON/OFF)
    document.getElementById('toggleTogetherChip').addEventListener('click', () => {
      this.state.togetherMode = !this.state.togetherMode;
      document.getElementById('togetherModeLabel').textContent = this.state.togetherMode
        ? 'ON (2배 보너스!)'
        : '혼자 타기';
      this.rebuildAvatars();
      this.showToast(
        this.state.togetherMode
          ? `🤝 친구와 같이 타기 ON! ${this.state.partnerName}와 나란히 놀이기구를 탑니다!`
          : `🏃 혼자 타기 모드로 전환되었습니다.`
      );
    });

    // Theme Tabs
    document.querySelectorAll('.theme-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const t = tab.dataset.theme;
        this.applyTheme(t, true);
        this.metaverse.sendAction({ type: 'changeTheme', theme: t });
      });
    });

    // Camera POV Switcher
    const povLabel = document.getElementById('povLabel');
    document.getElementById('cameraPovBtn').addEventListener('click', () => {
      this.camControl.orbitOffset = 0;
      this.camControl.pitchOffset = 0;
      this.camControl.zoomOffset = 0;

      if (this.state.povMode === 'closeup') {
        this.state.povMode = 'front';
        povLabel.textContent = '내 캐릭터 정면';
        this.showToast('📷 내 캐릭터 정면 보기: 내 표정과 왕관·날개·태그팔찌를 가까이서 봅니다!');
      } else if (this.state.povMode === 'front') {
        this.state.povMode = 'summit';
        povLabel.textContent = '전광판 & 범종탑';
        this.showToast('📷 실시간 3D 대형 전광판과 산사 황금범종 정상을 봅니다!');
      } else if (this.state.povMode === 'summit') {
        this.state.povMode = 'wide';
        povLabel.textContent = '키즈카페 전체';
        this.showToast('📷 키즈카페 전체 보기: 모든 놀이기구와 친구들을 한눈에 봅니다!');
      } else {
        this.state.povMode = 'closeup';
        povLabel.textContent = '같이 타기 클로즈업';
        this.showToast('📷 같이 타기 클로즈업: 친구와 함께 놀이기구 타는 모습을 생생하게 봅니다!');
      }
    });

    // Server & Player Count Modal Open/Close
    const toggleRoomModal = () => {
      document.getElementById('roomModal').classList.toggle('hidden');
      this.updateHUD();
    };
    document.getElementById('roomSelectBtn').addEventListener('click', toggleRoomModal);
    document.getElementById('presencePillBtn').addEventListener('click', toggleRoomModal);

    document.querySelectorAll('.close-panel-btn[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById(btn.dataset.close).classList.add('hidden');
      });
    });

    // Instance Channel Buttons (#0, #1, #2, #3)
    document.querySelectorAll('#instanceGroup .instance-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#instanceGroup .instance-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const inst = Number(btn.dataset.instance);
        document.getElementById('currentInstanceTag').textContent = `#${inst}번 서버`;
        this.metaverse.switchInstance(inst, {
          name: this.state.name,
          score: this.state.score,
          hat: this.state.hat,
          ride: this.state.currentRide
        });
        this.showToast(`🌐 #${inst}번 서버 채널로 이동했습니다!`);
      });
    });

    // Companion Toggle Checkbox
    document.getElementById('soloCompanionToggle').addEventListener('change', (e) => {
      this.metaverse.enableCompanions = e.target.checked;
      this.rebuildAvatars();
    });

    // Copy Room Link Button
    document.getElementById('copyRoomLinkBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      this.showToast('🔗 현재 서버 주소가 복사되었습니다! 친구에게 보내 같은 방에서 만나세요!');
    });

    // Sound Toggle
    document.getElementById('soundToggleBtn').addEventListener('click', () => {
      const muted = window.soundEngine.toggleMute();
      document.getElementById('soundToggleBtn').textContent = muted ? '🔇' : '🔊';
      this.showToast(muted ? '🔇 소리가 꺼졌습니다.' : '🔊 소리가 켜졌습니다.');
    });

    // Zen Mode Toggle
    document.getElementById('zenModeBtn').addEventListener('click', () => {
      this.state.zenMode = true;
      document.getElementById('topBar').classList.add('hidden');
      document.getElementById('bottomDock').classList.add('hidden');
      document.getElementById('roomModal').classList.add('hidden');
      document.getElementById('exitZenBtn').classList.remove('hidden');
    });

    document.getElementById('exitZenBtn').addEventListener('click', () => {
      this.state.zenMode = false;
      document.getElementById('topBar').classList.remove('hidden');
      document.getElementById('bottomDock').classList.remove('hidden');
      document.getElementById('exitZenBtn').classList.add('hidden');
    });

    // Reward Kiosk Shop Modal
    const openShop = () => {
      this.renderShopModal();
      document.getElementById('shop-modal').classList.add('open');
    };
    document.getElementById('btn-shop').addEventListener('click', openShop);
    document.getElementById('openShopChip').addEventListener('click', openShop);
    document.getElementById('close-shop-btn').addEventListener('click', () => {
      document.getElementById('shop-modal').classList.remove('open');
    });
  }

  applyTheme(mode, notify = true) {
    this.world.setTheme(mode);
    document.querySelectorAll('.theme-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.theme === mode);
    });
    if (notify) {
      const names = {
        arcade: '🎪 아케이드엑스 오산동탄 실사 테마',
        sansa: '🏯 산사(山寺) 솔숲 & 연등 힐링 테마',
        night: '⚡ 사이버 메타버스 나이트 테마'
      };
      this.showToast(`${names[mode] || mode}로 변경되었습니다!`);
    }
  }

  updateHUD() {
    // Score & Level
    document.getElementById('hud-score').textContent = `${this.state.score.toLocaleString()}점`;
    document.getElementById('hud-combo').textContent = `x${this.state.combo.toFixed(1)}배`;

    const lv = Math.floor(this.state.score / 400) + 1;
    const titles = ['키즈 탐험가', '점프 루키', '슬라이드 스타', '스카이워커', '산사 범종 마스터', '아케이드 전설'];
    document.getElementById('hud-level').textContent = `Lv.${lv} ${titles[Math.min(titles.length - 1, lv - 1)]}`;

    // Real-time Server & Player Count Status
    const realRoomCount = Math.max(1, this.metaverse.realUsers.length);
    const totalPlaymates = this.avatars.size;
    const totalAllServers = Math.max(realRoomCount, this.metaverse.totalRealOnline);

    document.getElementById('onlineCount').textContent = String(realRoomCount);
    document.getElementById('totalPlaymatesCount').textContent = String(totalPlaymates);

    // Update Server Modal Instance Counts (#0, #1, #2, #3)
    for (let i = 0; i < 4; i++) {
      const popEl = document.getElementById(`instPop${i}`);
      if (popEl) {
        const c =
          i === this.metaverse.instance
            ? Math.max(1, this.metaverse.instanceCounts[i] || realRoomCount)
            : this.metaverse.instanceCounts[i] || 0;
        popEl.textContent = `실시간 접속 ${c}명`;
      }
    }

    const healthTitle = document.getElementById('serverHealthTitle');
    const healthSub = document.getElementById('serverHealthSub');
    if (healthTitle && healthSub) {
      healthTitle.textContent = this.metaverse.serverLive
        ? '🟢 실시간 멀티서버 정상 가동 중 (LIVE)'
        : '🟢 로컬 멀티플레이 모드 가동 중';
      healthSub.textContent = `현재 방 접속자: ${realRoomCount}명 · 전체 서버 총 접속: ${totalAllServers}명 (단짝 친구 포함 ${totalPlaymates}명 놀이 중)`;
    }

    // Populate Active Room Users List inside Server Modal
    const usersListEl = document.getElementById('roomUsersList');
    if (usersListEl) {
      usersListEl.innerHTML = '';
      for (const av of this.avatars.values()) {
        const pill = document.createElement('span');
        pill.className = `user-pill-tag ${av.isMe ? 'is-me' : ''}`;
        const tag = av.isMe ? ' (나)' : av.isReal ? ' (실시간 접속)' : ' (키즈 친구)';
        pill.textContent = `${av.name}${tag} · ${av.score}P`;
        usersListEl.appendChild(pill);
      }
    }

    // Update 3D Giant Wall Scoreboard
    const rankings = Array.from(this.avatars.values())
      .map((a) => ({ name: a.isMe ? `${a.name} (나)` : a.name, score: a.score, isMe: a.isMe }))
      .sort((a, b) => b.score - a.score);

    this.world.updateWallScoreboard(
      rankings,
      `#${this.metaverse.instance}번 서버`,
      realRoomCount,
      totalPlaymates
    );
  }

  renderShopModal() {
    const items = [
      { id: 'cap', icon: '🧢', title: '아케이드 스포츠캡', desc: '기본 스포티 모자', cost: 0 },
      { id: 'satgat', icon: '👒', title: '산사(山寺) 힐링 삿갓', desc: '산사 컨셉 전통 삿갓', cost: 150 },
      { id: 'crown', icon: '👑', title: '황금 챔피언 왕관', desc: '오산동탄 1등 황금 왕관', cost: 300 },
      { id: 'wings', icon: '🦋', title: '사이버 네온 날개', desc: '고난도 정복자 빛의 날개', cost: 500 }
    ];

    document.getElementById('shop-my-points').textContent = `${this.state.score.toLocaleString()} P`;
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = '';

    items.forEach((it) => {
      const unlocked = this.state.unlockedHats.includes(it.id);
      const equipped = this.state.hat === it.id;

      const card = document.createElement('div');
      card.className = `shop-item ${equipped ? 'equipped' : ''}`;
      const btnLabel = equipped ? '착용중 ✓' : unlocked ? '착용하기' : `${it.cost}P 교환`;

      card.innerHTML = `
        <div class="shop-item-icon">${it.icon}</div>
        <div class="shop-item-title">${it.title}</div>
        <div class="shop-item-desc">${it.desc}</div>
        <button class="shop-buy-btn">${btnLabel}</button>
      `;

      card.querySelector('button').addEventListener('click', () => {
        if (unlocked) {
          this.state.hat = it.id;
          localStorage.setItem('arcadex_hat', it.id);
          this.rebuildAvatars();
          this.renderShopModal();
          this.showToast(`✨ [${it.title}] 아이템을 착용했습니다!`);
        } else if (this.state.score >= it.cost) {
          this.state.score -= it.cost;
          this.state.unlockedHats.push(it.id);
          this.state.hat = it.id;
          localStorage.setItem('arcadex_score', String(this.state.score));
          localStorage.setItem('arcadex_unlocked', JSON.stringify(this.state.unlockedHats));
          localStorage.setItem('arcadex_hat', it.id);
          window.soundEngine.playTagSuccess(4, 3);
          this.rebuildAvatars();
          this.renderShopModal();
          this.showToast(`🎉 [${it.title}] 교환 및 착용 완료!`);
        } else {
          this.showToast(`점수가 부족합니다! (필요: ${it.cost}P) 친구와 놀이기구를 타서 점수를 모아보세요!`);
        }
      });

      grid.appendChild(card);
    });
  }

  showToast(msg) {
    const banner = document.getElementById('toast-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => banner.classList.remove('show'), 2900);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const elapsed = now / 1000;

    const positions = this.updateAvatarsAndRides(dt, now, elapsed);
    this.world.updateWorldElements(dt, elapsed, positions);
    this.updateCamera();

    this.world.renderer.render(this.world.scene, this.world.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new KidsCafeApp();
});
