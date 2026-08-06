const db = require("../config/db");
const sendPush = require("./notification");
const { notifyUser } = require("./notification");

// How often the sweep runs (ms). The actual expiry time per booking is driven by
// sub_services.booking_destroy_min (In-City) or plans.booking_destroy_time (other
// services, parcel, onspot) — this only controls how quickly we react.
const SWEEP_INTERVAL_MS = 60 * 1000;

const CANCEL_TITLE = "Booking cancelled";
const CANCEL_BODY  = "Sorry, your booking has been cancelled. Please create a new booking.";

// One sweep: find bookings still SEARCHING past their allocated time,
// cancel them atomically, and notify the user. Never throws.
const sweepExpiredBookings = async () => {
    try {
        const [expired] = await db.query(`
            SELECT b.id, b.booking_id, b.user_id, u.fcm_token
            FROM bookings b
            LEFT JOIN sub_services ss ON ss.id = b.sub_service_id
            LEFT JOIN plans p         ON p.id  = b.plan_id
            LEFT JOIN users u         ON u.id  = b.user_id
            WHERE b.status = 'SEARCHING'
              AND b.deleted_at IS NULL
              AND (
                (b.service_id = 1 AND ss.booking_destroy_min > 0
                  AND b.created_at + INTERVAL ss.booking_destroy_min MINUTE <= NOW())
                OR
                (b.service_id != 1 AND p.booking_destroy_time > 0
                  AND b.created_at + INTERVAL p.booking_destroy_time MINUTE <= NOW())
              )
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

// Parcel bookings always carry a plan_id (required at creation) — only
// plans.booking_destroy_time applies, there's no In-City/sub_service branch.
const sweepExpiredParcelBookings = async () => {
    try {
        const [expired] = await db.query(`
            SELECT pb.id, pb.parcel_booking_id, pb.user_id
            FROM parcel_bookings pb
            LEFT JOIN plans p ON p.id = pb.plan_id
            WHERE pb.status = 'pending'
              AND pb.driver_id IS NULL
              AND pb.deleted_at IS NULL
              AND p.booking_destroy_time > 0
              AND pb.created_at + INTERVAL p.booking_destroy_time MINUTE <= NOW()
        `);

        for (const booking of expired) {
            const [result] = await db.query(`
                UPDATE parcel_bookings SET
                    status        = 'cancelled',
                    cancelled_by  = 'automatic',
                    cancel_reason = 'Auto-cancelled: no captain accepted within the allocated time',
                    updated_at    = NOW()
                WHERE id = ? AND status = 'pending' AND driver_id IS NULL
            `, [booking.id]);

            if (result.affectedRows === 0) continue; // someone else handled it

            console.log(`⏱️  Parcel booking ${booking.parcel_booking_id} auto-cancelled (time expired)`);

            await notifyUser(booking.user_id, CANCEL_TITLE, CANCEL_BODY, {
                type: "PARCEL_BOOKING_CANCELLED",
                parcel_booking_id: String(booking.parcel_booking_id),
            });
        }
    } catch (err) {
        console.error("bookingExpiry parcel sweep error:", err.message);
    }
};

// Onspot bookings always carry a plan_id (required at creation) — only
// plans.booking_destroy_time applies, there's no In-City/sub_service branch.
const sweepExpiredOnspotBookings = async () => {
    try {
        const [expired] = await db.query(`
            SELECT ob.id, ob.booking_no, ob.user_id
            FROM onspot_bookings ob
            LEFT JOIN plans p ON p.id = ob.plan_id
            WHERE ob.status = 'PENDING'
              AND ob.driver_id IS NULL
              AND p.booking_destroy_time > 0
              AND ob.created_at + INTERVAL p.booking_destroy_time MINUTE <= NOW()
        `);

        for (const booking of expired) {
            const [result] = await db.query(`
                UPDATE onspot_bookings SET
                    status        = 'CANCELLED',
                    cancelled_by  = 'AUTOMATIC',
                    cancel_reason = 'Auto-cancelled: no service man accepted within the allocated time',
                    updated_at    = NOW()
                WHERE id = ? AND status = 'PENDING' AND driver_id IS NULL
            `, [booking.id]);

            if (result.affectedRows === 0) continue; // someone else handled it

            console.log(`⏱️  Onspot booking ${booking.booking_no} auto-cancelled (time expired)`);

            await notifyUser(booking.user_id, CANCEL_TITLE, CANCEL_BODY, {
                type: "ONSPOT_BOOKING_CANCELLED",
                booking_no: String(booking.booking_no),
            });
        }
    } catch (err) {
        console.error("bookingExpiry onspot sweep error:", err.message);
    }
};

const runAllSweeps = async () => {
    await sweepExpiredBookings();
    await sweepExpiredParcelBookings();
    await sweepExpiredOnspotBookings();
};

// Start the recurring sweep. Call once from index.js after the server boots.
const startBookingExpiryJob = () => {
    setInterval(runAllSweeps, SWEEP_INTERVAL_MS);
    console.log("🕒 Booking auto-expiry job started (bookings, parcel_bookings, onspot_bookings)");
};

module.exports = { startBookingExpiryJob, sweepExpiredBookings, sweepExpiredParcelBookings, sweepExpiredOnspotBookings };
