const db = require("../config/db");

// POST /contact — public enquiry/contact form submission
exports.createContact = async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body || {};

        if (!name?.trim() || !message?.trim()) {
            return res.status(400).json({ status: false, message: "Name and message are required" });
        }

        const [result] = await db.query(
            `INSERT INTO contact_messages (name, email, phone, subject, message, status)
             VALUES (?, ?, ?, ?, ?, 0)`,
            [name.trim(), email || null, phone || null, subject || null, message.trim()]
        );

        return res.status(201).json({
            status: true,
            message: "Thanks! Your message has been received.",
            data: { id: result.insertId },
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// GET /admin/contacts — list submissions
exports.getContacts = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name, email, phone, subject, message, status, created_at
             FROM contact_messages ORDER BY id DESC`
        );
        return res.json({ status: true, total: rows.length, data: rows });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// PATCH /admin/contacts/:id/status — 0 = new, 1 = read/handled
exports.updateContactStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};
        if (![0, 1].includes(Number(status))) {
            return res.status(400).json({ status: false, message: "status must be 0 or 1" });
        }
        const [[row]] = await db.query(`SELECT id FROM contact_messages WHERE id = ?`, [id]);
        if (!row) return res.status(404).json({ status: false, message: "Not found" });
        await db.query(`UPDATE contact_messages SET status = ? WHERE id = ?`, [Number(status), id]);
        return res.json({ status: true, message: "Updated" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// DELETE /admin/contacts/:id
exports.deleteContact = async (req, res) => {
    try {
        const { id } = req.params;
        const [[row]] = await db.query(`SELECT id FROM contact_messages WHERE id = ?`, [id]);
        if (!row) return res.status(404).json({ status: false, message: "Not found" });
        await db.query(`DELETE FROM contact_messages WHERE id = ?`, [id]);
        return res.json({ status: true, message: "Deleted" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};
