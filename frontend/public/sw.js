// Service Worker — 寄生共生线
// 版本号变更会强制清除旧缓存（每次重新部署后需要递增）
const CACHE_NAME = 'parasitic-v2';
const CORE_ASSETS = ['/'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // 清除所有旧版本缓存
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] 清除旧缓存:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // 只处理 http/https 请求，跳过 chrome-extension 等不支持的 scheme
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  // index.html 永远走网络，不走缓存（防止旧 hash 引用问题）
  if (url.endsWith('/') || url.includes('/index.html')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 其他资源：网络优先，失败时回落缓存
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
