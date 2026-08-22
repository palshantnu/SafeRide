const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");
const { notifyUser, notifyDriver } = require("../services/notification");

//─── HELPER ──────────────────────────────────────────────────────────────────
const genId  = (prefix) => prefix + uuidv4().slice(0, 8).toUpperCase();
const genOtp = () => Math.floor(1000 + Math.random() * 9000);

const cancelWindow = (departure_time) => {
    const hrs = moment(departure_time).diff(moment(), "hours", true);
    if (hrs >= 48) return "before48";
    if (hrs >= 24) return "24to48";
    return "0to24"; 
};


const calcCancelCharge = (type, amount, base) => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return 0;
    const charge = (String(type).toLowerCase() === "percent")
        ? (parseFloat(base) * amt) / 100
        : amt;              
    return Math.round(charge * 100) / 100;
};

// find a trip that the logged-in driver is allowed to OPERATE (arrive/start/complete/verify-otp):
//   - a DRIVER trip they created themselves, OR
//   - a BA trip that has been assigned to them as captain
const findOperableTrip = async (trip_id, driver_id) => {
    const [[trip]] = await db.execute(`
        SELECT id, status FROM sigi_trips
        WHERE trip_id = ?
          AND ( (creator_type = 'DRIVER' AND creator_id = ?)
             OR (creator_type = 'BA'     AND assigned_driver_id = ?) )
    `, [trip_id, driver_id, driver_id]);
    return trip;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  DRIVER / BA  —  TRIP MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// POST /sigi/trip/create   (driver or BA)
exports.createTrip = async (req, res) => {
    try {
        const creator_id   = req.user.id;
        const creator_type = req.user.role === "driver" ? "DRIVER" : "BA";

        const {
            service_id,
            from_city, to_city, pickup_address,
            departure_time, total_seats,
            token_fare, full_fare
        } = req.body;

        if (!service_id || !from_city || !to_city || !departure_time || !total_seats || !token_fare || !full_fare) {
            return res.status(400).json({
                status: false,
                message: "service_id, from_city, to_city, departure_time, total_seats, token_fare, full_fare are required"
            });
        }

        // validate service exists
        const [[service]] = await db.execute(
            `SELECT id FROM services WHERE id = ? AND status = 1 AND deleted_at IS NULL`,
            [parseInt(service_id)]
        );
        
        if (!service) return res.status(400).json({ status: false, message: "Invalid service" });

        // validate creator is registered for this service
        if (creator_type === "DRIVER") {
            const [[driver]] = await db.execute(
                `SELECT id, service_id, status FROM drivers WHERE id = ?`, [creator_id]
            );
            if (!driver) return res.status(404).json({ status: false, message: "Driver not found" });
            if (driver.status !== "approved") {
                return res.status(403).json({ status: false, message: "Your account is not approved yet. Please wait for admin approval." });
            }
            if (parseInt(driver.service_id) !== parseInt(service_id)) {
                return res.status(403).json({ status: false, message: "You are not registered for this service" });
            }
        } else {
            const [[baService]] = await db.execute(
                `SELECT id FROM ba_services WHERE ba_id = ? AND service_id = ?`,
                [creator_id, parseInt(service_id)]
            );
            if (!baService) {
                return res.status(403).json({ status: false, message: "You are not registered for this service" });
            }
        }

        const departureMoment = moment(departure_time);
        if (!departureMoment.isValid()) {
            return res.status(400).json({ status: false, message: "departure_time is not a valid date" });
        }
        if (!departureMoment.isAfter(moment())) {
            return res.status(400).json({ status: false, message: "departure_time must be in the future" });
        }
        const formattedDeparture = departureMoment.format("YYYY-MM-DD HH:mm:ss");

        const seats = parseInt(total_seats);
        if (seats < 1) {
            return res.status(400).json({ status: false, message: "total_seats must be at least 1" });
        }

        const trip_id = genId("ST");

        await db.execute(`
            INSERT INTO sigi_trips
                (trip_id, creator_type, creator_id, service_id,
                 from_city, to_city, pickup_address,
                 departure_time, total_seats, available_seats,
                 token_fare, full_fare, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPCOMING', NOW(), NOW())
        `, [
            trip_id, creator_type, creator_id, parseInt(service_id),
            from_city, to_city, pickup_address || null,
            formattedDeparture, seats, seats,
            parseFloat(token_fare), parseFloat(full_fare)
        ]);

        return res.json({ status: true, message: "Trip posted successfully", trip_id });

    } catch (error) {
        console.error("createTrip error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /sigi/trip/my-trips
exports.myTrips = async (req, res) => {
 try {
        const creator_id   = req.user.id;

        const creator_type = req.user.role === "driver" ? "DRIVER" : "BA";
        const { status, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        // A driver sees trips they created themselves AND BA trips assigned to them as captain.
        // A BA sees only the trips it created.
        const ownership = creator_type === "DRIVER"
            ? `( (t.creator_type = 'DRIVER' AND t.creator_id = ?) OR (t.creator_type = 'BA' AND t.assigned_driver_id = ?) )`
            : `(t.creator_type = 'BA' AND t.creator_id = ?)`;

        const conditions = [ownership];
        const values     = creator_type === "DRIVER" ? [creator_id, creator_id] : [creator_id];

        if (status) { conditions.push(`t.status = ?`); values.push(status.toUpperCase()); }

        const where = `WHERE ${conditions.join(" AND ")}`;

        console.log("myTrips -> where:", where);
        console.log("myTrips -> values:", values);
        console.log("myTrips -> limit/offset:", limitNum, offset);

        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM sigi_trips t ${where}`, values
        );

        console.log("myTrips -> total count:", total);

        const [rows] = await db.execute(`
            SELECT t.*,
                   COUNT(sb.id)                                   AS total_bookings,
                   COALESCE(SUM(sb.seats), 0)                    AS booked_seats,
                   COALESCE(SUM(sb.token_amount), 0)             AS token_collected,
                   COALESCE(SUM(sb.balance_amount * sb.balance_paid), 0) AS balance_collected,
                   COALESCE(SUM(sb.platform_fee), 0)             AS platform_fee_collected,
                   COALESCE(SUM(sb.access_fee), 0)               AS access_fee_collected,
                   ad.full_name AS assigned_driver_name,
                   ad.phone     AS assigned_driver_mobile
            FROM sigi_trips t
            LEFT JOIN sigi_bookings sb ON sb.trip_id = t.id AND sb.status != 'CANCELLED'
            LEFT JOIN drivers ad       ON ad.id = t.assigned_driver_id
            ${where}
            GROUP BY t.id
            ORDER BY t.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "Trips fetched successfully",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });

    } catch (error) {
        console.error("myTrips error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getTripBookings = async (req, res) => {
    try {
        const uid  = req.user.id;
        const role = req.user.role === "driver" ? "DRIVER" : "BA";
        const { trip_id }  = req.params;

        const [[trip]] = await db.execute(`
            SELECT id FROM sigi_trips
            WHERE trip_id = ?
              AND ( (creator_id = ? AND creator_type = ?)
                 OR (creator_type = 'BA' AND assigned_driver_id = ?) )
        `, [trip_id, uid, role, uid]);

        if (!trip) return res.status(404).json({ status: false, message: "Trip not found" });

        const [rows] = await db.execute(`
            SELECT sb.id, sb.booking_id, sb.seats,
                   sb.token_amount, sb.balance_amount, sb.total_fare,
                   sb.token_paid, sb.balance_paid, sb.payment_mode,
                   sb.status, sb.otp, sb.otp_verified, sb.created_at,
                   sb.cancelled_by, sb.cancel_reason, sb.cancellation_fee,
                   u.name AS user_name, u.mobile AS user_mobile
            FROM sigi_bookings sb
            LEFT JOIN users u ON u.id = sb.user_id
            WHERE sb.trip_id = ?
            ORDER BY sb.id ASC
        `, [trip.id]);

        // attach passenger name/age list to each booking
        if (rows.length > 0) {
            const bookingIds = rows.map(r => r.id);
            const [passengers] = await db.query(
                `SELECT id, booking_id, name, age, gender FROM sigi_passengers WHERE booking_id IN (?) ORDER BY id ASC`,
                [bookingIds]
            );
            const byBooking = {};
            for (const p of passengers) {
                (byBooking[p.booking_id] = byBooking[p.booking_id] || []).push({ id: p.id, name: p.name, age: p.age, gender: p.gender });
            }
            rows.forEach(r => { r.passengers = byBooking[r.id] || []; });
        }

        return res.json({ status: true, message: "Trip bookings fetched", data: rows });

    } catch (error) {
        console.error("getTripBookings error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /sigi/trip/arrive  — driver marks arrived at pickup
exports.markArrived = async (req, res) => {
    try {
        if (req.user.role !== "driver") {
            return res.status(403).json({ status: false, message: "Only the assigned captain can operate this trip" });
        }
        const driver_id   = req.user.id;
        const { trip_id }  = req.body;

        if (!trip_id) return res.status(400).json({ status: false, message: "trip_id is required" });

        const trip = await findOperableTrip(trip_id, driver_id);
        if (!trip) return res.status(404).json({ status: false, message: "Trip not found or not assigned to you" });
        if (trip.status !== "UPCOMING") {
            return res.status(400).json({ status: false, message: `Trip is already ${trip.status}` });
        }

        await db.execute(
            `UPDATE sigi_trips SET status = 'BOARDING', updated_at = NOW() WHERE id = ?`,
            [trip.id]
        );

        // notify every passenger on this trip
        const [pax] = await db.execute(
            `SELECT user_id, booking_id FROM sigi_bookings WHERE trip_id = ? AND status NOT IN ('CANCELLED')`,
            [trip.id]
        );
        await Promise.all(pax.map(p => notifyUser(p.user_id, "Captain arrived",
            "Your captain has arrived at the pickup location.", { type: "SIGI_TRIP_ARRIVED", booking_id: p.booking_id })));

        return res.json({ status: true, message: "Marked as arrived. Users can now pay full fare." });

    } catch (error) {
        console.error("markArrived error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /sigi/trip/verify-otp  — verify user OTP when boarding
exports.verifyOtp = async (req, res) => {
    try {
        if (req.user.role !== "driver") {
            return res.status(403).json({ status: false, message: "Only the assigned captain can operate this trip" });
        }
        const driver_id = req.user.id;
        const { trip_id, booking_id, otp } = req.body;

        if (!trip_id || !booking_id || !otp) {
            return res.status(400).json({ status: false, message: "trip_id, booking_id, otp are required" });
        }

        const trip = await findOperableTrip(trip_id, driver_id);
        if (!trip) return res.status(404).json({ status: false, message: "Trip not found or not assigned to you" });
        if (trip.status !== "BOARDING") {
            return res.status(400).json({ status: false, message: "Trip is not in BOARDING state" });
        }

        const [[booking]] = await db.execute(
            `SELECT id, user_id, otp, balance_paid, status FROM sigi_bookings WHERE booking_id = ? AND trip_id = ?`,
            [booking_id, trip.id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (booking.status === "CANCELLED") {
            return res.status(400).json({ status: false, message: "Booking is cancelled" });
        }
        if (!booking.balance_paid) {
            return res.status(400).json({ status: false, message: "User has not paid full fare yet" });
        }
        if (parseInt(booking.otp) !== parseInt(otp)) {
            return res.status(400).json({ status: false, message: "Invalid OTP" });
        }
        if (booking.status === "BOARDED") {
            return res.status(400).json({ status: false, message: "Already boarded" });
        }

        await db.execute(
            `UPDATE sigi_bookings SET status = 'BOARDED', otp_verified = 1, updated_at = NOW() WHERE id = ?`,
            [booking.id]
        );

        await notifyUser(booking.user_id, "Boarded",
            "You have boarded the trip. Have a safe journey!", { type: "SIGI_BOARDED", booking_id });

        return res.json({ status: true, message: "OTP verified. Passenger boarded." });

    } catch (error) {
        console.error("verifyOtp error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /sigi/trip/start  — start ride (checks all confirmed bookings have paid)
exports.startTrip = async (req, res) => {
    try {
        if (req.user.role !== "driver") {
            return res.status(403).json({ status: false, message: "Only the assigned captain can operate this trip" });
        }
        const driver_id   = req.user.id;
        const { trip_id }  = req.body;

        if (!trip_id) return res.status(400).json({ status: false, message: "trip_id is required" });

        const trip = await findOperableTrip(trip_id, driver_id);
        if (!trip) return res.status(404).json({ status: false, message: "Trip not found or not assigned to you" });
        if (trip.status !== "BOARDING") {
            return res.status(400).json({ status: false, message: "Trip must be in BOARDING state to start" });
        }

        // check if any active booking has not paid balance
        const [unpaid] = await db.execute(`
            SELECT id FROM sigi_bookings
            WHERE trip_id = ? AND status NOT IN ('CANCELLED') AND balance_paid = 0
        `, [trip.id]);

        if (unpaid.length > 0) {
            return res.status(400).json({
                status: false,
                message: `${unpaid.length} booking(s) have not paid full fare yet`
            });
        }

        await db.execute(
            `UPDATE sigi_trips SET status = 'STARTED', started_at = NOW(), updated_at = NOW() WHERE id = ?`,
            [trip.id]
        );

        // notify every passenger on this trip
        const [pax] = await db.execute(
            `SELECT user_id, booking_id FROM sigi_bookings WHERE trip_id = ? AND status NOT IN ('CANCELLED')`,
            [trip.id]
        );
        await Promise.all(pax.map(p => notifyUser(p.user_id, "Trip started",
            "Your trip has started. Have a safe journey!", { type: "SIGI_TRIP_STARTED", booking_id: p.booking_id })));

        return res.json({ status: true, message: "Trip started successfully" });

    } catch (error) {
        console.error("startTrip error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /sigi/trip/complete
exports.completeTrip = async (req, res) => {
    try {
        if (req.user.role !== "driver") {
            return res.status(403).json({ status: false, message: "Only the assigned captain can operate this trip" });
        }
        const driver_id   = req.user.id;
        const { trip_id }  = req.body;

        if (!trip_id) return res.status(400).json({ status: false, message: "trip_id is required" });

        const trip = await findOperableTrip(trip_id, driver_id);
        if (!trip) return res.status(404).json({ status: false, message: "Trip not found or not assigned to you" });
        if (trip.status !== "STARTED") {
            return res.status(400).json({ status: false, message: "Trip is not IN_PROGRESS" });
        }

        await db.execute(`
            UPDATE sigi_trips SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW() WHERE id = ?
        `, [trip.id]);

        await db.execute(`
            UPDATE sigi_bookings
            SET status = 'COMPLETED', updated_at = NOW()
            WHERE trip_id = ? AND status != 'CANCELLED'
        `, [trip.id]);

        // notify every passenger the trip is complete (and they can rate the captain)
        const [pax] = await db.execute(
            `SELECT user_id, booking_id FROM sigi_bookings WHERE trip_id = ? AND status != 'CANCELLED'`,
            [trip.id]
        );
        await Promise.all(pax.map(p => notifyUser(p.user_id, "Trip completed",
            "Your trip is complete. Please rate the captain.", { type: "SIGI_TRIP_COMPLETED", booking_id: p.booking_id })));

        return res.json({ status: true, message: "Trip completed successfully" });

    } catch (error) {
        console.error("completeTrip error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.cancelTrip = async (req, res) => {
    try {
        const creator_id   = req.user.id;
        const creator_type = req.user.role === "driver" ? "DRIVER" : "BA";
        const { trip_id }  = req.body;

        if (!trip_id) return res.status(400).json({ status: false, message: "trip_id is required" });

        const [[trip]] = await db.execute(`
            SELECT st.id, st.status, st.departure_time,
                   s.driver_cancel_before48_type, s.driver_cancel_before48_amount,
                   s.driver_cancel_24to48_type,   s.driver_cancel_24to48_amount,
                   s.driver_cancel_0to24_type,    s.driver_cancel_0to24_amount
            FROM sigi_trips st
            LEFT JOIN services s ON s.id = st.service_id
            WHERE st.trip_id = ? AND st.creator_id = ? AND st.creator_type = ?
        `, [trip_id, creator_id, creator_type]);
        if (!trip) return res.status(404).json({ status: false, message: "Trip not found" });
        if (["COMPLETED", "CANCELLED"].includes(trip.status)) {
            return res.status(400).json({ status: false, message: `Trip is already ${trip.status}` });
        }

        const [activeBookings] = await db.execute(`
            SELECT id, user_id, seats, token_amount, total_fare
            FROM sigi_bookings
            WHERE trip_id = ? AND status NOT IN ('COMPLETED','CANCELLED')
        `, [trip.id]);

        // driver cancellation penalty (percent is of total trip value of active bookings)
        const tripValue = activeBookings.reduce((sum, b) => sum + (parseFloat(b.total_fare) || 0), 0);
        const window    = cancelWindow(trip.departure_time);
        const penalty   = calcCancelCharge(
            trip[`driver_cancel_${window}_type`],
            trip[`driver_cancel_${window}_amount`],
            tripValue
        );

        // cancel trip + its bookings
        await db.execute(
            `UPDATE sigi_trips SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?`,
            [trip.id]
        );

        // refund full token to every affected user (driver's fault), and attribute each
        // booking its proportional share of the driver's penalty (by fare weight) so the
        // per-row shares sum back to `penalty` — lets the admin Accounts page show
        // "cancelled by DRIVER" + a charge amount against each affected booking.
        let totalRefunded = 0;
        for (const b of activeBookings) {
            const token = parseFloat(b.token_amount) || 0;
            if (token > 0) {
                await db.execute(`UPDATE users SET wallet = wallet + ? WHERE id = ?`, [token, b.user_id]);
                totalRefunded += token;
            }
            const bookingFare  = parseFloat(b.total_fare) || 0;
            const bookingShare = tripValue > 0 ? Math.round((penalty * bookingFare / tripValue) * 100) / 100 : 0;
            await db.execute(`
                UPDATE sigi_bookings
                SET status = 'CANCELLED', cancelled_by = 'DRIVER', cancel_reason = ?, cancellation_fee = ?, updated_at = NOW()
                WHERE id = ?
            `, ['Trip cancelled by driver', bookingShare, b.id]);
        }

        // deduct penalty from driver's wallet (BA has no wallet column → skipped)
        if (creator_type === "DRIVER" && penalty > 0) {
            await db.execute(`UPDATE drivers SET wallet = wallet - ? WHERE id = ?`, [penalty, creator_id]);
        }

        return res.json({
            status: true,
            message: "Trip cancelled. All bookings cancelled and users refunded.",
            cancel_window: window,
            bookings_refunded: activeBookings.length,
            total_refunded: totalRefunded.toFixed(2),
            driver_penalty: (creator_type === "DRIVER" ? penalty : 0).toFixed(2)
        });

    } catch (error) {
        console.error("cancelTrip error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /selfsharing/trip/cancel-booking — captain cancels ONE passenger's booking (no-show
// or any other reason) while the trip keeps running for everyone else. Distinct from
// cancelTrip (whole trip + every booking cancelled) — here trip.status is untouched and
// only this one sigi_bookings row moves to CANCELLED, freeing its seat back up.
exports.driverCancelBooking = async (req, res) => {
    try {
        if (req.user.role !== "driver") {
            return res.status(403).json({ status: false, message: "Only the assigned captain can operate this trip" });
        }
        const driver_id = req.user.id;
        const { trip_id, booking_id, reason } = req.body;

        if (!trip_id || !booking_id) {
            return res.status(400).json({ status: false, message: "trip_id and booking_id are required" });
        }
        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ status: false, message: "reason is required" });
        }

        const trip = await findOperableTrip(trip_id, driver_id);
        if (!trip) return res.status(404).json({ status: false, message: "Trip not found or not assigned to you" });
        if (["COMPLETED", "CANCELLED"].includes(trip.status)) {
            return res.status(400).json({ status: false, message: `Trip is already ${trip.status}` });
        }

        const [[booking]] = await db.execute(`
            SELECT sb.*, st.departure_time,
                   s.user_cancel_before48_type, s.user_cancel_before48_amount,
                   s.user_cancel_24to48_type,   s.user_cancel_24to48_amount,
                   s.user_cancel_0to24_type,    s.user_cancel_0to24_amount
            FROM sigi_bookings sb
            JOIN sigi_trips st ON st.id = sb.trip_id
            LEFT JOIN services s ON s.id = st.service_id
            WHERE sb.booking_id = ? AND sb.trip_id = ?
        `, [booking_id, trip.id]);

        if (!booking) return res.status(404).json({ status: false, message: "Booking not found on this trip" });
        if (["CANCELLED", "COMPLETED", "BOARDED"].includes(booking.status)) {
            return res.status(400).json({ status: false, message: `Cannot cancel. Booking status: ${booking.status}` });
        }

        // token is forfeited per the same window-based policy a self-cancel would use
        // (see cancelBooking) — the passenger is the one who didn't show up; any balance
        // they'd already paid is refunded in full since the seat was never actually used.
        const token  = parseFloat(booking.token_amount) || 0;
        const window = cancelWindow(booking.departure_time);
        const charge = calcCancelCharge(
            booking[`user_cancel_${window}_type`],
            booking[`user_cancel_${window}_amount`],
            token
        );
        const tokenRefund   = Math.max(0, Math.round((token - charge) * 100) / 100);
        const balanceRefund = booking.balance_paid ? (parseFloat(booking.balance_amount) || 0) : 0;
        const totalRefund   = Math.round((tokenRefund + balanceRefund) * 100) / 100;

        if (totalRefund > 0) {
            await db.execute(`UPDATE users SET wallet = wallet + ? WHERE id = ?`, [totalRefund, booking.user_id]);
        }
        await db.execute(
            `UPDATE sigi_trips SET available_seats = available_seats + ?, updated_at = NOW() WHERE id = ?`,
            [booking.seats, trip.id]
        );
        await db.execute(`
            UPDATE sigi_bookings
            SET status = 'CANCELLED', cancelled_by = 'DRIVER_NO_SHOW', cancel_reason = ?, cancellation_fee = ?, updated_at = NOW()
            WHERE id = ?
        `, [reason, charge, booking.id]);

        await notifyUser(booking.user_id, "Booking cancelled by captain",
            `Your seat on trip ${trip_id} was cancelled by the captain. Reason: ${reason}`,
            { type: "SIGI_BOOKING_CANCELLED_BY_DRIVER", booking_id });

        return res.json({
            status: true,
            message: "Passenger's booking cancelled. Trip continues for the remaining passengers.",
            cancel_window: window,
            reason,
            token_paid: token.toFixed(2),
            cancel_charge: charge.toFixed(2),
            refunded: totalRefund.toFixed(2)
        });

    } catch (error) {
        console.error("driverCancelBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /selfsharing/trip/assign-captain  — BA assigns one of its captains to a trip
exports.assignCaptain = async (req, res) => {
    try {
        if (req.user.role === "driver") {
            return res.status(403).json({ status: false, message: "Only a BA can assign captains" });
        }
        const ba_id = req.user.id;
        const { trip_id, driver_id } = req.body;

        if (!trip_id || !driver_id) {
            return res.status(400).json({ status: false, message: "trip_id and driver_id are required" });
        }

        // trip must belong to this BA
        const [[trip]] = await db.execute(
            `SELECT id, status, departure_time FROM sigi_trips WHERE trip_id = ? AND creator_type = 'BA' AND creator_id = ?`,
            [trip_id, ba_id]
        );
        if (!trip) return res.status(404).json({ status: false, message: "Trip not found" });
        if (["COMPLETED", "CANCELLED"].includes(trip.status)) {
            return res.status(400).json({ status: false, message: `Cannot assign. Trip is ${trip.status}` });
        }

        // captain must belong to this BA and be approved
        const [[driver]] = await db.execute(
            `SELECT id, full_name, status FROM drivers WHERE id = ? AND ba_id = ?`,
            [parseInt(driver_id), ba_id]
        );
        if (!driver) {
            return res.status(404).json({ status: false, message: "Captain not found under your account" });
        }
        if (driver.status !== "approved") {
            return res.status(400).json({ status: false, message: "Captain is not approved" });
        }

        // a driver can't be on two trips at the same time — block if this captain is already
        // assigned to another active trip whose departure is within ±CONFLICT_WINDOW_HOURS
        const CONFLICT_WINDOW_HOURS = 6;
        const [[conflict]] = await db.execute(`
            SELECT trip_id, departure_time FROM sigi_trips
            WHERE assigned_driver_id = ?
              AND id != ?
              AND status IN ('UPCOMING', 'BOARDING', 'STARTED')
              AND ABS(TIMESTAMPDIFF(MINUTE, departure_time, ?)) < ?
            ORDER BY ABS(TIMESTAMPDIFF(MINUTE, departure_time, ?)) ASC
            LIMIT 1
        `, [driver.id, trip.id, trip.departure_time, CONFLICT_WINDOW_HOURS * 60, trip.departure_time]);

        if (conflict) {
            return res.status(409).json({
                status: false,
                message: `Captain is already assigned to trip ${conflict.trip_id} departing at ${moment(conflict.departure_time).format("YYYY-MM-DD HH:mm")}. Pick a different captain or trip time.`
            });
        }

        await db.execute(
            `UPDATE sigi_trips SET assigned_driver_id = ?, updated_at = NOW() WHERE id = ?`,
            [driver.id, trip.id]
        );

        await notifyDriver(driver.id, "Trip assigned",
            `You have been assigned to operate trip ${trip_id}.`, { type: "SIGI_TRIP_ASSIGNED", trip_id });

        return res.json({
            status: true,
            message: "Captain assigned successfully",
            trip_id,
            assigned_driver: { id: driver.id, full_name: driver.full_name }
        });

    } catch (error) {
        console.error("assignCaptain error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};


// ═══════════════════════════════════════════════════════════════════════════════
//  USER  —  BOOKING MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// GET /sigi/trips  — browse available trips
exports.getAvailableTrips = async (req, res) => {
    try {
        const { service_id, from_city, to_city, date, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;
        const conditions = [`t.status IN ('UPCOMING','BOARDING')`, `t.available_seats > 0`];
        const values     = [];
        if (service_id) { conditions.push(`t.service_id = ?`);         values.push(parseInt(service_id)); }
        if (from_city)  { conditions.push(`t.from_city LIKE ?`);        values.push(`%${from_city}%`); }
        if (to_city)    { conditions.push(`t.to_city LIKE ?`);          values.push(`%${to_city}%`); }
        if (date)       { conditions.push(`DATE(t.departure_time) = ?`); values.push(date); }
        const where = `WHERE ${conditions.join(" AND ")}`;

        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM sigi_trips t ${where}`, values
        );
        const [rows] = await db.execute(`
            SELECT
                t.id, t.trip_id, t.creator_type, t.service_id, t.from_city, t.to_city,
                t.pickup_address, t.departure_time,
                t.total_seats, t.available_seats,
                t.token_fare, t.full_fare, t.status, t.created_at,
                s.title AS service_name,
                CASE t.creator_type
                    WHEN 'DRIVER' THEN d.full_name
                    WHEN 'BA'     THEN ba.ba_name
                END AS creator_name,
                CASE t.creator_type
                    WHEN 'DRIVER' THEN d.phone
                    WHEN 'BA'     THEN ba.ba_mobile
                END AS creator_mobile,
                ss.access_fee, ss.access_fee_type, ss.platform_fee
            FROM sigi_trips t
            LEFT JOIN services s             ON s.id  = t.service_id
            LEFT JOIN drivers d              ON t.creator_type = 'DRIVER' AND d.id = t.creator_id
            LEFT JOIN business_associates ba ON t.creator_type = 'BA'     AND ba.id = t.creator_id
            -- this service's one designated fee sub_service (not tied to any driver —
            -- see selfSharingController.createBooking for the matching lookup rule)
            LEFT JOIN (
                SELECT ss1.service_id, ss1.access_fee, ss1.access_fee_type, ss1.platform_fee
                FROM sub_services ss1
                INNER JOIN (
                    SELECT service_id, MAX(updated_at) AS latest_updated_at
                    FROM sub_services
                    WHERE status = 1 AND deleted_at IS NULL
                      AND (access_fee IS NOT NULL OR platform_fee IS NOT NULL)
                    GROUP BY service_id
                ) latest ON latest.service_id = ss1.service_id AND latest.latest_updated_at = ss1.updated_at
            ) ss ON ss.service_id = t.service_id
            ${where}
            ORDER BY t.departure_time ASC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        // Show the same fee-inclusive fare the passenger will actually be charged at
        // booking time (see selfSharingController.createBooking) — platform_fee/access_fee
        // come from the operating captain's sub_service, not shown separately before now,
        // which made the browsed price look cheaper than what booking actually charged.
        const data = rows.map(t => {
            const baseFare    = parseFloat(t.full_fare || 0);
            const platformFee = parseFloat(t.platform_fee || 0);
            const accessFeeCfg = parseFloat(t.access_fee || 0);
            const accessFee    = (t.access_fee_type === 'percent')
                ? Math.round(baseFare * accessFeeCfg) / 100
                : accessFeeCfg;
            return {
                ...t,
                base_full_fare: baseFare.toFixed(2),
                platform_fee: platformFee.toFixed(2),
                access_fee: accessFee.toFixed(2),
                full_fare: (baseFare + platformFee + accessFee).toFixed(2),
            };
        });

        return res.json({
            status: true,
            message: "Available trips fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data
        });

    } catch (error) {
        console.error("getAvailableTrips error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /sigi/booking/create  — user books seats + pays token online (from app)
exports.createBooking = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { trip_id, seats, transaction_id, passengers } = req.body;

        if (!trip_id || !seats) {
            return res.status(400).json({ status: false, message: "trip_id and seats are required" });
        }

        const seatCount = parseInt(seats);
        if (seatCount < 1) {
            return res.status(400).json({ status: false, message: "seats must be at least 1" });
        }

        const passengerList = Array.isArray(passengers) ? passengers : [];
        if (passengerList.length > 0 && passengerList.length !== seatCount) {
            return res.status(400).json({
                status: false,
                message: `passengers count (${passengerList.length}) must match seats (${seatCount})`
            });
        }

        const mode = "ONLINE";
        const [[trip]] = await db.execute(
            `SELECT id, service_id, available_seats, token_fare, full_fare, status,
                    creator_type, creator_id, assigned_driver_id
             FROM sigi_trips WHERE trip_id = ?`,
            [trip_id]
        );

        if (!trip) return res.status(404).json({ status: false, message: "Trip not found" });
        
        if (!["UPCOMING", "BOARDING"].includes(trip.status)) {
            return res.status(400).json({ status: false, message: "Trip is not accepting bookings" });
        }

        if (trip.available_seats < seatCount) {
            return res.status(400).json({
                status: false,
                message: `Only ${trip.available_seats} seat(s) available`
            });
        }

        const token_amount = parseFloat(trip.token_fare) * seatCount;
        const baseFare     = parseFloat(trip.full_fare) * seatCount;

        // Platform fee / access fee come from this service's one designated fee
        // sub_service (same sub_services table + flat/percent convention used
        // everywhere else) — not tied to any particular driver, since drivers here
        // don't necessarily have a sub_service_id of their own. A service can have
        // several sub_services (vehicle types, etc.); whichever one actually has a
        // fee configured is "the" fee config for that service.
        let platformFee = 0;
        let accessFee    = 0;
        const [[ss]] = await db.execute(
            `SELECT access_fee, access_fee_type, platform_fee FROM sub_services
             WHERE service_id = ? AND status = 1 AND deleted_at IS NULL
               AND (access_fee IS NOT NULL OR platform_fee IS NOT NULL)
             ORDER BY updated_at DESC LIMIT 1`,
            [trip.service_id]
        );
        if (ss) {
            platformFee = parseFloat(ss.platform_fee || 0);
            const accessFeeCfg = parseFloat(ss.access_fee || 0);
            accessFee = (ss.access_fee_type === 'percent')
                ? Math.round(baseFare * accessFeeCfg) / 100
                : accessFeeCfg;
        }

        const total_fare     = baseFare + platformFee + accessFee;
        const balance_amount = total_fare - token_amount;
        const isLateBooking = trip.status === "BOARDING";
        const balancePaidFlag = isLateBooking ? 1 : 0;
        const bookingStatus   = isLateBooking ? "CONFIRMED" : "TOKEN_PAID";
        const amountCharged   = isLateBooking ? total_fare : token_amount;

        const booking_id = genId("SB");
        const otp        = genOtp();

        await db.execute(
            `UPDATE sigi_trips SET available_seats = available_seats - ?, updated_at = NOW() WHERE id = ?`,
            [seatCount, trip.id]
        );
        const [insertResult] = await db.execute(`
            INSERT INTO sigi_bookings
                (booking_id, trip_id, user_id, seats, token_amount, balance_amount, total_fare,
                 platform_fee, access_fee,
                 otp, token_paid, balance_paid, payment_mode, transaction_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NOW(), NOW())
        `, [booking_id, trip.id, user_id, seatCount, token_amount, balance_amount, total_fare, platformFee, accessFee, otp, balancePaidFlag, mode, transaction_id || null, bookingStatus]);

        const sigiBookingId = insertResult.insertId;
        let savedPassengers = [];
        if (passengerList.length > 0) {
            savedPassengers = passengerList.map(p => ({
                name: p.name || null,
                age: p.age != null ? parseInt(p.age) : null,
                gender: p.gender || null
            }));
            const values = savedPassengers.map(p => [sigiBookingId, p.name, p.age, p.gender]);
            await db.query(
                `INSERT INTO sigi_passengers (booking_id, name, age, gender) VALUES ?`,
                [values]
            );
        }

        // notify the trip's operating captain (its driver-creator, or the assigned captain)
        const tripDriverId = trip.creator_type === 'DRIVER' ? trip.creator_id : trip.assigned_driver_id;
        await notifyDriver(tripDriverId, "New passenger booked",
            `${seatCount} seat(s) booked on your trip.`, { type: "SIGI_NEW_BOOKING", booking_id });

        return res.json({
            status: true,
            message: isLateBooking
                ? "Booking confirmed. Full fare paid online (driver already arrived)."
                : "Booking confirmed. Token paid online.",
            booking_id,
            otp,
            payment_mode: mode,
            amount_charged: amountCharged.toFixed(2),
            passengers: savedPassengers,
            fare: {
                seats        : seatCount,
                base_fare    : baseFare.toFixed(2),
                platform_fee : platformFee.toFixed(2),
                access_fee   : accessFee.toFixed(2),
                token_paid   : token_amount.toFixed(2),
                balance_due  : isLateBooking ? "0.00" : balance_amount.toFixed(2),
                total_fare   : total_fare.toFixed(2)
            }
        });

    } catch (error) {
        console.error("createBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.payFullFare = async (req, res) => {
    try {
        const user_id                    = req.user.id;
        const { booking_id, payment_mode } = req.body;

        if (!booking_id) return res.status(400).json({ status: false, message: "booking_id is required" });

        const mode = ["CASH", "ONLINE"].includes((payment_mode || "").toUpperCase())
            ? payment_mode.toUpperCase()
            : "CASH";

        const [[booking]] = await db.execute(`
            SELECT sb.*, st.status AS trip_status, st.assigned_driver_id, st.creator_type, st.creator_id
            FROM sigi_bookings sb
            JOIN sigi_trips st ON st.id = sb.trip_id
            WHERE sb.booking_id = ? AND sb.user_id = ?
        `, [booking_id, user_id]);

        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (booking.status === "CANCELLED") {
            return res.status(400).json({ status: false, message: "Booking is cancelled" });
        }
        if (booking.trip_status !== "BOARDING") {
            return res.status(400).json({ status: false, message: "Driver has not arrived yet" });
        }
        if (booking.balance_paid) {
            return res.status(400).json({ status: false, message: "Balance already paid" });
        }

        await db.execute(`
            UPDATE sigi_bookings
            SET balance_paid = 1, payment_mode = ?, status = 'CONFIRMED', updated_at = NOW()
            WHERE id = ?
        `, [mode, booking.id]);

            // notify the trip's operating captain (driver)
            try {
                const tripDriverId = booking.creator_type === 'DRIVER' ? booking.creator_id : booking.assigned_driver_id;
                if (tripDriverId) {
                    await notifyDriver(tripDriverId, "Full fare paid",
                        `Passenger paid full fare for booking ${booking_id}`,
                        { type: "BALANCE_PAID", booking_id }
                    );
                }
            } catch (nerr) {
                console.error("notification send error:", nerr.message);
            }

        return res.json({
            status: true,
            message: "Full fare paid. Show OTP to driver for boarding.",
            otp          : booking.otp,
            balance_paid : parseFloat(booking.balance_amount).toFixed(2),
            payment_mode : mode
        });

    } catch (error) {
        console.error("payFullFare error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /sigi/booking/my-bookings
exports.myBookings = async (req, res) => {
    try {
        const user_id        = req.user.id;
        const { status, page, limit } = req.query;

        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [`sb.user_id = ?`];
        const values     = [user_id];

        if (status) { conditions.push(`sb.status = ?`); values.push(status.toUpperCase()); }

        const where = `WHERE ${conditions.join(" AND ")}`;

        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM sigi_bookings sb ${where}`, values
        );

        const [rows] = await db.execute(`
            SELECT sb.id, sb.booking_id, sb.seats,
                   sb.token_amount, sb.balance_amount, sb.total_fare,
                   sb.token_paid, sb.balance_paid, sb.payment_mode,
                   sb.status, sb.otp, sb.user_rated, sb.created_at,
                   sb.cancelled_by, sb.cancel_reason, sb.cancellation_fee,
                   st.trip_id, st.from_city, st.to_city, st.pickup_address,
                   st.departure_time, st.status AS trip_status,
                   st.started_at AS ride_started_at, st.completed_at AS ride_completed_at,
                   CASE st.creator_type
                       WHEN 'DRIVER' THEN d.full_name
                       WHEN 'BA'     THEN ba.ba_name
                   END AS creator_name,
                   CASE st.creator_type
                       WHEN 'DRIVER' THEN d.phone
                       WHEN 'BA'     THEN ba.ba_mobile
                   END AS creator_mobile
            FROM sigi_bookings sb
            JOIN sigi_trips st ON st.id = sb.trip_id
            LEFT JOIN drivers d              ON st.creator_type = 'DRIVER' AND d.id = st.creator_id
            LEFT JOIN business_associates ba ON st.creator_type = 'BA'     AND ba.id = st.creator_id
            ${where}
            ORDER BY sb.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        // after the trip is COMPLETED the user rates the captain; once rated it's FINISHED
        const data = rows.map(r => ({
            ...r,
            rating_status: r.status === 'COMPLETED'
                ? (Number(r.user_rated) === 1 ? 'FINISHED' : 'RATING_PENDING')
                : null
        }));

        return res.json({
            status: true,
            message: "Bookings fetched successfully",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data
        });

    } catch (error) {
        console.error("myBookings error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /sigi/booking/cancel
exports.cancelBooking = async (req, res) => {
    try {
        const user_id        = req.user.id;
        const { booking_id } = req.body;
        const cancel_reason  = req.body.cancel_reason ?? req.body.reason ?? null;

        if (!booking_id) return res.status(400).json({ status: false, message: "booking_id is required" });

        const [[booking]] = await db.execute(`
            SELECT sb.*, st.status AS trip_status, st.departure_time,
                   s.user_cancel_before48_type, s.user_cancel_before48_amount,
                   s.user_cancel_24to48_type,   s.user_cancel_24to48_amount,
                   s.user_cancel_0to24_type,    s.user_cancel_0to24_amount
            FROM sigi_bookings sb
            JOIN sigi_trips st ON st.id = sb.trip_id
            LEFT JOIN services s ON s.id = st.service_id
            WHERE sb.booking_id = ? AND sb.user_id = ?
        `, [booking_id, user_id]);

        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (["CANCELLED", "COMPLETED", "BOARDED"].includes(booking.status)) {
            return res.status(400).json({ status: false, message: `Cannot cancel. Status: ${booking.status}` });
        }
        if (["IN_PROGRESS", "COMPLETED"].includes(booking.trip_status)) {
            return res.status(400).json({ status: false, message: "Trip already in progress or completed" });
        }

        // pick the cancellation window from service policy and compute the charge
        const token  = parseFloat(booking.token_amount) || 0;
        const window = cancelWindow(booking.departure_time);
        const charge = calcCancelCharge(
            booking[`user_cancel_${window}_type`],
            booking[`user_cancel_${window}_amount`],
            token                                 
        );
        const refund = Math.max(0, Math.round((token - charge) * 100) / 100);

        if (refund > 0) {
            await db.execute(
                `UPDATE users SET wallet = wallet + ? WHERE id = ?`,
                [refund, user_id]
            );
        }
        await db.execute(
            `UPDATE sigi_trips SET available_seats = available_seats + ?, updated_at = NOW() WHERE id = ?`,
            [booking.seats, booking.trip_id]
        );
        await db.execute(
            `UPDATE sigi_bookings
             SET status = 'CANCELLED', cancelled_by = 'USER', cancel_reason = ?, cancellation_fee = ?, updated_at = NOW()
             WHERE id = ?`,
            [cancel_reason, charge, booking.id]
        );

        return res.json({
            status: true,
            message: "Booking cancelled.",
            cancel_window: window,
            cancel_reason,
            token_paid: token.toFixed(2),
            cancel_charge: charge.toFixed(2),
            refunded: refund.toFixed(2)
        });

    } catch (error) {
        console.error("cancelBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};


// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

exports.adminGetAllTrips = async (req, res) => {
    try {
        const { status, service_id, from_city, to_city, creator_type, from_date, to_date, search, page, limit } = req.query;

        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [];
        const values     = [];

        // sigi_trips is shared by both "Self Sharing" and "Inter City" — they're the same
        // carpool mechanism, distinguished only by which service the trip was created under.
        if (service_id)   { conditions.push(`t.service_id = ?`);              values.push(service_id); }
        if (status)       { conditions.push(`t.status = ?`);                  values.push(status.toUpperCase()); }
        if (creator_type) { conditions.push(`t.creator_type = ?`);            values.push(creator_type.toUpperCase()); }
        if (from_city)    { conditions.push(`t.from_city LIKE ?`);            values.push(`%${from_city}%`); }
        if (to_city)      { conditions.push(`t.to_city LIKE ?`);              values.push(`%${to_city}%`); }
        if (from_date)    { conditions.push(`DATE(t.created_at) >= ?`);       values.push(from_date); }
        if (to_date)      { conditions.push(`DATE(t.created_at) <= ?`);       values.push(to_date); }
        if (search)       {
            conditions.push(`(t.trip_id LIKE ? OR t.from_city LIKE ? OR t.to_city LIKE ?)`);
            const like = `%${search}%`;
            values.push(like, like, like);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM sigi_trips t ${where}`, values
        );

        const [rows] = await db.execute(`
            SELECT t.*,
                   t.from_city AS pickup_city,
                   t.to_city AS drop_city,
                   t.departure_time AS schedule_date,
                   t.total_seats AS seat_count,
                   t.full_fare AS total_fare,
                   COUNT(sb.id)                  AS total_bookings,
                   COALESCE(SUM(sb.seats), 0)    AS booked_seats,
                   COALESCE(SUM(sb.seats), 0)    AS passenger_count,
                   s.title AS service_name,
                   CASE t.creator_type
                       WHEN 'DRIVER' THEN creator_driver.full_name
                       WHEN 'BA'     THEN ba.ba_name
                   END AS creator_name,
                   CASE t.creator_type
                       WHEN 'DRIVER' THEN creator_driver.phone
                       WHEN 'BA'     THEN ba.ba_mobile
                   END AS creator_mobile,
                   COALESCE(assigned_driver.id, CASE WHEN t.creator_type = 'DRIVER' THEN creator_driver.id END) AS driver_id,
                   COALESCE(assigned_driver.full_name, CASE WHEN t.creator_type = 'DRIVER' THEN creator_driver.full_name END, ba.ba_name) AS driver_name,
                   COALESCE(assigned_driver.phone, CASE WHEN t.creator_type = 'DRIVER' THEN creator_driver.phone END, ba.ba_mobile) AS driver_mobile
            FROM sigi_trips t
            LEFT JOIN sigi_bookings sb           ON sb.trip_id = t.id AND sb.status != 'CANCELLED'
            LEFT JOIN services s                 ON s.id = t.service_id
            LEFT JOIN drivers creator_driver     ON t.creator_type = 'DRIVER' AND creator_driver.id = t.creator_id
            LEFT JOIN drivers assigned_driver    ON assigned_driver.id = t.assigned_driver_id
            LEFT JOIN business_associates ba     ON t.creator_type = 'BA'     AND ba.id = t.creator_id
            ${where}
            GROUP BY t.id
            ORDER BY t.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "All trips fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });

    } catch (error) {
        console.error("adminGetAllTrips error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.adminGetAllBookings = async (req, res) => {
    try {
        const { trip_id, status, service_id, from_date, to_date, search, page, limit } = req.query;

        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [];
        const values     = [];

        // sigi_bookings has no service_id of its own — it belongs to a trip, and that trip's
        // service_id is what tells "Self Sharing" (72) and "Inter City" (73) bookings apart.
        if (service_id) { conditions.push(`st.service_id = ?`);         values.push(service_id); }
        if (trip_id)   { conditions.push(`st.trip_id = ?`);             values.push(trip_id); }
        if (status)    { conditions.push(`sb.status = ?`);              values.push(status.toUpperCase()); }
        if (from_date) { conditions.push(`DATE(sb.created_at) >= ?`);   values.push(from_date); }
        if (to_date)   { conditions.push(`DATE(sb.created_at) <= ?`);   values.push(to_date); }
        if (search)    {
            conditions.push(`(sb.booking_id LIKE ? OR u.name LIKE ? OR u.mobile LIKE ?)`);
            const like = `%${search}%`;
            values.push(like, like, like);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM sigi_bookings sb
             JOIN sigi_trips st ON st.id = sb.trip_id
             LEFT JOIN users u ON u.id = sb.user_id
             ${where}`, values
        );

        const [rows] = await db.execute(`
            SELECT sb.*, st.trip_id, st.service_id, st.from_city, st.to_city, st.departure_time,
                   st.from_city AS pickup_city,
                   st.to_city AS drop_city,
                   st.departure_time AS schedule_date,
                   st.started_at AS ride_started_at,
                   st.completed_at AS ride_completed_at,
                   s.title AS service_name,
                   u.name AS user_name, u.mobile AS user_mobile, u.wallet AS user_wallet,
                   COALESCE(assigned_driver.id, CASE WHEN st.creator_type = 'DRIVER' THEN creator_driver.id END) AS driver_id,
                   COALESCE(assigned_driver.full_name, CASE WHEN st.creator_type = 'DRIVER' THEN creator_driver.full_name END) AS driver_name,
                   COALESCE(assigned_driver.phone, CASE WHEN st.creator_type = 'DRIVER' THEN creator_driver.phone END) AS driver_mobile,
                   COALESCE(assigned_driver.wallet, CASE WHEN st.creator_type = 'DRIVER' THEN creator_driver.wallet END) AS driver_wallet,
                   dr.rating, dr.review
            FROM sigi_bookings sb
            JOIN sigi_trips st ON st.id = sb.trip_id
            LEFT JOIN services s ON s.id = st.service_id
            LEFT JOIN users u ON u.id = sb.user_id
            LEFT JOIN drivers creator_driver ON st.creator_type = 'DRIVER' AND creator_driver.id = st.creator_id
            LEFT JOIN drivers assigned_driver ON assigned_driver.id = st.assigned_driver_id
            LEFT JOIN driver_reviews dr ON dr.booking_type = 'sigi' AND dr.booking_id = sb.id
            ${where}
            ORDER BY sb.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        // Company's cut is the captain's sub_service platform_fee + access_fee (flat or
        // percent, already resolved into a rupee amount at booking time — see
        // selfSharingController.createBooking). Everything else in total_fare is the
        // captain's own money. `cancelled_by`/`cancellation_fee` come straight off sb.* —
        // persisted at cancel time by cancelBooking (USER) / cancelTrip (DRIVER, split
        // proportionally across that trip's active bookings).
        // "Settled" here means the full balance has been collected, i.e. balance_paid = 1
        // (token_paid alone only covers the deposit, not the full fare).
        const data = rows.map(b => {
            const companyAmount = parseFloat(b.platform_fee || 0) + parseFloat(b.access_fee || 0);
            return {
                ...b,
                paid: Number(b.balance_paid) === 1 ? 1 : 0,
                total_amount: parseFloat(b.total_fare || 0),
                company_amount: companyAmount,
                captain_amount: Math.max(0, parseFloat(b.total_fare || 0) - companyAmount),
            };
        });

        return res.json({
            status: true,
            message: "All bookings fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data
        });

    } catch (error) {
        console.error("adminGetAllBookings error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};
