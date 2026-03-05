/* ══════════════════════════════════════════
   TOP MUSIQUE NIGER — app.js v2.0
   Auth + Rôles + Navigation dynamique
══════════════════════════════════════════ */
const TMN = (function () {

  const ROUTES = {
    index:              'index.html',
    onboarding:         'onboarding.html',
    login:              'login.html',
    register:           'register.html',
    home:               'home.html',
    artistProfile:      'profil-artiste.html',
    listenerProfile:    'profil-auditeur.html',
    publish:            'publish.html',
    stats:              'stats.html',
    top:                'top.html',
    player:             'player.html',
    settings:           'settings.html',
    notifications:      'notifications.html',
    admin:              'admin.html',
    // Pages principales auditeur
    evaluer:            'evaluer.html',
    telechargements:    'telechargements.html',
    // Pages secondaires (accessibles via Paramètres)
    favorites:          'favorites.html',
    history:            'historique.html',
    explore:            'explore.html',
    player:             'player.html',
    playlist:           'playlist.html',
    search:             'search.html',
    comments:           'comments.html',
  };

  /* ── AUTH ── */
  function getUser()    { try { return JSON.parse(localStorage.getItem('tmn_user')||'null'); } catch(e){ return null; } }
  function getToken()   { return localStorage.getItem('tmn_token'); }
  function isLoggedIn() { return !!(getUser() && getToken()); }
  function isArtist()   { const u=getUser(); return !!(u&&(u.role==='artist'||u.musicType==='artist')); }
  function isListener() { return isLoggedIn() && !isArtist(); }
  function isAdmin()    { const u=getUser(); return !!(u&&u.role==='admin'); }

  function login(userData) {
    const token = 'tmn_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    localStorage.setItem('tmn_user', JSON.stringify(userData));
    localStorage.setItem('tmn_token', token);
    return token;
  }

  function logout() {
    localStorage.removeItem('tmn_token');
    window.location.href = ROUTES.login;
  }

  function requireAuth() {
    if (!isLoggedIn()) { window.location.href = ROUTES.login; return false; }
    return true;
  }

  function profileUrl() {
    return isArtist() ? ROUTES.artistProfile : ROUTES.listenerProfile;
  }

  /* ── NAV PAR RÔLE ── */
  /* ────────────────────────────────────────────────
     NAV AUDITEUR  : Accueil | Top | ⭐ Évaluer | 📥 Téléchargements | Profil
     NAV ARTISTE   : Accueil | Top | ➕ Publier | 📊 Stats | Profil
     Pages secondaires → accessibles depuis Profil > Paramètres
  ─────────────────────────────────────────────── */
  function getNavItems() {
    if (isArtist()) return [
      { icon:'fa-house',      label:'Accueil',   url:ROUTES.home,            key:'home'    },
      { icon:'fa-trophy',     label:'Top',       url:ROUTES.top,             key:'top'     },
      { icon:'fa-plus',       label:'Publier',   url:ROUTES.publish,         key:'publish', center:true },
      { icon:'fa-chart-line', label:'Mes Stats', url:ROUTES.stats,           key:'stats'   },
      { icon:'fa-microphone', label:'Profil',    url:ROUTES.artistProfile,   key:'profile' },
    ];
    // Auditeur
    return [
      { icon:'fa-house',    label:'Accueil',        url:ROUTES.home,             key:'home'     },
      { icon:'fa-trophy',   label:'Top',            url:ROUTES.top,              key:'top'      },
      { icon:'fa-star',     label:'Évaluer',        url:ROUTES.evaluer,          key:'evaluer',  center:true },
      { icon:'fa-download', label:'Téléchargements',url:ROUTES.telechargements,  key:'download' },
      { icon:'fa-user',     label:'Profil',         url:ROUTES.listenerProfile,  key:'profile'  },
    ];
  }

  /* ── PAGE ACTIVE ── */
  function detectActivePage() {
    const p = window.location.pathname.split('/').pop();
    const map = {
      // Commun
      'home.html':            'home',
      'top.html':             'top',
      'player.html':          'home',
      'comments.html':        'home',
      // Artiste
      'publish.html':         'publish',
      'stats.html':           'stats',
      'profil-artiste.html':  'profile',
      // Auditeur
      'evaluer.html':         'evaluer',
      'telechargements.html': 'download',
      'profil-auditeur.html': 'profile',
      // Pages secondaires (dans Paramètres) → highlight Profil
      'notifications.html':   'profile',
      'settings.html':        'profile',
      'favorites.html':       'profile',
      'historique.html':      'profile',
      'playlist.html':        'profile',
      'explore.html':         'profile',
      'search.html':          'profile',
      'admin.html':           'profile',
    };
    return map[p] || 'home';
  }

  /* ── INJECT NAV ── */
  function injectNav(activeKey) {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    const items   = getNavItems();
    const current = activeKey || detectActivePage();
    let notifCount = 0;
    try { notifCount = (JSON.parse(localStorage.getItem('tmn_notifs')||'[]')).filter(n=>!n.read).length; } catch(e){}

    nav.innerHTML = '';
    items.forEach(item => {
      const a = document.createElement('a');
      a.href = item.url;
      a.className = 'nav-item'+(item.key===current?' active':'')+(item.center?' nav-pub':'');
      const pip = (item.key==='profile' && notifCount>0) ? '<div class="nav-pip"></div>' : '';
      if (item.center) {
        a.innerHTML = `<i class="fas ${item.icon}"></i><span>${item.label}</span>`;
      } else {
        a.innerHTML = `<i class="fas ${item.icon}"></i><span>${item.label}</span>${pip}`;
      }
      a.addEventListener('click', e => {
        if (item.url === window.location.pathname.split('/').pop()) e.preventDefault();
      });
      nav.appendChild(a);
    });
  }

  /* ── USER INFO ── */
  function injectUserInfo() {
    const user = getUser(); if (!user) return;
    const initials = (user.name||'U')[0].toUpperCase();
    const roleLbl  = isArtist() ? '🎤 Artiste' : '🎧 Auditeur';
    document.querySelectorAll('[data-tmn-name]').forEach(el => el.textContent = user.name||'Utilisateur');
    document.querySelectorAll('[data-tmn-initials]').forEach(el => el.textContent = initials);
    document.querySelectorAll('[data-tmn-role]').forEach(el => el.textContent = roleLbl);
    document.querySelectorAll('[data-tmn-avatar]').forEach(el => {
      if (user.picture) { el.style.backgroundImage=`url(${user.picture})`; el.style.backgroundSize='cover'; el.textContent=''; }
      else el.textContent = initials;
    });
  }

  /* ── ROLE VISIBILITY ── */
  function applyRoleVisibility() {
    document.querySelectorAll('[data-role="artist"]').forEach(el   => el.style.display = isArtist()   ? '' : 'none');
    document.querySelectorAll('[data-role="listener"]').forEach(el => el.style.display = isListener() ? '' : 'none');
    document.querySelectorAll('[data-role="auth"]').forEach(el     => el.style.display = isLoggedIn() ? '' : 'none');
    document.querySelectorAll('[data-role="guest"]').forEach(el    => el.style.display = isLoggedIn() ? 'none' : '');
    document.querySelectorAll('[data-role="admin"]').forEach(el    => el.style.display = isAdmin()    ? '' : 'none');
  }

  /* ── INIT PAGE ── */
  function init(opts={}) {
    opts = Object.assign({ requireAuth:true, activeNav:null, onReady:null }, opts);
    if (opts.requireAuth && !isLoggedIn()) { window.location.href = ROUTES.login; return; }
    injectNav(opts.activeNav);
    injectUserInfo();
    applyRoleVisibility();
    document.body.classList.add(isArtist() ? 'role-artist' : 'role-listener');
    if (isAdmin()) document.body.classList.add('role-admin');
    if (typeof opts.onReady === 'function') opts.onReady(getUser());
  }

  return { getUser, getToken, isLoggedIn, isArtist, isListener, isAdmin,
           login, logout, requireAuth, profileUrl,
           getNavItems, injectNav, injectUserInfo, applyRoleVisibility, init, ROUTES };
})();

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>TMN.applyRoleVisibility());
else TMN.applyRoleVisibility();

