/* ════════════════════════════════════════════════════
   tmn-api.js — Pont Frontend ↔ Backend
   TOP Musique Niger v1.1

   Stratégie :
   1. Tente l'API réelle (auto-détectée ou configurée)
   2. Si indisponible → données mock (mode démo)
   3. Toast automatique quand en mode démo

   Configuration :
   - localStorage.setItem('TMN_API_URL', 'https://your-api.up.railway.app/api')
   - Ou variable window.TMN_API_URL avant le chargement du script

   Usage : inclure après app.js sur chaque page
     <script src="app.js"></script>
     <script src="tmn-api.js"></script>
════════════════════════════════════════════════════ */
const TMNAPI = (function () {

  /* ── CONFIG AUTO-DÉTECTION ── */
  // Priorité : window.TMN_API_URL > localStorage > même domaine > localhost
  const _detectBase = () => {
    if (window.TMN_API_URL)                          return window.TMN_API_URL;
    const stored = localStorage.getItem('TMN_API_URL');
    if (stored)                                      return stored;
    // Si le frontend tourne sur le même serveur que l'API (Railway full-stack)
    const loc = window.location;
    if (loc.hostname !== 'localhost' && loc.hostname !== '127.0.0.1') {
      return `${loc.protocol}//${loc.hostname}/api`;
    }
    return 'http://localhost:3000/api';
  };

  const BASE      = _detectBase();
  const TIMEOUT   = 6000; // ms avant de basculer en mock
  let   _offline  = false;
  let   _toastShown = false;

  /* ── REQUÊTE AVEC TIMEOUT ── */
  async function _fetch(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token   = localStorage.getItem('tmn_token');
    if (token && !token.startsWith('tmn_') + '_' === false) {
      // Token réel (pas le token local simulé)
      headers['Authorization'] = `Bearer ${token}`;
    }
    const config = { method, headers };
    if (body instanceof FormData) { delete headers['Content-Type']; config.body = body; }
    else if (body)                 config.body = JSON.stringify(body);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    config.signal = controller.signal;

    try {
      const res  = await fetch(`${BASE}${path}`, config);
      clearTimeout(timer);
      _offline = false;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'Erreur API'), { status: res.status });
      return { ok: true, data };
    } catch (err) {
      clearTimeout(timer);
      _offline = true;
      if (!_toastShown) { _showOfflineToast(); _toastShown = true; }
      return { ok: false, error: err.message };
    }
  }

  function _showOfflineToast() {
    const t = document.getElementById('toast');
    if (t) {
      document.getElementById('toastMsg').textContent = '📴 Mode démo — backend non connecté';
      t.className = 'show warn';
      // Pas de timeout, on garde visible
    } else {
      // Toast minimal si pas d'élément #toast
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e1e26;border:1px solid rgba(201,168,76,.4);color:#c9a84c;padding:.6rem 1.2rem;border-radius:100px;font-size:.8rem;z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.5);';
      div.textContent = '📴 Mode démo – backend non connecté';
      document.body.appendChild(div);
    }
  }

  function isOffline() { return _offline; }

  /* ════════════════════════════════════════════════
     AUTH
  ════════════════════════════════════════════════ */
  const auth = {

    async register(payload) {
      const r = await _fetch('POST', '/auth/register', payload);
      if (r.ok) {
        // Sauvegarde du vrai token JWT
        localStorage.setItem('tmn_token', r.data.token);
        localStorage.setItem('tmn_user',  JSON.stringify(r.data.user));
        return r.data;
      }
      // Fallback : crée le compte localement (démo)
      const user = { ...payload, id: 'local_' + Date.now(), onboarded: true, createdAt: Date.now() };
      TMN.login(user);
      return { user, token: localStorage.getItem('tmn_token'), _demo: true };
    },

    async login(payload) {
      const r = await _fetch('POST', '/auth/login', payload);
      if (r.ok) {
        localStorage.setItem('tmn_token', r.data.token);
        localStorage.setItem('tmn_user',  JSON.stringify(r.data.user));
        return r.data;
      }
      // Fallback démo
      const saved = TMN.getUser();
      if (saved && saved.email === payload.email) {
        return { user: saved, token: localStorage.getItem('tmn_token'), _demo: true };
      }
      // Compte démo par rôle
      const role = payload.email.includes('artiste') || payload.email.includes('artist') ? 'artist' : 'listener';
      const user = { id: 'demo_' + role, name: payload.email.split('@')[0], email: payload.email, role, musicType: role === 'artist' ? 'artist' : '', onboarded: true };
      TMN.login(user);
      return { user, token: localStorage.getItem('tmn_token'), _demo: true };
    },

    async me() {
      const r = await _fetch('GET', '/auth/me');
      if (r.ok) {
        localStorage.setItem('tmn_user', JSON.stringify(r.data.user));
        return r.data.user;
      }
      return TMN.getUser();
    },

    async updateProfile(payload) {
      const r = await _fetch('PATCH', '/auth/me', payload);
      if (r.ok) { localStorage.setItem('tmn_user', JSON.stringify(r.data.user)); return r.data.user; }
      const user = { ...TMN.getUser(), ...payload };
      localStorage.setItem('tmn_user', JSON.stringify(user));
      return user;
    },
  };

  /* ════════════════════════════════════════════════
     MOCK DATA
  ════════════════════════════════════════════════ */
  const MOCK = {
    songs: [
      { id:'s1', emoji:'🎵', title:'SARAOUNA',     artist_name:'FATOUMATA', genre:'Afrobeat', region:'Niamey', play_count:12400, avg_rating:4.9, rating_count:248, like_count:842, status:'active', artist_verified:1 },
      { id:'s2', emoji:'🎤', title:'ZINDER RISE',  artist_name:'BOUBACAR',  genre:'Rap',      region:'Zinder', play_count:9800,  avg_rating:4.8, rating_count:186, like_count:634, status:'active', artist_verified:1 },
      { id:'s3', emoji:'🎸', title:'NIGHT FLOW',   artist_name:'MAMANE',    genre:'Rap',      region:'Maradi', play_count:8300,  avg_rating:4.7, rating_count:152, like_count:512, status:'active', artist_verified:0 },
      { id:'s4', emoji:'🥁', title:'AGADEZ SOUL',  artist_name:'RABIATOU',  genre:'Gospel',   region:'Agadez', play_count:7100,  avg_rating:4.8, rating_count:134, like_count:421, status:'active', artist_verified:1 },
      { id:'s5', emoji:'🎹', title:'MARADI VIBES', artist_name:'IBRAHIM',   genre:'Afrobeat', region:'Maradi', play_count:6800,  avg_rating:4.6, rating_count:121, like_count:398, status:'active', artist_verified:0 },
      { id:'s6', emoji:'🎶', title:'DOSSO BEAT',   artist_name:'AICHA',     genre:'R&B',      region:'Dosso',  play_count:5400,  avg_rating:4.5, rating_count:98,  like_count:287, status:'active', artist_verified:0 },
      { id:'s7', emoji:'🪘', title:'TAHOUA FAYA',  artist_name:'MOUSSA',    genre:'Mandé',    region:'Tahoua', play_count:4200,  avg_rating:4.7, rating_count:87,  like_count:256, status:'active', artist_verified:0 },
      { id:'s8', emoji:'🎻', title:'HAOUSSA LOVE', artist_name:'RAMATOU',   genre:'Haoussa',  region:'Zinder', play_count:3800,  avg_rating:4.4, rating_count:72,  like_count:198, status:'active', artist_verified:0 },
      { id:'s9', emoji:'🔥', title:'NIAMEY NUIT',  artist_name:'FATOUMATA', genre:'R&B',      region:'Niamey', play_count:3200,  avg_rating:4.6, rating_count:68,  like_count:178, status:'active', artist_verified:1 },
      { id:'s10',emoji:'✨', title:'DIFFA DREAM',  artist_name:'IBRAHIM',   genre:'Zouk',     region:'Diffa',  play_count:2900,  avg_rating:4.3, rating_count:54,  like_count:142, status:'active', artist_verified:0 },
    ],
    artistStats: {
      summary: { totalPlays:12400, weekPlays:2840, dayPlays:412, totalSongs:4, activeSongs:3, totalFavs:842, followers:4820, avg_rating:4.87 },
      charts: {
        dailyPlays: [
          {day:'2026-02-21',plays:380},{day:'2026-02-22',plays:420},{day:'2026-02-23',plays:510},
          {day:'2026-02-24',plays:390},{day:'2026-02-25',plays:480},{day:'2026-02-26',plays:445},{day:'2026-02-27',plays:412},
        ],
        genreBreakdown: [{genre:'Afrobeat',plays:8200},{genre:'R&B',plays:3200},{genre:'Gospel',plays:1000}],
        regionBreakdown: [{region:'Niamey',plays:5400},{region:'Zinder',plays:3200},{region:'Agadez',plays:2100},{region:'Maradi',plays:1700}],
      },
      topSongs: [
        { id:'s1',title:'SARAOUNA',emoji:'🎵',genre:'Afrobeat',play_count:12400,avg_rating:4.9,rating_count:248,like_count:842,status:'active'},
        { id:'s9',title:'NIAMEY NUIT',emoji:'🔥',genre:'R&B',play_count:3200,avg_rating:4.6,rating_count:68,like_count:178,status:'active'},
      ],
    },
    notifications: [
      { id:'n1', type:'top',     title:'🏆 Top 10 !',         body:'SARAOUNA est #1 cette semaine.', is_read:0, created_at: Date.now()/1000 - 3600,   action_url:'top.html' },
      { id:'n2', type:'rating',  title:'⭐ Nouvel avis 5★',   body:'Aminatou a noté votre morceau.', is_read:0, created_at: Date.now()/1000 - 7200,   action_url:'comments.html' },
      { id:'n3', type:'social',  title:'❤️ 100 abonnés !',   body:'Félicitations pour ce cap !',     is_read:0, created_at: Date.now()/1000 - 86400,  action_url:'profil-artiste.html' },
      { id:'n4', type:'release', title:'🎵 Nouveau morceau',  body:'BOUBACAR a sorti ZINDER RISE.',   is_read:1, created_at: Date.now()/1000 - 172800, action_url:'player.html' },
      { id:'n5', type:'system',  title:'🔧 Maintenance',      body:'Maintenance ce dimanche à 2h.',   is_read:1, created_at: Date.now()/1000 - 259200, action_url:null },
    ],
    rankings: [],
    platform: {
      kpis: {
        users:  { total:1248, artists:186, listeners:1058, new_today:12, new_week:78 },
        songs:  { total:892, pending:14, rejected:8, published_week:24 },
        plays:  { total:284000, today:4200, this_week:28400, this_month:98000 },
        top_song:   { title:'SARAOUNA',   artist:'FATOUMATA', play_count:12400, avg_rating:4.9 },
        top_artist: { name:'FATOUMATA',   total_plays:15600, songs:4 },
      },
      daily_activity: [
        {day:'2026-02-21',plays:3800},{day:'2026-02-22',plays:4200},{day:'2026-02-23',plays:5100},
        {day:'2026-02-24',plays:3900},{day:'2026-02-25',plays:4800},{day:'2026-02-26',plays:4450},{day:'2026-02-27',plays:4200},
      ],
      genre_stats:  [{genre:'Afrobeat',songs:142,plays:98000},{genre:'Rap',songs:118,plays:84000},{genre:'Gospel',songs:96,plays:62000}],
      region_stats: [{region:'Niamey',songs:320,plays:120000},{region:'Zinder',songs:188,plays:74000},{region:'Maradi',songs:152,plays:58000}],
    },
  };

  // Génère les rankings mock depuis les songs
  MOCK.rankings = MOCK.songs.map((s, i) => ({
    position: i + 1,
    prev_pos: i + 2 + Math.floor(Math.random() * 3) - 1,
    ...s,
    score: 1000 - i * 85,
  }));

  /* ════════════════════════════════════════════════
     SONGS
  ════════════════════════════════════════════════ */
  const songs = {
    async list(params = {}) {
      const r = await _fetch('GET', '/songs?' + new URLSearchParams(params));
      if (r.ok) return r.data;
      const data = [...MOCK.songs];
      if (params.genre)  return { data: data.filter(s => s.genre  === params.genre),  meta: {} };
      if (params.region) return { data: data.filter(s => s.region === params.region), meta: {} };
      if (params.search) { const q = params.search.toLowerCase(); return { data: data.filter(s => s.title.toLowerCase().includes(q) || s.artist_name.toLowerCase().includes(q)), meta: {} }; }
      return { data: data.slice(0, params.limit || 20), meta: { total: data.length } };
    },

    async get(id) {
      const r = await _fetch('GET', `/songs/${id}`);
      if (r.ok) return r.data.song;
      return MOCK.songs.find(s => s.id === id) || MOCK.songs[0];
    },

    async create(formData) {
      const r = await _fetch('POST', '/songs', formData);
      if (r.ok) return r.data;
      // Mock: simule la publication
      return { song: { id: 'new_' + Date.now(), title: formData.get?.('title') || 'Nouveau morceau', status: 'pending', _demo: true } };
    },

    async play(id, duration = 0) {
      const r = await _fetch('POST', `/songs/${id}/play`, { duration });
      // Pas de fallback nécessaire pour les écoutes
      return r.ok;
    },

    async rate(id, score) {
      const r = await _fetch('POST', `/songs/${id}/rate`, { score });
      if (r.ok) return r.data;
      // Mock local
      const s = MOCK.songs.find(s => s.id === id);
      if (s) { s.avg_rating = ((s.avg_rating * s.rating_count + score) / (s.rating_count + 1)); s.rating_count++; }
      return { avg_rating: s?.avg_rating || score, rating_count: s?.rating_count || 1, _demo: true };
    },

    async toggleFavorite(id) {
      const r = await _fetch('POST', `/songs/${id}/favorite`);
      if (r.ok) return r.data;
      // Toggle local
      const favs = JSON.parse(localStorage.getItem('tmn_favorites') || '[]');
      const idx  = favs.indexOf(id);
      if (idx > -1) { favs.splice(idx, 1); localStorage.setItem('tmn_favorites', JSON.stringify(favs)); return { favorited: false, _demo: true }; }
      favs.push(id);   localStorage.setItem('tmn_favorites', JSON.stringify(favs)); return { favorited: true, _demo: true };
    },

    isFavorited(id) {
      const favs = JSON.parse(localStorage.getItem('tmn_favorites') || '[]');
      return favs.includes(id);
    },

    async comments(id, params = {}) {
      const r = await _fetch('GET', `/songs/${id}/comments?` + new URLSearchParams(params));
      if (r.ok) return r.data;
      return { data: [], meta: { total: 0 } };
    },

    async addComment(id, body, parent_id = null) {
      const r = await _fetch('POST', `/songs/${id}/comments`, { body, parent_id });
      if (r.ok) return r.data.comment;
      const u = TMN.getUser();
      return { id: 'local_' + Date.now(), body, user_id: u?.id, name: u?.name || 'Moi', role: u?.role, like_count: 0, fire_count: 0, clap_count: 0, created_at: Math.floor(Date.now()/1000), _demo: true };
    },
  };

  /* ════════════════════════════════════════════════
     TOP
  ════════════════════════════════════════════════ */
  const top = {
    async weekly(week) {
      const r = await _fetch('GET', '/top' + (week ? `?week=${week}` : ''));
      if (r.ok) return r.data;
      return { data: MOCK.rankings, week: 'mock', source: 'demo' };
    },

    async byGenre() {
      const r = await _fetch('GET', '/top/genres');
      if (r.ok) return r.data;
      const g = {};
      ['Afrobeat','Rap','Gospel','R&B','Zouk','Mandé','Haoussa'].forEach(genre => {
        g[genre] = MOCK.songs.filter(s => s.genre === genre);
      });
      return { data: g };
    },

    async byRegion() {
      const r = await _fetch('GET', '/top/regions');
      if (r.ok) return r.data;
      const r2 = {};
      ['Niamey','Zinder','Maradi','Agadez','Tahoua','Dosso','Tillabéri','Diffa'].forEach(region => {
        r2[region] = MOCK.songs.filter(s => s.region === region);
      });
      return { data: r2 };
    },
  };

  /* ════════════════════════════════════════════════
     STATS
  ════════════════════════════════════════════════ */
  const stats = {
    async artist(id) {
      const r = await _fetch('GET', `/stats/artist/${id}`);
      if (r.ok) return r.data;
      return MOCK.artistStats;
    },

    async platform() {
      const r = await _fetch('GET', '/stats/platform');
      if (r.ok) return r.data;
      return MOCK.platform;
    },

    async history(params = {}) {
      const r = await _fetch('GET', '/stats/history?' + new URLSearchParams(params));
      if (r.ok) return r.data;
      // Génère un historique mock
      const data = MOCK.songs.slice(0, 10).map((s, i) => ({
        song_id: s.id, title: s.title, emoji: s.emoji, genre: s.genre,
        artist_name: s.artist_name, played_at: Math.floor(Date.now()/1000) - i * 3600, duration: 180,
      }));
      return { data, meta: { total: data.length } };
    },
  };

  /* ════════════════════════════════════════════════
     USERS
  ════════════════════════════════════════════════ */
  const users = {
    async get(id) {
      const r = await _fetch('GET', `/users/${id}`);
      if (r.ok) return r.data.user;
      const u = TMN.getUser();
      return { ...u, songs: 4, total_plays: 15600, avg_rating: 4.87, followers: 4820, is_following: false };
    },

    async songs(id, params = {}) {
      const r = await _fetch('GET', `/users/${id}/songs?` + new URLSearchParams(params));
      if (r.ok) return r.data;
      const myId = TMN.getUser()?.id;
      const data = id === myId ? MOCK.songs.slice(0, 4) : MOCK.songs.slice(0, 3);
      return { data, meta: { total: data.length } };
    },

    async follow(id) {
      const r = await _fetch('POST', `/users/${id}/follow`);
      if (r.ok) return r.data;
      return { following: true, _demo: true };
    },

    async favorites(id, params = {}) {
      const r = await _fetch('GET', `/users/${id}/favorites?` + new URLSearchParams(params));
      if (r.ok) return r.data;
      // Combine les favoris locaux avec les songs mock
      const localFavs = JSON.parse(localStorage.getItem('tmn_favorites') || '[]');
      const data = MOCK.songs.filter(s => localFavs.includes(s.id) || Math.random() > 0.4).slice(0, 8);
      return { data, meta: { total: data.length } };
    },

    async playlists(id) {
      const r = await _fetch('GET', `/users/${id}/playlists`);
      if (r.ok) return r.data;
      return { data: [
        { id:'p1', name:'Mes favoris Afro', song_count: 12, is_public: 1, cover_url: null },
        { id:'p2', name:'Soirée Niamey',    song_count: 8,  is_public: 0, cover_url: null },
      ]};
    },
  };

  /* ════════════════════════════════════════════════
     NOTIFICATIONS
  ════════════════════════════════════════════════ */
  const notifications = {
    async list(params = {}) {
      const r = await _fetch('GET', '/notifications?' + new URLSearchParams(params));
      if (r.ok) return r.data;
      const data = MOCK.notifications.filter(n => params.unread === 'true' ? !n.is_read : true);
      return { data, meta: { total: data.length, unread_count: MOCK.notifications.filter(n => !n.is_read).length } };
    },

    async count() {
      const r = await _fetch('GET', '/notifications/count');
      if (r.ok) return r.data.unread_count;
      return MOCK.notifications.filter(n => !n.is_read).length;
    },

    async markRead(id) {
      const r = await _fetch('PATCH', `/notifications/${id}/read`);
      if (!r.ok) { const n = MOCK.notifications.find(n => n.id === id); if (n) n.is_read = 1; }
      return true;
    },

    async markAllRead() {
      const r = await _fetch('PATCH', '/notifications/read-all');
      if (!r.ok) MOCK.notifications.forEach(n => n.is_read = 1);
      return true;
    },

    async delete(id) {
      await _fetch('DELETE', `/notifications/${id}`);
      return true;
    },
  };

  /* ════════════════════════════════════════════════
     PLAYLISTS
  ════════════════════════════════════════════════ */
  const playlists = {
    async list(params = {}) {
      const r = await _fetch('GET', '/playlists?' + new URLSearchParams(params));
      if (r.ok) return r.data;
      return { data: [
        { id:'p1', name:'Top Niger 2024', song_count:20, is_public:1, emoji:'🔥', owner_name:'TMN' },
        { id:'p2', name:'Nuits de Niamey',song_count:15, is_public:1, emoji:'🌙', owner_name:'Moussa' },
        { id:'p3', name:'Rap Nigérien',   song_count:18, is_public:1, emoji:'🎤', owner_name:'Aminatou' },
      ]};
    },

    async get(id) {
      const r = await _fetch('GET', `/playlists/${id}`);
      if (r.ok) return r.data;
      return { playlist: { id, name: 'Playlist', song_count: 5 }, songs: MOCK.songs.slice(0, 5) };
    },

    async create(data) {
      const r = await _fetch('POST', '/playlists', data);
      if (r.ok) return r.data.playlist;
      return { id: 'local_' + Date.now(), ...data, song_count: 0, _demo: true };
    },

    async addSong(playlistId, song_id) {
      const r = await _fetch('POST', `/playlists/${playlistId}/songs`, { song_id });
      return r.ok;
    },

    async removeSong(playlistId, song_id) {
      const r = await _fetch('DELETE', `/playlists/${playlistId}/songs/${song_id}`);
      return r.ok;
    },
  };

  /* ════════════════════════════════════════════════
     ADMIN
  ════════════════════════════════════════════════ */
  const admin = {
    async dashboard() {
      const r = await _fetch('GET', '/admin/dashboard');
      if (r.ok) return r.data;
      return MOCK.platform;
    },

    async pending(params = {}) {
      const r = await _fetch('GET', '/admin/songs/pending?' + new URLSearchParams(params));
      if (r.ok) return r.data;
      return { data: MOCK.songs.filter(s => s.status === 'pending').concat([
        { id:'pend1', title:'TEST TRACK', artist_name:'Nouveau Artiste', genre:'Rap', region:'Niamey', status:'pending', created_at: Date.now()/1000 - 7200 },
      ]), meta: { total: 1 } };
    },

    async approve(id) {
      const r = await _fetch('PATCH', `/admin/songs/${id}/approve`);
      return r.ok;
    },

    async reject(id, reason) {
      const r = await _fetch('PATCH', `/admin/songs/${id}/reject`, { reason });
      return r.ok;
    },

    async leaderboard() {
      const r = await _fetch('GET', '/admin/leaderboard');
      if (r.ok) return r.data;
      return { data: [
        { id:'a1', name:'FATOUMATA', song_count:4, total_plays:15600, avg_rating:4.87, followers:4820, is_verified:1 },
        { id:'a2', name:'BOUBACAR',  song_count:3, total_plays:11200, avg_rating:4.73, followers:3210, is_verified:1 },
        { id:'a3', name:'RABIATOU',  song_count:3, total_plays:8900,  avg_rating:4.78, followers:2640, is_verified:1 },
      ]};
    },
  };

  /* ── HELPERS ── */
  function fmt(n) { return n >= 1000 ? (n/1000).toFixed(1) + 'k' : String(n); }
  function timeAgo(ts) {
    const s = Math.floor(Date.now()/1000) - ts;
    if (s < 60)      return 'à l\'instant';
    if (s < 3600)    return Math.floor(s/60)   + ' min';
    if (s < 86400)   return Math.floor(s/3600)  + 'h';
    if (s < 604800)  return Math.floor(s/86400) + 'j';
    return new Date(ts * 1000).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
  }

  return { auth, songs, top, stats, users, notifications, playlists, admin, isOffline, fmt, timeAgo, MOCK };

})();
