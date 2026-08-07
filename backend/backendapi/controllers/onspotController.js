const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");
const { notifyUser, notifyDriversByService, notifyDriver } = require("../services/notification");

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const genId  = (prefix) => prefix + uuidv4().slice(0, 10).toUpperCase();
const genOtp = () => String(Math.floor(1000 + Math.random() * 9000));

const actorType = (req) => {
    if (req.user.role === "driver") return "DRIVER";
    if (!req.user.role)             return "BA";
    return "USER";
};

const ONSPOT_FIELDS = `
    ob.id, ob.booking_no, ob.user_id, ob.service_id, ob.sub_service_id, ob.plan_id,
    ob.city, ob.schedule_datetime, ob.full_address, ob.landmark, ob.remarks,
    ob.driver_id, ob.token_amount, ob.balance_amount, ob.total_amount,
    ob.platform_fee, ob.access_fee,
    ob.token_paid, ob.balance_paid, ob.payment_mode, ob.otp_verified,
    ob.status, ob.cancelled_by, ob.cancel_reason, ob.user_rated,
    ob.started_at, ob.completed_at, ob.created_at, ob.updated_at
`;

const findDriverBooking = async (booking_no, driver_id) => {
    const [[booking]] = await db.execute(
        `SELECT * FROM onspot_bookings WHERE booking_no = ? AND driver_id = ?`,
        [booking_no, driver_id]
    );
    return booking;
};


