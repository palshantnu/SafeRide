const db = require("../config/db");

// recompute and store the captain's average rating on the drivers table
const refreshDriverRating = async (driver_id) => {
    await db.query(
        `UPDATE drivers
         SET rating = COALESCE((SELECT ROUND(AVG(rating), 2) FROM driver_reviews WHERE driver_id = ?), 0)
         WHERE id = ?`,
        [driver_id, driver_id]
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  USER  —  rate & review the captain of a completed booking
// ═══════════════════════════════════════════════════════════════════════════════

// POST /user/driver/rating   body: { booking_id, rating, review }
exports.submitDriverReview = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { booking_id, rating, review } = req.body || {};

        if (!booking_id) {
            return res.status(400).json({ status: false, message: "booking_id is required" });
        }
        const stars = Number(rating);
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            return res.status(400).json({ status: false, message: "rating must be an integer from 1 to 5" });
        }

        const [[booking]] = await db.query(
            `SELECT id, driver_id, status FROM bookings WHERE booking_id = ? AND user_id = ?`,
            [booking_id, user_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (!booking.driver_id) {
            return res.status(400).json({ status: false, message: "No captain assigned to this booking" });
        }
        if (booking.status !== "COMPLETED") {
            return res.status(400).json({ status: false, message: "You can rate only after the ride is completed" });
        }

        await db.query(
            `INSERT INTO driver_reviews (booking_type, booking_id, driver_id, user_id, rating, review)
             VALUES ('ride', ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review), updated_at = CURRENT_TIMESTAMP`,
            [booking.id, booking.driver_id, user_id, stars, review || null]
        );

        await db.query(
            `UPDATE bookings SET user_rated = 1, user_review = ? WHERE id = ?`,
            [review || null, booking.id]
        );

        await refreshDriverRating(booking.driver_id);

        const [[driver]] = await db.query(`SELECT rating FROM drivers WHERE id = ?`, [booking.driver_id]);

        return res.json({
            status: true,
            message: "Thanks for rating the captain",
            data: {
                booking_id,
                driver_id: booking.driver_id,
                rating: stars,
                review: review || null,
                driver_avg_rating: driver ? driver.rating : null
            }
        });
    } catch (error) {
        console.error("submitDriverReview error:", error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  USER  —  rate the captain of a completed On-spot / Parcel booking
// ═══════════════════════════════════════════════════════════════════════════════

// Shared handler for onspot/parcel ratings. `cfg` describes the source table.
const submitServiceReview = async (req, res, cfg) => {
    try {
        const user_id = req.user.id;
        const { rating, review } = req.body || {};
        const publicId = req.body ? req.body[cfg.idParam] : undefined;

        if (!publicId) {
            return res.status(400).json({ status: false, message: `${cfg.idParam} is required` });
        }
        const stars = Number(rating);
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            return res.status(400).json({ status: false, message: "rating must be an integer from 1 to 5" });
        }

        const [[booking]] = await db.query(
            `SELECT id, driver_id, status FROM ${cfg.table} WHERE ${cfg.idColumn} = ? AND user_id = ?`,
            [publicId, user_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (!booking.driver_id) {
            return res.status(400).json({ status: false, message: "No captain assigned to this booking" });
        }
        if (booking.status !== cfg.completedStatus) {
            return res.status(400).json({ status: false, message: "You can rate only after the ride is completed" });
        }

        await db.query(
            `INSERT INTO driver_reviews (booking_type, booking_id, driver_id, user_id, rating, review)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review), updated_at = CURRENT_TIMESTAMP`,
            [cfg.bookingType, booking.id, booking.driver_id, user_id, stars, review || null]
        );

        await db.query(
            `UPDATE ${cfg.table} SET user_rated = 1, user_review = ? WHERE id = ?`,
            [review || null, booking.id]
        );

        await refreshDriverRating(booking.driver_id);

        const [[driver]] = await db.query(`SELECT rating FROM drivers WHERE id = ?`, [booking.driver_id]);

        return res.json({
            status: true,
            message: "Thanks for rating the captain",
            data: {
                [cfg.idParam]: publicId,
                driver_id: booking.driver_id,
                rating: stars,
                review: review || null,
                driver_avg_rating: driver ? driver.rating : null
            }
        });
    } catch (error) {
        console.error(`submit${cfg.bookingType}Review error:`, error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// POST /onspot/rating   body: { booking_no, rating, review }
exports.submitOnspotReview = (req, res) => submitServiceReview(req, res, {
    table: "onspot_bookings", idColumn: "booking_no", idParam: "booking_no",
    completedStatus: "COMPLETED", bookingType: "onspot"
});

// POST /parcel/rating   body: { parcel_booking_id, rating, review }
exports.submitParcelReview = (req, res) => submitServiceReview(req, res, {
    table: "parcel_bookings", idColumn: "parcel_booking_id", idParam: "parcel_booking_id",
    completedStatus: "delivered", bookingType: "parcel"
});

// POST /selfsharing/booking/rating   body: { booking_id, rating, review }
// Self-sharing captain lives on the trip, not the booking row — resolve it from sigi_trips.
exports.submitSigiReview = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { booking_id, rating, review } = req.body || {};

        if (!booking_id) {
            return res.status(400).json({ status: false, message: "booking_id is required" });
        }
        const stars = Number(rating);
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            return res.status(400).json({ status: false, message: "rating must be an integer from 1 to 5" });
        }

        // driver = the trip's operating captain (its creator if a DRIVER, else the assigned captain)
        const [[booking]] = await db.query(
            `SELECT sb.id, sb.status,
                    (CASE st.creator_type
                        WHEN 'DRIVER' THEN st.creator_id
                        ELSE st.assigned_driver_id
                     END) AS driver_id
             FROM sigi_bookings sb
             JOIN sigi_trips st ON st.id = sb.trip_id
             WHERE sb.booking_id = ? AND sb.user_id = ?`,
            [booking_id, user_id]
        );
        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (!booking.driver_id) {
            return res.status(400).json({ status: false, message: "No captain assigned to this trip" });
        }
        if (booking.status !== "COMPLETED") {
            return res.status(400).json({ status: false, message: "You can rate only after the ride is completed" });
        }

        await db.query(
            `INSERT INTO driver_reviews (booking_type, booking_id, driver_id, user_id, rating, review)
             VALUES ('sigi', ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating), review = VALUES(review), updated_at = CURRENT_TIMESTAMP`,
            [booking.id, booking.driver_id, user_id, stars, review || null]
        );

        await db.query(
            `UPDATE sigi_bookings SET user_rated = 1, user_review = ? WHERE id = ?`,
            [review || null, booking.id]
        );

        await refreshDriverRating(booking.driver_id);

        const [[driver]] = await db.query(`SELECT rating FROM drivers WHERE id = ?`, [booking.driver_id]);

        return res.json({
            status: true,
            message: "Thanks for rating the captain",
            data: {
                booking_id,
                driver_id: booking.driver_id,
                rating: stars,
                review: review || null,
                driver_avg_rating: driver ? driver.rating : null
            }
        });
    } catch (error) {
        console.error("submitSigiReview error:", error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  REVIEW LISTING
// ═══════════════════════════════════════════════════════════════════════════════

// shared helper — fetch a driver's reviews + summary
const fetchDriverReviews = async (driver_id) => {
    const [[summary]] = await db.query(
        `SELECT COUNT(*) AS total_reviews, COALESCE(ROUND(AVG(rating), 2), 0) AS average_rating
         FROM driver_reviews WHERE driver_id = ?`,
        [driver_id]
    );
    const [reviews] = await db.query(
        `SELECT dr.id, dr.booking_id, dr.rating, dr.review, dr.created_at,
                u.name AS user_name
         FROM driver_reviews dr
         LEFT JOIN users u ON u.id = dr.user_id
         WHERE dr.driver_id = ?
         ORDER BY dr.id DESC`,
        [driver_id]
    );
    return { summary, reviews };
};

// GET /driver/reviews   — logged-in captain views their own reviews
exports.getMyDriverReviews = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { summary, reviews } = await fetchDriverReviews(driver_id);
        return res.json({
            status: true,
            message: "Reviews fetched successfully",
            average_rating: summary.average_rating,
            total_reviews: summary.total_reviews,
            data: reviews
        });
    } catch (error) {
        console.error("getMyDriverReviews error:", error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// GET /driver/reviews/:driver_id   — public: anyone can view a captain's reviews
exports.getDriverReviewsById = async (req, res) => {
    try {
        const { driver_id } = req.params;

        const [[driver]] = await db.query(`SELECT id, full_name, rating FROM drivers WHERE id = ?`, [driver_id]);
        if (!driver) return res.status(404).json({ status: false, message: "Driver not found" });

        const { summary, reviews } = await fetchDriverReviews(driver_id);
        return res.json({
            status: true,
            message: "Reviews fetched successfully",
            driver: { id: driver.id, full_name: driver.full_name, rating: driver.rating },
            average_rating: summary.average_rating,
            total_reviews: summary.total_reviews,
            data: reviews
        });
    } catch (error) {
        console.error("getDriverReviewsById error:", error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};
