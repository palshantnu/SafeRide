const db = require("../config/db");

const createAdminNotification = async ({
  type,
  source_table = null,
  source_id = null,
  message = null,
  sub = null,
  payload = null,
  status = 1,
}) => {
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
