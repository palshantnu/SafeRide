const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = "uploads/banners/";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const deleteImageFile = (filename) => {
    if (!filename) return;
    const p = path.join(UPLOAD_DIR, filename);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); }
    catch (e) { console.log("app banner image delete error:", e.message); }
};

const SELECT_FIELDS = `id, title, image, link_url, position, status, created_at, updated_at`;

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC
// ═══════════════════════════════════════════════════════════════════════════════

// GET /app-banners — active banners for the app home slider
exports.getAppBanners = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ${SELECT_FIELDS} FROM app_banners
             WHERE status = 1
             ORDER BY position IS NULL, position ASC, id DESC`
        );
        return res.json({
            status: true,
            message: "Banners fetched successfully",
            total: rows.length,
            data: rows
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/app-banners — all banners (active + inactive)
exports.adminGetAllAppBanners = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ${SELECT_FIELDS} FROM app_banners
             ORDER BY position IS NULL, position ASC, id DESC`
        );
        return res.json({
            status: true,
            message: "Banners fetched successfully",
            total: rows.length,
            data: rows
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// POST /admin/app-banners — create (multipart: fields + image)
exports.createAppBanner = async (req, res) => {
    try {
        const { title, link_url } = req.body || {};
        const image = req.file ? req.file.filename : null;

        if (!image) {
            return res.status(400).json({ status: false, message: "Banner image is required" });
        }

        const position = req.body?.position !== undefined && req.body.position !== ""
            ? Number(req.body.position)
            : null;
        const status = req.body?.status !== undefined ? Number(req.body.status) : 1;

        const [result] = await db.query(
            `INSERT INTO app_banners (title, image, link_url, position, status)
             VALUES (?, ?, ?, ?, ?)`,
            [title?.trim() || null, image, link_url?.trim() || null, position, status]
        );

        const [[row]] = await db.query(`SELECT ${SELECT_FIELDS} FROM app_banners WHERE id = ?`, [result.insertId]);

        return res.status(201).json({ status: true, message: "Banner created successfully", data: row });
    } catch (err) {
        if (req.file) deleteImageFile(req.file.filename);
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// PUT /admin/app-banners/:id — update (multipart: fields + optional new image)
exports.updateAppBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, link_url } = req.body || {};

        const [[existing]] = await db.query(`SELECT * FROM app_banners WHERE id = ?`, [id]);
        if (!existing) {
            if (req.file) deleteImageFile(req.file.filename);
            return res.status(404).json({ status: false, message: "Banner not found" });
        }

        const setParts  = [];
        const setValues = [];

        if (title    !== undefined) { setParts.push(`title = ?`);    setValues.push(title?.trim() || null); }
        if (link_url !== undefined) { setParts.push(`link_url = ?`); setValues.push(link_url?.trim() || null); }

        if (req.body?.position !== undefined) {
            setParts.push(`position = ?`);
            setValues.push(req.body.position === "" ? null : Number(req.body.position));
        }

        if (req.body?.status !== undefined) { setParts.push(`status = ?`); setValues.push(Number(req.body.status)); }

        if (req.file) { setParts.push(`image = ?`); setValues.push(req.file.filename); }

        if (setParts.length === 0) {
            return res.status(400).json({ status: false, message: "No fields to update" });
        }

        setValues.push(id);
        await db.query(`UPDATE app_banners SET ${setParts.join(", ")} WHERE id = ?`, setValues);

        if (req.file && existing.image) deleteImageFile(existing.image);

        const [[row]] = await db.query(`SELECT ${SELECT_FIELDS} FROM app_banners WHERE id = ?`, [id]);

        return res.json({ status: true, message: "Banner updated successfully", data: row });
    } catch (err) {
        if (req.file) deleteImageFile(req.file.filename);
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// PATCH /admin/app-banners/:id/status
exports.toggleAppBannerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        if (status === undefined || ![0, 1].includes(Number(status))) {
            return res.status(400).json({ status: false, message: "status must be 0 or 1" });
        }

        const [[existing]] = await db.query(`SELECT id FROM app_banners WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Banner not found" });

        await db.query(`UPDATE app_banners SET status = ? WHERE id = ?`, [Number(status), id]);
        return res.json({
            status: true,
            message: `Banner ${Number(status) === 1 ? "activated" : "deactivated"} successfully`
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// DELETE /admin/app-banners/:id
exports.deleteAppBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const [[existing]] = await db.query(`SELECT id, image FROM app_banners WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Banner not found" });

        await db.query(`DELETE FROM app_banners WHERE id = ?`, [id]);
        deleteImageFile(existing.image);

        return res.json({ status: true, message: "Banner deleted successfully" });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};
