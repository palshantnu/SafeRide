const db = require("../config/db");
const { createAdminNotification } = require("./adminNotification");

// The captain app's Wallet screen is shared by drivers and Business Associates and calls
// the /driver/* wallet endpoints for both. A BA's token carries no `role` (a driver's has
// role "driver"), so those handlers hand BA requests over to the functions below — which
// work on business_associates.wallet instead of looking the BA's id up in `drivers`.
const isBAUser = (req) => req.user && req.user.role !== "driver";

// BA recharges get their own ledger (same shape as driver_recharges). Created on first use
// so a recharge can never fail after payment just because the migration wasn't run yet.
let rechargeTableReady = false;
const ensureRechargeTable = async () => {
    if (rechargeTableReady) return;
    await db.query(`
        CREATE TABLE IF NOT EXISTS ba_recharges (
            id              INT NOT NULL AUTO_INCREMENT,
            ba_id           INT NOT NULL,
            recharge_id     VARCHAR(100) DEFAULT NULL,
            amount          DECIMAL(10,2) NOT NULL DEFAULT '0.00',
            payment_mode    VARCHAR(30) DEFAULT 'ONLINE',
            transaction_id  VARCHAR(255) DEFAULT NULL,
            payment_status  VARCHAR(20) DEFAULT 'PENDING',
            recharge_status VARCHAR(20) DEFAULT 'PENDING',
            remarks         TEXT,
            created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY recharge_id (recharge_id),
            KEY ba_id (ba_id)
        )
    `);
    rechargeTableReady = true;
};

const VALID_MODES = ["CASH", "ONLINE", "UPI", "CARD", "WALLET", "BANK_TRANSFER"];

const findBA = async (ba_id) => {
    const [[ba]] = await db.query(`SELECT id, ba_name, ba_mobile, wallet FROM business_associates WHERE id = ?`, [ba_id]);
    return ba;
};

