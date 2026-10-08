/// <reference types="vite/client" />
// Web push for the admin panel: registers this browser with Firebase Cloud Messaging and
// hands the token to the backend, which then pushes every admin notification to it — so
// alerts arrive even when the panel (or the whole browser on a phone) is closed.
// The notification itself is drawn by public/admin-push-sw.js.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { registerAdminPushToken, removeAdminPushToken } from './api';

const env = import.meta.env;
const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID,
};
const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY;
const TOKEN_KEY = 'sr_admin_push_token';

export type PushState = 'enabled' | 'denied' | 'unsupported' | 'not_configured' | 'error';

/** The Firebase web-app values have been filled in (.env). */
export const pushConfigured = () =>
  !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId && VAPID_KEY);

/** This browser can do web push at all (needs HTTPS; on iPhone only once added to the Home Screen). */
export const pushSupported = async () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && (await isSupported().catch(() => false));

let app: FirebaseApp | null = null;
const getApp = () => (app ??= initializeApp(firebaseConfig));

/**
 * Ask for permission if needed (call from a click so browsers show the prompt), then
 * register this browser for admin pushes. Safe to call again — it just refreshes the token.
 */
export async function enableAdminPush(): Promise<PushState> {
  if (!pushConfigured()) return 'not_configured';
  if (!(await pushSupported())) return 'unsupported';
  try {
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== 'granted') return 'denied';

    const registration = await navigator.serviceWorker.register('/admin-push-sw.js');
    await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(getApp()), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return 'error';

    await registerAdminPushToken(token);
    localStorage.setItem(TOKEN_KEY, token);
    return 'enabled';
  } catch (e) {
    console.error('enableAdminPush failed:', e);
    return 'error';
  }
}

/** On logout: stop sending this browser admin notifications. Never throws. */
export async function disableAdminPush(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    if (token) await removeAdminPushToken(token);
    if (pushConfigured() && (await pushSupported())) await deleteToken(getMessaging(getApp()));
  } catch (e) {
    console.error('disableAdminPush failed:', e);
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}
