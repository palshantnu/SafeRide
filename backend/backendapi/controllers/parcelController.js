const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { notifyUser, notifyDriversByService, notifyDriver } = require("../services/notification");

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const genId  = (prefix) => prefix + uuidv4().slice(0, 10).toUpperCase();
const genOtp = () => String(Math.floor(1000 + Math.random() * 9000));


const actorType = (req) => {
    if (req.user.role === "driver") return "DRIVER";
    if (!req.user.role)             return "BA";
    return "USER";
};

const PARCEL_PACKAGING = ["Plastic", "Paper", "Carton", "Glass", "Iron"];
const PARCEL_LOADING    = ["User End", "Captain End"];

const PARCEL_FIELDS = `
    pb.id, pb.parcel_booking_id, pb.user_id, pb.driver_id, pb.bussinessassociate_id,
    pb.service_id, pb.sub_service_id, pb.plan_id,
    pb.pickup_city, pb.pickup_date, pb.pickup_time,
    pb.pickup_address, pb.pickup_landmark,
    pb.drop_city, pb.drop_address, pb.drop_landmark,
    pb.receiver_name, pb.receiver_mobile, pb.approx_weight, pb.weight_type, pb.packaging_material_type, pb.loading_unloading,
    pb.remarks, pb.amount, pb.actual_amount, pb.token_amount, pb.balance_amount,
    pb.payment_mode, pb.paid, pb.paid_at, pb.balance_paid,
    pb.pickup_image, pb.delivery_image,
    pb.pickup_otp_verified, pb.delivery_otp_verified,
    pb.status, pb.user_status, pb.driver_status, pb.cancelled_by, pb.cancel_reason, pb.user_rated,
    pb.completed_at, pb.delivered_at, pb.created_at, pb.updated_at
`;

