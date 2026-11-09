// Ultra-Smooth Point-and-Click Movement + 1-Click Co-Op Ride Engine + Real-Time Metaverse Sync
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
      // mode: 'WALKING' (running to clicked spot/ride) | 'STANDING' (standing at clicked spot) | 'RIDING' (playing on a ride)
      mode: 'RIDING',
      currentRide: 'trampoline',
      walkTarget: new THREE.Vector3(-16, 0, 7),
      pendingRideAfterWalk: null,
      rideStartTime: performance.now(),
      rideCycleCount: 0,
      togetherMode: true,
      partnerName: '단짝 민준',
      povMode: 'closeup', // 'closeup' | 'front' | 'summit' | 'wide'
      zenMode: false,
      manualJumpVel: 0,
      manualJumpY: 0
    };

    this.keys = {};
    this.avatars = new Map();

    // Smooth Camera Controller
    this.camControl = {
      currentPos: new THREE.Vector3(0, 12, 24),
      currentLook: new THREE.Vector3(0, 1.5, 5),
      orbitOffset: 0,
      pitchOffset: 0,
      zoomOffset: 0,
      isDragging: false,
      dragDist: 0,
      downX: 0,
      downY: 0,
      lastX: 0,
      lastY: 0,
      pinchStartDist: 0,
      pinchStartZoom: 0
    };

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.metaverse = new MetaverseManager(this.world, (ev) => this.handleMetaverseEvent(ev));

    this.rebuildAvatars();
    this.bindUIEvents();
    this.bindPointerAndKeyboard();
    this.updateHUD();

    this.lastTime = performance.now();
    this.animate();
  }

  rebuildAvatars() {
    const activeList = [];

    // 1. Me
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

    // 2. Real Server Users
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

    // 3. Friendly Kid Playmates
    if (this.metaverse.enableCompanions) {
      this.metaverse.companionSpecs.forEach((comp, idx) => {
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

    const otherReal = activeList.find((a) => !a.isMe && a.isReal);
    if (otherReal) {
      this.state.partnerName = otherReal.name;
      otherReal.isMyPartner = this.state.togetherMode;
    } else if (!this.state.partnerName) {
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

        const startZone = this.world.rideZones[spec.ride] || this.world.rideZones.trampoline;
        av = {
          id: spec.id,
          mesh,
          labelEl,
          currentPos: startZone.center.clone(),
          targetPos: startZone.center.clone(),
          rotY: 0,
          phaseOffset: idx * 1.1
        };
        mesh.position.copy(av.currentPos);
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
          if (z) this.showToast(`🎢 ${eff.actorName}님이 [${z.name}] 놀이를 시작했습니다!`);
        } else if (eff.effect === 'highfive') {
          window.soundEngine.playTagSuccess(3, 2);
          this.showToast(`🙌 ${eff.actorName}님이 반갑게 하이파이브를 보냅니다!`);
        } else if (eff.effect === 'changeTheme' && eff.theme) {
          this.applyTheme(eff.theme, false);
        }
      }
    }
  }

  // Walk to an arbitrary 3D floor point (when user clicks anywhere on the screen!)
  walkToPoint(point3D, pendingRideKey = null) {
    window.soundEngine.init();
    window.soundEngine.playJump(false);

    // Clamp inside park bounds
    const tx = Math.max(-32, Math.min(32, point3D.x));
    const tz = Math.max(-26, Math.min(26, point3D.z));

    this.state.mode = 'WALKING';
    this.state.walkTarget.set(tx, 0, tz);
    this.state.pendingRideAfterWalk = pendingRideKey;

    // Show glowing 3D Click Marker Ring at clicked spot!
    this.world.showClickMarker(
      new THREE.Vector3(tx, 0.05, tz),
      pendingRideKey ? 0xfbbf24 : 0x00f5d4
    );

    if (pendingRideKey) {
      const zone = this.world.rideZones[pendingRideKey];
      if (zone) {
        document.querySelectorAll('#dockActionsContainer .action-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.ride === pendingRideKey);
        });
        this.showToast(
          this.state.togetherMode
            ? `🏃 ${this.state.partnerName}와 함께 [${zone.name}](으)로 달려갑니다!`
            : `🏃 [${zone.name}](으)로 달려갑니다!`
        );
      }
    } else {
      // Check if clicked point is naturally near a ride zone
      const nearRide = this.findNearestRideZone(tx, tz, 6.2);
      if (nearRide) {
        this.state.pendingRideAfterWalk = nearRide;
        const zone = this.world.rideZones[nearRide];
        document.querySelectorAll('#dockActionsContainer .action-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.ride === nearRide);
        });
        this.showToast(`🏃 클릭한 [${zone.name}](으)로 달려가서 바로 탑승합니다!`);
      } else {
        document.querySelectorAll('#dockActionsContainer .action-btn').forEach((btn) => {
          btn.classList.remove('active');
        });
      }
    }
  }

  findNearestRideZone(x, z, maxRadius = 6.5) {
    let bestKey = null;
    let bestDist = maxRadius;
    for (const [key, zone] of Object.entries(this.world.rideZones)) {
      const d = Math.hypot(x - zone.center.x, z - zone.center.z);
      if (d < bestDist) {
        bestDist = d;
        bestKey = key;
      }
    }
    return bestKey;
  }

  // Triggered when clicking a Ride Button or arriving at a Ride
  selectRide(rideKey, walkThereFirst = true) {
    window.soundEngine.init();

    if (rideKey === 'highfive') {
      this.state.mode = 'RIDING';
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

    const myAv = this.avatars.get(this.metaverse.clientId);
    const distToZone = myAv
      ? Math.hypot(myAv.currentPos.x - zone.center.x, myAv.currentPos.z - zone.center.z)
      : 0;

    // Walk smoothly across the floor to the ride first if we're more than 3.5m away!
    if (walkThereFirst && distToZone > 3.5) {
      this.walkToPoint(zone.center, rideKey);
      return;
    }

    this.startRideImmediately(rideKey);
  }

  startRideImmediately(rideKey) {
    const zone = this.world.rideZones[rideKey];
    if (!zone) return;

    this.state.mode = 'RIDING';
    this.state.currentRide = rideKey;
    this.state.pendingRideAfterWalk = null;
    this.state.rideStartTime = performance.now();
    this.state.rideCycleCount = 0;

    document.querySelectorAll('#dockActionsContainer .action-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.ride === rideKey);
    });

    if (rideKey === 'slide' || rideKey === 'zipline') {
      window.soundEngine.playSlideWhoosh();
    } else {
      window.soundEngine.playJump(true);
    }

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

  updateAvatarsAndRides(dt, now, elapsed) {
    const rideElapsed = (now - this.state.rideStartTime) / 1000;
    const myAv = this.avatars.get(this.metaverse.clientId);

    // Check Keyboard Input (WASD / Arrow Keys) for direct manual movement anytime!
    let keyX = 0;
    let keyZ = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) keyZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) keyZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) keyX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) keyX += 1;

    if ((keyX !== 0 || keyZ !== 0) && myAv) {
      const len = Math.hypot(keyX, keyZ);
      const nx = keyX / len;
      const nz = keyZ / len;
      const cos = Math.cos(this.camControl.orbitOffset);
      const sin = Math.sin(this.camControl.orbitOffset);
      const wx = nx * cos + nz * sin;
      const wz = -nx * sin + nz * cos;

      this.state.mode = 'WALKING';
      this.state.pendingRideAfterWalk = null;
      this.state.walkTarget.set(
        Math.max(-32, Math.min(32, myAv.currentPos.x + wx * 3.5)),
        0,
        Math.max(-26, Math.min(26, myAv.currentPos.z + wz * 3.5))
      );
    }

    // Manual Jump Physics
    if (this.state.manualJumpY > 0 || this.state.manualJumpVel !== 0) {
      this.state.manualJumpVel -= 22 * dt;
      this.state.manualJumpY += this.state.manualJumpVel * dt;
      if (this.state.manualJumpY <= 0) {
        this.state.manualJumpY = 0;
        this.state.manualJumpVel = 0;
      }
    }

    // Group riding avatars by ride
    const rideGroups = {};
    for (const av of this.avatars.values()) {
      const r = av.ride || 'trampoline';
      if (!rideGroups[r]) rideGroups[r] = [];
      rideGroups[r].push(av);
    }

    const allPositions = [];

    for (const av of this.avatars.values()) {
      let targetX = av.currentPos.x;
      let targetY = av.currentPos.y;
      let targetZ = av.currentPos.z;
      let targetRotY = av.rotY;
      let targetPose = {
        torsoLean: 0,
        leftArmX: 0,
        rightArmX: 0,
        leftLegX: 0,
        rightLegX: 0,
        bodyY: 0
      };
      let bubbleHTML = '';

      // CASE A: Me or My Co-Op Partner is WALKING/RUNNING to the clicked point!
      if ((av.isMe || av.isMyPartner) && (this.state.mode === 'WALKING' || this.state.mode === 'STANDING')) {
        const partnerOffset = av.isMyPartner ? 1.6 : 0;
        const destX = this.state.walkTarget.x + partnerOffset;
        const destZ = this.state.walkTarget.z;
        const dx = destX - av.currentPos.x;
        const dz = destZ - av.currentPos.z;
        const dist = Math.hypot(dx, dz);

        if (this.state.mode === 'WALKING' && dist > 0.35) {
          const runSpeed = 12.5; // Brisk, responsive running speed!
          const stepDist = Math.min(dist, runSpeed * dt);
          av.currentPos.x += (dx / dist) * stepDist;
          av.currentPos.z += (dz / dist) * stepDist;
          av.currentPos.y = Math.abs(Math.sin(elapsed * 16)) * 0.28 + (av.isMe ? this.state.manualJumpY : 0);
          targetRotY = Math.atan2(dx, dz);

          // Energetic running arm & leg swing!
          const swing = Math.sin(elapsed * 16 + (av.isMyPartner ? 1.5 : 0)) * 0.85;
          targetPose.torsoLean = 0.22;
          targetPose.leftArmX = -0.3 + swing;
          targetPose.rightArmX = -0.3 - swing;
          targetPose.leftLegX = -swing;
          targetPose.rightLegX = swing;

          if (av.isMe) {
            if (this.state.pendingRideAfterWalk) {
              const zName = this.world.rideZones[this.state.pendingRideAfterWalk]?.name || '놀이기구';
              bubbleHTML = `🏃 [${zName}] 타러 달려가는 중!`;
            } else {
              bubbleHTML = `🏃 클릭한 곳으로 달려가는 중!`;
            }
          } else if (av.isMyPartner) {
            bubbleHTML = `🏃 "같이 가자~!"`;
          }
        } else {
          // Arrived at clicked point!
          av.currentPos.x = destX;
          av.currentPos.z = destZ;
          av.currentPos.y = av.isMe ? this.state.manualJumpY : 0;

          if (av.isMe && this.state.mode === 'WALKING') {
            if (this.state.pendingRideAfterWalk) {
              // Automatically start the ride we ran to!
              this.startRideImmediately(this.state.pendingRideAfterWalk);
              return allPositions;
            } else {
              this.state.mode = 'STANDING';
              // Check if we arrived near any X-Tag box!
              this.world.tagBoxes.forEach((box) => {
                const dBox = Math.hypot(av.currentPos.x - box.position.x, av.currentPos.z - box.position.z);
                if (dBox < 3.8) {
                  window.soundEngine.playTagSuccess(2, 2);
                  this.awardPoints(50, '⌚ 스마트 팔찌 [X-박스] 터치!', 2);
                }
              });
            }
          }

          // Happy idle breathing & waving at the clicked location
          const wave = Math.sin(elapsed * 5) * 0.25;
          targetPose.leftArmX = -0.2;
          targetPose.rightArmX = -2.2 + wave;
          if (av.isMe) {
            bubbleHTML = `✨ 도착 완료! 바닥이나 놀이기구를 클릭해 이동하세요!`;
          } else if (av.isMyPartner) {
            bubbleHTML = `🙌 "다음엔 어떤 놀이기구 탈까?"`;
          }
        }

        av.mesh.position.copy(av.currentPos);
        let diffRot = targetRotY - av.rotY;
        while (diffRot > Math.PI) diffRot -= Math.PI * 2;
        while (diffRot < -Math.PI) diffRot += Math.PI * 2;
        av.rotY += diffRot * 0.22;
        av.mesh.rotation.y = av.rotY;
        this.world.blendAvatarPose(av.mesh, targetPose, 0.22);
        allPositions.push(av.currentPos);
        this.projectAvatarOverlay(av, bubbleHTML);
        continue;
      }

      // CASE B: RIDING on a 3D Ride (Co-Op Side-by-Side!)
      const r = av.ride || 'trampoline';
      const groupList = rideGroups[r] || [av];
      const slotInRide = groupList.indexOf(av);
      const sideOffset =
        groupList.length === 1
          ? 0
          : (slotInRide - (groupList.length - 1) / 2) * 2.1;

      const t = av.isMe || av.isMyPartner ? rideElapsed : elapsed + av.phaseOffset;

      if (r === 'trampoline') {
        const cycle = t % 4.5;
        const bounceWave = Math.abs(Math.sin(t * 3.6));
        const jumpHeight = bounceWave * 4.2;

        targetX = -16 + sideOffset;
        targetY = 0.72 + jumpHeight;
        targetZ = 7 + (slotInRide > 1 ? 2.5 : 0);
        targetRotY = 0;

        if (jumpHeight > 1.2) {
          targetPose.leftArmX = -2.5;
          targetPose.rightArmX = -2.5;
          targetPose.leftLegX = 0.45;
          targetPose.rightLegX = 0.45;
        } else {
          targetPose.torsoLean = 0.2;
          targetPose.leftArmX = -0.5;
          targetPose.rightArmX = -0.5;
        }

        const pct = Math.min(100, Math.floor((cycle / 4.2) * 100));
        if (av.isMe) {
          bubbleHTML = this.state.togetherMode
            ? `🤸 ${this.state.partnerName}와 트램펄린 점프! <span class="prog-bar"><span class="prog-fill" style="width:${pct}%"></span></span>`
            : `🤸 트램펄린 슈퍼점프! (${pct}%)`;
        } else if (av.isMyPartner) {
          bubbleHTML = `🙌 "우와! 진짜 높이 뛴다!!"`;
        }
      } else if (r === 'ballpit') {
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
          bubbleHTML = `🟣 컬러 볼풀 다이빙! <span class="prog-bar"><span class="prog-fill" style="width:${pct}%"></span></span>`;
        } else if (av.isMyPartner) {
          bubbleHTML = `😆 "공이 사방으로 튀어! 재밌다!"`;
        }
      } else if (r === 'slide') {
        const cycleDuration = 5.2;
        const cycle = t % cycleDuration;
        const laneX = slotInRide % 2 === 0 ? -16.6 : -14.3;

        if (cycle < 1.1) {
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
            bubbleHTML = `🚀 "와아아아!! 진짜 빠르다!!"`;
          }
        }
      } else if (r === 'skywalk') {
        const cycleDuration = 6.0;
        const cycle = t % cycleDuration;
        const prog = Math.min(1, cycle / 5.2);

        targetX = -9.5 + prog * 19.0;
        targetY = 7.2 + Math.abs(Math.sin(t * 7)) * 0.18;
        targetZ = -14 + (slotInRide % 2 === 0 ? -0.65 : 0.65);
        targetRotY = Math.PI / 2;

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
        const cycleDuration = 6.5;
        const cycle = t % cycleDuration;
        const laneX = slotInRide % 2 === 0 ? -1.4 : 1.4;

        if (cycle < 5.0) {
          const climbP = cycle / 5.0;
          targetX = laneX;
          targetY = 0.5 + climbP * 14.0;
          targetZ = -20.2;
          targetRotY = Math.PI;

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

          if (isLaneA && this.world.ziplineTrolleyA) {
            this.world.ziplineTrolleyA.position.copy(curV);
          } else if (!isLaneA && this.world.ziplineTrolleyB) {
            this.world.ziplineTrolleyB.position.copy(curV);
          }

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
        targetX = sideOffset * 0.65;
        targetY = Math.abs(Math.sin(t * 8)) * 0.55;
        targetZ = 9.5;
        targetRotY = slotInRide % 2 === 0 ? 0.6 : -0.6;
        targetPose.leftArmX = -2.5;
        targetPose.rightArmX = -2.5;

        if (av.isMe) bubbleHTML = `🙌 "${this.state.partnerName}야 최고야! 하이파이브!!"`;
        else if (av.isMyPartner) bubbleHTML = `🙌 "우리 환상의 콤비네!! 짝짝!"`;
      }

      // Automatic cycle points for Me while riding
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

      av.targetPos.set(targetX, targetY + (av.isMe ? this.state.manualJumpY : 0), targetZ);
      av.currentPos.lerp(av.targetPos, 0.16);
      av.mesh.position.copy(av.currentPos);

      let diffRot = targetRotY - av.rotY;
      while (diffRot > Math.PI) diffRot -= Math.PI * 2;
      while (diffRot < -Math.PI) diffRot += Math.PI * 2;
      av.rotY += diffRot * 0.16;
      av.mesh.rotation.y = av.rotY;

      this.world.blendAvatarPose(av.mesh, targetPose, 0.18);
      allPositions.push(av.currentPos);
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

  updateCamera() {
    const myAv = this.avatars.get(this.metaverse.clientId);
    const myPos = myAv ? myAv.currentPos : new THREE.Vector3(0, 0, 10);

    let desiredLook = new THREE.Vector3(myPos.x, myPos.y + 1.4, myPos.z);
    let baseDist = 11.0 + this.camControl.zoomOffset;
    let baseYaw = this.camControl.orbitOffset;
    let basePitch = 0.36 + this.camControl.pitchOffset;

    if (this.state.povMode === 'closeup') {
      desiredLook.set(myPos.x, myPos.y + 1.4, myPos.z);
      baseDist = 10.5 + this.camControl.zoomOffset;
      basePitch = 0.34 + this.camControl.pitchOffset;
    } else if (this.state.povMode === 'front') {
      desiredLook.set(myPos.x, myPos.y + 1.35, myPos.z);
      baseDist = 5.6 + this.camControl.zoomOffset;
      baseYaw = myAv ? myAv.rotY + this.camControl.orbitOffset : 0;
      basePitch = 0.18 + this.camControl.pitchOffset;
    } else if (this.state.povMode === 'summit') {
      desiredLook.set(0, 11.5, -21);
      baseDist = 22 + this.camControl.zoomOffset;
      basePitch = 0.2 + this.camControl.pitchOffset;
    } else if (this.state.povMode === 'wide') {
      desiredLook.set(0, 3.5, -2);
      baseDist = 32 + this.camControl.zoomOffset;
      basePitch = 0.48 + this.camControl.pitchOffset;
    }

    baseDist = Math.max(4.0, Math.min(44, baseDist));
    basePitch = Math.max(0.08, Math.min(1.2, basePitch));

    const desiredPos = new THREE.Vector3(
      desiredLook.x + Math.sin(baseYaw) * Math.cos(basePitch) * baseDist,
      desiredLook.y + Math.sin(basePitch) * baseDist,
      desiredLook.z + Math.cos(baseYaw) * Math.cos(basePitch) * baseDist
    );

    this.camControl.currentPos.lerp(desiredPos, 0.1);
    this.camControl.currentLook.lerp(desiredLook, 0.14);

    this.world.camera.position.copy(this.camControl.currentPos);
    this.world.camera.lookAt(this.camControl.currentLook);
  }

  bindPointerAndKeyboard() {
    const dom = this.world.renderer.domElement;

    // Keyboard Support (WASD / Arrow Keys / Space Jump)
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        window.soundEngine.init();
        window.soundEngine.playJump(true);
        if (this.state.manualJumpY <= 0.1) {
          this.state.manualJumpVel = 9.5;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Pointer Down / Move / Up (Click Anywhere to Move + Drag to Orbit Camera)
    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      this.camControl.isDragging = true;
      this.camControl.dragDist = 0;
      this.camControl.downX = e.clientX;
      this.camControl.downY = e.clientY;
      this.camControl.lastX = e.clientX;
      this.camControl.lastY = e.clientY;
      window.soundEngine.init();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.camControl.isDragging) return;
      const dx = e.clientX - this.camControl.lastX;
      const dy = e.clientY - this.camControl.lastY;
      this.camControl.dragDist = Math.hypot(
        e.clientX - this.camControl.downX,
        e.clientY - this.camControl.downY
      );

      if (this.camControl.dragDist > 8) {
        this.camControl.orbitOffset -= dx * 0.006;
        this.camControl.pitchOffset = Math.max(
          -0.25,
          Math.min(0.75, this.camControl.pitchOffset + dy * 0.004)
        );
      }
      this.camControl.lastX = e.clientX;
      this.camControl.lastY = e.clientY;
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.camControl.isDragging) return;
      this.camControl.isDragging = false;

      // If dragDist <= 10px, treat as a 3D Point-and-Click command!
      if (this.camControl.dragDist > 10) return;

      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.world.camera);

      // 1. Did user click another 3D Kid Friend? -> Run over and High-Five / Ride Together!
      const friendHits = this.raycaster.intersectObjects(this.world.avatarHitMeshes, false);
      if (friendHits.length > 0) {
        const fId = friendHits[0].object.userData.avatarId;
        const friendAv = this.avatars.get(fId);
        if (friendAv && !friendAv.isMe) {
          this.state.partnerName = friendAv.name;
          this.state.togetherMode = true;
          document.getElementById('togetherModeLabel').textContent = 'ON (2배 보너스!)';
          this.walkToPoint(friendAv.currentPos, friendAv.ride || 'trampoline');
          this.showToast(`🤝 ${friendAv.name}에게 달려가 함께 놀이기구를 탑니다!`);
          return;
        }
      }

      // 2. Did user click a 3D Ride Hitbox? -> Run to that ride and ride it!
      const rideHits = this.raycaster.intersectObjects(this.world.rideHitMeshes, false);
      if (rideHits.length > 0) {
        const rk = rideHits[0].object.userData.rideKey;
        if (rk) {
          this.selectRide(rk, true);
          return;
        }
      }

      // 3. Did user click anywhere on the Floor (or mathematical ground plane Y=0)? -> Run to that exact 3D point!
      const floorHits = this.raycaster.intersectObject(this.world.floorMesh, false);
      if (floorHits.length > 0) {
        this.walkToPoint(floorHits[0].point, null);
        return;
      }

      // Fallback: intersect mathematical horizontal plane Y=0
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectPt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(groundPlane, intersectPt)) {
        this.walkToPoint(intersectPt, null);
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
      this.showToast(`🎉 바닥이나 놀이기구를 클릭하면 그곳으로 달려갑니다! 하단 버튼도 눌러보세요!`);
    });

    document.querySelectorAll('#dockActionsContainer .action-btn[data-ride]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectRide(btn.dataset.ride, true);
      });
    });

    document.getElementById('toggleTogetherChip').addEventListener('click', () => {
      this.state.togetherMode = !this.state.togetherMode;
      document.getElementById('togetherModeLabel').textContent = this.state.togetherMode
        ? 'ON (2배 보너스!)'
        : '혼자 타기';
      this.rebuildAvatars();
      this.showToast(
        this.state.togetherMode
          ? `🤝 친구와 같이 타기 ON! ${this.state.partnerName}와 함께 움직이고 놀이기구를 탑니다!`
          : `🏃 혼자 타기 모드로 전환되었습니다.`
      );
    });

    document.querySelectorAll('.theme-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const t = tab.dataset.theme;
        this.applyTheme(t, true);
        this.metaverse.sendAction({ type: 'changeTheme', theme: t });
      });
    });

    const povLabel = document.getElementById('povLabel');
    document.getElementById('cameraPovBtn').addEventListener('click', () => {
      this.camControl.orbitOffset = 0;
      this.camControl.pitchOffset = 0;
      this.camControl.zoomOffset = 0;

      if (this.state.povMode === 'closeup') {
        this.state.povMode = 'front';
        povLabel.textContent = '내 캐릭터 정면';
        this.showToast('📷 내 캐릭터 정면 보기');
      } else if (this.state.povMode === 'front') {
        this.state.povMode = 'summit';
        povLabel.textContent = '전광판 & 범종탑';
        this.showToast('📷 실시간 3D 대형 전광판과 산사 황금범종 정상 보기');
      } else if (this.state.povMode === 'summit') {
        this.state.povMode = 'wide';
        povLabel.textContent = '키즈카페 전체';
        this.showToast('📷 키즈카페 전체 보기 (원하는 바닥이나 기구를 클릭해 이동하세요!)');
      } else {
        this.state.povMode = 'closeup';
        povLabel.textContent = '같이 타기 클로즈업';
        this.showToast('📷 같이 타기 클로즈업 보기');
      }
    });

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

    document.getElementById('soloCompanionToggle').addEventListener('change', (e) => {
      this.metaverse.enableCompanions = e.target.checked;
      this.rebuildAvatars();
    });

    document.getElementById('copyRoomLinkBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      this.showToast('🔗 현재 서버 주소가 복사되었습니다! 친구에게 보내 같은 방에서 만나세요!');
    });

    document.getElementById('soundToggleBtn').addEventListener('click', () => {
      const muted = window.soundEngine.toggleMute();
      document.getElementById('soundToggleBtn').textContent = muted ? '🔇' : '🔊';
      this.showToast(muted ? '🔇 소리가 꺼졌습니다.' : '🔊 소리가 켜졌습니다.');
    });

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
    document.getElementById('hud-score').textContent = `${this.state.score.toLocaleString()}점`;
    document.getElementById('hud-combo').textContent = `x${this.state.combo.toFixed(1)}배`;

    const lv = Math.floor(this.state.score / 400) + 1;
    const titles = ['키즈 탐험가', '점프 루키', '슬라이드 스타', '스카이워커', '산사 범종 마스터', '아케이드 전설'];
    document.getElementById('hud-level').textContent = `Lv.${lv} ${titles[Math.min(titles.length - 1, lv - 1)]}`;

    const realRoomCount = Math.max(1, this.metaverse.realUsers.length);
    const totalPlaymates = this.avatars.size;
    const totalAllServers = Math.max(realRoomCount, this.metaverse.totalRealOnline);

    document.getElementById('onlineCount').textContent = String(realRoomCount);
    document.getElementById('totalPlaymatesCount').textContent = String(totalPlaymates);

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
