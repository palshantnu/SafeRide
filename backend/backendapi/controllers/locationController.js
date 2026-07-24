const db = require("../config/db");

// Two tables:
//   states (id, name, status, ...)
//   cities (id, state_id, name, status, ...)

// ═══════════════════════════════════════════════════════════════════════════════
//  STATES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /admin/states  — admin adds a state
exports.createState = async (req, res) => {
    try {
        const { name, status } = req.body;
        if (!name || !String(name).trim()) {
            return res.status(400).json({ status: false, message: "State name is required" });
        }

        const [[existing]] = await db.query(
            `SELECT id FROM states WHERE name = ? AND deleted_at IS NULL`,
            [name.trim()]
        );
        if (existing) return res.status(409).json({ status: false, message: "State already exists" });

        const [result] = await db.query(
            `INSERT INTO states (name, status, created_at, updated_at) VALUES (?, ?, NOW(), NOW())`,
            [name.trim(), status ?? 1]
        );
        const [[created]] = await db.query(`SELECT * FROM states WHERE id = ?`, [result.insertId]);

        return res.status(201).json({ status: true, message: "State created", data: created });
    } catch (error) {
        console.error("createState error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /admin/states  — admin list (with search, optional status filter, pagination)
exports.adminGetStates = async (req, res) => {
    try {
        const { search, status, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 50);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [`deleted_at IS NULL`];
        const values     = [];
        if (search)               { conditions.push(`name LIKE ?`);   values.push(`%${search}%`); }
        if (status !== undefined && status !== "") { conditions.push(`status = ?`); values.push(parseInt(status)); }
        const where = `WHERE ${conditions.join(" AND ")}`;

        const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM states ${where}`, values);
        const [rows] = await db.query(
            `SELECT * FROM states ${where} ORDER BY name ASC LIMIT ${limitNum} OFFSET ${offset}`,
            values
        );

        return res.json({
            status: true,
            message: "States fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("adminGetStates error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// PUT /admin/states/:id  — admin updates a state
exports.updateState = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, status } = req.body;

        const [[state]] = await db.query(`SELECT id FROM states WHERE id = ? AND deleted_at IS NULL`, [id]);
        if (!state) return res.status(404).json({ status: false, message: "State not found" });

        if (name && String(name).trim()) {
            const [[dup]] = await db.query(
                `SELECT id FROM states WHERE name = ? AND id != ? AND deleted_at IS NULL`,
                [name.trim(), id]
            );
            if (dup) return res.status(409).json({ status: false, message: "Another state with this name already exists" });
        }

        await db.query(
            `UPDATE states
             SET name = COALESCE(?, name), status = COALESCE(?, status), updated_at = NOW()
             WHERE id = ?`,
            [name ? name.trim() : null, status ?? null, id]
        );
        const [[updated]] = await db.query(`SELECT * FROM states WHERE id = ?`, [id]);

        return res.json({ status: true, message: "State updated", data: updated });
    } catch (error) {
        console.error("updateState error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// DELETE /admin/states/:id  — admin soft-deletes a state (and its cities)
exports.deleteState = async (req, res) => {
    try {
        const { id } = req.params;
        const [[state]] = await db.query(`SELECT id FROM states WHERE id = ? AND deleted_at IS NULL`, [id]);
        if (!state) return res.status(404).json({ status: false, message: "State not found" });

        await db.query(`UPDATE states SET deleted_at = NOW(), status = 0 WHERE id = ?`, [id]);
        await db.query(`UPDATE cities SET deleted_at = NOW(), status = 0 WHERE state_id = ?`, [id]);

        return res.json({ status: true, message: "State deleted" });
    } catch (error) {
        console.error("deleteState error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CITIES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /admin/cities  — admin adds a city under a state
exports.createCity = async (req, res) => {
    try {
        const { state_id, name, status } = req.body;
        if (!state_id) return res.status(400).json({ status: false, message: "state_id is required" });
        if (!name || !String(name).trim()) {
            return res.status(400).json({ status: false, message: "City name is required" });
        }

        const [[state]] = await db.query(`SELECT id FROM states WHERE id = ? AND deleted_at IS NULL`, [state_id]);
        if (!state) return res.status(400).json({ status: false, message: "Invalid state" });

        const [[existing]] = await db.query(
            `SELECT id FROM cities WHERE state_id = ? AND name = ? AND deleted_at IS NULL`,
            [state_id, name.trim()]
        );
        if (existing) return res.status(409).json({ status: false, message: "City already exists in this state" });

        const [result] = await db.query(
            `INSERT INTO cities (state_id, name, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
            [parseInt(state_id), name.trim(), status ?? 1]
        );
        const [[created]] = await db.query(`SELECT * FROM cities WHERE id = ?`, [result.insertId]);

        return res.status(201).json({ status: true, message: "City created", data: created });
    } catch (error) {
        console.error("createCity error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /admin/cities  — admin list (filter by state, search, status, pagination)
exports.adminGetCities = async (req, res) => {
    try {
        const { state_id, search, status, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 50);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [`c.deleted_at IS NULL`];
        const values     = [];
        if (state_id)             { conditions.push(`c.state_id = ?`); values.push(parseInt(state_id)); }
        if (search)               { conditions.push(`c.name LIKE ?`);  values.push(`%${search}%`); }
        if (status !== undefined && status !== "") { conditions.push(`c.status = ?`); values.push(parseInt(status)); }
        const where = `WHERE ${conditions.join(" AND ")}`;

        const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM cities c ${where}`, values);
        const [rows] = await db.query(`
            SELECT c.*, s.name AS state_name
            FROM cities c
            LEFT JOIN states s ON s.id = c.state_id
            ${where}
            ORDER BY c.name ASC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "Cities fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("adminGetCities error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// PUT /admin/cities/:id  — admin updates a city
exports.updateCity = async (req, res) => {
    try {
        const { id } = req.params;
        const { state_id, name, status } = req.body;

        const [[city]] = await db.query(`SELECT id, state_id FROM cities WHERE id = ? AND deleted_at IS NULL`, [id]);
        if (!city) return res.status(404).json({ status: false, message: "City not found" });

        if (state_id) {
            const [[state]] = await db.query(`SELECT id FROM states WHERE id = ? AND deleted_at IS NULL`, [state_id]);
            if (!state) return res.status(400).json({ status: false, message: "Invalid state" });
        }

        const targetState = state_id ? parseInt(state_id) : city.state_id;
        if (name && String(name).trim()) {
            const [[dup]] = await db.query(
                `SELECT id FROM cities WHERE state_id = ? AND name = ? AND id != ? AND deleted_at IS NULL`,
                [targetState, name.trim(), id]
            );
            if (dup) return res.status(409).json({ status: false, message: "Another city with this name already exists in this state" });
        }

        await db.query(
            `UPDATE cities
             SET state_id = COALESCE(?, state_id),
                 name     = COALESCE(?, name),
                 status   = COALESCE(?, status),
                 updated_at = NOW()
             WHERE id = ?`,
            [state_id ? parseInt(state_id) : null, name ? name.trim() : null, status ?? null, id]
        );
        const [[updated]] = await db.query(`SELECT * FROM cities WHERE id = ?`, [id]);

        return res.json({ status: true, message: "City updated", data: updated });
    } catch (error) {
        console.error("updateCity error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// DELETE /admin/cities/:id  — admin soft-deletes a city
exports.deleteCity = async (req, res) => {
    try {
        const { id } = req.params;
        const [[city]] = await db.query(`SELECT id FROM cities WHERE id = ? AND deleted_at IS NULL`, [id]);
        if (!city) return res.status(404).json({ status: false, message: "City not found" });

        await db.query(`UPDATE cities SET deleted_at = NOW(), status = 0 WHERE id = ?`, [id]);
        return res.json({ status: true, message: "City deleted" });
    } catch (error) {
        console.error("deleteCity error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  APP (public)  —  active states & cities for dropdowns
// ═══════════════════════════════════════════════════════════════════════════════

// GET /states  — active states list for the app
exports.getStates = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, name FROM states WHERE status = 1 AND deleted_at IS NULL ORDER BY name ASC`
        );
        return res.json({ status: true, message: "States fetched", data: rows });
    } catch (error) {
        console.error("getStates error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /cities  — all active cities for the app (no state needed; optional ?search=)
exports.getAllCities = async (req, res) => {
    try {
        const { search, limit } = req.query;

        const conditions = [`c.status = 1`, `c.deleted_at IS NULL`];
        const values     = [];
        if (search) { conditions.push(`c.name LIKE ?`); values.push(`%${search}%`); }
        const where = `WHERE ${conditions.join(" AND ")}`;

        const limitClause = limit ? `LIMIT ${Math.max(1, Number(limit))}` : "";

        const [rows] = await db.query(`
            SELECT c.id, c.state_id, c.name, s.name AS state_name
            FROM cities c
            LEFT JOIN states s ON s.id = c.state_id
            ${where}
            ORDER BY c.name ASC
            ${limitClause}
        `, values);

        return res.json({ status: true, message: "Cities fetched", data: rows });
    } catch (error) {
        console.error("getAllCities error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /states/:state_id/cities  — active cities of a state for the app
exports.getCities = async (req, res) => {
    try {
        const { state_id } = req.params;
        const [rows] = await db.query(
            `SELECT id, state_id, name FROM cities
             WHERE state_id = ? AND status = 1 AND deleted_at IS NULL
             ORDER BY name ASC`,
            [state_id]
        );
        return res.json({ status: true, message: "Cities fetched", data: rows });
    } catch (error) {
        console.error("getCities error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};