exports.createBooking = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can create a parcel booking" });
        }
        const user_id = req.user.id;

        const {
            service_id, sub_service_id, plan_id,
            pickup_city, pickup_date, pickup_time,
            pickup_address, pickup_landmark,
            drop_city, drop_address, drop_landmark,
            receiver_name, receiver_mobile, approx_weight, weight_type,
            packaging_material_type, loading_unloading, remarks
        } = req.body;

        const required = { service_id, plan_id, pickup_city, pickup_date, pickup_time, pickup_address,
            drop_city, drop_address, receiver_name, receiver_mobile, approx_weight,
            packaging_material_type, loading_unloading };
        const missing = Object.keys(required).filter((k) => required[k] === undefined || required[k] === "" || required[k] === null);
        if (missing.length) {
            return res.status(400).json({ status: false, message: `Required: ${missing.join(", ")}` });
        }

        if (!PARCEL_PACKAGING.includes(packaging_material_type)) {
            return res.status(400).json({ status: false, message: `packaging_material_type must be one of: ${PARCEL_PACKAGING.join(", ")}` });
        }

        if (!PARCEL_LOADING.includes(loading_unloading)) {
            return res.status(400).json({ status: false, message: `loading_unloading must be one of: ${PARCEL_LOADING.join(", ")}` });
        }

        const [[service]] = await db.execute(
            `SELECT id FROM services WHERE id = ? AND status = 1 AND deleted_at IS NULL`,
            [parseInt(service_id)]
        );
        if (!service) return res.status(400).json({ status: false, message: "Invalid service" });

        const [[plan]] = await db.execute(
            `SELECT id, service_id, sub_service_id, token_price, plan_price
             FROM plans WHERE id = ? AND status = 1 AND deleted_at IS NULL`,
            [parseInt(plan_id)]
        );
        if (!plan) return res.status(400).json({ status: false, message: "Invalid plan" });
        if (parseInt(plan.service_id) !== parseInt(service_id)) {
            return res.status(400).json({ status: false, message: "Plan does not belong to this service" });
        }
        if (sub_service_id && plan.sub_service_id && parseInt(plan.sub_service_id) !== parseInt(sub_service_id)) {
            return res.status(400).json({ status: false, message: "Plan does not belong to this sub-service" });
        }

        const amount       = parseFloat(plan.plan_price)  || 0;
        const token_amount = parseFloat(plan.token_price) || 0;
        const balance_amount = Math.max(0, Math.round((amount - token_amount) * 100) / 100);

        const parcel_booking_id = genId("PB");
        const pickup_otp   = genOtp();
        const delivery_otp = genOtp();

        await db.execute(`
            INSERT INTO parcel_bookings
                (parcel_booking_id, user_id, service_id, sub_service_id, plan_id,
                 pickup_city, pickup_date, pickup_time,
                 pickup_address, pickup_landmark,
                 drop_city, drop_address, drop_landmark,
                 receiver_name, receiver_mobile, approx_weight, weight_type, packaging_material_type, loading_unloading,
                 remarks, amount, actual_amount, token_amount, balance_amount,
                 pickup_otp, delivery_otp, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
        `, [
            parcel_booking_id, user_id, parseInt(service_id), sub_service_id || null, parseInt(plan_id),
            pickup_city, pickup_date, pickup_time,
            pickup_address, pickup_landmark || null,
            drop_city, drop_address, drop_landmark || null,
            receiver_name, receiver_mobile, parseFloat(approx_weight), weight_type || null, packaging_material_type, loading_unloading,
            remarks || null, amount, amount, token_amount, balance_amount,
            pickup_otp, delivery_otp
        ]);

        await notifyDriversByService(parseInt(service_id), sub_service_id ? parseInt(sub_service_id) : null,
            "New parcel booking", `New parcel pickup from ${pickup_city}`, { type: "NEW_PARCEL_BOOKING", parcel_booking_id });

        return res.json({
            status: true,
            message: "Parcel booking created. Waiting for a captain to accept.",
            parcel_booking_id,
            fare: {
                amount: amount.toFixed(2),
                token_amount: token_amount.toFixed(2),
                balance_amount: balance_amount.toFixed(2)
            }
        });

    } catch (error) {
        console.error("parcel createBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.myBookings = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can view their parcel bookings" });
        }
        const user_id = req.user.id;
        const { status, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [`pb.user_id = ?`, `pb.deleted_at IS NULL`];
        const values     = [user_id];
        if (status) { conditions.push(`pb.status = ?`); values.push(String(status).toLowerCase()); }
        const where = `WHERE ${conditions.join(" AND ")}`;

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM parcel_bookings pb ${where}`, values);
        const [rows] = await db.execute(`
            SELECT ${PARCEL_FIELDS}, pb.pickup_otp,pb.delivery_otp
            FROM parcel_bookings pb
            ${where}
            ORDER BY pb.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        const data = rows.map(r => ({
            ...r,
            rating_status: r.status === 'delivered'
                ? (Number(r.user_rated) === 1 ? 'FINISHED' : 'RATING_PENDING')
                : null
        }));

        return res.json({
            status: true,
            message: "Parcel bookings fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data
        });
    } catch (error) {
        console.error("parcel myBookings error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /parcel/booking/:parcel_booking_id
exports.bookingDetail = async (req, res) => {
    try {
        const { parcel_booking_id } = req.params;
        const actor = actorType(req);

        const [[booking]] = await db.execute(`
            SELECT ${PARCEL_FIELDS}, pb.pickup_otp, pb.delivery_otp,
                   s.title AS service_name, p.plan_name,
                   u.name AS user_name, u.mobile AS user_mobile,
                   d.full_name AS driver_name, d.phone AS driver_phone
            FROM parcel_bookings pb
            LEFT JOIN services s ON s.id = pb.service_id
            LEFT JOIN plans p    ON p.id = pb.plan_id
            LEFT JOIN users u    ON u.id = pb.user_id
            LEFT JOIN drivers d  ON d.id = pb.driver_id
            WHERE pb.parcel_booking_id = ? AND pb.deleted_at IS NULL
        `, [parcel_booking_id]);

        if (!booking) return res.status(404).json({ status: false, message: "Parcel booking not found" });

        // access: owner user, assigned driver, or owning BA
        const uid = req.user.id;
        const allowed =
            (actor === "USER"   && booking.user_id === uid) ||
            (actor === "DRIVER" && booking.driver_id === uid) ||
            (actor === "BA"     && booking.bussinessassociate_id === uid);
        if (!allowed) return res.status(403).json({ status: false, message: "Not allowed to view this booking" });

        return res.json({ status: true, message: "Parcel booking detail", data: booking });
    } catch (error) {
        console.error("parcel bookingDetail error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /parcel/booking/pay-token  — user pays token (after a captain accepts) → booking confirmed
exports.payToken = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can pay" });
        }
        const user_id = req.user.id;
        const { parcel_booking_id } = req.body;
        if (!parcel_booking_id) return res.status(400).json({ status: false, message: "parcel_booking_id is required" });

        const [[booking]] = await db.execute(
            `SELECT id, status, driver_id, paid, token_amount FROM parcel_bookings
             WHERE parcel_booking_id = ? AND user_id = ? AND deleted_at IS NULL`,
            [parcel_booking_id, user_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Parcel booking not found" });
        if (booking.status === "cancelled") return res.status(400).json({ status: false, message: "Booking is cancelled" });
        if (!booking.driver_id) return res.status(400).json({ status: false, message: "No captain has accepted yet" });
        if (booking.paid) return res.status(400).json({ status: false, message: "Token already paid" });

        await db.execute(`
            UPDATE parcel_bookings
            SET paid = 1, paid_at = NOW(), payment_mode = 'ONLINE',
                status = 'TOKEN_PAID', user_status = 'TOKEN_PAID', updated_at = NOW()
            WHERE id = ?
        `, [booking.id]);

        // notify assigned driver that token was paid
        try {
            if (booking.driver_id) {
                await notifyDriver(booking.driver_id, "Token paid",
                    `User paid token for parcel ${parcel_booking_id}`,
                    { type: "TOKEN_PAID", parcel_booking_id }
                );
            }
        } catch (nerr) {
            console.error("notification send error:", nerr.message);
        }

        return res.json({
            status: true,
            message: "Token paid online. Booking confirmed.",
            parcel_booking_id,
            token_paid: parseFloat(booking.token_amount).toFixed(2),
        });
    } catch (error) {
        console.error("parcel payToken error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /parcel/booking/pay-balance  — user pays remaining balance online (optional, before delivery)
exports.payBalance = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can pay" });
        }
        const user_id = req.user.id;
        const { parcel_booking_id } = req.body;
        if (!parcel_booking_id) return res.status(400).json({ status: false, message: "parcel_booking_id is required" });

        const [[booking]] = await db.execute(
            `SELECT id, status, paid, balance_paid, balance_amount FROM parcel_bookings
             WHERE parcel_booking_id = ? AND user_id = ? AND deleted_at IS NULL`,
            [parcel_booking_id, user_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Parcel booking not found" });
        if (booking.status === "cancelled") return res.status(400).json({ status: false, message: "Booking is cancelled" });
        if (!booking.paid) return res.status(400).json({ status: false, message: "Token not paid yet" });
        if (booking.balance_paid) return res.status(400).json({ status: false, message: "Balance already paid" });

        await db.execute(
            `UPDATE parcel_bookings SET balance_paid = 1, payment_mode = 'ONLINE', updated_at = NOW() WHERE id = ?`,
            [booking.id]
        );

        // notify assigned driver that balance was paid
        try {
            if (booking.driver_id) {
                await notifyDriver(booking.driver_id, "Balance paid",
                    `User paid remaining balance for parcel ${parcel_booking_id}`,
                    { type: "BALANCE_PAID", parcel_booking_id }
                );
            }
        } catch (nerr) {
            console.error("notification send error:", nerr.message);
        }

        return res.json({
            status: true,
            message: "Balance paid online.",
            parcel_booking_id,
            balance_paid: parseFloat(booking.balance_amount).toFixed(2),
        });
    } catch (error) {
        console.error("parcel payBalance error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /parcel/booking/cancel  — user cancels (before pickup)
exports.cancelBooking = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can cancel their booking" });
        }
        const user_id = req.user.id;
        const { parcel_booking_id, cancel_reason } = req.body;
        if (!parcel_booking_id) return res.status(400).json({ status: false, message: "parcel_booking_id is required" });

        const [[booking]] = await db.execute(
            `SELECT id, status FROM parcel_bookings WHERE parcel_booking_id = ? AND user_id = ? AND deleted_at IS NULL`,
            [parcel_booking_id, user_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Parcel booking not found" });
        if (["picked_up", "in_transit", "out_for_delivery", "delivered", "cancelled"].includes(booking.status)) {
            return res.status(400).json({ status: false, message: `Cannot cancel. Status: ${booking.status}` });
        }

        await db.execute(`
            UPDATE parcel_bookings
            SET status = 'cancelled', cancelled_by = 'user', cancel_reason = ?, updated_at = NOW()
            WHERE id = ?
        `, [cancel_reason || null, booking.id]);

        return res.json({ status: true, message: "Parcel booking cancelled" });
    } catch (error) {
        console.error("parcel cancelBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /parcel/current-booking  — user's ongoing parcel (not delivered/cancelled)
exports.currentBooking = async (req, res) => {
    try {
        if (actorType(req) !== "USER") {
            return res.status(403).json({ status: false, message: "Only a user can view their current parcel" });
        }
        const user_id = req.user.id;

        // a user can have several parcels in transit at once → return them all
        const [rows] = await db.execute(`
            SELECT ${PARCEL_FIELDS}, pb.pickup_otp, pb.delivery_otp,
                   s.title AS service_name, p.plan_name,
                   d.full_name AS driver_name, d.phone AS driver_phone
            FROM parcel_bookings pb
            LEFT JOIN services s ON s.id = pb.service_id
            LEFT JOIN plans p    ON p.id = pb.plan_id
            LEFT JOIN drivers d  ON d.id = pb.driver_id
            WHERE pb.user_id = ?
              AND pb.deleted_at IS NULL
              AND pb.status != 'cancelled'
              -- keep a delivered parcel visible until the user rates the captain
              AND (pb.status != 'delivered' OR pb.user_rated = 0)
            ORDER BY pb.id DESC
        `, [user_id]);

        const data = rows.map(r => ({
            ...r,
            rating_status: r.status === 'delivered'
                ? (Number(r.user_rated) === 1 ? 'FINISHED' : 'RATING_PENDING')
                : null
        }));

        return res.json({ status: true, message: "Current parcel bookings", count: data.length, data });
    } catch (error) {
        console.error("parcel currentBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};


exports.availableParcels = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only a captain can view available parcels" });
        }
        const driver_id = req.user.id;
        const { page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const [[driver]] = await db.execute(`SELECT id, service_id, status FROM drivers WHERE id = ?`, [driver_id]);
        if (!driver) return res.status(404).json({ status: false, message: "Driver not found" });

        const where = `WHERE pb.status = 'pending' AND pb.driver_id IS NULL AND pb.service_id = ? AND pb.deleted_at IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM parcel_rejections pr
                WHERE pr.parcel_id = pb.id AND pr.actor_type = 'DRIVER' AND pr.actor_id = ?
            )`;
        const values = [parseInt(driver.service_id), driver_id];

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM parcel_bookings pb ${where}`, values);
        const [rows] = await db.execute(`
            SELECT ${PARCEL_FIELDS}, s.title AS service_name, p.plan_name,
                   pb.amount AS total_fare,
                   COALESCE(p.plan_captain_commission, 0) AS driver_amount
            FROM parcel_bookings pb
            LEFT JOIN services s ON s.id = pb.service_id
            LEFT JOIN plans p    ON p.id = pb.plan_id
            ${where}
            ORDER BY pb.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "Available parcels fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("parcel availableParcels error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /parcel/driver/accept  — driver accepts a pending parcel
exports.acceptParcel = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only a captain can accept parcels" });
        }
        const driver_id = req.user.id;
        const { parcel_booking_id } = req.body;
        if (!parcel_booking_id) return res.status(400).json({ status: false, message: "parcel_booking_id is required" });

        const [[driver]] = await db.execute(`SELECT id, service_id, status FROM drivers WHERE id = ?`, [driver_id]);
        if (!driver) return res.status(404).json({ status: false, message: "Driver not found" });
        if (driver.status !== "approved") return res.status(403).json({ status: false, message: "Please get your KYC approved — only then you can accept parcels." });

        const [[booking]] = await db.execute(
            `SELECT id, user_id, status, driver_id, service_id FROM parcel_bookings WHERE parcel_booking_id = ? AND deleted_at IS NULL`,
            [parcel_booking_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Parcel booking not found" });
        if (booking.status !== "pending" || booking.driver_id) {
            return res.status(400).json({ status: false, message: "Parcel is no longer available" });
        }
        if (parseInt(booking.service_id) !== parseInt(driver.service_id)) {
            return res.status(403).json({ status: false, message: "You are not registered for this service" });
        }

        await db.execute(`
            UPDATE parcel_bookings
            SET driver_id = ?, status = 'accepted', driver_status = 'ACCEPTED', updated_at = NOW()
            WHERE id = ? AND driver_id IS NULL AND status = 'pending'
        `, [driver_id, booking.id]);

        await notifyUser(booking.user_id, "Captain assigned",
            "A captain has accepted your parcel. Please pay the token to confirm.", { type: "PARCEL_ACCEPTED", parcel_booking_id });

        return res.json({ status: true, message: "Parcel accepted. Ask the user to pay token to confirm." });
    } catch (error) {
        console.error("parcel acceptParcel error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// find a parcel the logged-in captain is operating
const findDriverParcel = async (parcel_booking_id, driver_id) => {
    const [[booking]] = await db.execute(
        `SELECT * FROM parcel_bookings WHERE parcel_booking_id = ? AND driver_id = ? AND deleted_at IS NULL`,
        [parcel_booking_id, driver_id]
    );
    return booking;
};

// POST /parcel/driver/arrive  — captain reached pickup point
exports.arrive = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only the assigned captain can do this" });
        }
        const driver_id = req.user.id;
        const { parcel_booking_id } = req.body;
        if (!parcel_booking_id) return res.status(400).json({ status: false, message: "parcel_booking_id is required" });

        const booking = await findDriverParcel(parcel_booking_id, driver_id);
        if (!booking) return res.status(404).json({ status: false, message: "Parcel not found or not assigned to you" });
        if (!["accepted", "TOKEN_PAID"].includes(booking.status)) {
            return res.status(400).json({ status: false, message: `Cannot arrive. Status: ${booking.status}` });
        }
        if (!booking.paid) {
            return res.status(400).json({ status: false, message: "Booking not confirmed yet (token unpaid)" });
        }

        await db.execute(
            `UPDATE parcel_bookings SET status = 'pickup_reached', driver_status = 'ARRIVED', updated_at = NOW() WHERE id = ?`,
            [booking.id]
        );

        await notifyUser(booking.user_id, "Captain arrived",
            "Your captain has reached the pickup location.", { type: "PARCEL_ARRIVED", parcel_booking_id });

        return res.json({ status: true, message: "Marked as arrived at pickup. Verify pickup OTP to collect the parcel." });
    } catch (error) {
        console.error("parcel arrive error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /parcel/driver/pickup-otp  — captain verifies pickup OTP + uploads parcel image
exports.verifyPickupOtp = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only the assigned captain can do this" });
        }
        const driver_id = req.user.id;
        const { parcel_booking_id, otp } = req.body;
        if (!parcel_booking_id || !otp) {
            return res.status(400).json({ status: false, message: "parcel_booking_id and otp are required" });
        }

        const booking = await findDriverParcel(parcel_booking_id, driver_id);
        if (!booking) return res.status(404).json({ status: false, message: "Parcel not found or not assigned to you" });
        if (booking.status !== "pickup_reached") {
            return res.status(400).json({ status: false, message: `Verify pickup only after arriving. Status: ${booking.status}` });
        }
        if (String(booking.pickup_otp) !== String(otp)) {
            return res.status(400).json({ status: false, message: "Invalid pickup OTP" });
        }

        const pickup_image = req.file?.filename || booking.pickup_image || null;

        await db.execute(`
            UPDATE parcel_bookings
            SET pickup_otp_verified = 1, pickup_otp_verified_at = NOW(),
                pickup_image = ?, status = 'picked_up', driver_status = 'PICKED_UP', updated_at = NOW()
            WHERE id = ?
        `, [pickup_image, booking.id]);

        await notifyUser(booking.user_id, "Parcel picked up",
            "Your parcel has been picked up and is on the way.", { type: "PARCEL_PICKED_UP", parcel_booking_id });

        return res.json({ status: true, message: "Pickup OTP verified. Parcel picked up." });
    } catch (error) {
        console.error("parcel verifyPickupOtp error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /parcel/driver/delivery-otp  — captain verifies delivery OTP + uploads proof → completed
exports.verifyDeliveryOtp = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only the assigned captain can do this" });
        }
        const driver_id = req.user.id;
        const { parcel_booking_id, otp } = req.body;
        if (!parcel_booking_id || !otp) {
            return res.status(400).json({ status: false, message: "parcel_booking_id and otp are required" });
        }

        const booking = await findDriverParcel(parcel_booking_id, driver_id);
        if (!booking) return res.status(404).json({ status: false, message: "Parcel not found or not assigned to you" });
        if (!["picked_up", "in_transit", "out_for_delivery"].includes(booking.status)) {
            return res.status(400).json({ status: false, message: `Parcel not picked up yet. Status: ${booking.status}` });
        }
        if (String(booking.delivery_otp) !== String(otp)) {
            return res.status(400).json({ status: false, message: "Invalid delivery OTP" });
        }

        const delivery_image = req.file?.filename || booking.delivery_image || null;

        await db.execute(`
            UPDATE parcel_bookings
            SET delivery_otp_verified = 1, delivery_otp_verified_at = NOW(),
                delivery_image = ?, status = 'delivered', driver_status = 'DELIVERED',
                delivered_at = NOW(), completed_at = NOW(), updated_at = NOW()
            WHERE id = ?
        `, [delivery_image, booking.id]);

        await notifyUser(booking.user_id, "Parcel delivered",
            "Your parcel has been delivered. Please rate the captain.", { type: "PARCEL_DELIVERED", parcel_booking_id });

        return res.json({ status: true, message: "Delivery OTP verified. Parcel delivered & completed." });
    } catch (error) {
        console.error("parcel verifyDeliveryOtp error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /parcel/driver/my-deliveries
exports.myDeliveries = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only a captain can view deliveries" });
        }
        const driver_id = req.user.id;
        const { status, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [`pb.driver_id = ?`, `pb.deleted_at IS NULL`];
        const values     = [driver_id];
        if (status) { conditions.push(`pb.status = ?`); values.push(String(status).toLowerCase()); }
        const where = `WHERE ${conditions.join(" AND ")}`;

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM parcel_bookings pb ${where}`, values);
        const [rows] = await db.execute(`
            SELECT ${PARCEL_FIELDS}, u.name AS user_name, u.mobile AS user_mobile,
                   COALESCE(p.plan_captain_commission, 0) AS driver_amount
            FROM parcel_bookings pb
            LEFT JOIN users u ON u.id = pb.user_id
            LEFT JOIN plans p ON p.id = pb.plan_id
            ${where}
            ORDER BY pb.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "Deliveries fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("parcel myDeliveries error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /parcel/driver/cancel  — captain cancels before pickup
exports.driverCancel = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only the assigned captain can cancel" });
        }
        const driver_id = req.user.id;
        const { parcel_booking_id, cancel_reason } = req.body;
        if (!parcel_booking_id) return res.status(400).json({ status: false, message: "parcel_booking_id is required" });

        const booking = await findDriverParcel(parcel_booking_id, driver_id);
        if (!booking) return res.status(404).json({ status: false, message: "Parcel not found or not assigned to you" });
        if (["picked_up", "in_transit", "out_for_delivery", "delivered", "cancelled"].includes(booking.status)) {
            return res.status(400).json({ status: false, message: `Cannot cancel. Status: ${booking.status}` });
        }

        await db.execute(`
            UPDATE parcel_bookings
            SET status = 'cancelled', cancelled_by = 'driver', cancel_reason = ?, updated_at = NOW()
            WHERE id = ?
        `, [cancel_reason || null, booking.id]);

        return res.json({ status: true, message: "Parcel cancelled by captain" });
    } catch (error) {
        console.error("parcel driverCancel error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /parcel/driver/current-delivery  — captain's ongoing parcel (not delivered/cancelled)
exports.driverCurrentDelivery = async (req, res) => {
    try {
        if (actorType(req) !== "DRIVER") {
            return res.status(403).json({ status: false, message: "Only a captain can view their current delivery" });
        }
        const driver_id = req.user.id;
        
        const [rows] = await db.execute(`
            SELECT ${PARCEL_FIELDS}, pb.pickup_otp, pb.delivery_otp,
                   s.title AS service_name, p.plan_name,
                   pb.amount AS total_fare,
                   COALESCE(p.plan_captain_commission, 0) AS driver_amount,
                   u.name AS user_name, u.mobile AS user_mobile
            FROM parcel_bookings pb
            LEFT JOIN services s ON s.id = pb.service_id
            LEFT JOIN plans p    ON p.id = pb.plan_id
            LEFT JOIN users u    ON u.id = pb.user_id
            WHERE pb.driver_id = ?
              AND pb.deleted_at IS NULL
              AND pb.status NOT IN ('delivered', 'cancelled')
            ORDER BY pb.id DESC
        `, [driver_id]);
        

        return res.json({ status: true, message: "Current deliveries", count: rows.length, data: rows });
    } catch (error) {
        console.error("parcel driverCurrentDelivery error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  BUSINESS ASSOCIATE  —  ACCEPT & ASSIGN TO OWN CAPTAIN
// ═══════════════════════════════════════════════════════════════════════════════

// GET /parcel/ba/available  — pending parcels a BA can accept
exports.baAvailableParcels = async (req, res) => {
    try {
        if (actorType(req) !== "BA") {
            return res.status(403).json({ status: false, message: "Only a business associate can view this" });
        }
        const { page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const ba_id = req.user.id;
        const where = `WHERE pb.status = 'pending' AND pb.driver_id IS NULL AND pb.bussinessassociate_id IS NULL AND pb.deleted_at IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM parcel_rejections pr
                WHERE pr.parcel_id = pb.id AND pr.actor_type = 'BA' AND pr.actor_id = ?
            )`;
        const baValues = [ba_id];

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM parcel_bookings pb ${where}`, baValues);
        const [rows] = await db.execute(`
            SELECT ${PARCEL_FIELDS}, s.title AS service_name, p.plan_name
            FROM parcel_bookings pb
            LEFT JOIN services s ON s.id = pb.service_id
            LEFT JOIN plans p    ON p.id = pb.plan_id
            ${where}
            ORDER BY pb.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, baValues);

        return res.json({
            status: true,
            message: "Available parcels fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("parcel baAvailableParcels error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /parcel/ba/accept-assign  — BA accepts a parcel and assigns one of its captains
exports.baAcceptAndAssign = async (req, res) => {
    try {
        if (actorType(req) !== "BA") {
            return res.status(403).json({ status: false, message: "Only a business associate can assign captains" });
        }
        const ba_id = req.user.id;
        const { parcel_booking_id, driver_id } = req.body;
        if (!parcel_booking_id || !driver_id) {
            return res.status(400).json({ status: false, message: "parcel_booking_id and driver_id are required" });
        }

        const [[booking]] = await db.execute(
            `SELECT id, status, driver_id FROM parcel_bookings WHERE parcel_booking_id = ? AND deleted_at IS NULL`,
            [parcel_booking_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Parcel booking not found" });
        if (booking.status !== "pending" || booking.driver_id) {
            return res.status(400).json({ status: false, message: "Parcel is no longer available" });
        }

        // captain must belong to this BA and be approved
        const [[driver]] = await db.execute(
            `SELECT id, full_name, status FROM drivers WHERE id = ? AND ba_id = ?`,
            [parseInt(driver_id), ba_id]
        );
        if (!driver) return res.status(404).json({ status: false, message: "Captain not found under your account" });
        if (driver.status !== "approved") return res.status(400).json({ status: false, message: "Captain is not approved" });

        await db.execute(`
            UPDATE parcel_bookings
            SET bussinessassociate_id = ?, driver_id = ?, status = 'accepted',
                driver_status = 'ASSIGNED', updated_at = NOW()
            WHERE id = ? AND driver_id IS NULL AND status = 'pending'
        `, [ba_id, driver.id, booking.id]);

        return res.json({
            status: true,
            message: "Parcel accepted and assigned to captain. Ask the user to pay token to confirm.",
            parcel_booking_id,
            assigned_driver: { id: driver.id, full_name: driver.full_name }
        });
    } catch (error) {
        console.error("parcel baAcceptAndAssign error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /parcel/ba/list  — parcels handled by this BA
exports.baParcels = async (req, res) => {
    try {
        if (actorType(req) !== "BA") {
            return res.status(403).json({ status: false, message: "Only a business associate can view this" });
        }
        const ba_id = req.user.id;
        const { status, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [`pb.bussinessassociate_id = ?`, `pb.deleted_at IS NULL`];
        const values     = [ba_id];
        if (status) { conditions.push(`pb.status = ?`); values.push(String(status).toLowerCase()); }
        const where = `WHERE ${conditions.join(" AND ")}`;

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM parcel_bookings pb ${where}`, values);
        const [rows] = await db.execute(`
            SELECT ${PARCEL_FIELDS}, u.name AS user_name, u.mobile AS user_mobile,
                   d.full_name AS driver_name, d.phone AS driver_phone
            FROM parcel_bookings pb
            LEFT JOIN users u   ON u.id = pb.user_id
            LEFT JOIN drivers d ON d.id = pb.driver_id
            ${where}
            ORDER BY pb.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "BA parcels fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("parcel baParcels error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /parcel/ba/current  — parcels this BA is currently handling (not delivered/cancelled)
exports.baCurrentParcels = async (req, res) => {
    try {
        if (actorType(req) !== "BA") {
            return res.status(403).json({ status: false, message: "Only a business associate can view this" });
        }
        const ba_id = req.user.id;

        const [rows] = await db.execute(`
            SELECT ${PARCEL_FIELDS}, pb.pickup_otp, pb.delivery_otp,
                   s.title AS service_name, p.plan_name,
                   u.name AS user_name, u.mobile AS user_mobile,
                   d.full_name AS driver_name, d.phone AS driver_phone
            FROM parcel_bookings pb
            LEFT JOIN services s ON s.id = pb.service_id
            LEFT JOIN plans p    ON p.id = pb.plan_id
            LEFT JOIN users u    ON u.id = pb.user_id
            LEFT JOIN drivers d  ON d.id = pb.driver_id
            WHERE pb.bussinessassociate_id = ?
              AND pb.deleted_at IS NULL
              AND pb.status NOT IN ('delivered', 'cancelled')
            ORDER BY pb.id DESC
        `, [ba_id]);

        return res.json({ status: true, message: "Current BA parcels", count: rows.length, data: rows });
    } catch (error) {
        console.error("parcel baCurrentParcels error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.rejectParcel = async (req, res) => {
    try {
        const actor = actorType(req);
        if (actor !== "DRIVER" && actor !== "BA") {
            return res.status(403).json({ status: false, message: "Only a captain or business associate can reject a parcel" });
        }
        const uid = req.user.id;
        const { parcel_booking_id, reject_reason } = req.body;
        if (!parcel_booking_id) return res.status(400).json({ status: false, message: "parcel_booking_id is required" });

        const [[booking]] = await db.execute(
            `SELECT id, status FROM parcel_bookings WHERE parcel_booking_id = ? AND deleted_at IS NULL`,
            [parcel_booking_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Parcel booking not found" });

        // a request can only be declined while it is still open (pending & unassigned)
        if (booking.status !== "pending") {
            return res.status(400).json({ status: false, message: `Cannot reject. Parcel is already ${booking.status}` });
        }

        // remember this actor declined it, so it won't be offered to them again
        await db.execute(`
            INSERT INTO parcel_rejections (parcel_id, actor_type, actor_id, reason, created_at)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE reason = VALUES(reason), created_at = NOW()
        `, [booking.id, actor, uid, reject_reason || null]);

        return res.json({
            status: true,
            message: "Request rejected. It won't be shown to you again."
        });
    } catch (error) {
        console.error("parcel rejectParcel error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN  —  all parcel bookings
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/parcel/bookings
exports.adminGetAllBookings = async (req, res) => {
    try {
        const { status, service_id, city, from_date, to_date, search, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [`pb.deleted_at IS NULL`];
        const values     = [];
        if (status)     { conditions.push(`pb.status = ?`);            values.push(String(status).toLowerCase()); }
        if (service_id) { conditions.push(`pb.service_id = ?`);        values.push(parseInt(service_id)); }
        if (city)       { conditions.push(`(pb.pickup_city LIKE ? OR pb.drop_city LIKE ?)`); values.push(`%${city}%`, `%${city}%`); }
        if (from_date)  { conditions.push(`DATE(pb.created_at) >= ?`); values.push(from_date); }
        if (to_date)    { conditions.push(`DATE(pb.created_at) <= ?`); values.push(to_date); }
        if (search)     {
            conditions.push(`(pb.parcel_booking_id LIKE ? OR u.name LIKE ? OR u.mobile LIKE ?)`);
            const like = `%${search}%`;
            values.push(like, like, like);
        }
        const where = `WHERE ${conditions.join(" AND ")}`;

        const [[{ total }]] = await db.execute(`
            SELECT COUNT(*) AS total
            FROM parcel_bookings pb
            LEFT JOIN users u ON u.id = pb.user_id
            ${where}
        `, values);

        const [rows] = await db.execute(`
            SELECT ${PARCEL_FIELDS},
                   pb.parcel_booking_id AS booking_id,
                   pb.amount AS total_fare,
                   pb.actual_amount AS actual_fare,
                   TIMESTAMP(pb.pickup_date, pb.pickup_time) AS schedule_date,
                   s.title AS service_name, ss.title AS sub_service_name, p.plan_name,
                   u.name AS user_name, u.mobile AS user_mobile,
                   d.full_name AS driver_name, d.phone AS driver_phone, d.phone AS driver_mobile
            FROM parcel_bookings pb
            LEFT JOIN services s ON s.id = pb.service_id
            LEFT JOIN sub_services ss ON ss.id = pb.sub_service_id
            LEFT JOIN plans p    ON p.id = pb.plan_id
            LEFT JOIN users u    ON u.id = pb.user_id
            LEFT JOIN drivers d  ON d.id = pb.driver_id
            ${where}
            ORDER BY pb.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "Parcel bookings fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });
    } catch (error) {
        console.error("parcel adminGetAllBookings error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};
