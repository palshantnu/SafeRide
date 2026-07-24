const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = "uploads/landing/";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// build a full, browser-usable URL for a stored image filename
const fileUrl = (req, filename) => {
    if (!filename) return null;
    const host = req.get("host") || "";
    // honour proxy's forwarded proto; for any non-local host default to https
    const fwd = (req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|192\.168\.)/.test(host);
    const scheme = fwd || (isLocal ? req.protocol : "https");
    return `${scheme}://${host}/${UPLOAD_DIR}${filename}`;
};

// content is stored as a JSON string in LONGTEXT — accept object or string on write
const toContentString = (content) => {
    if (content === undefined || content === null || content === "") return null;
    if (typeof content === "string") {
        // validate it is proper JSON; if not, store as a JSON string literal
        try { JSON.parse(content); return content; }
        catch { return JSON.stringify(content); }
    }
    return JSON.stringify(content);
};

// parse stored content back to an object/array for the response
const parseContent = (str) => {
    if (str === null || str === undefined || str === "") return null;
    try { return JSON.parse(str); }
    catch { return str; }
};

// shape a DB row for API output
const mapSection = (req, row) => ({
    id          : row.id,
    section_key : row.section_key,
    title       : row.title,
    subtitle    : row.subtitle,
    content     : parseContent(row.content),
    image       : row.image,
    image_url   : fileUrl(req, row.image),
    sort_order  : row.sort_order,
    status      : row.status,
    created_at  : row.created_at,
    updated_at  : row.updated_at
});

const deleteImageFile = (filename) => {
    if (!filename) return;
    const p = path.join(UPLOAD_DIR, filename);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); }
    catch (e) { console.log("landing image delete error:", e.message); }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC
// ═══════════════════════════════════════════════════════════════════════════════

