// 3D World, Co-Op Rides (Twin Slide, Dual Zipline, Dual Climbing), Scoreboard & Articulated Kid Avatars
class ArcadeWorld {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1021);
    this.scene.fog = new THREE.FogExp2(0x0b1021, 0.0075);

    this.camera = new THREE.PerspectiveCamera(
      54,
      window.innerWidth / window.innerHeight,
      0.1,
      260
    );
    this.camera.position.set(0, 10, 22);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    container.appendChild(this.renderer.domElement);

    this.themeMode = 'arcade'; // 'arcade' | 'sansa' | 'night'
    this.trampolinePads = [];
    this.ballPitBalls = [];
    this.skyWalkPlanks = [];
    this.tagBoxes = [];
    this.fireParticles = [];
    this.floatingLanterns = [];
    this.confettiParticles = [];
    this.rideHitMeshes = [];
    this.avatarHitMeshes = [];

    // Dual Zipline Trolleys for Riding Together!
    this.ziplineTrolleyA = null;
    this.ziplineTrolleyB = null;
    this.zipStartA = new THREE.Vector3(-1.3, 15.8, -19.5);
    this.zipEndA = new THREE.Vector3(-1.3, 8.8, 3.0);
    this.zipStartB = new THREE.Vector3(1.3, 15.8, -19.5);
    this.zipEndB = new THREE.Vector3(1.3, 8.8, 3.0);

    this.summitBell = null;

    this.rideZones = {
      trampoline: {
        id: 'trampoline',
        name: '점핑 트램펄린 존',
        center: new THREE.Vector3(-16, 0.7, 7),
        camOffset: new THREE.Vector3(0, 4.5, 9.5),
        diff: 1,
        basePts: 30
      },
      ballpit: {
        id: 'ballpit',
        name: '대형 볼풀 & 정글짐',
        center: new THREE.Vector3(16, 0.5, 7),
        camOffset: new THREE.Vector3(0, 4.8, 9.5),
        diff: 2,
        basePts: 50
      },
      slide: {
        id: 'slide',
        name: '트윈 다이내믹 슬라이드',
        center: new THREE.Vector3(-15.5, 4.0, -5),
        camOffset: new THREE.Vector3(4.5, 4.2, 9.5),
        diff: 3,
        basePts: 80
      },
      skywalk: {
        id: 'skywalk',
        name: '다이내믹 공중 출렁다리',
        center: new THREE.Vector3(0, 7.2, -14),
        camOffset: new THREE.Vector3(0, 3.8, 9.2),
        diff: 4,
        basePts: 150
      },
      climbing: {
        id: 'climbing',
        name: '듀얼 암벽 클라이밍 & 황금범종',
        center: new THREE.Vector3(0, 7.5, -21),
        camOffset: new THREE.Vector3(0, 3.5, 10.5),
        diff: 5,
        basePts: 250
      },
      zipline: {
        id: 'zipline',
        name: '트윈 플라잉 짚라인 & 과녁 드롭',
        center: new THREE.Vector3(0, 6.0, -4),
        camOffset: new THREE.Vector3(6.5, 3.8, 9.5),
        diff: 6,
        basePts: 400
      },
      bonfire: {
        id: 'bonfire',
        name: '산사 불멍 힐링 캠프존',
        center: new THREE.Vector3(0, 0.3, 14),
        camOffset: new THREE.Vector3(0, 3.2, 7.8),
        diff: 1,
        basePts: 40
      }
    };

    this.initLights();
    this.initFloorAndArchitecture();
    this.initSansaNatureElements();
    this.initGiantScoreboard();
    this.initTrampolineZone();
    this.initBallPitAndJungleGym();
    this.initTwinDynamicSlide();
    this.initSkyWalkBridge();
    this.initDualClimbingAndSummitTemple();
    this.initTwinZiplineAndDropTarget();
    this.initBonfireHealingZone();
    this.initTagBoxes();

    window.addEventListener('resize', () => this.onResize());
  }

  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xdbeafe, 0.78);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.7);
    this.hemiLight.position.set(0, 40, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff7ed, 1.2);
    this.dirLight.position.set(22, 38, 24);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 110;
    const d = 36;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    this.neonLight1 = new THREE.PointLight(0x00f5d4, 1.5, 34);
    this.neonLight1.position.set(-16, 9, 7);
    this.scene.add(this.neonLight1);

    this.neonLight2 = new THREE.PointLight(0xff2a85, 1.5, 34);
    this.neonLight2.position.set(16, 9, 7);
    this.scene.add(this.neonLight2);

    this.bonfireLight = new THREE.PointLight(0xff7b00, 2.4, 24);
    this.bonfireLight.position.set(0, 2.5, 14);
    this.scene.add(this.bonfireLight);
  }

  createFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    const size = 64;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#1e293b' : '#263449';
        ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      }
    }
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 12);
    return tex;
  }

  addRideClickBox(x, y, z, w, h, d, rideKey) {
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(x, y, z);
    hit.userData = { rideKey };
    this.scene.add(hit);
    this.rideHitMeshes.push(hit);
  }

  initFloorAndArchitecture() {
    const floorGeo = new THREE.PlaneGeometry(76, 66);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createFloorTexture(),
      roughness: 0.52,
      metalness: 0.12
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.7,
      metalness: 0.25
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(76, 26, 1.5), wallMat);
    backWall.position.set(0, 13, -30);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Neon Header Sign on Back Wall
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 192;
    const bctx = bannerCanvas.getContext('2d');
    bctx.fillStyle = '#090d16';
    bctx.fillRect(0, 0, 1024, 192);
    bctx.strokeStyle = '#00f5d4';
    bctx.lineWidth = 8;
    bctx.strokeRect(8, 8, 1008, 176);
    bctx.font = '900 50px Pretendard, sans-serif';
    bctx.fillStyle = '#00f5d4';
    bctx.textAlign = 'center';
    bctx.fillText('ARCADE X 오산동탄점 3D 메타버스 키즈파크', 512, 88);
    bctx.font = '700 30px Pretendard, sans-serif';
    bctx.fillStyle = '#fbbf24';
    bctx.fillText('친구들과 함께 놀이기구를 타고 [X] 태그 점수를 올려보세요!', 512, 146);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 6.0),
      new THREE.MeshBasicMaterial({ map: bannerTex })
    );
    bannerMesh.position.set(0, 21.5, -29.1);
    this.scene.add(bannerMesh);
  }

  initSansaNatureElements() {
    this.sansaGroup = new THREE.Group();
    this.scene.add(this.sansaGroup);

    const pinePositions = [
      [-30, -24], [30, -24], [-31, 0], [31, 0], [-28, 20], [28, 20], [-12, 22], [12, 22]
    ];
    pinePositions.forEach(([x, z]) => {
      const tree = this.createPineTree();
      tree.position.set(x, 0, z);
      this.sansaGroup.add(tree);
    });

    const lanternCoords = [[-6, 14], [6, 14], [-6, -18], [6, -18]];
    lanternCoords.forEach(([x, z]) => {
      const stoneLantern = this.createStoneLantern();
      stoneLantern.position.set(x, 0, z);
      this.sansaGroup.add(stoneLantern);
    });

    const lanternColors = [0xff2a85, 0xfbbf24, 0x00f5d4, 0xff7b00];
    for (let i = 0; i < 16; i++) {
      const lGeo = new THREE.SphereGeometry(0.42, 12, 12);
      const lMat = new THREE.MeshBasicMaterial({ color: lanternColors[i % lanternColors.length] });
      const lantern = new THREE.Mesh(lGeo, lMat);
      const angle = (i / 16) * Math.PI * 2;
      const radius = 21 + (i % 3) * 4;
      lantern.position.set(
        Math.cos(angle) * radius,
        11 + (i % 4) * 2.2,
        Math.sin(angle) * radius - 3
      );
      lantern.userData = { baseY: lantern.position.y, phase: i * 0.7 };
      this.floatingLanterns.push(lantern);
      this.sansaGroup.add(lantern);
    }
  }

  createPineTree() {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.65, 4.2, 8), trunkMat);
    trunk.position.y = 2.1;
    trunk.castShadow = true;
    group.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6 - i * 0.55, 3.0, 9), leafMat);
      cone.position.y = 4.0 + i * 1.8;
      cone.castShadow = true;
      group.add(cone);
    }
    return group;
  }

  createStoneLantern() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.1, 6), stoneMat);
    base.position.y = 0.55;
    group.add(base);

    const lightBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.65, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    );
    lightBox.position.y = 1.45;
    group.add(lightBox);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.55, 6), stoneMat);
    roof.position.y = 2.0;
    group.add(roof);
    return group;
  }

  initGiantScoreboard() {
    this.boardCanvas = document.createElement('canvas');
    this.boardCanvas.width = 512;
    this.boardCanvas.height = 384;
    this.boardCtx = this.boardCanvas.getContext('2d');
    this.boardTexture = new THREE.CanvasTexture(this.boardCanvas);

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 9.5),
      new THREE.MeshBasicMaterial({ map: this.boardTexture })
    );
    screenMesh.position.set(-21, 13.5, -28.9);
    this.scene.add(screenMesh);

    const rightScreen = screenMesh.clone();
    rightScreen.position.set(21, 13.5, -28.9);
    this.scene.add(rightScreen);

    this.updateWallScoreboard([], '#0번 메인 서버', 1, 4);
  }

  updateWallScoreboard(rankings, serverName, realOnlineCount, totalPlaymates) {
    const ctx = this.boardCtx;
    if (!ctx) return;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 384);

    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 372);

    ctx.fillStyle = '#00f5d4';
    ctx.font = '900 26px Pretendard, sans-serif';
    ctx.fillText(`🏆 실시간 전광판 (${serverName})`, 24, 46);

    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 18px Pretendard, sans-serif';
    ctx.fillText(`🟢 실시간 접속: ${realOnlineCount}명 (함께 노는 친구 ${totalPlaymates}명)`, 24, 78);

    const top5 = rankings.slice(0, 5);
    top5.forEach((p, idx) => {
      const y = 124 + idx * 50;
      ctx.fillStyle = p.isMe ? 'rgba(0, 245, 212, 0.28)' : 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(20, y - 30, 472, 42);

      ctx.fillStyle = idx === 0 ? '#fbbf24' : '#f8fafc';
      ctx.font = '800 21px Pretendard, sans-serif';
      ctx.fillText(`${idx + 1}위  ${p.name}`, 34, y - 2);

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'right';
      ctx.fillText(`${(p.score || 0).toLocaleString()} 점`, 476, y - 2);
      ctx.textAlign = 'left';
    });

    this.boardTexture.needsUpdate = true;
  }

  // 1. TRAMPOLINE ZONE (★☆☆☆☆ 쉬움)
  initTrampolineZone() {
    const cx = -16;
    const cz = 7;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.65, 12.5), frameMat);
    frame.position.set(cx, 0.32, cz);
    frame.receiveShadow = true;
    this.scene.add(frame);

    const padGeo = new THREE.BoxGeometry(3.4, 0.22, 3.4);
    for (let gx = -1; gx <= 1; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        const isEven = (gx + gz) % 2 === 0;
        const padMat = new THREE.MeshStandardMaterial({
          color: isEven ? 0x0f172a : 0x1e1b4b,
          emissive: isEven ? 0x00f5d4 : 0xff2a85,
          emissiveIntensity: 0.32,
          roughness: 0.3
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(cx + gx * 3.8, 0.68, cz + gz * 3.8);
        pad.receiveShadow = true;
        this.scene.add(pad);
        this.trampolinePads.push(pad);
      }
    }

    this.addRideClickBox(cx, 2.0, cz, 12.5, 4.0, 12.5, 'trampoline');
  }

  // 2. BALL PIT & JUNGLE GYM (★★☆☆☆ 보통)
  initBallPitAndJungleGym() {
    const cx = 16;
    const cz = 7;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.4 });

    const w1 = new THREE.Mesh(new THREE.BoxGeometry(12, 1.3, 0.8), wallMat);
    w1.position.set(cx, 0.65, cz - 5.6);
    const w2 = w1.clone();
    w2.position.set(cx, 0.65, cz + 5.6);
    const w3 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 12), wallMat);
    w3.position.set(cx - 5.6, 0.65, cz);
    const w4 = w3.clone();
    w4.position.set(cx + 5.6, 0.65, cz);
    this.scene.add(w1, w2, w3, w4);

    // Colorful Physics-Reactive Balls
    const ballColors = [0x00f5d4, 0xff2a85, 0xfbbf24, 0x38bdf8, 0xa855f7, 0x4ade80];
    const ballGeo = new THREE.SphereGeometry(0.36, 10, 10);
    for (let i = 0; i < 115; i++) {
      const bMat = new THREE.MeshStandardMaterial({
        color: ballColors[i % ballColors.length],
        roughness: 0.22
      });
      const ball = new THREE.Mesh(ballGeo, bMat);
      const bx = cx + (Math.random() - 0.5) * 9.5;
      const bz = cz + (Math.random() - 0.5) * 9.5;
      ball.position.set(bx, 0.38 + (i % 2) * 0.25, bz);
      ball.userData = {
        vx: 0,
        vz: 0,
        vy: 0,
        minX: cx - 4.8,
        maxX: cx + 4.8,
        minZ: cz - 4.8,
        maxZ: cz + 4.8
      };
      this.scene.add(ball);
      this.ballPitBalls.push(ball);
    }

    this.addRideClickBox(cx, 2.0, cz, 12, 4.0, 12, 'ballpit');
  }

  // 3. TWIN 2-LANE DYNAMIC MEGA SLIDE (★★★☆☆ 인기 - 친구와 나란히 같이 타기!)
  initTwinDynamicSlide() {
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.6, 8), towerMat);
    platform.position.set(-15, 7.0, -14);
    platform.castShadow = true;
    this.scene.add(platform);

    const colMat = new THREE.MeshStandardMaterial({ color: 0x00f5d4, roughness: 0.4 });
    [[-19, -17.5], [-11, -17.5], [-19, -10.5], [-11, -10.5]].forEach(([x, z]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 7.2, 12), colMat);
      col.position.set(x, 3.6, z);
      this.scene.add(col);
    });

    // Twin 2-Lane Wide Neon Slide Chute (X = -15.5, width 4.8m so 2 kids ride side-by-side!)
    const slideMatA = new THREE.MeshStandardMaterial({
      color: 0xff2a85,
      emissive: 0xff2a85,
      emissiveIntensity: 0.26,
      roughness: 0.18
    });
    const slideMatB = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.26,
      roughness: 0.18
    });

    const laneA = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 14.5), slideMatA);
    laneA.position.set(-16.6, 3.7, -4.2);
    laneA.rotation.x = 0.49;
    this.scene.add(laneA);

    const laneB = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 14.5), slideMatB);
    laneB.position.set(-14.3, 3.7, -4.2);
    laneB.rotation.x = 0.49;
    this.scene.add(laneB);

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.4
    });
    [-17.8, -15.45, -13.1].forEach((rx) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.85, 14.5), railMat);
      rail.position.set(rx, 4.0, -4.2);
      rail.rotation.x = 0.49;
      this.scene.add(rail);
    });

    this.addRideClickBox(-15.5, 4.0, -4.5, 5.5, 6.5, 14.5, 'slide');
  }

  // 4. DYNAMIC SKYWALK BRIDGE (★★★★☆ 스릴)
  initSkyWalkBridge() {
    const rightPlatform = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    rightPlatform.position.set(14.5, 7.0, -14);
    this.scene.add(rightPlatform);

    const colMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.4 });
    [[11, -17.5], [18, -17.5], [11, -10.5], [18, -10.5]].forEach(([x, z]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 7.2, 12), colMat);
      col.position.set(x, 3.6, z);
      this.scene.add(col);
    });

    for (let i = 0; i < 11; i++) {
      const px = -9.5 + i * 1.9;
      const plankMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xfbbf24 : 0x00f5d4,
        emissive: i % 2 === 0 ? 0xfbbf24 : 0x00f5d4,
        emissiveIntensity: 0.28
      });
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 3.4), plankMat);
      plank.position.set(px, 7.0, -14);
      plank.userData = { baseZ: -14, baseY: 7.0, phase: i * 0.55 };
      this.scene.add(plank);
      this.skyWalkPlanks.push(plank);
    }

    this.addRideClickBox(0, 7.5, -14, 20, 3.5, 4.5, 'skywalk');
  }

  // 5. DUAL CLIMBING WALL & SANSA GOLDEN BELL SUMMIT (★★★★★ 고난도)
  initDualClimbingAndSummitTemple() {
    const wallGeo = new THREE.BoxGeometry(8.2, 14.5, 1.2);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.55 });
    const climbWall = new THREE.Mesh(wallGeo, wallMat);
    climbWall.position.set(0, 7.25, -21.5);
    climbWall.castShadow = true;
    this.scene.add(climbWall);

    const holdColors = [0x00f5d4, 0xff2a85, 0xfbbf24, 0x4ade80, 0x38bdf8];
    const holdGeo = new THREE.BoxGeometry(0.5, 0.32, 0.35);
    for (let row = 0; row < 18; row++) {
      for (let col = -3; col <= 3; col++) {
        if ((row + col) % 2 !== 0) continue;
        const holdMat = new THREE.MeshStandardMaterial({
          color: holdColors[(row + Math.abs(col)) % holdColors.length],
          emissive: holdColors[(row + Math.abs(col)) % holdColors.length],
          emissiveIntensity: 0.6
        });
        const hold = new THREE.Mesh(holdGeo, holdMat);
        hold.position.set(col * 1.1, 1.2 + row * 0.72, -20.8);
        this.scene.add(hold);
      }
    }

    // Summit Mountain Temple Pavilion (산사 구름 정자 & 황금 범종)
    const summitDeck = new THREE.Mesh(
      new THREE.BoxGeometry(10.0, 0.6, 6.5),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 })
    );
    summitDeck.position.set(0, 14.5, -21.5);
    this.scene.add(summitDeck);

    const redWood = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });
    [[-4.0, -23.8], [4.0, -23.8], [-4.0, -19.2], [4.0, -19.2]].forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.2, 10), redWood);
      p.position.set(x, 16.8, z);
      this.scene.add(p);
    });

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 2.6, 4), roofMat);
    roof.position.set(0, 20.1, -21.5);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);

    const bellMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
      metalness: 0.85,
      roughness: 0.15
    });
    this.summitBell = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 1.1, 1.9, 18), bellMat);
    this.summitBell.position.set(0, 17.0, -21.5);
    this.scene.add(this.summitBell);

    this.addRideClickBox(0, 8.0, -21.0, 8.5, 16.0, 3.0, 'climbing');
  }

  // 6. TWIN FLYING ZIPLINE & BULLSEYE DROP TARGET (★★★★★★ 최고난도)
  initTwinZiplineAndDropTarget() {
    const createCableAndTrolley = (startV, endV, colorHex) => {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([startV, endV]);
      const lineMat = new THREE.LineBasicMaterial({ color: colorHex });
      this.scene.add(new THREE.Line(lineGeo, lineMat));

      const trolley = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.42, 0.95),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.45 })
      );
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 1.25),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      bar.position.y = -0.6;
      const handleBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24 })
      );
      handleBar.rotation.z = Math.PI / 2;
      handleBar.position.y = -1.2;
      trolley.add(body, bar, handleBar);
      trolley.position.copy(startV);
      this.scene.add(trolley);
      return trolley;
    };

    this.ziplineTrolleyA = createCableAndTrolley(this.zipStartA, this.zipEndA, 0x00f5d4);
    this.ziplineTrolleyB = createCableAndTrolley(this.zipStartB, this.zipEndB, 0xff2a85);

    // Bullseye Airbag Target Mat at (0, 0.1, 3.0)
    const rings = [
      { r: 4.6, col: 0x0284c7 },
      { r: 3.3, col: 0xff2a85 },
      { r: 2.0, col: 0xfbbf24 },
      { r: 0.9, col: 0x00f5d4 }
    ];
    rings.forEach((ring, idx) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(ring.r, ring.r, 0.35 + idx * 0.04, 32),
        new THREE.MeshStandardMaterial({
          color: ring.col,
          emissive: ring.col,
          emissiveIntensity: 0.25,
          roughness: 0.4
        })
      );
      m.position.set(0, 0.18, 3.0);
      this.scene.add(m);
    });

    this.addRideClickBox(0, 1.0, 3.0, 9.0, 2.5, 9.0, 'zipline');
  }

  // 7. BONFIRE HEALING ZONE (불멍 캠프파이어 휴식존)
  initBonfireHealingZone() {
    const cx = 0;
    const cz = 14;

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), stoneMat);
      rock.position.set(cx + Math.cos(ang) * 1.5, 0.28, cz + Math.sin(ang) * 1.5);
      this.scene.add(rock);
    }

    const logMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 8), logMat);
      log.position.set(cx, 0.35, cz);
      log.rotation.z = Math.PI / 2.3;
      log.rotation.y = (i * Math.PI) / 4;
      this.scene.add(log);
    }

    const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.45, 0.8), benchMat);
      bench.position.set(cx + Math.cos(ang) * 3.5, 0.25, cz + Math.sin(ang) * 3.5);
      bench.rotation.y = -ang + Math.PI / 2;
      this.scene.add(bench);
    }

    for (let i = 0; i < 26; i++) {
      const emberMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff5500 : 0xfbbf24,
        transparent: true,
        opacity: 0.9
      });
      const size = 0.18 + Math.random() * 0.3;
      const ember = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), emberMat);
      ember.position.set(
        cx + (Math.random() - 0.5) * 1.1,
        0.5 + Math.random() * 2.4,
        cz + (Math.random() - 0.5) * 1.1
      );
      ember.userData = {
        baseX: cx,
        baseZ: cz,
        speedY: 1.2 + Math.random() * 1.7,
        offset: Math.random() * Math.PI * 2
      };
      this.scene.add(ember);
      this.fireParticles.push(ember);
    }

    this.addRideClickBox(cx, 1.5, cz, 8.0, 3.0, 8.0, 'bonfire');
  }

  initTagBoxes() {
    const specs = [
      { id: 'tramp_tag', pos: [-16, 4.2, 7], color: 0x00f5d4 },
      { id: 'ball_tag', pos: [16, 2.2, 7], color: 0xff2a85 },
      { id: 'slide_tag', pos: [-15.5, 4.3, -4.2], color: 0xfbbf24 },
      { id: 'sky_tag', pos: [0, 8.6, -14], color: 0xfbbf24 },
      { id: 'climb_tag', pos: [0, 16.2, -20.5], color: 0xfbbf24 },
      { id: 'zip_tag', pos: [0, 2.2, 3.0], color: 0x00f5d4 }
    ];

    specs.forEach((sp) => {
      const group = new THREE.Group();
      group.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);

      const boxMat = new THREE.MeshStandardMaterial({
        color: sp.color,
        emissive: sp.color,
        emissiveIntensity: 0.7,
        metalness: 0.4,
        roughness: 0.2
      });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), boxMat);
      group.add(cube);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.88, 0.065, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      group.add(ring);

      group.userData = { ...sp, cube, ring, baseY: sp.pos[1] };
      this.scene.add(group);
      this.tagBoxes.push(group);
    });
  }

  // Create Smooth Articulated 3D Kid Avatar (불멍 스타일 관절 블렌딩 구조!)
  createKidAvatar(options = {}) {
    const {
      id = 'kid',
      shirtColor = 0x38bdf8,
      hatType = 'cap',
      bandColor = 0x00f5d4,
      isMe = false
    } = options;

    const root = new THREE.Group();
    const bodyRoot = new THREE.Group();
    root.add(bodyRoot);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.45 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.4 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    // Torso Pivot
    const torsoPivot = new THREE.Group();
    torsoPivot.position.y = 0.65;
    bodyRoot.add(torsoPivot);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.9, 14), shirtMat);
    torso.position.y = 0.45;
    torso.castShadow = true;
    torsoPivot.add(torso);

    // Head Group
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.25;
    torsoPivot.add(headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 18), skinMat);
    head.castShadow = true;
    headGroup.add(head);

    // Cute Eyes & Rosy Cheeks
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat);
    leftEye.position.set(-0.15, 0.05, 0.4);
    const rightEye = leftEye.clone();
    rightEye.position.set(0.15, 0.05, 0.4);

    const blushMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.45 });
    const leftBlush = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), blushMat);
    leftBlush.position.set(-0.24, -0.05, 0.36);
    const rightBlush = leftBlush.clone();
    rightBlush.position.set(0.24, -0.05, 0.36);
    headGroup.add(leftEye, rightEye, leftBlush, rightBlush);

    // Articulated Legs
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.18, 0.65, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.65, 10), pantsMat);
    leftLegMesh.position.y = -0.32;
    leftLeg.add(leftLegMesh);
    bodyRoot.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.18, 0.65, 0);
    const rightLegMesh = leftLegMesh.clone();
    rightLeg.add(rightLegMesh);
    bodyRoot.add(rightLeg);

    // Articulated Arms
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.48, 0.82, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.62, 10), skinMat);
    leftArmMesh.position.y = -0.28;
    leftArm.add(leftArmMesh);
    torsoPivot.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.48, 0.82, 0);
    const rightArmMesh = leftArmMesh.clone();
    rightArm.add(rightArmMesh);
    torsoPivot.add(rightArm);

    // Glowing Smart X-Tag Wristband on Right Wrist
    const wristBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.05, 8, 16),
      new THREE.MeshBasicMaterial({ color: bandColor })
    );
    wristBand.rotation.x = Math.PI / 2;
    wristBand.position.set(0, -0.5, 0);
    rightArm.add(wristBand);

    // Accessory Group
    const accessoryGroup = new THREE.Group();
    headGroup.add(accessoryGroup);
    const backAccessoryGroup = new THREE.Group();
    torsoPivot.add(backAccessoryGroup);

    const applyAccessory = (type) => {
      while (accessoryGroup.children.length) accessoryGroup.remove(accessoryGroup.children[0]);
      while (backAccessoryGroup.children.length) backAccessoryGroup.remove(backAccessoryGroup.children[0]);

      if (type === 'crown') {
        const crown = new THREE.Mesh(
          new THREE.CylinderGeometry(0.36, 0.28, 0.3, 8),
          new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.5, metalness: 0.85 })
        );
        crown.position.y = 0.48;
        accessoryGroup.add(crown);
      } else if (type === 'satgat') {
        const satgat = new THREE.Mesh(
          new THREE.ConeGeometry(0.82, 0.42, 14),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
        );
        satgat.position.y = 0.46;
        accessoryGroup.add(satgat);
      } else if (type === 'wings') {
        const wingMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });
        const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.25), wingMat);
        wL.position.set(-0.48, 0.55, -0.32);
        wL.rotation.y = 0.4;
        const wR = wL.clone();
        wR.position.set(0.48, 0.55, -0.32);
        wR.rotation.y = -0.4;
        backAccessoryGroup.add(wL, wR);
      } else {
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.46, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: isMe ? 0xff2a85 : shirtColor })
        );
        cap.position.y = 0.05;
        accessoryGroup.add(cap);
      }
    };

    applyAccessory(hatType);

    if (isMe) {
      const meRing = new THREE.Mesh(
        new THREE.RingGeometry(0.62, 0.82, 28),
        new THREE.MeshBasicMaterial({ color: 0x00f5d4, side: THREE.DoubleSide })
      );
      meRing.rotation.x = -Math.PI / 2;
      meRing.position.y = 0.04;
      root.add(meRing);
    }

    // Invisible Hitbox for clicking a friend in 3D
    const hitBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 2.2, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.y = 1.1;
    hitBox.userData = { avatarId: id };
    root.add(hitBox);
    if (!isMe) this.avatarHitMeshes.push(hitBox);

    root.userData = {
      id,
      bodyRoot,
      torsoPivot,
      headGroup,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      wristBand,
      applyAccessory,
      pose: {
        torsoLean: 0,
        leftArmX: 0,
        rightArmX: 0,
        leftLegX: 0,
        rightLegX: 0,
        bodyY: 0
      }
    };

    return root;
  }

  // Smoothly blend character joints toward target pose (60fps silky-smooth motion!)
  blendAvatarPose(mesh, target, lerpFactor = 0.16) {
    const u = mesh.userData;
    if (!u || !u.pose) return;
    const p = u.pose;
    const lerp = (a, b, t) => a + (b - a) * t;

    p.torsoLean = lerp(p.torsoLean, target.torsoLean || 0, lerpFactor);
    p.leftArmX = lerp(p.leftArmX, target.leftArmX || 0, lerpFactor);
    p.rightArmX = lerp(p.rightArmX, target.rightArmX || 0, lerpFactor);
    p.leftLegX = lerp(p.leftLegX, target.leftLegX || 0, lerpFactor);
    p.rightLegX = lerp(p.rightLegX, target.rightLegX || 0, lerpFactor);
    p.bodyY = lerp(p.bodyY, target.bodyY || 0, lerpFactor);

    u.torsoPivot.rotation.x = p.torsoLean;
    u.leftArm.rotation.x = p.leftArmX;
    u.rightArm.rotation.x = p.rightArmX;
    u.leftLeg.rotation.x = p.leftLegX;
    u.rightLeg.rotation.x = p.rightLegX;
    u.bodyRoot.position.y = p.bodyY;
  }

  spawnCelebrationBurst(pos, color = 0xfbbf24) {
    for (let i = 0; i < 24; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.22),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? color : 0x00f5d4 })
      );
      p.position.copy(pos);
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 5.5;
      p.userData = {
        vx: Math.cos(angle) * spd,
        vy: 3.5 + Math.random() * 6,
        vz: Math.sin(angle) * spd,
        life: 1.0
      };
      this.scene.add(p);
      this.confettiParticles.push(p);
    }
  }

  setTheme(mode) {
    this.themeMode = mode;
    if (mode === 'sansa') {
      this.scene.background.setHex(0x13221c);
      this.scene.fog.color.setHex(0x13221c);
      this.ambientLight.color.setHex(0xfde68a);
      this.dirLight.color.setHex(0xffedd5);
      this.dirLight.intensity = 1.35;
    } else if (mode === 'night') {
      this.scene.background.setHex(0x050711);
      this.scene.fog.color.setHex(0x050711);
      this.ambientLight.color.setHex(0x93c5fd);
      this.dirLight.color.setHex(0x38bdf8);
      this.dirLight.intensity = 0.85;
    } else {
      this.scene.background.setHex(0x0b1021);
      this.scene.fog.color.setHex(0x0b1021);
      this.ambientLight.color.setHex(0xdbeafe);
      this.dirLight.color.setHex(0xfff7ed);
      this.dirLight.intensity = 1.2;
    }
  }

  updateWorldElements(dt, elapsed, activeAvatarsPositions = []) {
    // 1. Skywalk swaying planks
    this.skyWalkPlanks.forEach((plank) => {
      plank.position.z = plank.userData.baseZ + Math.sin(elapsed * 2.1 + plank.userData.phase) * 0.65;
    });

    // 2. Rotating glowing X-Tag Boxes
    this.tagBoxes.forEach((box) => {
      box.userData.cube.rotation.y += dt * 1.8;
      box.userData.cube.rotation.x += dt * 1.1;
      box.userData.ring.rotation.z -= dt * 2.2;
      box.position.y = box.userData.baseY + Math.sin(elapsed * 3 + box.position.x) * 0.2;
    });

    // 3. Ball Pit Balls splash when any kid avatar is in the Ball Pit!
    this.ballPitBalls.forEach((ball) => {
      for (const pos of activeAvatarsPositions) {
        const dx = ball.position.x - pos.x;
        const dz = ball.position.z - pos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < 2.5 && Math.abs(ball.position.y - pos.y) < 2.0) {
          const dist = Math.sqrt(distSq) || 0.1;
          ball.userData.vx += (dx / dist) * 10 * dt;
          ball.userData.vz += (dz / dist) * 10 * dt;
          ball.userData.vy = 2.8;
        }
      }

      ball.position.x += ball.userData.vx * dt;
      ball.position.z += ball.userData.vz * dt;
      ball.position.y += ball.userData.vy * dt;
      if (ball.position.y > 0.38) {
        ball.userData.vy -= 9.8 * dt;
      } else {
        ball.position.y = 0.38;
        ball.userData.vy = 0;
      }
      ball.userData.vx *= 0.92;
      ball.userData.vz *= 0.92;
      ball.position.x = Math.max(ball.userData.minX, Math.min(ball.userData.maxX, ball.position.x));
      ball.position.z = Math.max(ball.userData.minZ, Math.min(ball.userData.maxZ, ball.position.z));
    });

    // 4. Bonfire Embers
    this.fireParticles.forEach((ember) => {
      ember.position.y += ember.userData.speedY * dt;
      ember.position.x = ember.userData.baseX + Math.sin(elapsed * 4 + ember.userData.offset) * 0.55;
      ember.rotation.y += dt * 3;
      if (ember.position.y > 3.6) ember.position.y = 0.45;
    });
    this.bonfireLight.intensity = 2.1 + Math.sin(elapsed * 10) * 0.35;

    // 5. Floating Lanterns
    this.floatingLanterns.forEach((l) => {
      l.position.y = l.userData.baseY + Math.sin(elapsed * 1.4 + l.userData.phase) * 0.42;
    });

    // 6. Celebration Confetti
    for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
      const p = this.confettiParticles[i];
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.userData.vy -= 12 * dt;
      p.rotation.x += 5 * dt;
      p.rotation.y += 5 * dt;
      p.userData.life -= dt;
      if (p.userData.life <= 0) {
        this.scene.remove(p);
        this.confettiParticles.splice(i, 1);
      }
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.ArcadeWorld = ArcadeWorld;
