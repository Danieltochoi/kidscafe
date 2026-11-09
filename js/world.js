// 3D World, Rides, X-Tag Boxes, Scoreboard & Kid Avatar Builder
class ArcadeWorld {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1021);
    this.scene.fog = new THREE.FogExp2(0x0b1021, 0.0085);

    this.camera = new THREE.PerspectiveCamera(
      58,
      window.innerWidth / window.innerHeight,
      0.1,
      250
    );
    this.camera.position.set(0, 12, 26);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.themeMode = 'hybrid'; // 'hybrid' (실사+산사 융합), 'sansa' (산사 자연힐링), 'arcade' (사이버 네온)
    this.trampolinePads = [];
    this.ballPitBalls = [];
    this.skyWalkPlanks = [];
    this.tagBoxes = [];
    this.fireParticles = [];
    this.floatingLanterns = [];
    this.confettiParticles = [];
    this.ziplineTrolley = null;
    this.summitBell = null;
    this.guideArrow = null;

    this.rideZones = {
      trampoline: { name: '점핑 트램펄린 존', pos: new THREE.Vector3(-18, 0.6, 8), diff: 1, basePts: 30 },
      ballpit:    { name: '대형 볼풀 & 정글짐', pos: new THREE.Vector3(18, 0.6, 8), diff: 2, basePts: 50 },
      slide:      { name: '다이내믹 메가 슬라이드', pos: new THREE.Vector3(-16, 7.2, -13), entryPos: new THREE.Vector3(-9, 0.5, -13), diff: 3, basePts: 80 },
      skywalk:    { name: '다이내믹 스카이워크', pos: new THREE.Vector3(-10, 7.2, -13), entryPos: new THREE.Vector3(-9, 0.5, -13), diff: 4, basePts: 150 },
      climbing:   { name: '다이내믹 클라이밍 & 산사 범종탑', pos: new THREE.Vector3(0, 0.5, -20.5), diff: 5, basePts: 250 },
      zipline:    { name: '다이내믹 플라잉 짚라인 & 드롭', pos: new THREE.Vector3(0, 14.5, -21), entryPos: new THREE.Vector3(0, 0.5, -20.5), diff: 6, basePts: 400 },
      bonfire:    { name: '산사 불멍 힐링 캠프존', pos: new THREE.Vector3(0, 0.5, 15), diff: 1, basePts: 40 }
    };

    this.initLights();
    this.initFloorAndArchitecture();
    this.initSansaNatureElements();
    this.initGiantScoreboard();
    this.initTrampolineZone();
    this.initBallPitAndJungleGym();
    this.initDynamicSlideAndTower();
    this.initSkyWalkBridge();
    this.initClimbingAndSummitTemple();
    this.initZiplineAndDropTarget();
    this.initBonfireHealingZone();
    this.initTagBoxes();
    this.initGuideArrow();

    window.addEventListener('resize', () => this.onResize());
  }

  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xdbeafe, 0.72);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.65);
    this.hemiLight.position.set(0, 40, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff7ed, 1.15);
    this.dirLight.position.set(24, 38, 22);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 110;
    const d = 38;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    // Colorful Accent Point Lights for Arcade-X Vibe
    this.neonLight1 = new THREE.PointLight(0x00f5d4, 1.4, 35);
    this.neonLight1.position.set(-18, 9, 8);
    this.scene.add(this.neonLight1);

    this.neonLight2 = new THREE.PointLight(0xff2a85, 1.4, 35);
    this.neonLight2.position.set(18, 9, 8);
    this.scene.add(this.neonLight2);

    this.bonfireLight = new THREE.PointLight(0xff7b00, 2.2, 22);
    this.bonfireLight.position.set(0, 2.5, 15);
    this.scene.add(this.bonfireLight);
  }

  createCheckerFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    // Soft padded tile grid
    const size = 64;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#1e293b' : '#263449';
        ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      }
    }
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 12);
    return tex;
  }

  initFloorAndArchitecture() {
    // Main Safety Mat Floor
    const floorGeo = new THREE.PlaneGeometry(76, 66);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createCheckerFloorTexture(),
      roughness: 0.55,
      metalness: 0.12
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // Outer Park Boundary & Pillars
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.7,
      metalness: 0.25
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(76, 26, 1.5), wallMat);
    backWall.position.set(0, 13, -32);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Neon "ARCADE X - OSAN DONGTAN" 3D Sign Banner on Back Wall
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 192;
    const bctx = bannerCanvas.getContext('2d');
    bctx.fillStyle = '#090d16';
    bctx.fillRect(0, 0, 1024, 192);
    bctx.strokeStyle = '#00f5d4';
    bctx.lineWidth = 8;
    bctx.strokeRect(8, 8, 1008, 176);
    bctx.font = '900 54px Pretendard, sans-serif';
    bctx.fillStyle = '#00f5d4';
    bctx.textAlign = 'center';
    bctx.fillText('ARCADE X 오산동탄점 × 산사(山寺) 메타버스', 512, 92);
    bctx.font = '700 30px Pretendard, sans-serif';
    bctx.fillStyle = '#fbbf24';
    bctx.fillText('어려운 놀이기구 [X] 태그 박스를 터치할수록 더 높은 점수가 올라갑니다!', 512, 148);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 6.2),
      new THREE.MeshBasicMaterial({ map: bannerTex })
    );
    bannerMesh.position.set(0, 21.5, -31.1);
    this.scene.add(bannerMesh);

    // Central Glowing Track Carpet
    const trackGeo = new THREE.RingGeometry(8, 10.5, 48);
    const trackMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.22
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.set(0, 0.03, 2);
    this.scene.add(trackMesh);
  }

  initSansaNatureElements() {
    this.sansaGroup = new THREE.Group();
    this.scene.add(this.sansaGroup);

    // Pine Trees (소나무) & Traditional Stone Lanterns (석등) around the park perimeter
    const pinePositions = [
      [-32, -26], [32, -26], [-33, 0], [33, 0], [-30, 22], [30, 22], [-12, 24], [12, 24]
    ];
    pinePositions.forEach(([x, z]) => {
      const tree = this.createPineTree();
      tree.position.set(x, 0, z);
      this.sansaGroup.add(tree);
    });

    // Stone Lanterns (산사 석등) near the Bonfire & Climbing Pavilion
    const lanternCoords = [[-6, 15], [6, 15], [-6, -18], [6, -18]];
    lanternCoords.forEach(([x, z]) => {
      const stoneLantern = this.createStoneLantern();
      stoneLantern.position.set(x, 0, z);
      this.sansaGroup.add(stoneLantern);
    });

    // Floating Lotus Lanterns (하늘 연등) suspended in the air
    const lanternColors = [0xff2a85, 0xfbbf24, 0x00f5d4, 0xff7b00];
    for (let i = 0; i < 18; i++) {
      const lGeo = new THREE.SphereGeometry(0.45, 12, 12);
      const lMat = new THREE.MeshBasicMaterial({
        color: lanternColors[i % lanternColors.length]
      });
      const lantern = new THREE.Mesh(lGeo, lMat);
      const angle = (i / 18) * Math.PI * 2;
      const radius = 22 + (i % 3) * 5;
      lantern.position.set(
        Math.cos(angle) * radius,
        11 + (i % 4) * 2.5,
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
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 4.5, 8), trunkMat);
    trunk.position.y = 2.25;
    trunk.castShadow = true;
    group.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.8 - i * 0.6, 3.2, 9), leafMat);
      cone.position.y = 4.2 + i * 1.9;
      cone.castShadow = true;
      group.add(cone);
    }
    return group;
  }

  createStoneLantern() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.2, 6), stoneMat);
    base.position.y = 0.6;
    group.add(base);

    const lightBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.7, 0.65),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    );
    lightBox.position.y = 1.55;
    group.add(lightBox);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.6, 6), stoneMat);
    roof.position.y = 2.15;
    group.add(roof);
    return group;
  }

  initGiantScoreboard() {
    // 3D Live Wall Scoreboard on the Left-Back Wall (Just like real Arcade-X!)
    this.boardCanvas = document.createElement('canvas');
    this.boardCanvas.width = 512;
    this.boardCanvas.height = 384;
    this.boardCtx = this.boardCanvas.getContext('2d');
    this.boardTexture = new THREE.CanvasTexture(this.boardCanvas);

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 9.5),
      new THREE.MeshBasicMaterial({ map: this.boardTexture })
    );
    screenMesh.position.set(-22, 13.5, -30.9);
    this.scene.add(screenMesh);

    this.updateWallScoreboard([], '오산동탄 1서버', 24);
  }

  updateWallScoreboard(rankings, serverName, onlineCount) {
    const ctx = this.boardCtx;
    if (!ctx) return;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 512, 384);

    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 372);

    ctx.fillStyle = '#ff2a85';
    ctx.font = '900 26px Pretendard, sans-serif';
    ctx.fillText(`🏆 실시간 전광판 (${serverName})`, 24, 46);

    ctx.fillStyle = '#00f5d4';
    ctx.font = '700 18px Pretendard, sans-serif';
    ctx.fillText(`현재 서버 인원: ${onlineCount}명 놀이중`, 24, 76);

    const top5 = rankings.slice(0, 5);
    top5.forEach((p, idx) => {
      const y = 122 + idx * 50;
      ctx.fillStyle = p.isMe ? 'rgba(0, 245, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(20, y - 30, 472, 42);

      ctx.fillStyle = idx === 0 ? '#fbbf24' : '#f8fafc';
      ctx.font = '800 22px Pretendard, sans-serif';
      ctx.fillText(`${idx + 1}위  ${p.name}`, 34, y - 2);

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'right';
      ctx.fillText(`${p.score.toLocaleString()} 점`, 476, y - 2);
      ctx.textAlign = 'left';
    });

    this.boardTexture.needsUpdate = true;
  }

  // 1. TRAMPOLINE ZONE (★☆☆☆☆ 쉬움)
  initTrampolineZone() {
    const group = new THREE.Group();
    group.position.set(-18, 0, 8);
    this.scene.add(group);

    // Padded safety frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.65, 13.5), frameMat);
    frame.position.y = 0.32;
    frame.receiveShadow = true;
    group.add(frame);

    // 3x3 Grid of Bouncy Neon Trampoline Beds
    const padGeo = new THREE.BoxGeometry(3.6, 0.2, 3.6);
    for (let gx = -1; gx <= 1; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        const padMat = new THREE.MeshStandardMaterial({
          color: (gx + gz) % 2 === 0 ? 0x0f172a : 0x1e1b4b,
          emissive: (gx + gz) % 2 === 0 ? 0x00f5d4 : 0xff2a85,
          emissiveIntensity: 0.28,
          roughness: 0.35
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(-18 + gx * 4.1, 0.68, 8 + gz * 4.1);
        pad.receiveShadow = true;
        this.scene.add(pad);
        this.trampolinePads.push(pad);
      }
    }
  }

  // 2. GIANT BALL PIT & JUNGLE GYM MAZE (★★☆☆☆ 보통)
  initBallPitAndJungleGym() {
    const cx = 18;
    const cz = 8;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.4 });

    // Cushioned Pool Walls
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(13, 1.3, 0.8), wallMat);
    w1.position.set(cx, 0.65, cz - 6.1);
    const w2 = w1.clone();
    w2.position.set(cx, 0.65, cz + 6.1);
    const w3 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 13), wallMat);
    w3.position.set(cx - 6.1, 0.65, cz);
    const w4 = w3.clone();
    w4.position.set(cx + 6.1, 0.65, cz);
    this.scene.add(w1, w2, w3, w4);

    // 2nd Floor Jungle Gym Frame above the Ball Pit
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.3 });
    for (let px of [-5.2, 5.2]) {
      for (let pz of [-5.2, 5.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6.5, 10), pillarMat);
        post.position.set(cx + px, 3.25, cz + pz);
        this.scene.add(post);
      }
    }

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 0.35, 10.8),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.65 })
    );
    deck.position.set(cx, 4.6, cz);
    this.scene.add(deck);

    // Ramp up to Jungle Gym 2F
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.3, 7.5),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5 })
    );
    ramp.position.set(cx - 6.2, 2.3, cz);
    ramp.rotation.x = -0.58;
    this.scene.add(ramp);

    // Colorful Physics-Reactive Balls inside the Ball Pit
    const ballColors = [0x00f5d4, 0xff2a85, 0xfbbf24, 0x38bdf8, 0xa855f7, 0x4ade80];
    const ballGeo = new THREE.SphereGeometry(0.36, 10, 10);
    for (let i = 0; i < 110; i++) {
      const bMat = new THREE.MeshStandardMaterial({
        color: ballColors[i % ballColors.length],
        roughness: 0.25
      });
      const ball = new THREE.Mesh(ballGeo, bMat);
      const bx = cx + (Math.random() - 0.5) * 10.2;
      const bz = cz + (Math.random() - 0.5) * 10.2;
      ball.position.set(bx, 0.38 + (i % 2) * 0.28, bz);
      ball.userData = {
        vx: 0,
        vz: 0,
        vy: 0,
        minX: cx - 5.2,
        maxX: cx + 5.2,
        minZ: cz - 5.2,
        maxZ: cz + 5.2
      };
      this.scene.add(ball);
      this.ballPitBalls.push(ball);
    }
  }

  // 3. DYNAMIC MEGA SLIDE & ADVENTURE TOWER (★★★☆☆ 중급)
  initDynamicSlideAndTower() {
    // Left Adventure Tower at (-15, 0, -15)
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 8), towerMat);
    platform.position.set(-15, 7.0, -15);
    platform.castShadow = true;
    this.scene.add(platform);

    // Tower support columns
    const colMat = new THREE.MeshStandardMaterial({ color: 0x00f5d4, roughness: 0.4 });
    [[-19, -18.5], [-11, -18.5], [-19, -11.5], [-11, -11.5]].forEach(([x, z]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 7.2, 12), colMat);
      col.position.set(x, 3.6, z);
      col.castShadow = true;
      this.scene.add(col);
    });

    // Easy Stair/Ramp up to the Slide & Skywalk Platform (from x=-9, z=-13 up to x=-13, y=7, z=-13)
    for (let s = 0; s < 14; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.35, 1.1),
        new THREE.MeshStandardMaterial({ color: s % 2 === 0 ? 0x38bdf8 : 0xfbbf24 })
      );
      step.position.set(-9.5 - s * 0.35, 0.4 + s * 0.5, -13);
      this.scene.add(step);
    }

    // Neon Wave Mega Slide Chute going from (-16, 7.0, -11) down to (-16, 0.4, 1)
    const slideMat = new THREE.MeshStandardMaterial({
      color: 0xff2a85,
      emissive: 0xff2a85,
      emissiveIntensity: 0.22,
      roughness: 0.2
    });
    const slideChute = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 14.5), slideMat);
    slideChute.position.set(-16.2, 3.7, -4.8);
    slideChute.rotation.x = 0.49;
    slideChute.castShadow = true;
    this.scene.add(slideChute);

    // Side rails for the slide
    const railMat = new THREE.MeshStandardMaterial({ color: 0x00f5d4, emissive: 0x00f5d4, emissiveIntensity: 0.4 });
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 14.5), railMat);
    leftRail.position.set(-17.8, 4.0, -4.8);
    leftRail.rotation.x = 0.49;
    const rightRail = leftRail.clone();
    rightRail.position.set(-14.6, 4.0, -4.8);
    this.scene.add(leftRail, rightRail);
  }

  // 4. DYNAMIC SKYWALK BRIDGE (★★★★☆ 어려움)
  initSkyWalkBridge() {
    // Connects Left Tower (-10.5, 7.0, -15) to Right Tower (10.5, 7.0, -15)
    const rightPlatform = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    rightPlatform.position.set(14.5, 7.0, -15);
    this.scene.add(rightPlatform);

    // Right Tower Columns
    const colMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.4 });
    [[11, -18.5], [18, -18.5], [11, -11.5], [18, -11.5]].forEach(([x, z]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 7.2, 12), colMat);
      col.position.set(x, 3.6, z);
      this.scene.add(col);
    });

    // Suspended Swaying Bridge Planks across X = -10 to +10 at Y = 7.0, Z = -15
    for (let i = 0; i < 11; i++) {
      const px = -9.5 + i * 1.9;
      const plankMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xfbbf24 : 0x00f5d4,
        emissive: i % 2 === 0 ? 0xfbbf24 : 0x00f5d4,
        emissiveIntensity: 0.25
      });
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.28, 2.6), plankMat);
      plank.position.set(px, 7.0, -15);
      plank.userData = { baseZ: -15, baseY: 7.0, phase: i * 0.55 };
      this.scene.add(plank);
      this.skyWalkPlanks.push(plank);
    }

    // Safety Airbag Mat below Skywalk
    const safetyMat = new THREE.Mesh(
      new THREE.BoxGeometry(21, 0.5, 5.5),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.6 })
    );
    safetyMat.position.set(0, 0.25, -15);
    this.scene.add(safetyMat);
  }

  // 5. DYNAMIC CLIMBING WALL & SANSA GOLDEN BELL SUMMIT (★★★★★ 매우 어려움)
  initClimbingAndSummitTemple() {
    // Center Mega Climbing Tower at (0, 0..14.5, -22)
    const wallGeo = new THREE.BoxGeometry(7.5, 14.5, 1.2);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.6 });
    const climbWall = new THREE.Mesh(wallGeo, wallMat);
    climbWall.position.set(0, 7.25, -22);
    climbWall.castShadow = true;
    this.scene.add(climbWall);

    // Glowing Climbing Holds (클라이밍 홀드)
    const holdColors = [0x00f5d4, 0xff2a85, 0xfbbf24, 0x4ade80, 0x38bdf8];
    const holdGeo = new THREE.BoxGeometry(0.48, 0.32, 0.35);
    for (let row = 0; row < 18; row++) {
      for (let col = -2; col <= 2; col++) {
        if ((row + col) % 2 !== 0) continue;
        const holdMat = new THREE.MeshStandardMaterial({
          color: holdColors[(row + Math.abs(col)) % holdColors.length],
          emissive: holdColors[(row + Math.abs(col)) % holdColors.length],
          emissiveIntensity: 0.55
        });
        const hold = new THREE.Mesh(holdGeo, holdMat);
        hold.position.set(col * 1.25, 1.2 + row * 0.72, -21.3);
        this.scene.add(hold);
      }
    }

    // Summit Mountain Temple Pavilion (산사 구름 누각 & 황금 범종) at Y = 14.5
    const summitDeck = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 0.6, 6.5),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 })
    );
    summitDeck.position.set(0, 14.5, -22);
    this.scene.add(summitDeck);

    // Traditional Pavilion Pillars & Giwa Roof (전통 기와 지붕)
    const redWood = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });
    [[-3.8, -24.2], [3.8, -24.2], [-3.8, -19.8], [3.8, -19.8]].forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.2, 10), redWood);
      p.position.set(x, 16.8, z);
      this.scene.add(p);
    });

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 2.6, 4), roofMat);
    roof.position.set(0, 20.1, -22);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);

    // Golden Temple Bell (황금 산사 범종) inside the Summit Pavilion
    const bellMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.15
    });
    this.summitBell = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.05, 1.9, 18), bellMat);
    this.summitBell.position.set(0, 17.0, -22);
    this.scene.add(this.summitBell);
  }

  // 6. DYNAMIC FLYING ZIPLINE & BULLSEYE DROP TARGET (★★★★★★ 최고난도)
  initZiplineAndDropTarget() {
    // Zipline Cable from Summit (0, 16.5, -20) to Front-Right Drop Zone (8, 9.5, 16)
    this.zipStart = new THREE.Vector3(0, 15.8, -19.5);
    this.zipEnd = new THREE.Vector3(0, 9.0, 4.0);

    const points = [this.zipStart, this.zipEnd];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00f5d4, linewidth: 3 });
    const cable = new THREE.Line(lineGeo, lineMat);
    this.scene.add(cable);

    // Zipline Trolley Handle
    this.ziplineTrolley = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.45, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.4 })
    );
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    bar.position.y = -0.7;
    this.ziplineTrolley.add(body, bar);
    this.ziplineTrolley.position.copy(this.zipStart);
    this.scene.add(this.ziplineTrolley);

    // Bullseye Dynamic Drop Target Mat at (0, 0.1, 2.0)
    const rings = [
      { r: 4.5, col: 0x0284c7 },
      { r: 3.2, col: 0xff2a85 },
      { r: 1.9, col: 0xfbbf24 },
      { r: 0.85, col: 0x00f5d4 }
    ];
    rings.forEach((ring, idx) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(ring.r, ring.r, 0.35 + idx * 0.04, 32),
        new THREE.MeshStandardMaterial({
          color: ring.col,
          emissive: ring.col,
          emissiveIntensity: 0.22,
          roughness: 0.4
        })
      );
      m.position.set(0, 0.18, 2.0);
      this.scene.add(m);
    });
  }

  // 7. BONFIRE HEALING ZONE (불멍 캠프파이어 & 산사 힐링존)
  initBonfireHealingZone() {
    const cx = 0;
    const cz = 15;

    // Stone Fire Pit Ring
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), stoneMat);
      rock.position.set(cx + Math.cos(ang) * 1.6, 0.3, cz + Math.sin(ang) * 1.6);
      this.scene.add(rock);
    }

    // Firewood Logs
    const logMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.4, 8), logMat);
      log.position.set(cx, 0.35, cz);
      log.rotation.z = Math.PI / 2.3;
      log.rotation.y = (i * Math.PI) / 4;
      this.scene.add(log);
    }

    // Wooden Seating Benches around the Bonfire
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 0.8), benchMat);
      bench.position.set(cx + Math.cos(ang) * 3.8, 0.25, cz + Math.sin(ang) * 3.8);
      bench.rotation.y = -ang + Math.PI / 2;
      this.scene.add(bench);
    }

    // Glowing 3D Fire & Rising Embers ("불멍" 감성!)
    for (let i = 0; i < 28; i++) {
      const emberMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff5500 : 0xfbbf24,
        transparent: true,
        opacity: 0.88
      });
      const size = 0.18 + Math.random() * 0.32;
      const ember = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), emberMat);
      ember.position.set(
        cx + (Math.random() - 0.5) * 1.2,
        0.5 + Math.random() * 2.5,
        cz + (Math.random() - 0.5) * 1.2
      );
      ember.userData = {
        baseX: cx,
        baseZ: cz,
        speedY: 1.2 + Math.random() * 1.8,
        offset: Math.random() * Math.PI * 2
      };
      this.scene.add(ember);
      this.fireParticles.push(ember);
    }
  }

  // X-TAG BOXES (태그 팔찌로 터치하는 미션 포인트!)
  initTagBoxes() {
    const specs = [
      // Trampoline Zone Tags (Difficulty 1-2)
      { id: 'tramp_1', name: '트램펄린 점프 태그', pos: [-18, 3.2, 8], pts: 30, diff: 1, color: 0x00f5d4 },
      { id: 'tramp_2', name: '트램펄린 슈퍼점프 링', pos: [-18, 6.2, 8], pts: 60, diff: 2, color: 0x38bdf8 },
      { id: 'tramp_3', name: '사이드 바운스 태그', pos: [-22, 2.8, 12], pts: 35, diff: 1, color: 0x00f5d4 },

      // Ball Pit & Jungle Gym Tags (Difficulty 2)
      { id: 'ball_1', name: '볼풀 보물 태그박스', pos: [18, 1.5, 8], pts: 45, diff: 2, color: 0xff2a85 },
      { id: 'jungle_2f', name: '정글짐 2층 비밀 태그', pos: [18, 5.8, 8], pts: 75, diff: 3, color: 0xa855f7 },

      // Mega Slide Tags (Difficulty 3)
      { id: 'slide_top', name: '다이내믹 슬라이드 출발 태그', pos: [-16.2, 8.2, -12.5], pts: 80, diff: 3, color: 0xff2a85 },
      { id: 'slide_mid', name: '슬라이드 스피드 링', pos: [-16.2, 4.3, -4.8], pts: 90, diff: 3, color: 0xfbbf24 },

      // Skywalk Tags (Difficulty 4 - High risk, high score!)
      { id: 'sky_mid', name: '공중 출렁다리 중앙 태그', pos: [0, 8.3, -15], pts: 150, diff: 4, color: 0xfbbf24 },
      { id: 'sky_end', name: '스카이워크 완주 태그', pos: [14.5, 8.3, -15], pts: 180, diff: 4, color: 0xff2a85 },

      // Climbing & Summit Bell (Difficulty 5)
      { id: 'climb_top', name: '산사(山寺) 정상 황금범종 태그', pos: [0, 16.0, -21], pts: 250, diff: 5, color: 0xfbbf24 },

      // Flying Zipline & Bullseye Drop (Difficulty 6)
      { id: 'zip_drop', name: '다이내믹 드롭 과녁 중앙 태그', pos: [0, 1.6, 2.0], pts: 120, diff: 4, color: 0x00f5d4 },

      // Bonfire Healing Tag
      { id: 'bonfire_tag', name: '산사 불멍 힐링 에너지 태그', pos: [0, 2.2, 15], pts: 40, diff: 1, color: 0xff7b00 }
    ];

    specs.forEach((sp) => {
      const group = new THREE.Group();
      group.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);

      const boxMat = new THREE.MeshStandardMaterial({
        color: sp.color,
        emissive: sp.color,
        emissiveIntensity: 0.65,
        metalness: 0.4,
        roughness: 0.2
      });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 1.05), boxMat);
      group.add(cube);

      // Outer glowing wireframe ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.07, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      group.add(ring);

      group.userData = {
        ...sp,
        cooldown: 0,
        cube,
        ring,
        baseY: sp.pos[1]
      };

      this.scene.add(group);
      this.tagBoxes.push(group);
    });
  }

  initGuideArrow() {
    // Glowing 3D Pointer above player showing direction to next high-value X-Tag Box
    const arrowGroup = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.75, 12),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    );
    cone.rotation.x = Math.PI / 2;
    arrowGroup.add(cone);
    this.guideArrow = arrowGroup;
    this.scene.add(this.guideArrow);
  }

  // Create Expressive 3D Kid Avatar with Glowing X-Tag Wristband!
  createKidAvatar(options = {}) {
    const {
      shirtColor = 0x38bdf8,
      hatType = 'cap', // 'cap', 'crown', 'satgat', 'wings'
      bandColor = 0x00f5d4,
      isMe = false
    } = options;

    const root = new THREE.Group();

    // Shadow blob
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.5 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.4 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    // Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.95, 12), shirtMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    root.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 16), skinMat);
    head.position.y = 1.95;
    head.castShadow = true;
    root.add(head);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeMat);
    leftEye.position.set(-0.16, 2.0, 0.41);
    const rightEye = leftEye.clone();
    rightEye.position.set(0.16, 2.0, 0.41);
    root.add(leftEye, rightEye);

    // Legs
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.65, 10), pantsMat);
    leftLeg.position.set(-0.18, 0.35, 0);
    const rightLeg = leftLeg.clone();
    rightLeg.position.set(0.18, 0.35, 0);
    root.add(leftLeg, rightLeg);

    // Arms
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.65, 10), skinMat);
    leftArm.position.set(-0.52, 1.15, 0);
    const rightArm = leftArm.clone();
    rightArm.position.set(0.52, 1.15, 0);
    root.add(leftArm, rightArm);

    // Glowing X-Tag Wristband on Right Arm!
    const wristBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.055, 8, 16),
      new THREE.MeshBasicMaterial({ color: bandColor })
    );
    wristBand.rotation.x = Math.PI / 2;
    wristBand.position.set(0, -0.22, 0);
    rightArm.add(wristBand);

    // Accessory / Hat Group
    const accessoryGroup = new THREE.Group();
    root.add(accessoryGroup);

    const applyAccessory = (type) => {
      while (accessoryGroup.children.length) {
        accessoryGroup.remove(accessoryGroup.children[0]);
      }
      if (type === 'crown') {
        const crown = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.3, 0.32, 8),
          new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.5, metalness: 0.8 })
        );
        crown.position.y = 2.45;
        accessoryGroup.add(crown);
      } else if (type === 'satgat') {
        // Traditional Korean Mountain Hat (산사 삿갓)
        const satgat = new THREE.Mesh(
          new THREE.ConeGeometry(0.85, 0.45, 12),
          new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
        );
        satgat.position.y = 2.45;
        accessoryGroup.add(satgat);
      } else if (type === 'wings') {
        const wingMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const wL = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), wingMat);
        wL.position.set(-0.5, 1.35, -0.35);
        wL.rotation.y = 0.4;
        const wR = wL.clone();
        wR.position.set(0.5, 1.35, -0.35);
        wR.rotation.y = -0.4;
        accessoryGroup.add(wL, wR);
      } else {
        // Cute Sport Cap
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.47, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: isMe ? 0xff2a85 : shirtColor })
        );
        cap.position.y = 2.02;
        accessoryGroup.add(cap);
      }
    };

    applyAccessory(hatType);

    // Player Ground Ring for "Me"
    if (isMe) {
      const meRing = new THREE.Mesh(
        new THREE.RingGeometry(0.65, 0.85, 24),
        new THREE.MeshBasicMaterial({ color: 0x00f5d4, side: THREE.DoubleSide })
      );
      meRing.rotation.x = -Math.PI / 2;
      meRing.position.y = 0.04;
      root.add(meRing);
    }

    root.userData = {
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      wristBand,
      torso,
      head,
      applyAccessory
    };

    return root;
  }

  spawnCelebrationBurst(pos, color = 0xfbbf24) {
    for (let i = 0; i < 26; i++) {
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

  cycleTheme() {
    const modes = ['hybrid', 'sansa', 'arcade'];
    const nextIdx = (modes.indexOf(this.themeMode) + 1) % modes.length;
    this.themeMode = modes[nextIdx];

    if (this.themeMode === 'sansa') {
      // Serene Sunset / Mountain Temple Forest Vibe
      this.scene.background.setHex(0x13221c);
      this.scene.fog.color.setHex(0x13221c);
      this.ambientLight.color.setHex(0xfde68a);
      this.dirLight.color.setHex(0xffedd5);
      this.dirLight.intensity = 1.35;
      this.sansaGroup.visible = true;
    } else if (this.themeMode === 'arcade') {
      // Cyber Neon Indoor Arcade-X Vibe
      this.scene.background.setHex(0x060814);
      this.scene.fog.color.setHex(0x060814);
      this.ambientLight.color.setHex(0x93c5fd);
      this.dirLight.color.setHex(0x38bdf8);
      this.dirLight.intensity = 0.9;
      this.sansaGroup.visible = true;
    } else {
      // Hybrid Realistic + Sansa
      this.scene.background.setHex(0x0b1021);
      this.scene.fog.color.setHex(0x0b1021);
      this.ambientLight.color.setHex(0xdbeafe);
      this.dirLight.color.setHex(0xfff7ed);
      this.dirLight.intensity = 1.15;
      this.sansaGroup.visible = true;
    }
    return this.themeMode;
  }

  updateWorldElements(dt, elapsed, playerPos) {
    // 1. Animate Skywalk Swaying Planks
    this.skyWalkPlanks.forEach((plank) => {
      plank.position.z = plank.userData.baseZ + Math.sin(elapsed * 2.1 + plank.userData.phase) * 0.75;
    });

    // 2. Animate Tag Boxes & Cooldowns
    let nearestBox = null;
    let nearestDist = Infinity;

    this.tagBoxes.forEach((box) => {
      box.userData.cube.rotation.y += dt * 1.8;
      box.userData.cube.rotation.x += dt * 1.1;
      box.userData.ring.rotation.z -= dt * 2.2;
      box.position.y = box.userData.baseY + Math.sin(elapsed * 3 + box.position.x) * 0.22;

      if (box.userData.cooldown > 0) {
        box.userData.cooldown = Math.max(0, box.userData.cooldown - dt);
        box.visible = Math.floor(elapsed * 10) % 2 === 0;
        box.scale.setScalar(0.55);
      } else {
        box.visible = true;
        box.scale.setScalar(1.0);
        const dist = playerPos.distanceTo(box.position);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestBox = box;
        }
      }
    });

    // Update Guide Arrow above player pointing to nearest active X-Tag Box
    if (this.guideArrow && nearestBox) {
      this.guideArrow.position.set(playerPos.x, playerPos.y + 3.0, playerPos.z);
      this.guideArrow.lookAt(nearestBox.position.x, playerPos.y + 3.0, nearestBox.position.z);
    }

    // 3. Ball Pit Physics (scatter when player walks/jumps through!)
    this.ballPitBalls.forEach((ball) => {
      const dx = ball.position.x - playerPos.x;
      const dz = ball.position.z - playerPos.z;
      const dy = Math.abs(ball.position.y - playerPos.y);
      const distSq = dx * dx + dz * dz;
      if (distSq < 2.2 && dy < 1.8) {
        const dist = Math.sqrt(distSq) || 0.1;
        ball.userData.vx += (dx / dist) * 9 * dt;
        ball.userData.vz += (dz / dist) * 9 * dt;
        ball.userData.vy = 2.5;
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

      // Clamp inside pool
      ball.position.x = Math.max(ball.userData.minX, Math.min(ball.userData.maxX, ball.position.x));
      ball.position.z = Math.max(ball.userData.minZ, Math.min(ball.userData.maxZ, ball.position.z));
    });

    // 4. Bonfire Rising Embers ("불멍" 파티클)
    this.fireParticles.forEach((ember) => {
      ember.position.y += ember.userData.speedY * dt;
      ember.position.x = ember.userData.baseX + Math.sin(elapsed * 4 + ember.userData.offset) * 0.55;
      ember.rotation.y += dt * 3;
      if (ember.position.y > 3.6) {
        ember.position.y = 0.45;
      }
    });
    this.bonfireLight.intensity = 2.0 + Math.sin(elapsed * 11) * 0.35;

    // 5. Floating Sansa Lanterns
    this.floatingLanterns.forEach((l) => {
      l.position.y = l.userData.baseY + Math.sin(elapsed * 1.4 + l.userData.phase) * 0.45;
    });

    // 6. Confetti Celebration Particles
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
