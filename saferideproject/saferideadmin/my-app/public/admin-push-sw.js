/* Sigiride admin panel — push notification service worker.
 *
 * The backend sends a data-only web push for every admin notification
 * (backend/backendapi/services/adminNotification.js → pushToAdmins). This worker runs
 * even when the admin panel tab, or the whole browser on a phone, is closed, and turns
 * that push into a system notification. Tapping it opens the matching admin page.
 */

// Which admin page each notification type opens (mirrors TYPE_ROUTE in Navbar.tsx).
const TYPE_ROUTE = {
  new_user: '/UserList',
  new_captain: '/Driverlist',
  booking_new: '/bookinghistory',
  booking_cancel: '/bookinghistory',
  booking_rejection: '/bookinghistory',
  ba: '/Bussinessassociatelist',
  ba_kyc_pending: '/Bussinessassociatelist',
  ba_kyc_approved: '/Bussinessassociatelist',
  ba_kyc_rejected: '/Bussinessassociatelist',
  driver_kyc_pending: '/Driverlist',
  driver_kyc_verified: '/Driverlist',
  driver_kyc_rejected: '/Driverlist',
  withdrawal_request: '/withdrawal-requests',
};

const targetUrl = (data) => {
  const route = TYPE_ROUTE[data.type] || '/';
  // KYC notifications open that person's documents directly
  return data.kyc_id ? `${route}?kyc=${data.kyc_id}` : route;
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    const payload = event.data ? event.data.json() : {};
    data = payload.data || payload.notification || {};
  } catch (e) { /* not JSON — show a generic notification below */ }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // let any open admin tab refresh its list (and play its own chime)
    windows.forEach((client) => client.postMessage({ source: 'admin-push', data }));

    // an admin tab is open and in front → the in-page bell + chime is enough
    if (windows.some((client) => client.visibilityState === 'visible')) return;

    await self.registration.showNotification(data.title || 'Sigiride Admin', {
      body: data.body || 'You have a new notification',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: `admin-${data.id || Date.now()}`,
      data: { url: targetUrl(data) },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(url);
      return;
    }
    await self.clients.openWindow(url);
  })());
});
