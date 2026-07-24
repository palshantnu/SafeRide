const db = require("../config/db");
const bcrypt = require("bcryptjs");

// Actions available per module (the checkbox columns in the admin UI)
const PERMISSION_ACTIONS = ["view", "add", "edit", "delete"];

// Modules that can be permissioned (the checkbox rows in the admin UI)
const PERMISSION_MODULES = [
    "dashboard",
    "staff",
    "roles",
    "permissions",
    "services",
    "sub_services",
    "plans",
    "drivers",
    "business_associates",
    "bookings",
    "users",
    "self_sharing",
    "parcel",
    "onspot",
    "landing",
    "popups",
    "notifications",
    "ratings",
    "withdrawals",
    "locations"
];

// ══════════════════════════════════════════════════════
//  STAFF
// ══════════════════════════════════════════════════════

exports.createStaff = async (req, res) => {
    try {
        const { name, email, mobile, password, role_id } = req.body;

        if (!name || !mobile || !password) {
            return res.status(400).json({ status: false, message: "name, mobile and password are required" });
        }

        const [[existing]] = await db.query(
            `SELECT id FROM users WHERE mobile = ? OR email = ?`,
            [mobile, email || ""]
        );
        if (existing) {
            return res.status(409).json({ status: false, message: "Mobile or email already exists" });
        }

        if (role_id) {
            const [[role]] = await db.query(`SELECT id FROM roles WHERE id = ?`, [role_id]);
            if (!role) {
                return res.status(400).json({ status: false, message: "Invalid role_id" });
            }
        }

        const hashed = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            `INSERT INTO users (name, email, mobile, password, role, role_id, status)
             VALUES (?, ?, ?, ?, 'staff', ?, 1)`,
            [name, email || null, mobile, hashed, role_id || null]
        );

        const [[staff]] = await db.query(`
            SELECT u.id, u.name, u.email, u.mobile, u.role, u.status, u.created_at,
                   r.id AS role_id, r.role_name
            FROM users u
            LEFT JOIN roles r ON r.id = u.role_id
            WHERE u.id = ?
        `, [result.insertId]);

        return res.status(201).json({ status: true, message: "Staff created successfully", data: staff });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.getStaffList = async (req, res) => {
    try {
        const [staff] = await db.query(`
            SELECT u.id, u.name, u.email, u.mobile, u.role, u.status, u.created_at,
                   r.id AS role_id, r.role_name
            FROM users u
            LEFT JOIN roles r ON r.id = u.role_id
            WHERE u.role = 'staff'
            ORDER BY u.id DESC
        `);

        return res.json({ status: true, message: "Staff list fetched", total: staff.length, data: staff });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.getStaffById = async (req, res) => {
    try {
        const { id } = req.params;

        const [[staff]] = await db.query(`
            SELECT u.id, u.name, u.email, u.mobile, u.role, u.status, u.created_at,
                   r.id AS role_id, r.role_name
            FROM users u
            LEFT JOIN roles r ON r.id = u.role_id
            WHERE u.id = ? AND u.role = 'staff'
        `, [id]);

        if (!staff) return res.status(404).json({ status: false, message: "Staff not found" });

        const [permissions] = await db.query(`
            SELECT p.id, p.permission_name, p.module
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = ?
        `, [staff.role_id]);

        return res.json({ status: true, data: { ...staff, permissions } });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, mobile, password, role_id, status } = req.body;

        const [[existing]] = await db.query(
            `SELECT id FROM users WHERE id = ? AND role = 'staff'`, [id]
        );
        if (!existing) return res.status(404).json({ status: false, message: "Staff not found" });

        if (role_id) {
            const [[role]] = await db.query(`SELECT id FROM roles WHERE id = ?`, [role_id]);
            if (!role) return res.status(400).json({ status: false, message: "Invalid role_id" });
        }

        let passwordClause = "";
        const params = [];

        if (password) {
            const hashed = await bcrypt.hash(password, 10);
            passwordClause = ", password = ?";
            params.push(hashed);
        }

        await db.query(
            `UPDATE users SET name = ?, email = ?, mobile = ?, role_id = ?,
             status = ? ${passwordClause} WHERE id = ?`,
            [name, email || null, mobile, role_id || null, status ?? 1, ...params, id]
        );

        return res.json({ status: true, message: "Staff updated successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;

        const [[existing]] = await db.query(
            `SELECT id FROM users WHERE id = ? AND role = 'staff'`, [id]
        );
        if (!existing) return res.status(404).json({ status: false, message: "Staff not found" });

        await db.query(`DELETE FROM users WHERE id = ?`, [id]);

        return res.json({ status: true, message: "Staff deleted successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// GET /admin/me — the logged-in admin/staff with their role + permissions.
// Used by the frontend to gate pages & action buttons by view/add/edit/delete.
exports.getMe = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ status: false, message: "Unauthorized" });

        const [[user]] = await db.query(`
            SELECT u.id, u.name, u.email, u.mobile, u.role, u.status, u.role_id, r.role_name
            FROM users u
            LEFT JOIN roles r ON r.id = u.role_id
            WHERE u.id = ?
        `, [userId]);
        if (!user) return res.status(404).json({ status: false, message: "User not found" });

        let permissions = [];
        if (user.role_id) {
            const [rows] = await db.query(`
                SELECT p.id, p.permission_name, p.module
                FROM role_permissions rp
                JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = ?
            `, [user.role_id]);
            permissions = rows;
        }

        // Full access for the platform admin or an unrestricted role.
        const roleName = (user.role_name || "").toLowerCase();
        const is_super_admin =
            user.role === "admin" || !user.role_id ||
            roleName === "super admin" || roleName === "superadmin";

        return res.json({
            status: true,
            data: {
                user: {
                    id: user.id, name: user.name, email: user.email, mobile: user.mobile,
                    role: user.role, role_id: user.role_id, role_name: user.role_name, status: user.status,
                },
                is_super_admin,
                permissions,
            },
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.assignRoleToStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_id } = req.body;

        if (!role_id) return res.status(400).json({ status: false, message: "role_id is required" });

        const [[staff]] = await db.query(
            `SELECT id FROM users WHERE id = ? AND role = 'staff'`, [id]
        );
        if (!staff) return res.status(404).json({ status: false, message: "Staff not found" });

        const [[role]] = await db.query(`SELECT id, role_name FROM roles WHERE id = ?`, [role_id]);
        if (!role) return res.status(400).json({ status: false, message: "Invalid role_id" });

        await db.query(`UPDATE users SET role_id = ? WHERE id = ?`, [role_id, id]);

        return res.json({ status: true, message: `Role '${role.role_name}' assigned to staff successfully` });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// ══════════════════════════════════════════════════════
//  ROLES
// ══════════════════════════════════════════════════════

exports.createRole = async (req, res) => {
    try {
        const { role_name, description } = req.body;

        if (!role_name) return res.status(400).json({ status: false, message: "role_name is required" });

        const [[existing]] = await db.query(`SELECT id FROM roles WHERE role_name = ?`, [role_name]);
        if (existing) return res.status(409).json({ status: false, message: "Role already exists" });

        const [result] = await db.query(
            `INSERT INTO roles (role_name, description) VALUES (?, ?)`,
            [role_name, description || null]
        );

        return res.status(201).json({
            status: true,
            message: "Role created successfully",
            data: { id: result.insertId, role_name, description }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.getRoles = async (req, res) => {
    try {
        const [roles] = await db.query(`
            SELECT r.id, r.role_name, r.description, r.status, r.created_at,
                   COUNT(rp.permission_id) AS total_permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON rp.role_id = r.id
            GROUP BY r.id
            ORDER BY r.id DESC
        `);

        return res.json({ status: true, message: "Roles fetched", total: roles.length, data: roles });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_name, description, status } = req.body;

        const [[existing]] = await db.query(`SELECT id FROM roles WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Role not found" });

        await db.query(
            `UPDATE roles SET role_name = ?, description = ?, status = ? WHERE id = ?`,
            [role_name, description || null, status ?? 1, id]
        );

        return res.json({ status: true, message: "Role updated successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        const [[existing]] = await db.query(`SELECT id FROM roles WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Role not found" });

        await db.query(`DELETE FROM roles WHERE id = ?`, [id]);

        return res.json({ status: true, message: "Role deleted successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// ══════════════════════════════════════════════════════
//  PERMISSIONS
// ══════════════════════════════════════════════════════

exports.createPermission = async (req, res) => {
    try {
        const { permission_name, module, description } = req.body;

        if (!permission_name || !module) {
            return res.status(400).json({ status: false, message: "permission_name and module are required" });
        }

        const [[existing]] = await db.query(
            `SELECT id FROM permissions WHERE permission_name = ? AND module = ?`,
            [permission_name, module]
        );
        if (existing) return res.status(409).json({ status: false, message: "Permission already exists" });

        const [result] = await db.query(
            `INSERT INTO permissions (permission_name, module, description) VALUES (?, ?, ?)`,
            [permission_name, module, description || null]
        );

        return res.status(201).json({
            status: true,
            message: "Permission created successfully",
            data: { id: result.insertId, permission_name, module, description }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.getPermissions = async (req, res) => {
    try {
        const { module } = req.query;
        let whereClause = "";
        const params = [];

        if (module) {
            whereClause = "WHERE module = ?";
            params.push(module);
        }

        const [permissions] = await db.query(
            `SELECT id, permission_name, module, description, created_at
             FROM permissions ${whereClause} ORDER BY module, id`,
            params
        );

        return res.json({ status: true, message: "Permissions fetched", total: permissions.length, data: permissions });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// Create every module × action permission (view/add/edit/delete) if missing.
// Idempotent in code (the permissions table has no unique key), so it is safe
// to call repeatedly — only combos that don't exist yet get inserted.
exports.seedPermissions = async (req, res) => {
    try {
        const [existing] = await db.query(`SELECT permission_name, module FROM permissions`);
        const seen = new Set(existing.map(p => `${p.permission_name}|${p.module}`));

        const toInsert = [];
        for (const module of PERMISSION_MODULES) {
            for (const action of PERMISSION_ACTIONS) {
                if (!seen.has(`${action}|${module}`)) {
                    toInsert.push([action, module, `${action} ${module}`]);
                }
            }
        }

        if (toInsert.length > 0) {
            await db.query(
                `INSERT INTO permissions (permission_name, module, description) VALUES ?`,
                [toInsert]
            );
        }

        const [permissions] = await db.query(
            `SELECT id, permission_name, module FROM permissions ORDER BY module, id`
        );

        return res.json({
            status: true,
            message: `Permissions seeded successfully (${toInsert.length} new added)`,
            total: permissions.length,
            data: permissions
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// Checkbox matrix for the admin UI: one row per module, one column per action.
// Pass ?role_id= (or /:role_id) to mark which boxes are already checked for that role.
exports.getPermissionMatrix = async (req, res) => {
    try {
        const role_id = req.params.role_id || req.query.role_id || null;

        let role = null;
        const checked = new Set();

        if (role_id) {
            const [[roleRow]] = await db.query(
                `SELECT id, role_name, description FROM roles WHERE id = ?`, [role_id]
            );
            if (!roleRow) return res.status(404).json({ status: false, message: "Role not found" });
            role = roleRow;

            const [assigned] = await db.query(
                `SELECT permission_id FROM role_permissions WHERE role_id = ?`, [role_id]
            );
            assigned.forEach(r => checked.add(r.permission_id));
        }

        const [permissions] = await db.query(
            `SELECT id, permission_name, module FROM permissions ORDER BY module, id`
        );

        // group into { module, permissions: { view:{id,checked}, add:{...}, ... } }
        const matrix = {};
        for (const p of permissions) {
            if (!matrix[p.module]) matrix[p.module] = { module: p.module, permissions: {} };
            matrix[p.module].permissions[p.permission_name] = {
                id: p.id,
                checked: checked.has(p.id)
            };
        }

        return res.json({
            status: true,
            message: "Permission matrix fetched",
            actions: PERMISSION_ACTIONS,
            role,
            total_modules: Object.keys(matrix).length,
            data: Object.values(matrix)
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.deletePermission = async (req, res) => {
    try {
        const { id } = req.params;

        const [[existing]] = await db.query(`SELECT id FROM permissions WHERE id = ?`, [id]);
        if (!existing) return res.status(404).json({ status: false, message: "Permission not found" });

        await db.query(`DELETE FROM permissions WHERE id = ?`, [id]);

        return res.json({ status: true, message: "Permission deleted successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// ══════════════════════════════════════════════════════
//  ROLE ↔ PERMISSIONS
// ══════════════════════════════════════════════════════

exports.assignPermissionsToRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { permission_ids } = req.body;

        // Allow an empty array — it clears all permissions for the role.
        if (!Array.isArray(permission_ids)) {
            return res.status(400).json({ status: false, message: "permission_ids must be an array" });
        }

        const [[role]] = await db.query(`SELECT id FROM roles WHERE id = ?`, [id]);
        if (!role) return res.status(404).json({ status: false, message: "Role not found" });

        // Delete existing and re-insert the new set (if any).
        // De-duplicate ids — role_permissions has no unique key, so repeated ids
        // in the request would otherwise create duplicate links.
        await db.query(`DELETE FROM role_permissions WHERE role_id = ?`, [id]);

        const uniqueIds = [...new Set(permission_ids)];
        if (uniqueIds.length > 0) {
            const values = uniqueIds.map(pid => [id, pid]);
            await db.query(
                `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES ?`,
                [values]
            );
        }

        const [assigned] = await db.query(`
            SELECT p.id, p.permission_name, p.module
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = ?
            ORDER BY p.module, p.id
        `, [id]);

        return res.json({
            status: true,
            message: "Permissions assigned to role successfully",
            total: assigned.length,
            data: assigned
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.getRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;

        const [[role]] = await db.query(`SELECT id, role_name, description FROM roles WHERE id = ?`, [id]);
        if (!role) return res.status(404).json({ status: false, message: "Role not found" });

        const [permissions] = await db.query(`
            SELECT p.id, p.permission_name, p.module, p.description
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = ?
            ORDER BY p.module, p.id
        `, [id]);

        return res.json({
            status: true,
            message: "Role permissions fetched",
            role,
            total: permissions.length,
            data: permissions
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};
