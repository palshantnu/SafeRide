const db = require("../config/db");

// GET /app-version?app=user|driver&platform=android|ios  (public, no auth — called on app launch)
exports.getAppVersion = async (req, res) => {
    try {
        const { app, platform } = req.query;
        if (!app || !platform) {
            return res.status(400).json({ status: false, message: "app and platform are required" });
        }

        const [[row]] = await db.execute(
            `SELECT app, platform, latest_version, min_version, force_update, update_message, store_url
             FROM app_versions WHERE app = ? AND platform = ?`,
            [app, platform]
        );

        if (!row) {
            // no config for this app/platform yet — default to "no update needed"
            return res.json({
                status: true,
                data: { app, platform, latest_version: null, min_version: null, force_update: false, update_message: null, store_url: null }
            });
        }

        return res.json({
            status: true,
            data: { ...row, force_update: Boolean(row.force_update) }
        });
    } catch (error) {
        console.error("getAppVersion error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /admin/app-versions
exports.adminGetAppVersions = async (req, res) => {
    try {
        const [rows] = await db.execute(`SELECT * FROM app_versions ORDER BY app ASC, platform ASC`);
        return res.json({ status: true, data: rows.map(r => ({ ...r, force_update: Boolean(r.force_update) })) });
    } catch (error) {
        console.error("adminGetAppVersions error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// PUT /admin/app-versions/:id
exports.adminUpdateAppVersion = async (req, res) => {
    try {
        const { id } = req.params;
        const { latest_version, min_version, force_update, update_message, store_url } = req.body;

        const [[existing]] = await db.execute(`SELECT * FROM app_versions WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Not found" });

        await db.execute(
            `UPDATE app_versions SET
                latest_version = ?, min_version = ?, force_update = ?,
                update_message = ?, store_url = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                latest_version ?? existing.latest_version,
                min_version ?? existing.min_version,
                force_update !== undefined ? (force_update ? 1 : 0) : existing.force_update,
                update_message !== undefined ? update_message : existing.update_message,
                store_url !== undefined ? store_url : existing.store_url,
                id
            ]
        );

        const [[updated]] = await db.execute(`SELECT * FROM app_versions WHERE id = ?`, [id]);
        return res.json({ status: true, message: "App version updated", data: { ...updated, force_update: Boolean(updated.force_update) } });
    } catch (error) {
        console.error("adminUpdateAppVersion error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};
