/**
 * Push notification diagnostics.
 *
 *   node scripts/checkPush.js                 -> report what's broken
 *   node scripts/checkPush.js <FCM_TOKEN>     -> also send a real test push to that token
 *
 * Run this on the SERVER (where the push is failing).
 */
require("dotenv").config();

const line = (s) => console.log(s);

(async () => {
    line("──────────────────────────────────────────────");
    line("  PUSH NOTIFICATION DIAGNOSTICS");
    line("──────────────────────────────────────────────\n");

    // ── 1. is firebase-admin installed? ───────────────────────────────
    let firebaseInstalled = false;
    try {
        require.resolve("firebase-admin");
        firebaseInstalled = true;
        line("1. firebase-admin package .......... ✅ installed");
    } catch {
        line("1. firebase-admin package .......... ❌ NOT INSTALLED");
        line("   FIX: npm install firebase-admin\n");
    }

    // ── 2. did Firebase Admin initialize (valid service-account key)? ──
    const { messaging } = require("../config/firebase");
    const initialized = !!messaging;
    if (initialized) {
        line("2. Firebase Admin init ............. ✅ initialized");
    } else {
        line("2. Firebase Admin init ............. ❌ NOT INITIALIZED");
        line("   -> every push is silently skipped ('Push skipped — Firebase not initialized')");
        if (firebaseInstalled) {
            line("   Cause is the service-account key. Check serviceAccountKey.json.json:");
            line("     - file exists at project root");
            line("     - is valid JSON with project_id / private_key / client_email");
        }
        line("");
    }

    // ── 3. does anyone actually have an fcm_token? ────────────────────
    const db = require("../config/db");
    const counts = {};
    for (const table of ["users", "drivers", "business_associates"]) {
        try {
            const [[row]] = await db.query(
                `SELECT COUNT(*) AS total,
                        SUM(fcm_token IS NOT NULL AND fcm_token <> '') AS with_token
                 FROM ${table}`
            );
            counts[table] = row;
            const ok = Number(row.with_token) > 0 ? "✅" : "⚠️ ";
            line(`3. ${table.padEnd(20)} ${ok} ${row.with_token || 0} of ${row.total} have an fcm_token`);
        } catch (err) {
            line(`3. ${table.padEnd(20)} ❌ ${err.message}`);
            if (/Unknown column/i.test(err.message)) {
                line(`   FIX: ALTER TABLE ${table} ADD COLUMN fcm_token VARCHAR(2000) DEFAULT NULL;`);
            }
        }
    }
    line("");

    // ── 4. optional: send a real test push ────────────────────────────
    const token = process.argv[2];
    if (token) {
        line("4. Sending a test push to the supplied token...");
        const sendPush = require("../services/notification");
        const res = await sendPush(token, "Test push", "If you can see this, push works ✅", { type: "TEST" });
        line(res ? `   ✅ SENT — message id: ${res}` : "   ❌ NOT SENT — see the error logged above");
    } else {
        line("4. Test push ....................... skipped");
        line("   To really send one:  node scripts/checkPush.js <FCM_TOKEN_FROM_A_DEVICE>");
    }

    line("\n──────────────────────────────────────────────");
    line("  VERDICT");
    line("──────────────────────────────────────────────");
    if (!firebaseInstalled) {
        line("Push is OFF: firebase-admin is not installed.  ->  npm install firebase-admin && pm2 restart backend");
    } else if (!initialized) {
        line("Push is OFF: Firebase Admin failed to initialize (service-account key problem).");
    } else if (!Object.values(counts).some(c => Number(c?.with_token) > 0)) {
        line("Firebase is fine, but NOBODY has an fcm_token saved — so there is no one to push to.");
        line("The app must send fcm_token on login (verify-otp).");
    } else {
        line("Firebase is initialized and tokens exist. If a push still doesn't arrive,");
        line("run with a real device token (step 4) to see the exact FCM error.");
    }
    line("");

    process.exit(0);
})();
