const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { notifyAudience } = require("../services/notification");

const UPLOAD_DIR = "uploads/notification/";
const VALID_AUDIENCE = ["user", "captain", "both"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fileUrl = (req, filename) => {
    if (!filename) return null;
    const host = req.get("host") || "";
    // honour proxy's forwarded proto; for any non-local host default to https
    const fwd = (req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|192\.168\.)/.test(host);
    const scheme = fwd || (isLocal ? req.protocol : "https");
    return `${scheme}://${host}/${UPLOAD_DIR}${filename}`;
};

const mapNotification = (req, row) => ({
    id         : row.id,
    title      : row.title,
    message    : row.message,
    image      : row.image,
    image_url  : fileUrl(req, row.image),
    audience   : row.audience,
    status     : row.status,
    created_at : row.created_at,
    updated_at : row.updated_at
});

const deleteImageFile = (filename) => {
    if (!filename) return;
    const p = path.join(UPLOAD_DIR, filename);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); }
    catch (e) { console.log("notification image delete error:", e.message); }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC
// ═══════════════════════════════════════════════════════════════════════════════

// GET /notifications/:audience  — active notifications for 'user' or 'captain' (includes 'both')
exports.getNotificationsByAudience = async (req, res) => {
    try {
        const audience = String(req.params.audience || "").toLowerCase();

        if (!["user", "captain"].includes(audience)) {
            return res.status(400).json({ status: false, message: "audience must be 'user' or 'captain'" });
        }

        const [rows] = await db.query(
            `SELECT id, title, message, image, audience, status, created_at, updated_at
             FROM notification_messages
             WHERE status = 1 AND audience IN (?, 'both')
             ORDER BY id DESC`,
            [audience]
        );

        return res.json({
            status: true,
            message: "Notifications fetched successfully",
            audience,
            total: rows.length,
            data: rows.map(r => mapNotification(req, r))
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/notifications  — all notifications (active + inactive)
exports.adminGetAllNotifications = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, title, message, image, audience, status, created_at, updated_at
             FROM notification_messages ORDER BY id DESC`
        );
        return res.json({
            status: true,
            message: "Notifications fetched successfully",
            total: rows.length,
            data: rows.map(r => mapNotification(req, r))
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// GET /admin/notifications/:id
exports.getNotificationById = async (req, res) => {
    try {
        const { id } = req.params;
        const [[row]] = await db.query(
            `SELECT id, title, message, image, audience, status, created_at, updated_at
             FROM notification_messages WHERE id = ?`,
            [id]
        );
        if (!row) return res.status(404).json({ status: false, message: "Notification not found" });
        return res.json({ status: true, message: "Notification fetched successfully", data: mapNotification(req, row) });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// POST /admin/notifications  — create (multipart: fields + optional image)
exports.createNotification = async (req, res) => {
    try {
        const { title, message } = req.body || {};
        const audience = String(req.body?.audience || "both").toLowerCase();
        const image = req.file ? req.file.filename : null;

        if (!VALID_AUDIENCE.includes(audience)) {
            if (req.file) deleteImageFile(req.file.filename);
            return res.status(400).json({ status: false, message: "audience must be 'user', 'captain' or 'both'" });
        }

        // a notification needs at least an image or some text
        if (!image && !title?.trim() && !message?.trim()) {
            return res.status(400).json({ status: false, message: "Provide an image, title or message" });
        }

        const [result] = await db.query(
            `INSERT INTO notification_messages (title, message, image, audience, status)
             VALUES (?, ?, ?, ?, ?)`,
            [
                title || null,
                message || null,
                image,
                audience,
                req.body?.status !== undefined ? Number(req.body.status) : 1
            ]
        );

        const [[row]] = await db.query(
            `SELECT id, title, message, image, audience, status, created_at, updated_at
             FROM notification_messages WHERE id = ?`,
            [result.insertId]
        );

        // only an active notification is actually pushed out
        let sent_count = 0;
        if (Number(row.status) === 1) {
            sent_count = await notifyAudience(
                row.audience,
                row.title || "Notification",
                row.message || "",
                { type: "ADMIN_NOTIFICATION", notification_id: row.id, image: fileUrl(req, row.image) || "" }
            );
        }

        return res.status(201).json({
            status: true,
            message: `Notification created successfully. Push sent to ${sent_count} device(s).`,
            sent_count,
            data: mapNotification(req, row)
        });
    } catch (err) {
        if (req.file) deleteImageFile(req.file.filename);
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// POST /admin/notifications/:id/send  — (re)send an existing notification as a push
exports.sendNotificationPush = async (req, res) => {
    try {
        const { id } = req.params;

        const [[row]] = await db.query(
            `SELECT id, title, message, image, audience, status FROM notification_messages WHERE id = ?`,
            [id]
        );
        if (!row) return res.status(404).json({ status: false, message: "Notification not found" });

        const sent_count = await notifyAudience(
            row.audience,
            row.title || "Notification",
            row.message || "",
            { type: "ADMIN_NOTIFICATION", notification_id: row.id, image: fileUrl(req, row.image) || "" }
        );

        return res.json({
            status: true,
            message: `Push sent to ${sent_count} device(s)`,
            audience: row.audience,
            sent_count
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// PUT /admin/notifications/:id  — update (multipart: fields + optional new image)
exports.updateNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, message } = req.body || {};

        const [[existing]] = await db.query(`SELECT * FROM notification_messages WHERE id = ?`, [id]);
        if (!existing) {
            if (req.file) deleteImageFile(req.file.filename);
            return res.status(404).json({ status: false, message: "Notification not found" });
        }

        const setParts  = [];
        const setValues = [];

        if (title   !== undefined) { setParts.push(`title = ?`);   setValues.push(title || null); }
        if (message !== undefined) { setParts.push(`message = ?`); setValues.push(message || null); }

        if (req.body?.audience !== undefined) {
            const audience = String(req.body.audience).toLowerCase();
            if (!VALID_AUDIENCE.includes(audience)) {
                if (req.file) deleteImageFile(req.file.filename);
                return res.status(400).json({ status: false, message: "audience must be 'user', 'captain' or 'both'" });
            }
            setParts.push(`audience = ?`); setValues.push(audience);
        }

        if (req.body?.status !== undefined) { setParts.push(`status = ?`); setValues.push(Number(req.body.status)); }

        if (req.file) { setParts.push(`image = ?`); setValues.push(req.file.filename); }

        if (setParts.length === 0) {
            return res.status(400).json({ status: false, message: "No fields to update" });
        }

        setValues.push(id);
        await db.query(`UPDATE notification_messages SET ${setParts.join(", ")} WHERE id = ?`, setValues);

        if (req.file && existing.image) deleteImageFile(existing.image);

        const [[row]] = await db.query(
            `SELECT id, title, message, image, audience, status, created_at, updated_at
             FROM notification_messages WHERE id = ?`,
            [id]
        );

        return res.json({ status: true, message: "Notification updated successfully", data: mapNotification(req, row) });
    } catch (err) {
        if (req.file) deleteImageFile(req.file.filename);
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// PATCH /admin/notifications/:id/status
exports.toggleNotificationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        if (status === undefined || ![0, 1].includes(Number(status))) {
            return res.status(400).json({ status: false, message: "status must be 0 or 1" });
        }

        const [[existing]] = await db.query(`SELECT id FROM notification_messages WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Notification not found" });

        await db.query(`UPDATE notification_messages SET status = ? WHERE id = ?`, [Number(status), id]);
        return res.json({
            status: true,
            message: `Notification ${Number(status) === 1 ? "activated" : "deactivated"} successfully`
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// DELETE /admin/notifications/:id
exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const [[existing]] = await db.query(`SELECT id, image FROM notification_messages WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Notification not found" });

        await db.query(`DELETE FROM notification_messages WHERE id = ?`, [id]);
        deleteImageFile(existing.image);

        return res.json({ status: true, message: "Notification deleted successfully" });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};
