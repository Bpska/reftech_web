/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-003 -- the service worker of the portal: shows the push messages of the notification centre
// (backend PushService, Web Push with aes128gcm) and opens the right page when one is pressed.
// It is registered by src/modules/platform/push.ts when a login switches push on (Notifications > Settings).
// It does not keep pages for offline use.
/* eslint-disable no-restricted-globals */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  // A push without a message (or one that could not be read) still tells the person to look at the bell.
  const title = data.title || 'New notification';
  const options = {
    body: data.body || 'Open RefTech to read it.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.id ? `n${data.id}` : undefined,
    renotify: !!data.id,
    requireInteraction: data.severity === 'CRITICAL',
    data: { link: data.link || '/platform/notifications' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.link) || '/platform/notifications';
  let target;
  try { target = new URL(raw, self.location.origin); } catch (e) { target = new URL('/platform/notifications', self.location.origin); }
  // only pages of this portal are opened
  if (target.origin !== self.location.origin) target = new URL(target.pathname + target.search + target.hash, self.location.origin);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
        if ('navigate' in c) return c.navigate(target.href).then(w => (w || c).focus()).catch(() => c.focus());
        return c.focus();
      }
    }
    return self.clients.openWindow(target.href);
  }));
});
