const db = require("../config/db");
const sendPush = require("./notification");

// How often the sweep runs (ms). The actual expiry time per booking is driven by
// sub_services.booking_destroy_min — this only controls how quickly we react.
const SWEEP_INTERVAL_MS = 60 * 1000;

const CANCEL_TITLE = "Booking cancelled";
const CANCEL_BODY  = "Sorry, your booking has been cancelled. Please create a new booking.";

// One sweep: find In-City bookings still SEARCHING past their allocated time,
// cancel them atomically, and notify the user. Never throws.
const sweepExpiredBookings = async () => {
    try {
        const [expired] = await db.query(`
            SELECT b.id, b.booking_id, b.user_id, u.fcm_token
            FROM bookings b
            JOIN sub_services ss ON ss.id = b.sub_service_id
            LEFT JOIN users u    ON u.id = b.user_id
            WHERE b.service_id = 1
              AND b.status = 'SEARCHING'
              AND b.deleted_at IS NULL
              AND ss.booking_destroy_min > 0
              AND b.created_at + INTERVAL ss.booking_destroy_min MINUTE <= NOW()
        `);

        for (const booking of expired) {
            // atomic guard: only cancel if it's STILL searching (a captain may have just accepted)
            const [result] = await db.query(`
                UPDATE bookings SET
                    status        = 'CANCELLED',
                    user_status   = 'CANCELLED',
                    driver_status = 'CANCELLED',
                    cancelled_by  = 'AUTOMATIC',
                    cancel_reason = 'Auto-cancelled: no captain accepted within the allocated time',
                    deleted_at    = NOW(),
                    updated_at    = NOW()
                WHERE id = ? AND status = 'SEARCHING'
            `, [booking.id]);

            if (result.affectedRows === 0) continue; // someone else handled it

            console.log(`⏱️  Booking ${booking.booking_id} auto-cancelled (time expired)`);

            // best-effort push — sendPush is safe with a null/invalid token
            await sendPush(booking.fcm_token, CANCEL_TITLE, CANCEL_BODY, {
                type: "BOOKING_CANCELLED",
                booking_id: String(booking.booking_id),
            });
        }
    } catch (err) {
        console.error("bookingExpiry sweep error:", err.message);
    }
};

// Start the recurring sweep. Call once from index.js after the server boots.
const startBookingExpiryJob = () => {
    setInterval(sweepExpiredBookings, SWEEP_INTERVAL_MS);
    console.log("🕒 Booking auto-expiry job started");
};

module.exports = { startBookingExpiryJob, sweepExpiredBookings };
