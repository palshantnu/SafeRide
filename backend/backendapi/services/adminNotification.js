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
};
