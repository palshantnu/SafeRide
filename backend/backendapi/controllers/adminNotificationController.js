const { getAdminNotifications } = require("../services/adminNotification");

exports.getAdminNotifications = async (req, res) => {
  try {
    const rows = await getAdminNotifications(100);
    return res.json({
      status: true,
      message: "Admin notifications fetched successfully",
      total: rows.length,
      data: rows.map(row => ({
        ...row,
        payload: row.payload ? JSON.parse(row.payload) : null,
      })),
    });
  } catch (error) {
    console.error("getAdminNotifications error:", error.message);
    return res.status(500).json({ status: false, message: "Server error", error: error.message });
  }
};
