const db = require("../config/db");
const { getAdminNotifications, saveAdminPushToken, removeAdminPushToken } = require("../services/adminNotification");

// Admin notifications must only reach admin-panel logins. verifyToken also accepts app
// tokens, so rule those out: a driver token carries role "driver", a BA token carries
// `mobile` (the admin panel's own login token is just { id }), and an app user is a
// `users` row with role "user" and no staff role.
const isAdminPanelUser = async (req) => {
  if (!req.user?.id || req.user.role === 'driver' || 'mobile' in req.user) return false;
  const [[user]] = await db.query(`SELECT role, role_id FROM users WHERE id = ?`, [req.user.id]);
  if (!user) return false;
  return !!user.role_id || (!!user.role && String(user.role).toLowerCase() !== 'user');
};

exports.getAdminNotifications = async (req, res) => {
  try {
    const rows = await getAdminNotifications(100);
    return res.json({
      status: true,
      message: "Admin notifications fetched successfully",
      total: rows.length,
      data: rows.map(row => ({
        ...row,
        payload: row.payload
          ? (typeof row.payload === 'string'
              ? JSON.parse(row.payload)
              : row.payload)
          : null,
      })),
    });
  } catch (error) {
    console.error("getAdminNotifications error:", error.message);
    return res.status(500).json({ status: false, message: "Server error", error: error.message });
  }
};

// POST /admin/push-token  { token }  — an admin's browser enabled push notifications
exports.registerPushToken = async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ status: false, message: "token is required" });
    if (!(await isAdminPanelUser(req))) {
      return res.status(403).json({ status: false, message: "Only admin panel users can enable these notifications" });
    }
    await saveAdminPushToken(token, req.user.id);
    return res.json({ status: true, message: "Push notifications enabled on this device" });
  } catch (error) {
    console.error("registerPushToken error:", error.message);
    return res.status(500).json({ status: false, message: "Server error", error: error.message });
  }
};

// DELETE /admin/push-token  { token }  — admin logged out on that browser
exports.removePushToken = async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ status: false, message: "token is required" });
    await removeAdminPushToken(token);
    return res.json({ status: true, message: "Push notifications disabled on this device" });
  } catch (error) {
    console.error("removePushToken error:", error.message);
    return res.status(500).json({ status: false, message: "Server error", error: error.message });
  }
};