// POST /driver/recharge (BA)
exports.recharge = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { amount, payment_mode, transaction_id, remarks } = req.body;

        const parsedAmount = parseFloat(amount);
        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ status: false, message: "amount must be a positive number" });
        }
        const mode = (payment_mode || "ONLINE").toUpperCase();
        if (!VALID_MODES.includes(mode)) {
            return res.status(400).json({ status: false, message: `payment_mode must be one of: ${VALID_MODES.join(", ")}` });
        }

        const ba = await findBA(ba_id);
        if (!ba) return res.status(404).json({ status: false, message: "Business Associate not found" });

        await ensureRechargeTable();
        const recharge_id = `RCH-BA-${Date.now()}-${ba_id}`;
        const [result] = await db.query(`
            INSERT INTO ba_recharges
                (ba_id, recharge_id, amount, payment_mode, transaction_id, payment_status, recharge_status, remarks)
            VALUES (?, ?, ?, ?, ?, 'SUCCESS', 'COMPLETED', ?)
        `, [ba_id, recharge_id, parsedAmount, mode, transaction_id || null, remarks || null]);

        await db.query(`UPDATE business_associates SET wallet = COALESCE(wallet, 0) + ? WHERE id = ?`, [parsedAmount, ba_id]);
        const updated = await findBA(ba_id);

        return res.status(201).json({
            status: true,
            message: "Wallet recharged successfully",
            data: {
                id: result.insertId,
                recharge_id,
                ba_id,
                ba_name: ba.ba_name,
                amount: parsedAmount,
                payment_mode: mode,
                transaction_id: transaction_id || null,
                payment_status: "SUCCESS",
                recharge_status: "COMPLETED",
                wallet_balance: updated.wallet
            }
        });
    } catch (error) {
        console.error("BA recharge error:", error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// GET /driver/recharge-history (BA)
exports.rechargeHistory = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { status, page, limit } = req.query;
        const pageNum  = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const offset   = (pageNum - 1) * pageSize;

        await ensureRechargeTable();
        let whereClause = `WHERE ba_id = ?`;
        const params = [ba_id];
        if (status) { whereClause += ` AND recharge_status = ?`; params.push(String(status).toUpperCase()); }

        const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM ba_recharges ${whereClause}`, params);
        const [recharges] = await db.query(`
            SELECT id, recharge_id, amount, payment_mode, transaction_id,
                   payment_status, recharge_status, remarks, created_at
            FROM ba_recharges
            ${whereClause}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        `, [...params, pageSize, offset]);

        const ba = await findBA(ba_id);
        return res.json({
            status: true,
            message: "Recharge history fetched successfully",
            wallet_balance: ba ? ba.wallet : null,
            pagination: { total, page: pageNum, limit: pageSize, total_pages: Math.ceil(total / pageSize) },
            data: recharges
        });
    } catch (error) {
        console.error("BA rechargeHistory error:", error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// GET /driver/wallet (BA)
exports.wallet = async (req, res) => {
    try {
        const ba = await findBA(req.user.id);
        if (!ba) return res.status(404).json({ status: false, message: "Business Associate not found" });

        await ensureRechargeTable();
        const [recharges] = await db.query(`
            SELECT id, recharge_id, amount, payment_mode, transaction_id,
                   payment_status, recharge_status, remarks, created_at
            FROM ba_recharges WHERE ba_id = ? ORDER BY id DESC
        `, [ba.id]);

        return res.json({
            status: true,
            message: "Wallet details fetched successfully",
            data: { ba_id: ba.id, full_name: ba.ba_name, phone: ba.ba_mobile, wallet_balance: ba.wallet, recharge_history: recharges }
        });
    } catch (error) {
        console.error("BA wallet error:", error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// POST /driver/withdrawal-request (BA) — stored as user_type 'BA' (see migration.sql)
exports.withdrawalRequest = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { amount, bank_name, account_number, ifsc_code, account_holder_name, upi_id } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ status: false, message: "Valid amount is required" });
        }
        if (!upi_id && !account_number) {
            return res.status(400).json({ status: false, message: "Provide either upi_id or account_number" });
        }

        const ba = await findBA(ba_id);
        if (!ba) return res.status(404).json({ status: false, message: "Business Associate not found" });
        if (parseFloat(ba.wallet || 0) < parseFloat(amount)) {
            return res.status(400).json({ status: false, message: "Insufficient wallet balance" });
        }

        const [existing] = await db.query(
            `SELECT id FROM withdrawal_requests WHERE user_type = 'BA' AND user_id = ? AND status = 'PENDING'`, [ba_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ status: false, message: "You already have a pending withdrawal request" });
        }

        try {
            await db.query(`
                INSERT INTO withdrawal_requests
                    (user_type, user_id, amount, bank_name, account_number, ifsc_code, account_holder_name, upi_id, status, created_at, updated_at)
                VALUES ('BA', ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())
            `, [ba_id, parseFloat(amount), bank_name || null, account_number || null, ifsc_code || null, account_holder_name || null, upi_id || null]);
        } catch (err) {
            // withdrawal_requests.user_type doesn't allow 'BA' until the migration is applied
            console.error("BA withdrawalRequest insert error:", err.message);
            return res.status(400).json({ status: false, message: "Withdrawals are not enabled for Business Associates yet. Please contact support." });
        }

        await createAdminNotification({
            type: "withdrawal_request",
            source_table: "withdrawal_requests",
            source_id: null,
            message: `Business Associate withdrawal request for ₹${amount}`,
            sub: `Pending BA payout`,
            payload: { user_type: "BA", user_id: ba_id, amount: parseFloat(amount) }
        });

        return res.json({ status: true, message: "Withdrawal request submitted successfully" });
    } catch (error) {
        console.error("BA withdrawalRequest error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /driver/withdrawal-history (BA)
exports.withdrawalHistory = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const limitNum = Math.max(1, Number(req.query.limit) || 10);
        const pageNum  = Math.max(1, Number(req.query.page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM withdrawal_requests WHERE user_type = 'BA' AND user_id = ?`, [ba_id]
        );
        const [rows] = await db.query(`
            SELECT w.id, w.amount, w.bank_name, w.account_number, w.ifsc_code, w.account_holder_name, w.upi_id,
                   w.status, w.remarks, w.created_at, w.updated_at,
                   ba.ba_name AS driver_name, ba.ba_mobile AS driver_mobile
            FROM withdrawal_requests w
            LEFT JOIN business_associates ba ON ba.id = w.user_id
            WHERE w.user_type = 'BA' AND w.user_id = ?
            ORDER BY w.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, [ba_id]);

        return res.json({
            status: true,
            message: "Withdrawal history fetched successfully",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("BA withdrawalHistory error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.isBAUser = isBAUser;
