/* ══════════════════════════════════════════════════════════
   TOP MUSIQUE NIGER — Service Worker v1.0
   Stratégie multi-cache + file d'attente hors-ligne
   ──────────────────────────────────────────────────────────
   CACHES :
   ┌─────────────────┬───────────────────────────────────────┐
   │ tmn-static-v1   │ Pages HTML + app.js + tmn-api.js      │
   │ tmn-cdn-v1      │ Google Fonts + Font Awesome (CDN)     │
   │ tmn-api-v1      │ Réponses GET de l'API (5 min TTL)     │
   │ tmn-audio-v1    │ Fichiers audio importés localement    │
   └─────────────────┴───────────────────────────────────────┘
   STRATÉGIES :
   • Static assets  → Cache-first, réseau en fallback
   • CDN (fonts)    → Stale-while-revalidate
   • API GET        → Network-first, cache en fallback
   • API POST/PATCH → Online seulement + queue si offline
   • Audio blobs    → Cache-first
══════════════════════════════════════════════════════════ */

const STATIC_VER  = 'tmn-static-v2';
const CDN_VER     = 'tmn-cdn-v2';
const API_VER     = 'tmn-api-v2';
const AUDIO_VER   = 'tmn-audio-v2';
const ALL_CACHES  = [STATIC_VER, CDN_VER, API_VER, AUDIO_VER]; // v2 — production

/* ── Pages à pré-cacher au install ── */
const PRECACHE_PAGES = [
  './',
  './index.html',
  './home.html',
  './top.html',
  './player.html',
  './explore.html',
  './login.html',
  './register.html',
  './onboarding.html',
  './search.html',
  './favorites.html',
  './historique.html',
  './playlist.html',
  './notifications.html',
  './settings.html',
  './stats.html',
  './profil-artiste.html',
  './profil-auditeur.html',
  './publish.html',
  './comments.html',
  './admin.html',
  './app.js',
  './tmn-api.js',
  './offline.html',
  './evaluer.html',
  './telechargements.html',
  './favicon.ico',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/apple-touch-icon.png',
];

/* ── TTL cache API (5 minutes) ── */
const API_CACHE_TTL = 5 * 60 * 1000;

/* ── File d'attente pour actions hors-ligne ── */
const QUEUE_KEY = 'tmn_offline_queue';

/* ══════════════════════════════
   INSTALL — Pré-cacher les assets
══════════════════════════════ */
self.addEventListener('install', event => {
  console.log('[SW] Install — pré-cache statique');
  event.waitUntil(
    caches.open(STATIC_VER)
      .then(cache => cache.addAll(PRECACHE_PAGES.map(p =>
        new Request(p, { cache: 'reload' })  // force fetch fresh
      )))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pré-cache partiel:', err))
  );
});

/* ══════════════════════════════
   ACTIVATE — Nettoyer anciens caches
══════════════════════════════ */
self.addEventListener('activate', event => {
  console.log('[SW] Activate — nettoyage des caches obsolètes');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !ALL_CACHES.includes(k))
          .map(k => { console.log('[SW] Suppression cache:', k); return caches.delete(k); })
      ))
      .then(() => self.clients.claim())
  );
});

/* ══════════════════════════════
   FETCH — Routeur principal
══════════════════════════════ */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  /* ── Ignorer les requêtes non-GET qui ne sont pas API ── */
  if (req.method !== 'GET' && !url.pathname.startsWith('/api/')) return;

  /* ── 1. CDN (Google Fonts, Font Awesome) → Stale-while-revalidate ── */
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(_staleWhileRevalidate(req, CDN_VER));
    return;
  }

  /* ── 2. API GET → Network-first avec fallback cache ── */
  if (url.pathname.startsWith('/api/') && req.method === 'GET') {
    event.respondWith(_networkFirstWithTTL(req));
    return;
  }

  /* ── 3. API POST/PATCH/DELETE → Online seulement, queue si offline ── */
  if (url.pathname.startsWith('/api/') && req.method !== 'GET') {
    event.respondWith(_mutationHandler(req));
    return;
  }

  /* ── 4. Audio blob (fichiers MP3 importés) ── */
  if (req.destination === 'audio' || url.pathname.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)) {
    event.respondWith(_cacheFirst(req, AUDIO_VER));
    return;
  }

  /* ── 5. Pages et assets statiques → Cache-first ── */
  event.respondWith(_cacheFirstWithOfflineFallback(req));
});