// GET /landing  — all ACTIVE sections for rendering the landing page
exports.getLandingPage = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, section_key, title, subtitle, content, image, sort_order, status, created_at, updated_at
             FROM landing_sections
             WHERE status = 1
             ORDER BY sort_order ASC, id ASC`
        );

        const sections = rows.map(r => mapSection(req, r));

        // also provide a key->section(s) map for convenience on the frontend
        const byKey = {};
        for (const s of sections) {
            if (byKey[s.section_key] === undefined) byKey[s.section_key] = s;
            else if (Array.isArray(byKey[s.section_key])) byKey[s.section_key].push(s);
            else byKey[s.section_key] = [byKey[s.section_key], s];
        }

        return res.json({
            status: true,
            message: "Landing page fetched successfully",
            total: sections.length,
            data: sections,
            sections: byKey
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/landing  — all sections (active + inactive)
exports.adminGetAllSections = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, section_key, title, subtitle, content, image, sort_order, status, created_at, updated_at
             FROM landing_sections
             ORDER BY sort_order ASC, id ASC`
        );
        return res.json({
            status: true,
            message: "Sections fetched successfully",
            total: rows.length,
            data: rows.map(r => mapSection(req, r))
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// GET /admin/landing/:id
exports.getSectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const [[row]] = await db.query(
            `SELECT id, section_key, title, subtitle, content, image, sort_order, status, created_at, updated_at
             FROM landing_sections WHERE id = ?`,
            [id]
        );
        if (!row) return res.status(404).json({ status: false, message: "Section not found" });
        return res.json({ status: true, message: "Section fetched successfully", data: mapSection(req, row) });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// POST /admin/landing  — create a section (multipart: fields + optional image)
exports.createSection = async (req, res) => {
    try {
        const { section_key, title, subtitle, content, sort_order, status } = req.body || {};

        if (!section_key || !section_key.trim()) {
            if (req.file) deleteImageFile(req.file.filename);
            return res.status(400).json({ status: false, message: "section_key is required" });
        }

        const image = req.file ? req.file.filename : null;

        const [result] = await db.query(
            `INSERT INTO landing_sections (section_key, title, subtitle, content, image, sort_order, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                section_key.trim(),
                title || null,
                subtitle || null,
                toContentString(content),
                image,
                sort_order !== undefined ? Number(sort_order) : 0,
                status !== undefined ? Number(status) : 1
            ]
        );

        const [[row]] = await db.query(
            `SELECT id, section_key, title, subtitle, content, image, sort_order, status, created_at, updated_at
             FROM landing_sections WHERE id = ?`,
            [result.insertId]
        );

        return res.status(201).json({
            status: true,
            message: "Section created successfully",
            data: mapSection(req, row)
        });
    } catch (err) {
        if (req.file) deleteImageFile(req.file.filename);
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// PUT /admin/landing/:id  — update a section (multipart: fields + optional new image)
exports.updateSection = async (req, res) => {
    try {
        const { id } = req.params;
        const { section_key, title, subtitle, content, sort_order, status } = req.body || {};

        const [[existing]] = await db.query(`SELECT * FROM landing_sections WHERE id = ?`, [id]);
        if (!existing) {
            if (req.file) deleteImageFile(req.file.filename);
            return res.status(404).json({ status: false, message: "Section not found" });
        }

        // only overwrite fields that were actually provided (partial update friendly)
        const setParts  = [];
        const setValues = [];

        if (section_key !== undefined) { setParts.push(`section_key = ?`); setValues.push(section_key.trim()); }
        if (title       !== undefined) { setParts.push(`title = ?`);       setValues.push(title || null); }
        if (subtitle    !== undefined) { setParts.push(`subtitle = ?`);    setValues.push(subtitle || null); }
        if (content     !== undefined) { setParts.push(`content = ?`);     setValues.push(toContentString(content)); }
        if (sort_order  !== undefined) { setParts.push(`sort_order = ?`);  setValues.push(Number(sort_order)); }
        if (status      !== undefined) { setParts.push(`status = ?`);      setValues.push(Number(status)); }

        if (req.file) {
            setParts.push(`image = ?`);
            setValues.push(req.file.filename);
        }

        if (setParts.length === 0) {
            return res.status(400).json({ status: false, message: "No fields to update" });
        }

        setValues.push(id);
        await db.query(`UPDATE landing_sections SET ${setParts.join(", ")} WHERE id = ?`, setValues);

        // remove old image only after a successful update with a new file
        if (req.file && existing.image) deleteImageFile(existing.image);

        const [[row]] = await db.query(
            `SELECT id, section_key, title, subtitle, content, image, sort_order, status, created_at, updated_at
             FROM landing_sections WHERE id = ?`,
            [id]
        );

        return res.json({ status: true, message: "Section updated successfully", data: mapSection(req, row) });
    } catch (err) {
        if (req.file) deleteImageFile(req.file.filename);
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// DELETE /admin/landing/:id
exports.deleteSection = async (req, res) => {
    try {
        const { id } = req.params;
        const [[existing]] = await db.query(`SELECT id, image FROM landing_sections WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Section not found" });

        await db.query(`DELETE FROM landing_sections WHERE id = ?`, [id]);
        deleteImageFile(existing.image);

        return res.json({ status: true, message: "Section deleted successfully" });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// PATCH /admin/landing/:id/status
exports.toggleSectionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        if (status === undefined || ![0, 1].includes(Number(status))) {
            return res.status(400).json({ status: false, message: "status must be 0 or 1" });
        }

        const [[existing]] = await db.query(`SELECT id FROM landing_sections WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Section not found" });

        await db.query(`UPDATE landing_sections SET status = ? WHERE id = ?`, [Number(status), id]);
        return res.json({
            status: true,
            message: `Section ${Number(status) === 1 ? "activated" : "deactivated"} successfully`
        });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

// PATCH /admin/landing/reorder  — body: { order: [{ id, sort_order }, ...] }
exports.reorderSections = async (req, res) => {
    try {
        const { order } = req.body || {};
        if (!Array.isArray(order) || order.length === 0) {
            return res.status(400).json({ status: false, message: "order must be a non-empty array of { id, sort_order }" });
        }

        for (const item of order) {
            if (item.id === undefined || item.sort_order === undefined) continue;
            await db.query(`UPDATE landing_sections SET sort_order = ? WHERE id = ?`,
                [Number(item.sort_order), Number(item.id)]);
        }

        return res.json({ status: true, message: "Sections reordered successfully" });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};
