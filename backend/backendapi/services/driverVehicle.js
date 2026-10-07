const db = require("../config/db");

// Vehicle details a Business Associate fills in while assigning one of its drivers.
// A BA's drivers have no vehicle of their own on file, so the BA supplies it at assign
// time and it is saved on the driver's profile (driver_profiles) — the same place the
// user-facing booking screens already read a captain's vehicle from. Assigning the same
// driver again with different details simply overwrites them.
const VEHICLE_FIELDS = ["vehicle_type", "vehicle_model", "vehicle_color", "vehicle_number"];

// Pull the non-empty vehicle fields out of a request body.
const pickVehicle = (body = {}) => {
    const vehicle = {};
    for (const field of VEHICLE_FIELDS) {
        const value = body[field] === undefined || body[field] === null ? "" : String(body[field]).trim();
        if (value) vehicle[field] = value;
    }
    return vehicle;
};

// Save them on the driver's profile; fields not supplied are left as they were.
// Returns true if anything was written.
const saveDriverVehicle = async (driver_id, vehicle = {}) => {
    const fields = Object.keys(vehicle);
    if (!driver_id || fields.length === 0) return false;

    const [[existing]] = await db.query(`SELECT id FROM driver_profiles WHERE driver_id = ?`, [driver_id]);
    if (existing) {
        await db.query(
            `UPDATE driver_profiles SET ${fields.map((f) => `${f} = ?`).join(", ")} WHERE driver_id = ?`,
            [...fields.map((f) => vehicle[f]), driver_id]
        );
    } else {
        // vehicle_type / vehicle_number are NOT NULL on this table
        await db.query(
            `INSERT INTO driver_profiles (driver_id, vehicle_type, vehicle_model, vehicle_color, vehicle_number)
             VALUES (?, ?, ?, ?, ?)`,
            [driver_id, vehicle.vehicle_type || "", vehicle.vehicle_model || null,
             vehicle.vehicle_color || null, vehicle.vehicle_number || ""]
        );
    }
    return true;
};

module.exports = { pickVehicle, saveDriverVehicle };
