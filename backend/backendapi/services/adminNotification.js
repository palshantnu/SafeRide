const db = require("../config/db");

const ensureAdminNotificationsTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id int NOT NULL AUTO_INCREMENT,
      type varchar(64) NOT NULL,
      source_table varchar(64) DEFAULT NULL,
      source_id int DEFAULT NULL,
      message varchar(512) DEFAULT NULL,
      sub varchar(256) DEFAULT NULL,
      payload json DEFAULT NULL,
      status tinyint(1) NOT NULL DEFAULT '1',
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_type (type),
      KEY idx_status (status),
      KEY idx_source (source_table, source_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

// ─── Web push to the admin panel ────────────────────────────────────────────────
// Every browser an admin has enabled notifications on registers an FCM web token here
// (see adminNotificationController.registerPushToken). Each new admin notification is
// then pushed to all of them, so it arrives even when the admin panel tab — or the
// whole browser on a phone — is closed.
let pushTableReady = false;
const ensureAdminPushTokensTable = async () => {
  if (pushTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_push_tokens (
      id int NOT NULL AUTO_INCREMENT,
      admin_id int DEFAULT NULL,
      token varchar(512) NOT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_token (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  pushTableReady = true;
};

const saveAdminPushToken = async (token, admin_id = null) => {
  await ensureAdminPushTokensTable();
  await db.query(
    `INSERT INTO admin_push_tokens (admin_id, token) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE admin_id = VALUES(admin_id), updated_at = CURRENT_TIMESTAMP`,
    [admin_id, token]
  );
};

const removeAdminPushToken = async (token) => {
  await ensureAdminPushTokensTable();
  await db.query(`DELETE FROM admin_push_tokens WHERE token = ?`, [token]);
};

// Notification title shown on the device, by type.
const PUSH_TITLES = {
  new_user: 'New User',
  new_captain: 'New Captain',
  booking_new: 'New Booking',
  booking_cancel: 'Booking Cancelled',
  booking_rejection: 'Booking Rejected',
  ba: 'New Business Associate',
  ba_kyc_pending: 'BA KYC Pending',
  ba_kyc_approved: 'BA KYC Approved',
  ba_kyc_rejected: 'BA KYC Rejected',
  driver_kyc_pending: 'Driver KYC Pending',
  driver_kyc_verified: 'Driver KYC Verified',
  driver_kyc_rejected: 'Driver KYC Rejected',
  withdrawal_request: 'Payment Request',
};

// Tokens FCM reports as gone (browser data cleared, permission revoked…) are dropped.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// Best-effort — never throws, so a push problem can't break whatever created the notification.
const pushToAdmins = async ({ id, type, message, sub, source_id, payload }) => {
  try {
    // required lazily: config/firebase logs loudly when the key is missing
    const { messaging } = require("../config/firebase");
    if (!messaging) return;
    await ensureAdminPushTokensTable();
    const [rows] = await db.query(`SELECT token FROM admin_push_tokens`);
    if (!rows.length) return;

    // Data-only message: the admin panel's service worker builds the notification itself
    // (title/body/click target), so it looks the same whether the tab is open or not.
    const data = {
      id: String(id || ''),
      type: String(type || ''),
      title: PUSH_TITLES[type] || 'Sigiride Admin',
      body: [message, sub].filter(Boolean).join(' — '),
    };
    // KYC notifications: whose documents to open when the notification is tapped
    if (String(type || '').includes('kyc')) {
      const owner = String(type).startsWith('ba_')
        ? payload?.ba_id
        : (payload?.driver_id ?? (type === 'driver_kyc_pending' ? source_id : null));
      if (owner) data.kyc_id = String(owner);
    }
    await Promise.all(rows.map(async ({ token }) => {
      try {
        await messaging.send({ token, data, webpush: { headers: { Urgency: 'high' } } });
      } catch (err) {
        if (DEAD_TOKEN_CODES.has(err.code)) {
          await db.query(`DELETE FROM admin_push_tokens WHERE token = ?`, [token]);
        } else {
          console.error(`admin push error [${err.code || 'unknown'}]:`, err.message);
        }
      }
    }));
  } catch (err) {
    console.error("pushToAdmins error:", err.message);
  }
};

const createAdminNotification = async ({
  type,
  source_table = null,
  source_id = null,
  message = null,
  sub = null,
  payload = null,
  status = 1,
}) => {
  await ensureAdminNotificationsTable();
  const [result] = await db.query(
    `INSERT INTO admin_notifications
       (type, source_table, source_id, message, sub, payload, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      type,
      source_table,
      source_id,
      message || null,
      sub || null,
      payload ? JSON.stringify(payload) : null,
      status,
    ]
  );
  // fire-and-forget: don't make the caller wait on (or fail because of) the push
  pushToAdmins({ id: result.insertId, type, message, sub, source_id, payload });
  return result.insertId;
};

const getAdminNotifications = async (limit = 60) => {
  await ensureAdminNotificationsTable();
  const [rows] = await db.query(
    `SELECT id, type, source_table, source_id, message, sub, payload, created_at
     FROM admin_notifications
     WHERE status = 1
     ORDER BY id DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
};

module.exports = {
  createAdminNotification,
  getAdminNotifications,
  saveAdminPushToken,
  removeAdminPushToken,
};
