// Real-Time Multi-Server Manager (Render.com SSE + Co-Op Playmates)
class MetaverseManager {
  constructor(world, onStateChange) {
    this.world = world;
    this.onStateChange = onStateChange;

    const urlParams = new URLSearchParams(window.location.search);
    this.clientId =
      sessionStorage.getItem('ax_clientId') ||
      'kid_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('ax_clientId', this.clientId);

    this.room = urlParams.get('room') || 'arcadex';
    this.instance = Number(urlParams.get('instance') || 0);
    this.region = urlParams.get('region') || 'kr';

    this.sseSource = null;
    this.serverLive = false;
    this.instanceCounts = { 0: 1, 1: 0, 2: 0, 3: 0 };
    this.totalRealOnline = 1;
    this.realUsers = [];
    this.enableCompanions = true;

    // Friendly Kid Playmates (rides together with you & plays around the park!)
    this.companionSpecs = [
      { id: 'comp_minjun', name: '단짝 민준', color: 0xff2a85, hat: 'crown', baseScore: 340, defaultRide: 'trampoline' },
      { id: 'comp_seoyeon', name: '단짝 서연', color: 0x00f5d4, hat: 'wings', baseScore: 420, defaultRide: 'slide' },
      { id: 'comp_doyun', name: '단짝 도윤', color: 0xfbbf24, hat: 'satgat', baseScore: 510, defaultRide: 'climbing' }
    ];

    this.syncUrlParams();
    this.pollRoomsPeriodically();
  }

  syncUrlParams() {
    if (window.location.protocol === 'file:') return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', this.room);
    url.searchParams.set('instance', String(this.instance));
    url.searchParams.set('region', this.region);
    window.history.replaceState({}, '', url.toString());
  }

  connectStream(myProfile) {
    if (window.location.protocol === 'file:') {
      this.serverLive = false;
      this.realUsers = [
        {
          id: this.clientId,
          name: myProfile.name,
          slotIndex: 0,
          ride: myProfile.ride || 'trampoline',
          score: myProfile.score || 120,
          hat: myProfile.hat || 'cap',
          color: '#38bdf8'
        }
      ];
      if (this.onStateChange) this.onStateChange({ type: 'sync' });
      return;
    }

    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }

    this.syncUrlParams();

    const q = new URLSearchParams({
      room: this.room,
      instance: String(this.instance),
      region: this.region,
      clientId: this.clientId,
      name: myProfile.name,
      score: String(myProfile.score || 120),
      hat: myProfile.hat || 'cap',
      color: '#38bdf8'
    });

    try {
      const es = new EventSource(`/api/stream?${q.toString()}`);
      this.sseSource = es;

      es.addEventListener('init', (ev) => {
        this.serverLive = true;
        const data = JSON.parse(ev.data);
        if (data.snapshot) this.applySnapshot(data.snapshot);
      });

      es.addEventListener('sync', (ev) => {
        this.serverLive = true;
        const snapshot = JSON.parse(ev.data);
        this.applySnapshot(snapshot);
      });

      es.addEventListener('serverCounts', (ev) => {
        this.serverLive = true;
        const data = JSON.parse(ev.data);
        if (data.instanceCounts) this.instanceCounts = data.instanceCounts;
        if (typeof data.totalRealOnline === 'number') this.totalRealOnline = data.totalRealOnline;
        if (this.onStateChange) this.onStateChange({ type: 'counts' });
      });

      es.addEventListener('effect', (ev) => {
        const eff = JSON.parse(ev.data);
        if (this.onStateChange) this.onStateChange({ type: 'effect', effect: eff });
      });

      es.onerror = () => {
        this.serverLive = false;
        if (this.onStateChange) this.onStateChange({ type: 'error' });
      };
    } catch (_) {
      this.serverLive = false;
    }
  }

  applySnapshot(snapshot) {
    if (!snapshot) return;
    if (snapshot.instanceCounts) this.instanceCounts = snapshot.instanceCounts;
    if (typeof snapshot.totalOnline === 'number') this.totalRealOnline = snapshot.totalOnline;
    this.realUsers = Array.isArray(snapshot.users) ? snapshot.users : [];
    if (this.onStateChange) this.onStateChange({ type: 'sync', snapshot });
  }

  sendAction(payload) {
    if (window.location.protocol === 'file:') return;
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: this.room,
        instance: this.instance,
        region: this.region,
        clientId: this.clientId,
        ...payload
      })
    }).catch(() => {});
  }

  switchInstance(newInstance, myProfile) {
    this.instance = Number(newInstance) || 0;
    this.connectStream(myProfile);
  }

  pollRoomsPeriodically() {
    setInterval(() => {
      if (window.location.protocol === 'file:') return;
      fetch('/api/rooms')
        .then((r) => r.json())
        .then((data) => {
          if (data && data.ok) {
            this.serverLive = true;
            if (data.instanceCounts) this.instanceCounts = data.instanceCounts;
            if (typeof data.totalRealOnline === 'number') this.totalRealOnline = data.totalRealOnline;
            if (this.onStateChange) this.onStateChange({ type: 'counts' });
          }
        })
        .catch(() => {});
    }, 8000);
  }
}

window.MetaverseManager = MetaverseManager;
