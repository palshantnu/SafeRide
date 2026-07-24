const db = require("../config/db");

const VALID_ROLES = ['user', 'driver'];

exports.getPagesByRole = async (req, res) => {
    try {
        const { role } = req.body || {};

        if (!role || !VALID_ROLES.includes(role)) {
            return res.status(400).json({
                status: false,
                message: "role is required and must be 'user' or 'driver'"
            });
        }

        const [pages] = await db.query(
            `SELECT id, page_type, role, title, slug, content, created_at
             FROM pages WHERE role = ? AND status = 1 ORDER BY id DESC`,
            [role]
        );

        return res.json({
            status: true,
            message: "Pages fetched successfully",
            role,
            total: pages.length,
            data: pages
        });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

exports.getAllPages = async (req, res) => {
    try {
        const [pages] = await db.query(
            `SELECT id, page_type, role, title, slug, content, status, created_at, updated_at
             FROM pages ORDER BY id DESC`
        );

        return res.json({
            status: true,
            message: "Pages fetched successfully",
            total: pages.length,
            data: pages
        });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

exports.getPageById = async (req, res) => {
    try {
        const { id } = req.params;

        const [[page]] = await db.query(
            `SELECT id, page_type, role, title, slug, content, status, created_at, updated_at
             FROM pages WHERE id = ?`,
            [id]
        );

        if (!page) {
            return res.status(404).json({ status: false, message: "Page not found" });
        }

        return res.json({ status: true, message: "Page fetched successfully", data: page });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

exports.getPageBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const [[page]] = await db.query(
            `SELECT id, page_type, role, title, slug, content, status, created_at, updated_at
             FROM pages WHERE slug = ?`,
            [slug]
        );

        if (!page) {
            return res.status(404).json({ status: false, message: "Page not found" });
        }

        return res.json({ status: true, message: "Page fetched successfully", data: page });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

exports.createPage = async (req, res) => {
    try {
        const { page_type, role, title, slug, content, status } = req.body || {};

        if (!page_type || !role || !title || !slug || !content) {
            return res.status(400).json({
                status: false,
                message: "page_type, role, title, slug and content are required"
            });
        }

        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({
                status: false,
                message: "role must be 'user' or 'driver'"
            });
        }

        const [[existing]] = await db.query(
            `SELECT id FROM pages WHERE slug = ?`, [slug]
        );

        if (existing) {
            return res.status(409).json({ status: false, message: "Slug already exists" });
        }

        const [result] = await db.query(
            `INSERT INTO pages (page_type, role, title, slug, content, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [page_type, role, title, slug, content, status !== undefined ? Number(status) : 1]
        );

        return res.status(201).json({
            status: true,
            message: "Page created successfully",
            data: {
                id: result.insertId,
                page_type,
                role,
                title,
                slug,
                content,
                status: status !== undefined ? Number(status) : 1
            }
        });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

exports.updatePage = async (req, res) => {
    try {
        const { id } = req.params;
        const { page_type, role, title, slug, content, status } = req.body || {};

        if (!page_type || !role || !title || !slug || !content) {
            return res.status(400).json({
                status: false,
                message: "page_type, role, title, slug and content are required"
            });
        }

        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({
                status: false,
                message: "role must be 'user' or 'driver'"
            });
        }

        const [[existing]] = await db.query(
            `SELECT id FROM pages WHERE id = ?`, [id]
        );

        if (!existing) {
            return res.status(404).json({ status: false, message: "Page not found" });
        }

        const [[slugConflict]] = await db.query(
            `SELECT id FROM pages WHERE slug = ? AND id != ?`, [slug, id]
        );

        if (slugConflict) {
            return res.status(409).json({ status: false, message: "Slug already used by another page" });
        }

        await db.query(
            `UPDATE pages SET page_type = ?, role = ?, title = ?, slug = ?, content = ?, status = ? WHERE id = ?`,
            [page_type, role, title, slug, content, status !== undefined ? Number(status) : 1, id]
        );

        return res.json({ status: true, message: "Page updated successfully" });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

exports.deletePage = async (req, res) => {
    try {
        const { id } = req.params;

        const [[existing]] = await db.query(
            `SELECT id FROM pages WHERE id = ?`, [id]
        );

        if (!existing) {
            return res.status(404).json({ status: false, message: "Page not found" });
        }

        await db.query(`DELETE FROM pages WHERE id = ?`, [id]);

        return res.json({ status: true, message: "Page deleted successfully" });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};

exports.togglePageStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        if (status === undefined || ![0, 1].includes(Number(status))) {
            return res.status(400).json({ status: false, message: "status must be 0 or 1" });
        }

        const [[existing]] = await db.query(
            `SELECT id FROM pages WHERE id = ?`, [id]
        );

        if (!existing) {
            return res.status(404).json({ status: false, message: "Page not found" });
        }

        await db.query(`UPDATE pages SET status = ? WHERE id = ?`, [Number(status), id]);

        return res.json({
            status: true,
            message: `Page ${Number(status) === 1 ? "activated" : "deactivated"} successfully`
        });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Server error", error: err.message });
    }
};
