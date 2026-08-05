const db = require("../config/db");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require('uuid');

require("dotenv").config();
const SECRET = process.env.JWT_SECRET;
const { notifyUser, notifyDriver } = require("../services/notification");
const { createAdminNotification } = require('../services/adminNotification');

exports.payToken = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { booking_id, pickup_address, pickup_location, landmark } = req.body;

        if (!booking_id) {
            return res.status(400).json({
                status: false,
                message: "booking_id is required"
            });
        }

        const [rows] = await db.query(`
            SELECT 
                b.id,
                b.booking_id,
                b.status,
                b.user_id,
                b.driver_id,
                b.plan_id,
                p.token_price
            FROM bookings b
            LEFT JOIN plans p ON p.id = b.plan_id
            WHERE b.booking_id = ?
        `, [booking_id]);

        if (rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Booking not found"
            });
        }

        const booking = rows[0];

        if (booking.user_id !== user_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized"
            });
        }

        if (booking.status === 'TOKEN_PAID') {
            return res.status(400).json({
                status: false,
                message: "Token already paid"
            });
        }

        if (booking.status !== 'ACCEPTED' && booking.status !== 'ASSIGN') {
            return res.status(400).json({
                status: false,
                message: "Driver not assigned yet"
            });
        }

        const token_amount = booking.token_price;

        let updateFields = `
            status = 'TOKEN_PAID',
            user_status = 'CONFIRMED',
            driver_status = 'ACCEPTED',
            payment_mode = 'ONLINE',
            token_amount = ?,
            token_paid = 1
        `;

        let values = [token_amount];

        if (pickup_address) {
            updateFields += `, pickup_address = ?`;
            values.push(pickup_address);
        }

        if (pickup_location) {
            updateFields += `, pickup_location = ?`;
            values.push(pickup_location);
        }

        if (landmark) {
            updateFields += `, landmark = ?`;
            values.push(landmark);
        }

        values.push(booking.id);

        await db.query(`
            UPDATE bookings 
            SET ${updateFields}
            WHERE id = ?
        `, values);

        // notify assigned driver that token was paid
        try {
            if (booking.driver_id) {
                await notifyDriver(booking.driver_id, "Token paid",
                    `User paid token for booking ${booking.booking_id}`,
                    { type: "TOKEN_PAID", booking_id: booking.booking_id }
                );
            }
        } catch (nerr) {
            console.error("notification send error:", nerr.message);
        }

        return res.json({
            status: true,
            message: "Token paid successfully",
            data: {
                booking_id: booking.booking_id,
                token_amount
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.payBalance = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { booking_id, payment_mode } = req.body;

        if (!booking_id) {
            return res.status(400).json({
                status: false,
                message: "booking_id is required"
            });
        }

        const [rows] = await db.query(`
            SELECT
                b.id,
                b.booking_id,
                b.user_id,
                b.driver_id,
                b.status,
                b.token_amount,
                b.plan_id,
                b.otp,
                p.plan_price,
                p.plan_captain_commission,
                p.plan_company_commission
            FROM bookings b
            LEFT JOIN plans p ON p.id = b.plan_id
            WHERE b.booking_id = ?
        `, [booking_id]);

        if (rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Booking not found"
            });
        }

        const booking = rows[0];

        if (booking.user_id !== user_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized user"
            });
        }

        if (booking.status !== 'ARRIVED') {
            return res.status(400).json({
                status: false,
                message: "Payment allowed only after driver arrival"
            });
        }

        const token_amount          = Number(booking.token_amount           || 0);
        const plan_price            = Number(booking.plan_price             || 0);
        const plan_captain_commission = Number(booking.plan_captain_commission || 0);
        const plan_company_commission = Number(booking.plan_company_commission || 0);

        let balance_amount = plan_price - token_amount;
        if (balance_amount < 0) balance_amount = 0;

        const mode = (payment_mode && ['CASH', 'ONLINE'].includes(payment_mode)) ? payment_mode : 'CASH';

        await db.query(`
            UPDATE bookings
            SET
                balance_paid = 1,
                balance_amount = ?,
                payment_mode = ?,
                status = 'BALANCE_PAID',
                user_status = 'BALANCE_PAID',
                driver_status = 'ARRIVED'
            WHERE id = ?
        `, [balance_amount, mode, booking.id]);

        // notify assigned driver that balance was paid
        try {
            if (booking.driver_id) {
                await notifyDriver(booking.driver_id, "Balance paid",
                    `User paid remaining balance for booking ${booking.booking_id}`,
                    { type: "BALANCE_PAID", booking_id: booking.booking_id }
                );
            }
        } catch (nerr) {
            console.error("notification send error:", nerr.message);
        }

        return res.json({
            status: true,
            message: "Remaining balance paid successfully",
            data: {
                booking_id: booking.booking_id,
                payment_mode: mode,
                token_amount,
                plan_price,
                balance_amount,
                plan_captain_commission,
                plan_company_commission,
                otp: booking.otp
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

exports.payTopup = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { topup_id, payment_mode } = req.body;
        if (!topup_id) {
            return res.status(400).json({
                status: false,
                message: "topup_id is required"
            });
        }

        if (!payment_mode || !['CASH','ONLINE'].includes(payment_mode)) {
            return res.status(400).json({
                status: false,
                message: "payment_mode is required and must be 'online' or 'cash'"
            });
        }

        const [rows] = await db.query(`
            SELECT
                bt.id, bt.booking_id, bt.status,
                bt.topup_amount, bt.captain_commission, bt.company_commission,
                b.user_id, b.driver_id
            FROM booking_topups bt
            JOIN bookings b ON b.id = bt.booking_id
            WHERE bt.id = ?
        `, [topup_id]);

        if (rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Topup not found"
            });
        }

        const topup = rows[0];

        if (topup.user_id !== user_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized"
            });
        }

        if (topup.status === 'PAID') {
            return res.status(400).json({
                status: false,
                message: "Topup already paid"
            });
        }

        const otp = Math.floor(1000 + Math.random() * 9000);

        await db.query(`
            UPDATE booking_topups
            SET
                status = 'PAID',
                topup_otp = ?,
                payment_mode = ?,
                paid_at = NOW()
            WHERE id = ?
        `, [otp, payment_mode, topup_id]);

        const captain_commission = Number(topup.captain_commission || 0);

        return res.json({
            status: true,
            message: "Topup paid successfully",
            data: {
                topup_id,
                payment_mode,
                topup_amount: topup.topup_amount,
                captain_commission,
                company_commission: Number(topup.company_commission || 0),
                otp
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

exports.userBookingHistory = async (req, res) => {
    try {
        const user_id = req.user.id;

        const [bookings] = await db.query(`
            SELECT
                b.id,
                b.booking_id,
                b.service_id,
                b.sub_service_id,
                b.pickup_city,
                b.drop_city,
                b.to_city,
                b.pickup_address,
                b.drop_address,
                b.pickup_location,
                b.person,
                b.schedule_date,
                b.distance,
                b.total_fare,
                b.actual_distance,
                b.actual_fare,
                b.token_amount,
                b.token_paid,
                b.start_lat,
                b.start_lng,
                b.end_lat,
                b.end_lng,
                b.status,
                b.user_status,
                b.driver_status,
                b.otp_verified,
                b.user_rated,
                b.created_at,
                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km,
                p.token_price,
                p.platform_fee,
                p.access_fee,
                ss.fixed_charge,
                ss.fixed_charge_km,
                ss.charge_after_fixed_per_km,
                ss.access_fee      AS sub_access_fee,
                ss.access_fee_type AS sub_access_fee_type,
                ss.platform_fee    AS sub_platform_fee,
                d.full_name AS driver_name,
                d.phone AS driver_mobile,
                dp.driver_profile,
                dp.vehicle_type,
                dp.vehicle_model,
                dp.vehicle_color,
                dp.vehicle_number,
                s.title AS service_name,
                dr.rating AS user_rating,
dr.review AS user_review

            FROM bookings b

            LEFT JOIN plans p
                ON p.id = b.plan_id
            LEFT JOIN sub_services ss
                ON ss.id = b.sub_service_id
            LEFT JOIN drivers d
                ON d.id = b.driver_id
            LEFT JOIN driver_profiles dp
                ON dp.driver_id = b.driver_id
            LEFT JOIN services s
                ON s.id = b.service_id
            LEFT JOIN driver_reviews dr
                ON dr.booking_id = b.id
                AND dr.user_id = b.user_id
                AND dr.driver_id = b.driver_id
            WHERE b.user_id = ?

            ORDER BY b.id DESC
        `, [user_id]);

        for (let booking of bookings) {
            const isInCity = parseInt(booking.service_id) === 1;
            booking.is_incity = isInCity;
            booking.rating_status = booking.status === 'COMPLETED'
                ? (Number(booking.user_rated) === 1 ? 'FINISHED' : 'RATING_PENDING')
                : null;

            if (isInCity) {
                booking.plan_name    = undefined;
                booking.plan_price   = undefined;
                booking.meter_images = undefined;
                booking.topups       = undefined;
                booking.total_fare   = parseFloat(booking.actual_fare) > 0 ? booking.actual_fare : null;
                booking.final_fare   = parseFloat(booking.actual_fare) > 0 ? booking.actual_fare : null;
                const accessFee   = parseFloat(booking.sub_access_fee || 0);
                const platformFee = parseFloat(booking.sub_platform_fee || 0);
                booking.access_fee      = accessFee;
                booking.access_fee_type = booking.sub_access_fee_type || 'flat';
                booking.platform_fee    = platformFee;

                if (parseFloat(booking.actual_fare) > 0) {
                    const fixedCharge = parseFloat(booking.fixed_charge || 0);
                    const fixedKm     = parseFloat(booking.fixed_charge_km || 0);
                    const perKm       = parseFloat(booking.charge_after_fixed_per_km || 0);
                    const extraKm     = Math.max(0, parseFloat(booking.actual_distance || 0) - fixedKm);
                    booking.fare_breakdown = {
                        fixed_charge : fixedCharge,
                        fixed_km     : fixedKm,
                        extra_km     : extraKm,
                        extra_fare   : (extraKm * perKm).toFixed(2),
                        access_fee   : accessFee,
                        platform_fee : platformFee,
                        total_fare   : parseFloat(booking.actual_fare).toFixed(2)
                    };
                }
            } else {
                const [images] = await db.query(`
                    SELECT
                        id,
                        image_type,
                        CONCAT('uploads/meter_images/', image) AS image,
                        created_at
                    FROM booking_meter_images
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [booking.id]);

                const [topups] = await db.query(`
                    SELECT
                        id,
                        extra_km,
                        price_per_km,
                        topup_amount,
                        reason,
                        status,
                        topup_otp,
                        created_at
                    FROM booking_topups
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [booking.id]);

                booking.meter_images = images;
                booking.topups       = topups;
                booking.final_fare   = booking.total_fare ?? null;
            }

            // strip raw sub_service helper columns from the response
            booking.fixed_charge              = undefined;
            booking.fixed_charge_km           = undefined;
            booking.charge_after_fixed_per_km = undefined;
            booking.sub_access_fee            = undefined;
            booking.sub_access_fee_type       = undefined;
            booking.sub_platform_fee          = undefined;
        }

        return res.json({
            status: true,
            message: "User booking history fetched successfully",
            total_booking: bookings.length,
            data: bookings
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            message: "Server error",
            error: error.message
        });
    }
};

// GET /user/service-history?type=intercity|selfsharing|parcel|onspot (type optional)
// Combined history across all four services for the logged-in user, newest first.
exports.serviceHistory = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { type } = req.query;
        const wanted = (t) => !type || String(type).toLowerCase() === t;

        const tasks = [];

        // Intercity / ride bookings
        if (wanted('intercity')) {
            tasks.push(db.query(`
                SELECT b.booking_id AS booking_ref, b.status,
                       COALESCE(NULLIF(b.actual_fare, 0), b.total_fare) AS amount,
                       b.pickup_city AS from_location,
                       COALESCE(b.drop_city, b.to_city) AS to_location,
                       b.created_at, s.title AS service_name
                FROM bookings b
                LEFT JOIN services s ON s.id = b.service_id
                WHERE b.user_id = ?
            `, [user_id]).then(([rows]) => rows.map(r => ({ service_type: 'intercity', ...r }))));
        }

        // Self-sharing
        if (wanted('selfsharing')) {
            tasks.push(db.query(`
                SELECT sb.booking_id AS booking_ref, sb.status, sb.total_fare AS amount,
                       st.from_city AS from_location, st.to_city AS to_location,
                       sb.created_at, 'Self Sharing' AS service_name
                FROM sigi_bookings sb
                JOIN sigi_trips st ON st.id = sb.trip_id
                WHERE sb.user_id = ?
            `, [user_id]).then(([rows]) => rows.map(r => ({ service_type: 'selfsharing', ...r }))));
        }

        // Parcel
        if (wanted('parcel')) {
            tasks.push(db.query(`
                SELECT pb.parcel_booking_id AS booking_ref, pb.status, pb.amount,
                       pb.pickup_city AS from_location, pb.drop_city AS to_location,
                       pb.created_at, 'Parcel' AS service_name
                FROM parcel_bookings pb
                WHERE pb.user_id = ? AND pb.deleted_at IS NULL
            `, [user_id]).then(([rows]) => rows.map(r => ({ service_type: 'parcel', ...r }))));
        }

        // On-spot
        if (wanted('onspot')) {
            tasks.push(db.query(`
                SELECT ob.booking_no AS booking_ref, ob.status, ob.total_amount AS amount,
                       ob.city AS from_location, NULL AS to_location,
                       ob.created_at, s.title AS service_name
                FROM onspot_bookings ob
                LEFT JOIN services s ON s.id = ob.service_id
                WHERE ob.user_id = ?
            `, [user_id]).then(([rows]) => rows.map(r => ({ service_type: 'onspot', ...r }))));
        }

        const results = await Promise.all(tasks);
        const data = results
            .flat()
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json({
            status: true,
            message: "Service history fetched successfully",
            total: data.length,
            data
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.userCurrentBooking = async (req, res) => {
    try {
        const user_id = req.user.id;
        const [bookings] = await db.query(`
            SELECT
                b.id,
                b.booking_id,
                b.service_id,
                b.pickup_city,
                b.drop_city,
                b.to_city,
                b.pickup_address,
                b.drop_address,
                b.pickup_location,
                b.person,
                b.schedule_date,
                b.balance_amount,
                b.distance,
                b.total_fare,
                b.actual_distance,
                b.actual_fare,
                b.token_amount,
                b.token_paid,
                b.start_lat,
                b.start_lng,
                b.end_lat,
                b.end_lng,
                b.status,
                b.user_status,
                b.driver_status,
                b.otp_verified,
                b.user_rated,
                b.created_at,
                b.otp,
                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km,
                p.token_price,
                p.platform_fee,
                p.access_fee,
                ss.fixed_charge,
                ss.fixed_charge_km,
                ss.charge_after_fixed_per_km,
                ss.access_fee      AS sub_access_fee,
                ss.access_fee_type AS sub_access_fee_type,
                ss.platform_fee    AS sub_platform_fee,
                d.full_name AS driver_name,
                d.phone AS driver_mobile,
                d.current_lat AS driver_current_lat,
                d.current_lng AS driver_current_lng,
                d.location_updated_at AS driver_location_updated_at,
                dp.driver_profile,
                dp.vehicle_type,
                dp.vehicle_model,
                dp.vehicle_color,
                dp.vehicle_number,
                s.title AS service_name
            FROM bookings b

            LEFT JOIN plans p
                ON p.id = b.plan_id
            LEFT JOIN sub_services ss
                ON ss.id = b.sub_service_id
            LEFT JOIN drivers d
                ON d.id = b.driver_id
            LEFT JOIN driver_profiles dp
                ON dp.driver_id = b.driver_id
            LEFT JOIN services s
                ON s.id = b.service_id

            WHERE b.user_id = ?
            AND (
                b.status IN (
                    'PENDING','SEARCHING','ASSIGN','ACCEPTED','TOKEN_PAID','ARRIVED',
                    'STARTED','PICKEDUP','DROPPED','TOPUP_PENDING','BALANCE_PAID',
                    'WAITING_FOR_PAYMENT','SCHEDULED','OTP_VERIFIED'
                )
                -- keep a completed ride visible until the user rates the captain
                OR (b.status = 'COMPLETED' AND b.user_rated = 0)
            )
            ORDER BY b.id DESC
        `, [user_id]);

        if (bookings.length === 0) {
            return res.json({
                status: false,
                message: "No current booking found",
                data: []
            });
        }

        const result = await Promise.all(bookings.map(async (booking) => {
            const isInCity = parseInt(booking.service_id) === 1;
            booking.is_incity = isInCity;

            // rating lifecycle: after a ride is COMPLETED the user must rate the captain;
            // once rated the ride is FINISHED (and drops off the current-booking list).
            booking.rating_status = booking.status === 'COMPLETED'
                ? (Number(booking.user_rated) === 1 ? 'FINISHED' : 'RATING_PENDING')
                : null;

            if (isInCity) {
                booking.plan_name    = undefined;
                booking.plan_price   = undefined;
                booking.plan_hour    = undefined;
                booking.plan_km      = undefined;
                booking.meter_images = undefined;
                booking.topups       = undefined;
                const hasActualFare  = parseFloat(booking.actual_fare) > 0;
                booking.total_fare   = hasActualFare
                    ? booking.actual_fare
                    : (parseFloat(booking.total_fare) > 0 ? booking.total_fare : null);
                booking.fare_note    = hasActualFare
                    ? `Meter fare: ₹${booking.actual_fare} (${booking.actual_distance} km)`
                    : (parseFloat(booking.total_fare) > 0
                        ? `Estimated fare: ₹${booking.total_fare}`
                        : "Fare will be calculated on meter at trip end");

                // In-city: fees come from the sub_service (already included in actual_fare)
                const accessFee   = parseFloat(booking.sub_access_fee || 0);
                const platformFee = parseFloat(booking.sub_platform_fee || 0);
                booking.access_fee      = accessFee;
                booking.access_fee_type = booking.sub_access_fee_type || 'flat';
                booking.platform_fee    = platformFee;

                if (hasActualFare) {
                    const fixedCharge = parseFloat(booking.fixed_charge || 0);
                    const fixedKm     = parseFloat(booking.fixed_charge_km || 0);
                    const perKm       = parseFloat(booking.charge_after_fixed_per_km || 0);
                    const extraKm     = Math.max(0, parseFloat(booking.actual_distance || 0) - fixedKm);
                    booking.fare_breakdown = {
                        fixed_charge : fixedCharge,
                        fixed_km     : fixedKm,
                        extra_km     : extraKm,
                        extra_fare   : (extraKm * perKm).toFixed(2),
                        access_fee   : accessFee,
                        platform_fee : platformFee,
                        total_fare   : parseFloat(booking.actual_fare).toFixed(2)
                    };
                }
            } else {
                const [images] = await db.query(`
                    SELECT
                        id,
                        image_type,
                        CONCAT('uploads/meter_images/', image) AS image,
                        created_at
                    FROM booking_meter_images
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [booking.id]);

                const [topups] = await db.query(`
                    SELECT
                        id,
                        extra_km,
                        price_per_km,
                        topup_amount,
                        reason,
                        status,
                        topup_otp,
                        created_at
                    FROM booking_topups
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [booking.id]);

                booking.meter_images = images;
                booking.topups       = topups;
            }

            if (booking.driver_image) {
                booking.driver_image =
                    `${process.env.BASE_URL}/uploads/drivers/${booking.driver_image}`;
            }

            // full URL for the captain's profile photo (stored in uploads/driver_profiles/)
            booking.driver_profile_url = booking.driver_profile
                ? `${process.env.BASE_URL}/uploads/driver_profiles/${booking.driver_profile}`
                : null;

            // strip raw sub_service helper columns from the response
            booking.fixed_charge              = undefined;
            booking.fixed_charge_km           = undefined;
            booking.charge_after_fixed_per_km = undefined;
            booking.sub_access_fee            = undefined;
            booking.sub_access_fee_type       = undefined;
            booking.sub_platform_fee          = undefined;

            return booking;
        }));

        return res.json({
            status: true,
            message: "User current bookings fetched successfully",
            data: result
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            message: "Server error",
            error: error.message
        });
    }
};

//----------------------------------------------|Admin Api|----------------------------------------------------------------------------//
 exports.userList = async (req, res) => {
    try {

        const [users] = await db.query(`
            SELECT
                id,
                name,
                email,
                mobile,
                role,
                status,
                wallet,
                created_at
            FROM users
            WHERE role = 'user'
            ORDER BY id DESC
        `);

        return res.json({
            status: true,
            message: "All users fetched successfully",
            total_users: users.length,
            data: users
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            status: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const [users] = await db.query(`
            SELECT id, name, email, mobile, profile, role, status, created_at
            FROM users
            WHERE id = ? AND role = 'user'
        `, [userId]);

        if (!users.length) {
            return res.status(404).json({ status: false, message: "User not found" });
        }

        const user = users[0];
        if (user.profile) {
            user.profile = `https://${req.get('host')}/uploads/userprofile/${user.profile}`;
        }

        return res.json({
            status: true,
            message: "Profile fetched successfully",
            data: user
        });

    } catch (error) {
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email } = req.body;

        const [existing] = await db.query(
            `SELECT id, profile FROM users WHERE id = ? AND role = 'user'`,
            [userId]
        );

        if (!existing.length) {
            return res.status(404).json({ status: false, message: "User not found" });
        }

        if (email) {
            const [emailCheck] = await db.query(
                `SELECT id FROM users WHERE email = ? AND id != ?`,
                [email, userId]
            );
            if (emailCheck.length) {
                return res.status(409).json({ status: false, message: "Email already in use" });
            }
        }

        let profile = existing[0].profile;
        if (req.file) {
            if (profile) {
                const oldPath = path.join('uploads/userprofile', profile);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            profile = req.file.filename;
        }

        await db.query(`
            UPDATE users 
            SET 
                name       = COALESCE(?, name),
                email      = COALESCE(?, email),
                profile    = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [name || null, email || null, profile, userId]);

        const [updated] = await db.query(
            `SELECT id, name, email, mobile, profile, role, status, created_at FROM users WHERE id = ?`,
            [userId]
        );

        const user = updated[0];
        if (user.profile) {
            user.profile = `https://${req.get('host')}/uploads/userprofile/${user.profile}`;
        }

        return res.json({
            status: true,
            message: "Profile updated successfully",
            data: user
        });

    } catch (error) {
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.processPayment = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { booking_id, payment_mode } = req.body;

        const VALID_MODES = ['CASH', 'ONLINE', 'UPI', 'CARD'];

        if (!booking_id || !payment_mode) {
            return res.status(400).json({
                status: false,
                message: "booking_id and payment_mode are required"
            });
        }

        if (!VALID_MODES.includes(payment_mode.toUpperCase())) {
            return res.status(400).json({
                status: false,
                message: "payment_mode must be CASH, ONLINE, UPI or CARD"
            });
        }

        const [[booking]] = await db.query(`
            SELECT id, booking_id, user_id, driver_id,
                   service_id, status, paid,
                   actual_fare, total_fare
            FROM bookings
            WHERE booking_id = ?
        `, [booking_id]);

        if (!booking) {
            return res.status(404).json({
                status: false,
                message: "Booking not found"
            });
        }

        if (booking.user_id !== user_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized"
            });
        }

        const isInCity = parseInt(booking.service_id) === 1;

        const allowedStatuses = isInCity
            ? ['WAITING_FOR_PAYMENT']
            : ['BALANCE_PENDING'];

        if (!allowedStatuses.includes(booking.status)) {
            return res.status(400).json({
                status: false,
                message: "Payment not allowed at this stage"
            });
        }

        if (booking.paid == 1) {
            return res.status(400).json({
                status: false,
                message: "Payment already done"
            });
        }

        const finalFare = parseFloat(
            booking.actual_fare || booking.total_fare || 0
        );

        // After payment status
        const nextStatus = isInCity
            ? 'PAYMENT_DONE'
            : 'BALANCE_PAID';

        await db.query(`
            UPDATE bookings
            SET paid = 1,
                payment_mode = ?,
                paid_at = NOW(),
                status = ?,
                user_status = ?,
                driver_status = ?
            WHERE id = ?
        `, [
            payment_mode.toUpperCase(),
            nextStatus,
            nextStatus,
            nextStatus,
            booking.id
        ]);

        return res.json({
            status: true,
            message: "Payment done successfully",
            data: {
                booking_id: booking.booking_id,
                payment_mode: payment_mode.toUpperCase(),
                booking_status: nextStatus,
                final_fare: finalFare.toFixed(2)
            }
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            status: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.getInvoice = async (req, res) => {
    try {

        const caller_id = req.user.id;
        const role = req.user.role;

        const { booking_id } = req.body;

        if (!booking_id) {
            return res.status(400).json({
                status: false,
                message: "booking_id is required"
            });
        }

        const [[booking]] = await db.query(`
            SELECT
                b.id,
                b.booking_id,
                b.service_id,
                b.booking_type,
                b.user_id,
                b.driver_id,

                b.pickup_city,
                b.drop_city,
                b.to_city,
                b.pickup_address,
                b.drop_address,

                b.person,
                b.schedule_date,

                b.distance,
                b.actual_distance,

                b.total_fare,
                b.actual_fare,

                b.token_amount,
                b.token_paid,
                b.balance_amount,
                b.topup_amount,

                b.payment_mode,
                b.paid,
                b.paid_at,

                b.status,
                b.created_at,

                s.title AS service_name,
                ss.title AS sub_service_name,

                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km,
                p.platform_fee AS plan_platform_fee,
                p.access_fee   AS plan_access_fee,

                ss.fixed_charge,
                ss.fixed_charge_km,
                ss.charge_after_fixed_per_km,
                ss.access_fee      AS sub_access_fee,
                ss.access_fee_type AS sub_access_fee_type,
                ss.platform_fee    AS sub_platform_fee,

                u.name AS user_name,
                u.mobile AS user_mobile,

                d.full_name AS driver_name,
                d.phone AS driver_mobile

            FROM bookings b

            LEFT JOIN services s
                ON s.id = b.service_id

            LEFT JOIN sub_services ss
                ON ss.id = b.sub_service_id

            LEFT JOIN plans p
                ON p.id = b.plan_id

            LEFT JOIN users u
                ON u.id = b.user_id

            LEFT JOIN drivers d
                ON d.id = b.driver_id

            WHERE b.booking_id = ?
        `, [booking_id]);

        if (!booking) {
            return res.status(404).json({
                status: false,
                message: "Booking not found"
            });
        }

        // Authorization
        if (role === 'driver' && booking.driver_id != caller_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized"
            });
        }

        if (role === 'user' && booking.user_id != caller_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized"
            });
        }

        const isInCity = parseInt(booking.service_id) === 1;

        // Allowed invoice statuses
        const allowedStatuses = isInCity
            ? ['WAITING_FOR_PAYMENT', 'PAYMENT_DONE', 'COMPLETED']
            : ['COMPLETED'];

        if (!allowedStatuses.includes(booking.status)) {
            return res.status(400).json({
                status: false,
                message: "Invoice is not available at this stage"
            });
        }

        let fare_breakdown;
        let finalFare;

        // =========================
        // IN-CITY
        // =========================
        if (isInCity) {

            finalFare = parseFloat(
                booking.actual_fare || 0
            );

            // In-city: fees come from the sub_service (already included in actual_fare)
            const fixedCharge = parseFloat(booking.fixed_charge || 0);
            const fixedKm     = parseFloat(booking.fixed_charge_km || 0);
            const perKm       = parseFloat(booking.charge_after_fixed_per_km || 0);
            const accessFee   = parseFloat(booking.sub_access_fee || 0);
            const platformFee = parseFloat(booking.sub_platform_fee || 0);
            const extraKm     = Math.max(0, parseFloat(booking.actual_distance || 0) - fixedKm);

            fare_breakdown = {
                actual_distance: booking.actual_distance,
                fixed_charge: fixedCharge,
                fixed_km: fixedKm,
                extra_km: extraKm,
                extra_fare: (extraKm * perKm).toFixed(2),
                access_fee: accessFee,
                access_fee_type: booking.sub_access_fee_type || 'flat',
                platform_fee: platformFee,
                actual_fare: booking.actual_fare
            };

        } else {
            
            const [topups] = await db.query(`
                SELECT
                    id,
                    extra_km,
                    price_per_km,
                    topup_amount,
                    status
                FROM booking_topups
                WHERE booking_id = ?
                AND status = 'PAID'
            `, [booking.id]);

            const tokenAmt = parseFloat(
                booking.token_amount || 0
            );

            const balanceAmt = parseFloat(
                booking.balance_amount || 0
            );

            const totalTopup = topups.reduce((sum, t) => {
                return sum + parseFloat(t.topup_amount || 0);
            }, 0);

            finalFare = tokenAmt + balanceAmt + totalTopup;

            // Other services: fees come from the plan
            const accessFee   = booking.plan_access_fee != null ? parseFloat(booking.plan_access_fee) : 0;
            const platformFee = booking.plan_platform_fee != null ? parseFloat(booking.plan_platform_fee) : 0;

            fare_breakdown = {
                plan_name: booking.plan_name,
                plan_price: booking.plan_price,
                plan_hour: booking.plan_hour,
                plan_km: booking.plan_km,

                access_fee: accessFee,
                platform_fee: platformFee,

                token_amount: tokenAmt,
                balance_amount: balanceAmt,
                topup_amount: totalTopup,

                topups,

                total_paid: finalFare.toFixed(2)
            };
        }

        // Driver/User amount label
        const amountField = role === 'driver'
            ? {
                i_collect: finalFare.toFixed(2)
            }
            : {
                i_paid: finalFare.toFixed(2)
            };

        return res.json({
            status: true,
            message: "Invoice fetched successfully",

            invoice: {

                booking_id: booking.booking_id,
                booking_type: booking.booking_type,

                service_name: booking.service_name,
                sub_service_name: booking.sub_service_name,

                is_incity: isInCity,

                user: {
                    name: booking.user_name,
                    mobile: booking.user_mobile
                },

                driver: {
                    name: booking.driver_name,
                    mobile: booking.driver_mobile
                },

                pickup_address: booking.pickup_address,
                drop_address: booking.drop_address,

                pickup_city: booking.pickup_city,
                drop_city: booking.drop_city,

                person: booking.person,

                schedule_date: booking.schedule_date,

                fare_breakdown,

                payment_mode: booking.payment_mode,

                paid: booking.paid,
                paid_at: booking.paid_at,

                status: booking.status,

                booking_date: booking.created_at,

                ...amountField
            }
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            status: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.userInitiateRecharge = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { amount, payment_mode, transaction_id } = req.body;

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ status: false, message: "Valid amount is required" });
        }

        const validModes = ['CASH', 'ONLINE', 'UPI', 'CARD', 'BANK_TRANSFER'];
        const mode = payment_mode && validModes.includes(payment_mode.toUpperCase())
            ? payment_mode.toUpperCase()
            : 'ONLINE';

        const recharge_id = 'UR' + uuidv4().slice(0, 8).toUpperCase();
        const parsedAmount = parseFloat(amount).toFixed(2);

        const [result] = await db.query(
            `INSERT INTO user_wallet_recharges
                (user_id, recharge_id, amount, payment_mode, transaction_id, payment_status, recharge_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'SUCCESS', 'COMPLETED', NOW(), NOW())`,
            [user_id, recharge_id, parsedAmount, mode, transaction_id || null]
        );

        await db.query(
            `UPDATE users SET wallet = wallet + ? WHERE id = ?`,
            [parsedAmount, user_id]
        );

        return res.status(201).json({
            status: true,
            message: "Recharge successful. Wallet updated.",
            data: {
                id: result.insertId,
                recharge_id,
                amount: parsedAmount,
                payment_mode: mode,
                payment_status: 'SUCCESS',
                recharge_status: 'COMPLETED'
            }
        });

    } catch (error) {
        console.error("userInitiateRecharge error:", error.message);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getUserRechargeList = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { page, limit } = req.query;

        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page) || 1);
        const offset   = (pageNum - 1) * limitNum;

        const [countResult, walletResult] = await Promise.all([
            db.query(`SELECT COUNT(*) AS total FROM user_wallet_recharges WHERE user_id = ?`, [user_id]),
            db.query(`SELECT wallet FROM users WHERE id = ?`, [user_id])
        ]);
        const total   = countResult[0][0].total;
        const userRow = walletResult[0][0];

        const [rows] = await db.query(
            `SELECT id, recharge_id, amount, payment_mode, transaction_id,
                    payment_status, recharge_status, remarks, created_at, updated_at
             FROM user_wallet_recharges
             WHERE user_id = ?
             ORDER BY id DESC
             LIMIT ${limitNum} OFFSET ${offset}`,
            [user_id]
        );

    return res.json({
    status: true,
    message: "Recharge history fetched successfully",
    wallet_balance: parseFloat(userRow?.wallet || 0),
    pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum)
    },
    data: rows
});

    } catch (error) {
        console.error("getUserRechargeList error:", error.message);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { booking_id, cancel_reason ,role} = req.body;

        if (!booking_id) {
            return res.status(400).json({
                status: false,
                message: "booking_id is required"
            });
        }

        const allowedRoles = ['USER', 'DRIVER', 'BUSINESS_ASSOCIATE'];
        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({
                status: false,
                message: `Invalid role: '${role}'. Allowed: USER, DRIVER, BUSINESS_ASSOCIATE`
            });
        }

        // ─── Fetch booking ───────────────────────────────────────────────
        const [rows] = await db.query(`
            SELECT
                id,
                booking_id,
                user_id,
                driver_id,
                bussinessassociate_id,
                service_id,
                sub_service_id,
                status,
                user_status,
                driver_status,
                total_fare,
                schedule_date
            FROM bookings
            WHERE booking_id = ?
        `, [booking_id]);

        if (rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Booking not found"
            });
        }

        const booking = rows[0];
        console.log("📦 Booking:", booking);

        // ─── USER Authorization ──────────────────────────────────────────
        if (role === 'USER' && booking.user_id != user_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized: This booking does not belong to you"
            });
        }

        // ─── DRIVER Authorization ────────────────────────────────────────
        if (role === 'DRIVER' && booking.driver_id != user_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized: This booking is not assigned to you"
            });
        }

        // ─── BUSINESS_ASSOCIATE Authorization ────────────────────────────
        if (role === 'BUSINESS_ASSOCIATE') {
            if (!booking.bussinessassociate_id) {
                return res.status(403).json({
                    status: false,
                    message: "Unauthorized: No Business Associate linked to this booking"
                });
            }
            if (booking.bussinessassociate_id != user_id) {
                return res.status(403).json({
                    status: false,
                    message: "Unauthorized: This booking is not under your association"
                });
            }
        }

        // ─── Role wise restriction ───────────────────────────────────────
        if (role === 'BUSINESS_ASSOCIATE' && !['ASSIGN', 'ACCEPTED'].includes(booking.status)) {
            return res.status(400).json({
                status: false,
                message: "Business Associate can only cancel an ASSIGN or ACCEPTED booking"
            });
        }

        const cancelled_by = role;

        // ─── Cancellation fee from sub_services (time-window based) ─────
        // A charge applies ONLY after a captain has accepted the ride. If the ride
        // is still searching / not yet accepted, cancelling is free.
        const preAcceptance = ['PENDING', 'SEARCHING', 'SCHEDULED'];
        const isAccepted    = booking.driver_id && !preAcceptance.includes(booking.status);

        let cancellationFee = 0;
        let feeAppliedOn    = null;
        let walletDeducted  = 0;

        if (isAccepted && booking.sub_service_id) {
            const [[ss]] = await db.query(
                `SELECT
                    user_cancel_before48_type, user_cancel_before48_amount,
                    user_cancel_24to48_type,   user_cancel_24to48_amount,
                    user_cancel_0to24_type,    user_cancel_0to24_amount,
                    driver_cancel_before48_type, driver_cancel_before48_amount,
                    driver_cancel_24to48_type,   driver_cancel_24to48_amount,
                    driver_cancel_0to24_type,    driver_cancel_0to24_amount
                 FROM sub_services WHERE id = ?`,
                [booking.sub_service_id]
            );

            if (ss) {
                const prefix  = role === 'USER' ? 'user' : 'driver';
                const hoursLeft = booking.schedule_date
                    ? (new Date(booking.schedule_date) - new Date()) / 36e5
                    : null;

                let feeType, feeAmount;
                if (hoursLeft === null || hoursLeft >= 48) {
                    feeType   = ss[`${prefix}_cancel_before48_type`];
                    feeAmount = parseFloat(ss[`${prefix}_cancel_before48_amount`] || 0);
                } else if (hoursLeft >= 24) {
                    feeType   = ss[`${prefix}_cancel_24to48_type`];
                    feeAmount = parseFloat(ss[`${prefix}_cancel_24to48_amount`] || 0);
                } else {
                    feeType   = ss[`${prefix}_cancel_0to24_type`];
                    feeAmount = parseFloat(ss[`${prefix}_cancel_0to24_amount`] || 0);
                }

                if (feeType === 'percent') {
                    cancellationFee = parseFloat(booking.total_fare || 0) * feeAmount / 100;
                } else {
                    cancellationFee = feeAmount;
                }
                cancellationFee = Math.round(cancellationFee * 100) / 100;
                feeAppliedOn    = prefix;

                // deduct from the canceller's wallet — never let it go negative
                if (cancellationFee > 0) {
                    const table   = role === 'DRIVER' ? 'drivers' : 'users';
                    const walletOwnerId = role === 'DRIVER' ? booking.driver_id : booking.user_id;
                    const [[owner]] = await db.query(`SELECT wallet FROM ${table} WHERE id = ?`, [walletOwnerId]);
                    // const balance = parseFloat(owner?.wallet || 0);
                    // walletDeducted = Math.min(cancellationFee, Math.max(0, balance));
                    // if (walletDeducted > 0) {
                    //     await db.query(
                    //         `UPDATE ${table} SET wallet = wallet - ? WHERE id = ?`,
                    //         [walletDeducted, walletOwnerId]
                    //     );
                    // }
                    const balance = parseFloat(owner?.wallet || 0);

// Always deduct full cancellation fee
walletDeducted = cancellationFee;

await db.query(
    `UPDATE ${table}
     SET wallet = wallet - ?
     WHERE id = ?`,
    [walletDeducted, walletOwnerId]
);
                }
            }
        }

        // ─── Update booking ──────────────────────────────────────────────
        await db.query(`
            UPDATE bookings
            SET
                status           = 'CANCELLED',
                user_status      = 'CANCELLED',
                driver_status    = 'CANCELLED',
                cancelled_by     = ?,
                cancel_reason    = ?,
                cancellation_fee = ?
            WHERE id = ?
        `, [cancelled_by, cancel_reason || null, cancellationFee, booking.id]);

        await createAdminNotification({
          type: 'booking_cancel',
          source_table: 'bookings',
          source_id: booking.id,
          message: `Booking ${booking.booking_id} cancelled by ${cancelled_by}`,
          sub: `Cancelled by ${cancelled_by}`,
          payload: { booking_id: booking.booking_id, cancelled_by }
        });

        // send push notification to the other party
        try {
            if (role === 'USER' && booking.driver_id) {
                await notifyDriver(booking.driver_id, "Booking cancelled",
                    `User cancelled booking ${booking.booking_id}`,
                    { type: "BOOKING_CANCELLED", booking_id: booking.booking_id, cancelled_by: 'USER' }
                );
            } else if (role === 'DRIVER' && booking.user_id) {
                await notifyUser(booking.user_id, "Booking cancelled",
                    `Driver cancelled booking ${booking.booking_id}`,
                    { type: "BOOKING_CANCELLED", booking_id: booking.booking_id, cancelled_by: 'DRIVER' }
                );
            }
        } catch (nerr) {
            console.error("notification send error:", nerr.message);
        }

        return res.json({
            status: true,
            message: "Booking cancelled successfully",
            data: {
                booking_id      : booking.booking_id,
                cancelled_by    : cancelled_by,
                cancel_reason   : cancel_reason || null,
                was_accepted    : isAccepted,
                cancellation_fee: cancellationFee,
                wallet_deducted : walletDeducted,
                fee_applied_on  : feeAppliedOn
            }
        });

    } catch (error) {
        console.error("❌ cancelBooking error:", error.message);
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

// ─── USER WITHDRAWAL REQUEST ─────────────────────────────────────────────────
exports.createWithdrawalRequest = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { amount, bank_name, account_number, ifsc_code, account_holder_name, upi_id } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ status: false, message: "Valid amount is required" });
        }

        if (!upi_id && (!bank_name || !account_number || !ifsc_code || !account_holder_name)) {
            return res.status(400).json({
                status: false,
                message: "Provide either UPI ID or full bank details (bank_name, account_number, ifsc_code, account_holder_name)"
            });
        }

        const [[user]] = await db.execute(`SELECT id, wallet FROM users WHERE id = ?`, [user_id]);
        if (!user) return res.status(404).json({ status: false, message: "User not found" });

        if (parseFloat(user.wallet) < parseFloat(amount)) {
            return res.status(400).json({ status: false, message: "Insufficient wallet balance" });
        }

        const [existing] = await db.execute(
            `SELECT id FROM withdrawal_requests WHERE user_type = 'USER' AND user_id = ? AND status = 'PENDING'`,
            [user_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ status: false, message: "You already have a pending withdrawal request" });
        }

        await db.execute(`
            INSERT INTO withdrawal_requests
                (user_type, user_id, amount, bank_name, account_number, ifsc_code, account_holder_name, upi_id, status, created_at, updated_at)
            VALUES ('USER', ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())
        `, [user_id, parseFloat(amount), bank_name || null, account_number || null, ifsc_code || null, account_holder_name || null, upi_id || null]);

        await createAdminNotification({
          type: 'withdrawal_request',
          source_table: 'withdrawal_requests',
          source_id: null,
          message: `User withdrawal request for ₹${amount}`,
          sub: `Pending user payout`,
          payload: { user_type: 'USER', user_id, amount: parseFloat(amount) }
        });

        return res.json({ status: true, message: "Withdrawal request submitted successfully" });

    } catch (error) {
        console.error("createWithdrawalRequest error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getUserWithdrawalHistory = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM withdrawal_requests WHERE user_type = 'USER' AND user_id = ?`,
            [user_id]
        );

        const [rows] = await db.execute(`
            SELECT w.id, w.amount, w.bank_name, w.account_number, w.ifsc_code, w.account_holder_name, w.upi_id,
                   w.status, w.remarks, w.created_at, w.updated_at,
                   u.name AS user_name, u.mobile AS user_mobile
            FROM withdrawal_requests w
            LEFT JOIN users u ON u.id = w.user_id
            WHERE w.user_type = 'USER' AND w.user_id = ?
            ORDER BY w.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, [user_id]);

        return res.json({
            status: true,
            message: "Withdrawal history fetched successfully",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });

    } catch (error) {
        console.error("getUserWithdrawalHistory error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};
