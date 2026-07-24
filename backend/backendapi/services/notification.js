const { messaging } = require("../config/firebase");
const db = require("../config/db");

const TOKEN_TABLES = ["users", "drivers", "business_associates"];

// FCM says the token is dead (app uninstalled, token rotated, or it belongs to a
// different Firebase project). There is no point keeping it — clear it.
const DEAD_TOKEN_CODES = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
    "messaging/invalid-argument",
]);

const clearDeadToken = async (token) => {
    for (const table of TOKEN_TABLES) {
        try {
            await db.query(`UPDATE ${table} SET fcm_token = NULL WHERE fcm_token = ?`, [token]);
        } catch { /* table/column may not exist — ignore */ }
    }
};

// Best-effort push. Never throws — returns null if there's no token, Firebase
// isn't initialized, or the send fails, so callers don't need their own try/catch.
const sendPush = async (token, title, body, data = {}) => {
    if (!token) return null;
    if (!messaging) {
        console.warn("Push skipped — Firebase not initialized");
        return null;
    }

    // FCM data values must be strings
    const stringData = {};
    for (const [k, v] of Object.entries(data)) stringData[k] = String(v);

    try {
        return await messaging.send({
            token,
            notification: { title, body },
            data: stringData,
        });
    } catch (err) {
        console.error(`sendPush error [${err.code || "unknown"}]:`, err.message);
        // drop tokens FCM has rejected so we stop pushing to them
        if (DEAD_TOKEN_CODES.has(err.code)) {
            await clearDeadToken(token);
            console.warn("Dead FCM token cleared from DB");
        }
        return null;
    }
};

// Look up a recipient's fcm_token from its table and push. Best-effort — never throws.
const notifyByTable = async (table, id, title, body, data = {}) => {
    if (!id) return null;
    try {
        const [[row]] = await db.query(`SELECT fcm_token FROM ${table} WHERE id = ?`, [id]);
        if (!row || !row.fcm_token) return null;
        return await sendPush(row.fcm_token, title, body, data);
    } catch (err) {
        console.error(`notify(${table}) error:`, err.message);
        return null;
    }
};

const notifyUser   = (userId,   title, body, data) => notifyByTable("users",                userId,   title, body, data);
const notifyDriver = (driverId, title, body, data) => notifyByTable("drivers",              driverId, title, body, data);
const notifyBA     = (baId,     title, body, data) => notifyByTable("business_associates",  baId,     title, body, data);

// Broadcast to every device in a table that has a token. Best-effort — never throws.
const broadcastToTable = async (table, title, body, data = {}) => {
    try {
        const [rows] = await db.query(
            `SELECT fcm_token FROM ${table} WHERE fcm_token IS NOT NULL AND fcm_token <> ''`
        );
        await Promise.all(rows.map(r => sendPush(r.fcm_token, title, body, data)));
        return rows.length;
    } catch (err) {
        console.error(`broadcastToTable(${table}) error:`, err.message);
        return 0;
    }
};

// Admin broadcast by audience: 'user' | 'captain' | 'both'. Returns devices pinged.
const notifyAudience = async (audience, title, body, data = {}) => {
    const a = String(audience || "both").toLowerCase();
    let sent = 0;
    if (a === "user" || a === "both")    sent += await broadcastToTable("users",   title, body, data);
    if (a === "captain" || a === "both") sent += await broadcastToTable("drivers", title, body, data);
    return sent;
};

// Broadcast a "new booking" to every driver registered for the service (and sub-service,
// if given). Best-effort — never throws. Returns how many drivers were pinged.
const notifyDriversByService = async (serviceId, subServiceId, title, body, data = {}) => {
    if (!serviceId) return 0;
    try {
        let sql = `SELECT fcm_token FROM drivers WHERE service_id = ? AND fcm_token IS NOT NULL AND fcm_token <> ''`;
        const params = [serviceId];
        if (subServiceId) { sql += ` AND (sub_service_id = ? OR sub_service_id IS NULL)`; params.push(subServiceId); }
        const [rows] = await db.query(sql, params);
        await Promise.all(rows.map(r => sendPush(r.fcm_token, title, body, data)));
        return rows.length;
    } catch (err) {
        console.error("notifyDriversByService error:", err.message);
        return 0;
    }
};

// keep the default export a callable function (existing `require("./notification")` usage),
// and expose the named helpers as properties.
module.exports = sendPush;
module.exports.sendPush    = sendPush;
module.exports.notifyUser  = notifyUser;
module.exports.notifyDriver = notifyDriver;
module.exports.notifyBA    = notifyBA;
module.exports.notifyDriversByService = notifyDriversByService;
module.exports.notifyAudience = notifyAudience;