/* ══════════════════════════════
   BACKGROUND SYNC
══════════════════════════════ */
self.addEventListener('sync', event => {
  if (event.tag === 'tmn-offline-sync') {
    console.log('[SW] Background sync — traitement de la file hors-ligne');
    event.waitUntil(_processOfflineQueue());
  }
});

/* ══════════════════════════════
   MESSAGE — Communication avec les pages
══════════════════════════════ */
self.addEventListener('message', event => {
  const { type, payload } = event.data || {};

  switch (type) {
    /* Page demande les stats de cache */
    case 'GET_CACHE_STATS':
      _getCacheStats().then(stats => {
        event.ports[0]?.postMessage({ type: 'CACHE_STATS', stats });
      });
      break;

    /* Page demande la liste des pages mises en cache */
    case 'GET_CACHED_PAGES':
      _getCachedPages().then(pages => {
        event.ports[0]?.postMessage({ type: 'CACHED_PAGES', pages });
      });
      break;

    /* Page demande le vidage du cache API */
    case 'CLEAR_API_CACHE':
      caches.delete(API_VER).then(() => {
        caches.open(API_VER); // recrée vide
        event.ports[0]?.postMessage({ type: 'API_CACHE_CLEARED' });
      });
      break;

    /* Page force une mise à jour du SW */
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

/* ══════════════════════════════════════════
   STRATÉGIES DE CACHE
══════════════════════════════════════════ */

/* Cache-first — retourne le cache, fetch si absent */
async function _cacheFirst(req, cacheName = STATIC_VER) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch(e) {
    return new Response('Ressource non disponible hors-ligne.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/* Cache-first avec fallback page offline pour les HTML */
async function _cacheFirstWithOfflineFallback(req) {
  const cache  = await caches.open(STATIC_VER);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const fresh = await fetch(req);
    if (fresh.ok && ['document','script','style','font','image'].includes(req.destination)) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch(e) {
    /* Page HTML → page offline */
    if (req.destination === 'document' || req.headers.get('Accept')?.includes('text/html')) {
      const offline = await cache.match('./offline.html');
      return offline || new Response('<h1>Hors-ligne</h1><p>Revenez quand la connexion est rétablie.</p>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return new Response('', { status: 503 });
  }
}

/* Stale-while-revalidate — retourne le cache ET fetch en arrière-plan */
async function _staleWhileRevalidate(req, cacheName = CDN_VER) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req).then(fresh => {
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => null);

  return cached || fetchPromise;
}

/* Network-first avec TTL pour les réponses API GET */
async function _networkFirstWithTTL(req) {
  const cache = await caches.open(API_VER);

  try {
    const fresh = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);

    if (fresh.ok) {
      /* Ajouter un header de timestamp pour le TTL */
      const headers = new Headers(fresh.headers);
      headers.set('X-SW-Cached-At', Date.now().toString());
      const cachedBody = await fresh.clone().arrayBuffer();
      const timestampedResponse = new Response(cachedBody, {
        status: fresh.status,
        statusText: fresh.statusText,
        headers,
      });
      cache.put(req, timestampedResponse);
    }

    return fresh;
  } catch(e) {
    /* Réseau inaccessible — chercher dans le cache */
    const cached = await cache.match(req);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('X-SW-Cached-At') || '0');
      const age = Date.now() - cachedAt;
      const isExpired = age > API_CACHE_TTL;

      /* Toujours retourner le cache même expiré hors-ligne */
      const body = await cached.text();
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': cached.headers.get('Content-Type') || 'application/json',
          'X-SW-From-Cache': 'true',
          'X-SW-Cache-Age': Math.round(age / 1000) + 's',
          'X-SW-Stale': isExpired ? 'true' : 'false',
        }
      });
    }

    /* Aucun cache disponible */
    return new Response(
      JSON.stringify({ error: 'Hors-ligne', offline: true, cached: false }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/* Handler pour mutations (POST/PATCH/DELETE) */
async function _mutationHandler(req) {
  try {
    const fresh = await Promise.race([
      fetch(req.clone()),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    return fresh;
  } catch(e) {
    /* Hors-ligne → mettre en file d'attente */
    await _enqueueAction(req);
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        queued: true,
        message: 'Action enregistrée — sera synchronisée quand la connexion est rétablie'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/* ══════════════════════════════════════════
   FILE D'ATTENTE HORS-LIGNE
══════════════════════════════════════════ */

async function _enqueueAction(req) {
  try {
    const body = await req.text().catch(() => '');
    const queue = await _getQueue();

    queue.push({
      id:        Date.now() + Math.random().toString(36).slice(2),
      url:       req.url,
      method:    req.method,
      headers:   Object.fromEntries(req.headers.entries()),
      body,
      queuedAt:  new Date().toISOString(),
    });

    await _saveQueue(queue);
    console.log('[SW] Action mise en file:', req.method, req.url);

    /* Tenter la sync en arrière-plan si disponible */
    if (self.registration.sync) {
      await self.registration.sync.register('tmn-offline-sync').catch(() => {});
    }
  } catch(e) {
    console.warn('[SW] Impossible de mettre en file:', e);
  }
}

async function _processOfflineQueue() {
  const queue = await _getQueue();
  if (!queue.length) return;

  console.log(`[SW] Traitement de ${queue.length} action(s) hors-ligne`);
  const remaining = [];

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method:  item.method,
        headers: item.headers,
        body:    item.body || undefined,
      });

      if (res.ok) {
        console.log('[SW] ✓ Action synchronisée:', item.method, item.url);
        /* Notifier toutes les pages ouvertes */
        _broadcastToClients({
          type:   'OFFLINE_ACTION_SYNCED',
          action: { url: item.url, method: item.method, id: item.id }
        });
      } else {
        remaining.push(item);
      }
    } catch(e) {
      remaining.push(item); /* Toujours hors-ligne, réessayer plus tard */
    }
  }

  await _saveQueue(remaining);

  if (remaining.length === 0) {
    _broadcastToClients({ type: 'OFFLINE_QUEUE_EMPTY' });
  }
}

async function _getQueue() {
  const clients = await self.clients.matchAll();
  /* Utilise IndexedDB via une page client si disponible, sinon IDB simple */
  return _idbGet(QUEUE_KEY).catch(() => []);
}

async function _saveQueue(queue) {
  return _idbSet(QUEUE_KEY, queue);
}

/* ── Mini IndexedDB wrapper ── */
function _idbGet(key) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tmn-sw-store', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onerror   = () => reject(req.error);
    req.onsuccess = () => {
      const tx  = req.result.transaction('kv', 'readonly');
      const get = tx.objectStore('kv').get(key);
      get.onsuccess = () => resolve(get.result || []);
      get.onerror   = () => reject(get.error);
    };
  });
}

function _idbSet(key, value) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tmn-sw-store', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('kv');
    req.onerror   = () => reject(req.error);
    req.onsuccess = () => {
      const tx  = req.result.transaction('kv', 'readwrite');
      const put = tx.objectStore('kv').put(value, key);
      put.onsuccess = () => resolve();
      put.onerror   = () => reject(put.error);
    };
  });
}

/* ── Diffuser un message à toutes les pages ouvertes ── */
async function _broadcastToClients(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => c.postMessage(msg));
}

/* ══════════════════════════════
   UTILITAIRES
══════════════════════════════ */

async function _getCacheStats() {
  const stats = {};
  for (const name of ALL_CACHES) {
    try {
      const cache = await caches.open(name);
      const keys  = await cache.keys();
      stats[name] = { entries: keys.length };
    } catch(e) {
      stats[name] = { entries: 0 };
    }
  }
  return stats;
}

async function _getCachedPages() {
  const cache = await caches.open(STATIC_VER);
  const keys  = await cache.keys();
  return keys.map(r => new URL(r.url).pathname).filter(p => p.endsWith('.html'));
}