/* ══════════════════════════════════════════════════════
   SERVICE WORKER — Enregistrement + Indicateur hors-ligne
══════════════════════════════════════════════════════ */
(function () {

  /* ── 1. Enregistrement du Service Worker ── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(reg => {
          console.log('[TMN] Service Worker enregistré:', reg.scope);

          /* Vérifier une mise à jour disponible */
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                _showUpdateBanner();
              }
            });
          });
        })
        .catch(err => console.warn('[TMN] SW non supporté:', err));
    });

    /* Écouter les messages du SW */
    navigator.serviceWorker.addEventListener('message', e => {
      const { type, action } = e.data || {};
      if (type === 'OFFLINE_ACTION_SYNCED') {
        _showToast(`✅ Synchronisé : ${_actionLabel(action?.url, action?.method)}`, 'success');
      }
      if (type === 'OFFLINE_QUEUE_EMPTY') {
        _showToast('✅ Toutes les actions hors-ligne synchronisées', 'success');
      }
    });
  }

  /* ── 2. Indicateur connexion flottant ── */
  let _wasOffline = !navigator.onLine;

  function _injectOfflineBar() {
    if (document.getElementById('tmn-offline-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'tmn-offline-bar';
    bar.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:99999',
      'height:3px;background:linear-gradient(90deg,#ef4444,#f97316)',
      'transform:scaleY(0);transform-origin:top',
      'transition:transform .3s ease;pointer-events:none',
    ].join(';');

    const pill = document.createElement('div');
    pill.id = 'tmn-offline-pill';
    pill.style.cssText = [
      'position:fixed;top:env(safe-area-inset-top,0px);left:50%',
      'transform:translateX(-50%) translateY(-60px)',
      'background:#1a1a1a;border:1px solid rgba(239,68,68,.4)',
      'border-radius:100px;padding:.3rem .9rem',
      'font-size:.72rem;font-weight:700;color:#ef4444',
      'z-index:99999;white-space:nowrap',
      'transition:transform .4s cubic-bezier(.34,1.56,.64,1)',
      'display:flex;align-items:center;gap:.4rem',
      'box-shadow:0 4px 20px rgba(0,0,0,.4)',
    ].join(';');
    pill.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#ef4444;animation:tmn-blink 1s ease infinite;"></span> Hors-ligne';

    document.head.insertAdjacentHTML('beforeend', `
      <style>
        @keyframes tmn-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes tmn-slide-down { from{transform:translateX(-50%) translateY(-60px)} to{transform:translateX(-50%) translateY(8px)} }
        @keyframes tmn-slide-up   { from{transform:translateX(-50%) translateY(8px)}  to{transform:translateX(-50%) translateY(-60px)} }
      </style>
    `);

    document.body.appendChild(bar);
    document.body.appendChild(pill);
  }

  function _showOffline() {
    _injectOfflineBar();
    const bar  = document.getElementById('tmn-offline-bar');
    const pill = document.getElementById('tmn-offline-pill');
    if (bar)  bar.style.transform  = 'scaleY(1)';
    if (pill) pill.style.animation = 'tmn-slide-down .4s cubic-bezier(.34,1.56,.64,1) forwards';
  }

  function _showOnline() {
    const bar  = document.getElementById('tmn-offline-bar');
    const pill = document.getElementById('tmn-offline-pill');
    if (bar)  bar.style.transform = 'scaleY(0)';
    if (pill) {
      pill.style.background  = 'rgba(16,185,129,.12)';
      pill.style.borderColor = 'rgba(16,185,129,.4)';
      pill.style.color       = '#10b981';
      pill.innerHTML         = '<span style="width:6px;height:6px;border-radius:50%;background:#10b981;"></span> Connexion rétablie';
      setTimeout(() => {
        if (pill) pill.style.animation = 'tmn-slide-up .35s ease forwards';
        setTimeout(() => { if (pill) pill.remove(); if (bar) bar.remove(); }, 400);
      }, 2000);
    }

    /* Tenter la sync en arrière-plan */
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        if (reg.sync) reg.sync.register('tmn-offline-sync').catch(() => {});
      });
    }
  }

  window.addEventListener('online',  () => {
    if (_wasOffline) { _wasOffline = false; _showOnline(); }
  });
  window.addEventListener('offline', () => {
    _wasOffline = true; _showOffline();
  });

  /* Afficher immédiatement si déjà hors-ligne */
  if (!navigator.onLine) {
    document.addEventListener('DOMContentLoaded', _showOffline);
  }

  /* ── 3. Banner de mise à jour SW ── */
  function _showUpdateBanner() {
    if (document.getElementById('tmn-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'tmn-update-banner';
    banner.style.cssText = [
      'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+72px)',
      'left:1rem;right:1rem;z-index:9999',
      'background:#1a1a2e;border:1px solid rgba(139,92,246,.4)',
      'border-radius:16px;padding:.9rem 1rem',
      'display:flex;align-items:center;gap:.8rem',
      'box-shadow:0 8px 30px rgba(0,0,0,.5)',
      'animation:slideUp .35s cubic-bezier(.34,1.56,.64,1)',
      'font-size:.82rem;color:#c4c0ff',
    ].join(';');
    banner.innerHTML = `
      <span style="font-size:1.2rem;">🆕</span>
      <div style="flex:1;"><strong style="color:#fff;">Mise à jour disponible</strong><br>Rechargez pour profiter de la nouvelle version.</div>
      <button onclick="location.reload()" style="background:rgba(139,92,246,.25);border:1px solid rgba(139,92,246,.4);border-radius:8px;padding:.4rem .8rem;color:#a78bfa;font-size:.78rem;font-weight:700;cursor:pointer;">Recharger</button>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#6b6a80;cursor:pointer;font-size:1rem;padding:.2rem;">✕</button>
    `;
    document.body.appendChild(banner);
  }

  /* ── 4. Helpers ── */
  function _actionLabel(url, method) {
    if (!url) return method;
    const path = new URL(url).pathname;
    if (path.includes('/play'))     return '▶ Écoute enregistrée';
    if (path.includes('/favorite')) return '❤️ Favori synchronisé';
    if (path.includes('/comment'))  return '💬 Commentaire publié';
    if (path.includes('/rate'))     return '⭐ Note envoyée';
    return `${method} ${path.replace('/api/','').split('/')[0]}`;
  }

  function _showToast(msg, type = 'info') {
    /* Utilise le toast natif de la page si disponible */
    if (typeof showToast === 'function') { showToast(msg, type); return; }

    const t = document.createElement('div');
    t.style.cssText = [
      'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+80px)',
      'left:50%;transform:translateX(-50%)',
      'background:#1e1e26;border:1px solid rgba(255,255,255,.12)',
      'border-radius:100px;padding:.5rem 1.1rem',
      'font-size:.82rem;font-weight:600;color:#f0ece4',
      'z-index:9999;white-space:nowrap;pointer-events:none',
      'animation:slideUp .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.4)',
    ].join(';');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

})();
