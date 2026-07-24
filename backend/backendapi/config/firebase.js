// Firebase Admin (modular API — firebase-admin v10+).
// NOTE: the legacy namespaced API (admin.apps / admin.credential / admin.messaging())
// does NOT exist in firebase-admin v13+, so we must use the modular subpaths.
//
// Boot-safe: if the package or the service-account key is missing/invalid we log and
// export messaging = null, so pushes are skipped instead of crashing the app.
let messaging = null;

try {
    const { initializeApp, cert, getApps } = require("firebase-admin/app");
    const { getMessaging } = require("firebase-admin/messaging");

    if (!getApps().length) {
        const serviceAccount = require("../serviceAccountKey.json.json");
        initializeApp({ credential: cert(serviceAccount) });
        console.log(`✅ Firebase Admin initialized (project: ${serviceAccount.project_id})`);
    }

    messaging = getMessaging();
} catch (err) {
    console.error("⚠️  Firebase Admin not initialized — push notifications disabled:", err.message);
    messaging = null;
}

module.exports = { messaging };