exports.createBooking = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can create a booking" });
        }
        const user_id = req.user.id;

        const {
            service_id, sub_service_id, plan_id,
            city, schedule_datetime, full_address, landmark, remarks
        } = req.body;

        const required = { service_id, sub_service_id, plan_id, city, schedule_datetime, full_address };
        const missing = Object.keys(required).filter((k) => required[k] === undefined || required[k] === "" || required[k] === null);
        if (missing.length) {
            return res.status(400).json({ status: false, message: `Required: ${missing.join(", ")}` });
        }

        const [[service]] = await db.execute(
            `SELECT id FROM services WHERE id = ? AND status = 1 AND deleted_at IS NULL`,
            [parseInt(service_id)]
        );
        if (!service) return res.status(400).json({ status: false, message: "Invalid service" });

        const [[plan]] = await db.execute(
            `SELECT id, service_id, sub_service_id, token_price, plan_price,
                    platform_fee, access_fee, access_fee_type
             FROM plans WHERE id = ? AND status = 1 AND deleted_at IS NULL`,
            [parseInt(plan_id)]
        );

        if (!plan) return res.status(400).json({ status: false, message: "Invalid plan" });

        if (parseInt(plan.service_id) !== parseInt(service_id)) {
            return res.status(400).json({ status: false, message: "Plan does not belong to this service" });
        }

        if (plan.sub_service_id && parseInt(plan.sub_service_id) !== parseInt(sub_service_id)) {
            return res.status(400).json({ status: false, message: "Plan does not belong to this sub-service" });
        }

        // frontend sends ISO like "2026-06-30T14:23:00.000Z" — MySQL DATETIME needs "YYYY-MM-DD HH:mm:ss".
        // use the literal time from the string (utc) so the picked time is stored as-is (no timezone shift)
        const scheduleMoment = moment.utc(schedule_datetime, moment.ISO_8601, true).isValid()
            ? moment.utc(schedule_datetime)
            : moment(schedule_datetime);
        if (!scheduleMoment.isValid()) {
            return res.status(400).json({ status: false, message: "schedule_datetime is not a valid date" });
        }
        const formattedSchedule = scheduleMoment.format("YYYY-MM-DD HH:mm:ss");

        const planPrice   = parseFloat(plan.plan_price)  || 0;
        const platformFee = parseFloat(plan.platform_fee || 0);
        // access_fee can be a flat amount OR a percentage of the plan price (same convention as In-City)
        const accessFeeCfg = parseFloat(plan.access_fee || 0);
        const accessFee    = (plan.access_fee_type === 'percent')
            ? Math.round(planPrice * accessFeeCfg) / 100
            : accessFeeCfg;
        const total_amount   = planPrice + platformFee + accessFee;
        const token_amount   = parseFloat(plan.token_price) || 0;
        const balance_amount = Math.max(0, Math.round((total_amount - token_amount) * 100) / 100);

        const booking_no = genId("OB");
        const otp        = genOtp();

        await db.execute(`
            INSERT INTO onspot_bookings
                (booking_no, user_id, service_id, sub_service_id, plan_id,
                 city, schedule_datetime, full_address, landmark, remarks,
                 token_amount, balance_amount, total_amount, platform_fee, access_fee, otp, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())
        `, [
            booking_no, user_id, parseInt(service_id), parseInt(sub_service_id), parseInt(plan_id),
            city, formattedSchedule, full_address, landmark || null, remarks || null,
            token_amount, balance_amount, total_amount, platformFee, accessFee, otp
        ]);

        await notifyDriversByService(parseInt(service_id), parseInt(sub_service_id), "New on-spot booking",
            `New on-spot booking in ${city}`, { type: "NEW_ONSPOT_BOOKING", booking_no });

        return res.json({
            status: true,
            message: "Booking created. Waiting for a service man to accept.",
            booking_no,
            fare: {
                plan_price: planPrice.toFixed(2),
                platform_fee: platformFee.toFixed(2),
                access_fee: accessFee.toFixed(2),
                token_amount: token_amount.toFixed(2),
                balance_amount: balance_amount.toFixed(2),
                total_amount: total_amount.toFixed(2)
            }
        });
     } catch (error) {
        console.error("onspot createBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.payToken = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can pay" });
        }
        const user_id = req.user.id;
        const { booking_no } = req.body;
        if (!booking_no) return res.status(400).json({ status: false, message: "booking_no is required" });

        const [[booking]] = await db.execute(
            `SELECT id, status, driver_id, token_amount FROM onspot_bookings
             WHERE booking_no = ? AND user_id = ?`,
            [booking_no, user_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (booking.status === "CANCELLED") return res.status(400).json({ status: false, message: "Booking is cancelled" });
        if (!booking.driver_id || booking.status !== "ASSIGNED") {
            return res.status(400).json({ status: false, message: "No service man has accepted yet" });
        }

        await db.execute(
            `UPDATE onspot_bookings SET token_paid = 1, status = 'TOKEN_PAID', updated_at = NOW() WHERE id = ?`,
            [booking.id]
        );

        // notify assigned driver that token was paid
        try {
            if (booking.driver_id) {
                await notifyDriver(booking.driver_id, "Token paid",
                    `User paid token for on-spot booking ${booking_no}`,
                    { type: "TOKEN_PAID", booking_no }
                );
            }
        } catch (nerr) {
            console.error("notification send error:", nerr.message);
        }

        return res.json({
            status: true,
            message: "Token paid. Booking confirmed.",
            booking_no,
            token_paid: parseFloat(booking.token_amount).toFixed(2),
        });
    } catch (error) {
        console.error("onspot payToken error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.payFull = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can pay" });
        }
        const user_id = req.user.id;
        const { booking_no, payment_mode } = req.body;
        if (!booking_no) return res.status(400).json({ status: false, message: "booking_no is required" });

        const mode = ["CASH", "ONLINE"].includes(String(payment_mode || "").toUpperCase())
            ? payment_mode.toUpperCase()
            : "CASH";

        const [[booking]] = await db.execute(
            `SELECT id, status, otp, balance_amount, balance_paid, driver_id FROM onspot_bookings
             WHERE booking_no = ? AND user_id = ?`,
            [booking_no, user_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (booking.status === "CANCELLED") return res.status(400).json({ status: false, message: "Booking is cancelled" });
        if (booking.status !== "ARRIVED") {
            return res.status(400).json({ status: false, message: "Service man has not arrived yet" });
        }
        if (booking.balance_paid) {
            return res.status(400).json({ status: false, message: "Full payment already done" });
        }

        await db.execute(
            `UPDATE onspot_bookings SET balance_paid = 1, payment_mode = ?, updated_at = NOW() WHERE id = ?`,
            [mode, booking.id]
        );

        // notify assigned driver that full payment was made
        try {
            if (booking.driver_id) {
                await notifyDriver(booking.driver_id, "Full payment recorded",
                    `User paid full amount for on-spot booking ${booking_no}`,
                    { type: "BALANCE_PAID", booking_no }
                );
            }
        } catch (nerr) {
            console.error("notification send error:", nerr.message);
        }

        return res.json({
            status: true,
            message: "Full payment recorded. Share the OTP with the service man to start the work.",
            booking_no,
            otp: booking.otp,
            balance_paid: parseFloat(booking.balance_amount).toFixed(2),
            payment_mode: mode,
        });
    } catch (error) {
        console.error("onspot payFull error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can cancel their booking" });
        }
        const user_id = req.user.id;
        const { booking_no, cancel_reason } = req.body;
        if (!booking_no) return res.status(400).json({ status: false, message: "booking_no is required" });

        const [[booking]] = await db.execute(
            `SELECT id, status FROM onspot_bookings WHERE booking_no = ? AND user_id = ?`,
            [booking_no, user_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (["ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(booking.status)) {
            return res.status(400).json({ status: false, message: `Cannot cancel. Status: ${booking.status}` });
        }

        await db.execute(`
            UPDATE onspot_bookings
            SET status = 'CANCELLED', cancelled_by = 'USER', cancel_reason = ?, updated_at = NOW()
            WHERE id = ?
        `, [cancel_reason || null, booking.id]);

        return res.json({ status: true, message: "Booking cancelled" });
    } catch (error) {
        console.error("onspot cancelBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.myBookings = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can view their bookings" });
        }
        const user_id = req.user.id;
        const { status, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [`ob.user_id = ?`];
        const values     = [user_id];
        if (status) { conditions.push(`ob.status = ?`); values.push(String(status).toUpperCase()); }
        const where = `WHERE ${conditions.join(" AND ")}`;

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM onspot_bookings ob ${where}`, values);
        const [rows] = await db.execute(`
            SELECT ${ONSPOT_FIELDS}, ob.otp,
                   s.title AS service_name, p.plan_name,
                   d.full_name AS driver_name, d.phone AS driver_phone ,dP.driver_profile
            FROM onspot_bookings ob
            LEFT JOIN services s ON s.id = ob.service_id
            LEFT JOIN plans p    ON p.id = ob.plan_id
            LEFT JOIN drivers d  ON d.id = ob.driver_id
            LEFT JOIN driver_profiles dP  ON dP.driver_id = d.id 
            ${where}
            ORDER BY ob.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        const data = rows.map(r => ({
            ...r,
            rating_status: r.status === 'COMPLETED'
                ? (Number(r.user_rated) === 1 ? 'FINISHED' : 'RATING_PENDING')
                : null
        }));

        return res.json({
            status: true,
            message: "Bookings fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data
        });
    } catch (error) {
        console.error("onspot myBookings error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.currentBooking = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can view their current booking" });
        }
        const user_id = req.user.id;

        const [rows] = await db.execute(`
            SELECT ${ONSPOT_FIELDS}, ob.otp,
                   s.title AS service_name, p.plan_name,
                   d.full_name AS driver_name, d.phone AS driver_phone ,dP.driver_profile
            FROM onspot_bookings ob
            LEFT JOIN services s ON s.id = ob.service_id
            LEFT JOIN plans p    ON p.id = ob.plan_id
            LEFT JOIN drivers d  ON d.id = ob.driver_id 
            LEFT JOIN driver_profiles dP  ON dP.driver_id = d.id
            WHERE ob.user_id = ?
              AND ob.status != 'CANCELLED'
              -- keep a completed booking visible until the user rates the captain
              AND (ob.status != 'COMPLETED' OR ob.user_rated = 0)
            ORDER BY ob.id DESC
        `, [user_id]);

        const data = rows.map(r => ({
            ...r,
            rating_status: r.status === 'COMPLETED'
                ? (Number(r.user_rated) === 1 ? 'FINISHED' : 'RATING_PENDING')
                : null
        }));

        return res.json({ status: true, message: "Current bookings", count: data.length, data });
    } catch (error) {
        console.error("onspot currentBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};


exports.availableBookings = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only a service man can view available bookings" });
        }
        const driver_id = req.user.id;
        const { page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const [[driver]] = await db.execute(`SELECT id, service_id, status FROM drivers WHERE id = ?`, [driver_id]);
        if (!driver) return res.status(404).json({ status: false, message: "Service man not found" });

        const where = `WHERE ob.status = 'PENDING' AND ob.driver_id IS NULL AND ob.service_id = ?
            AND NOT EXISTS (
                SELECT 1 FROM onspot_rejections orj
                WHERE orj.booking_id = ob.id AND orj.driver_id = ?
            )`;
        const values = [parseInt(driver.service_id), driver_id];

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM onspot_bookings ob ${where}`, values);
        const [rows] = await db.execute(`
            SELECT ${ONSPOT_FIELDS}, s.title AS service_name, p.plan_name,
                   ob.total_amount AS total_fare,
                   COALESCE(p.plan_captain_commission, 0) AS driver_amount
            FROM onspot_bookings ob
            LEFT JOIN services s ON s.id = ob.service_id
            LEFT JOIN plans p    ON p.id = ob.plan_id
            ${where}
            ORDER BY ob.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "Available bookings fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("onspot availableBookings error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /onspot/driver/accept  — service man accepts a pending booking
exports.acceptBooking = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only a service man can accept bookings" });
        }
        const driver_id = req.user.id;
        const { booking_no } = req.body;
        if (!booking_no) return res.status(400).json({ status: false, message: "booking_no is required" });

        const [[driver]] = await db.execute(`SELECT id, service_id, status FROM drivers WHERE id = ?`, [driver_id]);
        if (!driver) return res.status(404).json({ status: false, message: "Service man not found" });
        if (driver.status !== "approved") return res.status(403).json({ status: false, message: "Please get your KYC approved — only then you can accept bookings." });

        const [[booking]] = await db.execute(
            `SELECT id, user_id, status, driver_id, service_id FROM onspot_bookings WHERE booking_no = ?`,
            [booking_no]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (booking.status !== "PENDING" || booking.driver_id) {
            return res.status(400).json({ status: false, message: "Booking is no longer available" });
        }
        if (parseInt(booking.service_id) !== parseInt(driver.service_id)) {
            return res.status(403).json({ status: false, message: "You are not registered for this service" });
        }

        await db.execute(`
            UPDATE onspot_bookings
            SET driver_id = ?, status = 'ASSIGNED', updated_at = NOW()
            WHERE id = ? AND driver_id IS NULL AND status = 'PENDING'
        `, [driver_id, booking.id]);

        await notifyUser(booking.user_id, "Service man assigned",
            "A service man has accepted your booking. Please pay the token to confirm.", { type: "ONSPOT_ACCEPTED", booking_no });

        return res.json({ status: true, message: "Booking accepted. Ask the user to pay token to confirm." });
    } catch (error) {
        console.error("onspot acceptBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.arrive = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only the assigned service man can do this" });
        }
        const driver_id = req.user.id;
        const { booking_no } = req.body;
        if (!booking_no) return res.status(400).json({ status: false, message: "booking_no is required" });

        const booking = await findDriverBooking(booking_no, driver_id);
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found or not assigned to you" });
        if (booking.status !== "TOKEN_PAID") {
            return res.status(400).json({ status: false, message: `Cannot arrive. Status: ${booking.status}` });
        }

        await db.execute(
            `UPDATE onspot_bookings SET status = 'ARRIVED', updated_at = NOW() WHERE id = ?`,
            [booking.id]
        );

        await notifyUser(booking.user_id, "Service man arrived",
            "Your service man has arrived. Please complete the payment.", { type: "ONSPOT_ARRIVED", booking_no });

        return res.json({ status: true, message: "Marked as arrived. Collect full payment and verify OTP to start." });
    } catch (error) {
        console.error("onspot arrive error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /onspot/driver/verify-otp  — service man verifies OTP (after full payment) → work starts
exports.verifyOtp = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only the assigned service man can do this" });
        }
        const driver_id = req.user.id;
        const { booking_no, otp } = req.body;
        if (!booking_no || !otp) {
            return res.status(400).json({ status: false, message: "booking_no and otp are required" });
        }

        const booking = await findDriverBooking(booking_no, driver_id);
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found or not assigned to you" });
        if (booking.status !== "ARRIVED") {
            return res.status(400).json({ status: false, message: `Verify OTP only after arriving. Status: ${booking.status}` });
        }
        if (!booking.balance_paid) {
            return res.status(400).json({ status: false, message: "User has not paid the full amount yet" });
        }
        if (String(booking.otp) !== String(otp)) {
            return res.status(400).json({ status: false, message: "Invalid OTP" });
        }

        await db.execute(`
            UPDATE onspot_bookings
            SET otp_verified = 1, status = 'IN_PROGRESS', started_at = NOW(), updated_at = NOW()
            WHERE id = ?
        `, [booking.id]);

        await notifyUser(booking.user_id, "Work started",
            "Your service work has started.", { type: "ONSPOT_STARTED", booking_no });

        return res.json({ status: true, message: "OTP verified. Work started." });
    } catch (error) {
        console.error("onspot verifyOtp error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.completeBooking = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only the assigned service man can do this" });
        }
        const driver_id = req.user.id;
        const { booking_no } = req.body;
        if (!booking_no) return res.status(400).json({ status: false, message: "booking_no is required" });

        const booking = await findDriverBooking(booking_no, driver_id);
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found or not assigned to you" });
        if (booking.status !== "IN_PROGRESS") {
            return res.status(400).json({ status: false, message: `Cannot complete. Status: ${booking.status}` });
        }

        await db.execute(`
            UPDATE onspot_bookings
            SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
            WHERE id = ?
        `, [booking.id]);

        await notifyUser(booking.user_id, "Service completed",
            "Your service has been completed. Please rate the service man.", { type: "ONSPOT_COMPLETED", booking_no });

        return res.json({ status: true, message: "Booking completed successfully" });
    } catch (error) {
        console.error("onspot completeBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.driverCancel = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only the assigned service man can cancel" });
        }
        const driver_id = req.user.id;
        const { booking_no, cancel_reason } = req.body;
        if (!booking_no) return res.status(400).json({ status: false, message: "booking_no is required" });

        const booking = await findDriverBooking(booking_no, driver_id);
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found or not assigned to you" });
        if (["ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(booking.status)) {
            return res.status(400).json({ status: false, message: `Cannot cancel. Status: ${booking.status}` });
        }

        await db.execute(`
            UPDATE onspot_bookings
            SET status = 'CANCELLED', cancelled_by = 'DRIVER', cancel_reason = ?, updated_at = NOW()
            WHERE id = ?
        `, [cancel_reason || null, booking.id]);

        return res.json({ status: true, message: "Booking cancelled by service man" });
    } catch (error) {
        console.error("onspot driverCancel error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.rejectBooking = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only a service man can reject a booking" });
        }
        const driver_id = req.user.id;
        const { booking_no, reject_reason } = req.body;
        if (!booking_no) return res.status(400).json({ status: false, message: "booking_no is required" });

        const [[booking]] = await db.execute(
            `SELECT id, status FROM onspot_bookings WHERE booking_no = ?`,
            [booking_no]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });

        // a request can only be declined while it is still open (pending & unassigned)
        if (booking.status !== "PENDING") {
            return res.status(400).json({ status: false, message: `Cannot reject. Booking is already ${booking.status}` });
        }

        // remember this service man declined it, so it won't be offered to them again
        await db.execute(`
            INSERT INTO onspot_rejections (booking_id, driver_id, reason, created_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE reason = VALUES(reason), created_at = NOW()
        `, [booking.id, driver_id, reject_reason || null]);

        return res.json({ status: true, message: "Request rejected. It won't be shown to you again." });
    } catch (error) {
        console.error("onspot rejectBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.myJobs = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only a service man can view jobs" });
        }
        const driver_id = req.user.id;
        const { status, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;
        const conditions = [`ob.driver_id = ?`];
        const values     = [driver_id];
        if (status) { conditions.push(`ob.status = ?`); values.push(String(status).toUpperCase()); }
        const where = `WHERE ${conditions.join(" AND ")}`;
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM onspot_bookings ob ${where}`, values);
        const [rows] = await db.execute(`
            SELECT ${ONSPOT_FIELDS}, s.title AS service_name, p.plan_name,
                   u.name AS user_name, u.mobile AS user_mobile,
                   COALESCE(p.plan_captain_commission, 0) AS driver_amount
            FROM onspot_bookings ob
            LEFT JOIN services s ON s.id = ob.service_id
            LEFT JOIN plans p    ON p.id = ob.plan_id
            LEFT JOIN users u    ON u.id = ob.user_id
            ${where}
            ORDER BY ob.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "Jobs fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("onspot myJobs error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.driverCurrentJob = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only a service man can view their current job" });
        }
        const driver_id = req.user.id;

        const [rows] = await db.execute(`
            SELECT ${ONSPOT_FIELDS}, s.title AS service_name, p.plan_name,
                   ob.total_amount AS total_fare,
                   COALESCE(p.plan_captain_commission, 0) AS driver_amount,
                   u.name AS user_name, u.mobile AS user_mobile
            FROM onspot_bookings ob
            LEFT JOIN services s ON s.id = ob.service_id
            LEFT JOIN plans p    ON p.id = ob.plan_id
            LEFT JOIN users u    ON u.id = ob.user_id
            WHERE ob.driver_id = ?
              AND ob.status NOT IN ('COMPLETED', 'CANCELLED')
            ORDER BY ob.id DESC
        `, [driver_id]);

        return res.json({ status: true, message: "Current Bookings", count: rows.length, data: rows });
    } catch (error) {
        console.error("onspot driverCurrentbookings error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.bookingDetail = async (req, res) => {
    try {
        const { booking_no } = req.params;
        const actor = actorType(req);

        const [[booking]] = await db.execute(`
            SELECT ${ONSPOT_FIELDS}, ob.otp,
                   s.title AS service_name, p.plan_name,
                   u.name AS user_name, u.mobile AS user_mobile,
                   d.full_name AS driver_name, d.phone AS driver_phone
            FROM onspot_bookings ob
            LEFT JOIN services s ON s.id = ob.service_id
            LEFT JOIN plans p    ON p.id = ob.plan_id
            LEFT JOIN users u    ON u.id = ob.user_id
            LEFT JOIN drivers d  ON d.id = ob.driver_id
            WHERE ob.booking_no = ?
        `, [booking_no]);

        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });

        const uid = req.user.id;
        const allowed =
            (actor === "USER"   && booking.user_id === uid) ||
            (actor === "DRIVER" && booking.driver_id === uid);
        if (!allowed) return res.status(403).json({ status: false, message: "Not allowed to view this booking" });

        return res.json({ status: true, message: "Booking detail", data: booking });
    } catch (error) {
        console.error("onspot bookingDetail error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/onspot/bookings  — all on-spot bookings (history) for admin
exports.adminGetAllBookings = async (req, res) => {
    try {
        const { status, service_id, city, from_date, to_date, search, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [];
        const values     = [];
        if (status)     { conditions.push(`ob.status = ?`);              values.push(String(status).toUpperCase()); }
        if (service_id) { conditions.push(`ob.service_id = ?`);          values.push(parseInt(service_id)); }
        if (city)       { conditions.push(`ob.city LIKE ?`);             values.push(`%${city}%`); }
        if (from_date)  { conditions.push(`DATE(ob.created_at) >= ?`);   values.push(from_date); }
        if (to_date)    { conditions.push(`DATE(ob.created_at) <= ?`);   values.push(to_date); }
        if (search)     {
            conditions.push(`(ob.booking_no LIKE ? OR u.name LIKE ? OR u.mobile LIKE ?)`);
            const like = `%${search}%`;
            values.push(like, like, like);
        }
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const [[{ total }]] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM onspot_bookings ob
            LEFT JOIN users u ON u.id = ob.user_id
            ${where}
        `, values);

        const [rows] = await db.execute(`
            SELECT ${ONSPOT_FIELDS},
                   ob.booking_no AS booking_id,
                   ob.city AS pickup_city,
                   ob.full_address AS pickup_address,
                   ob.total_amount AS total_fare,
                   ob.schedule_datetime AS schedule_date,
                   s.title AS service_name, ss.title AS sub_service_name, p.plan_name,
                   p.plan_captain_commission, p.plan_company_commission,
                   u.name AS user_name, u.mobile AS user_mobile, u.wallet AS user_wallet,
                   d.full_name AS driver_name, d.phone AS driver_phone, d.phone AS driver_mobile, d.wallet AS driver_wallet,
                   dr.rating, dr.review
            FROM onspot_bookings ob
            LEFT JOIN services s ON s.id = ob.service_id
            LEFT JOIN sub_services ss ON ss.id = ob.sub_service_id
            LEFT JOIN plans p    ON p.id = ob.plan_id
            LEFT JOIN users u    ON u.id = ob.user_id
            LEFT JOIN drivers d  ON d.id = ob.driver_id
            LEFT JOIN driver_reviews dr ON dr.booking_type = 'onspot' AND dr.booking_id = ob.id
            ${where}
            ORDER BY ob.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        // Same plan-driven split as parcel; on-spot also has no persisted cancellation-fee column.
        // Company's cut also includes the plan's platform_fee/access_fee (flat or percent,
        // already resolved into a rupee amount at booking time — see onspotController.createBooking).
        // There's no generic `paid` column here at all — only `token_paid`/`balance_paid` — so
        // "settled" means the full balance has been collected, i.e. balance_paid = 1.
        const data = rows.map(b => ({
            ...b,
            paid: Number(b.balance_paid) === 1 ? 1 : 0,
            total_amount: parseFloat(b.total_fare || 0),
            company_amount: parseFloat(b.plan_company_commission || 0)
                + parseFloat(b.platform_fee || 0) + parseFloat(b.access_fee || 0),
            captain_amount: parseFloat(b.plan_captain_commission || 0),
        }));

        return res.json({
            status: true,
            message: "On-spot bookings fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data
        });
    } catch (error) {
        console.error("onspot adminGetAllBookings error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};
