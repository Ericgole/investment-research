/**
 * Service Worker — 投研体系 v2.0 移动端 PWA
 * 提供离线缓存 + 更新通知 + 后台同步
 */
var CACHE_NAME = 'investment-research-v2.0-' + new Date().toISOString().slice(0,10);
var CACHE_URLS = [
  '/',
  'mobile.html',
  'index.html',
  'taa-deviation-workflow.html',
  'css/dashboard.css',
  'js/core.js',
  'js/data-access.js',
  'data/kpi.json',
  'data/saa.json',
  'data/taa.json',
  'data/alert_rules.json',
  'manifest.json'
];

// Install: 预缓存核心文件
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] 预缓存 ' + CACHE_URLS.length + ' 个文件');
      return cache.addAll(CACHE_URLS.map(function(url) {
        return new Request(url, { mode: 'no-cors' });
      })).catch(function(err) {
        console.warn('[SW] 部分预缓存失败 (跨域CDN忽略):', err.message);
      });
    })
  );
  self.skipWaiting();
});

// Activate: 清理旧缓存
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { console.log('[SW] 删除旧缓存:', k); return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch: 缓存优先 (Cache-First) 策略
self.addEventListener('fetch', function(event) {
  // 跳过非 GET 请求和 CDN 资源
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.hostname.includes('cdn.jsdelivr.net')) return; // ECharts CDN 走网络
  
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // 后台更新缓存
        fetch(event.request).then(function(response) {
          if (response.ok) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, response);
            });
          }
        }).catch(function() {});
        return cached;
      }
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        // 离线回退: 返回 mobile.html
        if (event.request.headers.get('Accept').includes('text/html')) {
          return caches.match('mobile.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Push Notification
self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : {};
  var title = data.title || '投研预警';
  var options = {
    body: data.body || '有新预警通知',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || 'mobile.html' },
    actions: [
      { action: 'open', title: '查看详情' },
      { action: 'close', title: '关闭' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.includes('mobile.html') && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(event.notification.data.url || 'mobile.html');
      })
    );
  }
});
