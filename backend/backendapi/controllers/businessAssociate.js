const db = require("../config/db");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { createAdminNotification } = require('../services/adminNotification');
const { notifyUser } = require('../services/notification');
require("dotenv").config();
const SECRET = process.env.JWT_SECRET;

// One-time welcome gift credited to a Business Associate's wallet on first registration
const BA_SIGNUP_GIFT = 100;

// Driver's earning on a booking = plan_captain_commission + Σ(PAID topup captain_commission)
const computeDriverAmount = (planCaptainCommission, topups = []) => {
    const planPart  = parseFloat(planCaptainCommission || 0);
    const topupPart = topups
        .filter(t => t.status === 'PAID')
        .reduce((sum, t) => sum + parseFloat(t.captain_commission || 0), 0);
    return Math.round((planPart + topupPart) * 100) / 100;
};


exports.sendOTP = async (req, res) => {
    try {
        const { ba_mobile } = req.body;

        if (!ba_mobile) {
            return res.status(400).json({ message: "Mobile required" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);
        const expires_at = new Date(Date.now() + 5 * 60 * 1000);

        await db.query(
            "INSERT INTO ba_otps (ba_mobile, otp, expires_at) VALUES (?, ?, ?)",
            [ba_mobile, otp, expires_at]
        );

        console.log("OTP:", otp); 

        res.json({ message: "OTP sent", otpnumber : otp  });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.verifyAndRegisterBA = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { ba_mobile, otp, ba_name, company_name, services, fcm_token, pincode } = req.body;

        if (!ba_mobile) {
            return res.status(400).json({ message: "Mobile number is required" });
        }

        if (!otp) {
            return res.status(400).json({ message: "OTP is required" });
        }

        const [otpRows] = await connection.query(
            `SELECT * FROM ba_otps 
             WHERE ba_mobile = ? AND otp = ? 
             ORDER BY id DESC LIMIT 1`,
            [ba_mobile, otp]
        );

        if (otpRows.length === 0) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        const otpRecord = otpRows[0];

        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(400).json({ message: "OTP expired" });
        }

        const [exist] = await connection.query(
            "SELECT * FROM business_associates WHERE ba_mobile = ?",
            [ba_mobile]
        );

        let ba_id;
        let ba_data;

        let uniqueServices = [];

        if (services && services.length > 0) {

            uniqueServices = [...new Map(
                services.map(s => [parseInt(s.service_id), s])
            ).values()];

            const serviceIds = uniqueServices.map(s => parseInt(s.service_id));

            const placeholders = serviceIds.map(() => '?').join(',');

            const [validServices] = await connection.query(
                `SELECT id FROM services WHERE id IN (${placeholders})`,
                serviceIds
            );

            const validIds = validServices.map(s => s.id);

            const invalidServices = serviceIds.filter(id => !validIds.includes(id));

            if (invalidServices.length > 0) {
                return res.status(400).json({
                    message: "Invalid service_id found",
                    invalid_service_ids: invalidServices
                });
            }
        }

        await connection.beginTransaction();

        if (exist.length === 0) {

            if (!ba_name) {
                return res.status(400).json({ message: "Name is required" });
            }

            if (!services || services.length === 0) {
                return res.status(400).json({ message: "At least one service is required" });
            }

            const [result] = await connection.query(
                "INSERT INTO business_associates (ba_name, ba_mobile, company_name, pincode, wallet, fcm_token) VALUES (?, ?, ?, ?, ?, ?)",
                [ba_name, ba_mobile, company_name?.trim() || null, pincode?.trim() || null, BA_SIGNUP_GIFT, fcm_token || null]
            );

            ba_id = result.insertId;

            await createAdminNotification({
              type: 'ba',
              source_table: 'business_associates',
              source_id: ba_id,
              message: `New business associate registered: ${ba_name}`,
              sub: `BA registration received`,
              payload: { ba_id, ba_mobile }
            });

            for (let s of uniqueServices) {

                const serviceId = parseInt(s.service_id);

                await connection.query(
                    "INSERT INTO ba_services (ba_id, service_id, commission_rate) VALUES (?, ?, ?)",
                    [ba_id, serviceId, s.commission_rate || 0]
                );
            }

            ba_data = { id: ba_id, ba_name, ba_mobile, pincode: pincode?.trim() || null, company_name: company_name?.trim() || null, wallet: BA_SIGNUP_GIFT };

        } else {
            ba_data = exist[0];
            ba_id = ba_data.id;

            // OTP verified — update fcm_token for the existing BA
            if (fcm_token) {
                await connection.query(
                    "UPDATE business_associates SET fcm_token = ? WHERE id = ?",
                    [fcm_token, ba_id]
                );
            }

            if (uniqueServices.length > 0) {

                // old services delete
                await connection.query(
                    "DELETE FROM ba_services WHERE ba_id = ?",
                    [ba_id]
                );

                // insert new services
                for (let s of uniqueServices) {

                    const serviceId = parseInt(s.service_id);

                    await connection.query(
                        "INSERT INTO ba_services (ba_id, service_id, commission_rate) VALUES (?, ?, ?)",
                        [ba_id, serviceId, s.commission_rate || 0]
                    );
                }
            }
        }

        // ✅ COMMIT
        await connection.commit();

        // ✅ TOKEN
        const token = jwt.sign(
            { id: ba_id, mobile: ba_mobile },
            SECRET,
            { expiresIn: "7d" }
        );

        // ✅ DELETE OTP
        await connection.query(
            "DELETE FROM ba_otps WHERE ba_mobile = ?",
            [ba_mobile]
        );

        return res.json({
            message: "Login/Register successful",
            token,
            ba: ba_data
        });

    } catch (err) {
        await connection.rollback();

        console.error("ERROR:", err);

        return res.status(500).json({
            error: err.message
        });
    } finally {
        connection.release();
    }
};

exports.verifyOTPLogin = async (req, res) => {
    try {
        const { ba_mobile, otp, fcm_token } = req.body;

        const [rows] = await db.query(
            `SELECT * FROM ba_otps
             WHERE ba_mobile = ? AND otp = ?
             ORDER BY id DESC LIMIT 1`,
            [ba_mobile, otp]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: "Invalid OTP" });
        }
        const record = rows[0];
        if (new Date() > new Date(record.expires_at)) {
            return res.status(400).json({ message: "OTP expired" });
        }
        const [users] = await db.query(
            "SELECT * FROM business_associates WHERE ba_mobile = ?",
            [ba_mobile]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "User not registered" });
        }

        const ba = users[0];

        // OTP verified — update fcm_token for the BA
        if (fcm_token) {
            await db.query(
                "UPDATE business_associates SET fcm_token = ? WHERE id = ?",
                [fcm_token, ba.id]
            );
        }

        const token = jwt.sign(
            { id: ba.id, mobile: ba.ba_mobile },
            SECRET,
            { expiresIn: "7d" }
        );

        await db.query(
            "DELETE FROM ba_otps WHERE ba_mobile = ?",
            [ba_mobile]
        );

        res.json({
            message: "Login successful",
            token,
            ba
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.addBAServices = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { services } = req.body;
        if (!services || services.length === 0) {
            return res.status(400).json({
                status: false,
                message: "At least one service required"
            });
        }

        const [ba] = await db.query(
            "SELECT id FROM business_associates WHERE id = ?",
            [ba_id]
        );

        if (ba.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Business Associate not found"
            });
        }
        const uniqueServices = [...new Map(services.map(s => [s.service_id, s])).values()];
        const serviceIds = uniqueServices.map(s => s.service_id);
        const [validServices] = await db.query(
            "SELECT id FROM services WHERE id IN (?)",
            [serviceIds]
        );

        const validIds = validServices.map(s => s.id);

        const invalidServices = serviceIds.filter(id => !validIds.includes(id));

        if (invalidServices.length > 0) {
            return res.status(400).json({
                status: false,
                message: "Invalid service_id found",
                invalid_service_ids: invalidServices
            });
        }
        const [existing] = await db.query(
            "SELECT service_id FROM ba_services WHERE ba_id = ?",
            [ba_id]
        );
        const existingIds = existing.map(s => s.service_id);
        const newServices = uniqueServices.filter(
            s => !existingIds.includes(s.service_id)
        );

        if (newServices.length === 0) {
            return res.json({
                status: true,
                message: "All services already added"
            });
        }

        for (let s of newServices) {
            await db.query(
                "INSERT INTO ba_services (ba_id, service_id, commission_rate) VALUES (?, ?, ?)",
                [ba_id, s.service_id, s.commission_rate || 0]
            );
        }

        res.json({
            status: true,
            message: "Services added successfully",
            added_count: newServices.length,
            added_services: newServices
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            message: "Something went wrong",
            error: err.message
        });
    }
};
exports.getBAServices = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const [rows] = await db.query(`
            SELECT 
                bs.id,
                bs.service_id,
                s.title,
                bs.created_at
                FROM ba_services bs
                LEFT JOIN services s ON bs.service_id = s.id
                WHERE bs.ba_id = ?
                ORDER BY bs.id DESC
        `, [ba_id]);

        res.json({
            status: true,
            message: "BA services fetched successfully",
            total: rows.length,
            data: rows
        });

    } catch (err) {
        res.status(500).json({
            status: false,
            message: "Something went wrong",
            error: err.message
        });
    }
};

exports.createDriverByBA = async (req, res) => {
    try {
        const ba_id = req.user.id; // logged-in BA
        const {
            full_name,
            phone,
            service_id,
            sub_service_id,
            pincode
        } = req.body;

        if (!full_name || !phone || !service_id || !sub_service_id) {
            return res.status(400).json({
                status: false,
                message: "Missing required fields"
            });
        }

        const [ba] = await db.query(
            "SELECT id FROM business_associates WHERE id = ?",
            [ba_id]
        );

        if (ba.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Business Associate not found"
            });
        }


        // ✅ 5. Check phone already exists
        const [existingDriver] = await db.query(
            "SELECT id FROM drivers WHERE phone = ?",
            [phone]
        );

        if (existingDriver.length > 0) {
            return res.status(400).json({
                status: false,
                message: "Driver already exists with this service"
            });
        }

        const [result] = await db.query(
            `INSERT INTO drivers 
            (full_name, phone, service_id, sub_service_id, pincode, ba_id, wallet, status, is_online)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', 0)`,
            [full_name, phone, service_id, sub_service_id, pincode, ba_id]
        );

        return res.json({
            status: true,
            message: "Driver created successfully",
            driver_id: result.insertId
        });

    } catch (err) {
        console.error("Create Driver Error:", err);
        return res.status(500).json({
            status: false,
            message: "Something went wrong",
            error: err.message
        });
    }
};

exports.getDriversByBA = async (req, res) => {
    try {
        const ba_id = req.user.id; 
        const [ba] = await db.query(
            "SELECT id FROM business_associates WHERE id = ?",
            [ba_id]
        );

        if (ba.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Business Associate not found"
            });
        }
        const [drivers] = await db.query(
            `SELECT 
                d.id,
                d.full_name,
                d.phone,
                d.pincode,
                d.status,
                d.is_online,
                s.id AS service_id,
                s.title AS service_name,
                ss.id AS sub_service_id,
                ss.title AS sub_service_name
            FROM drivers d
            LEFT JOIN services s ON s.id = d.service_id
            LEFT JOIN sub_services ss ON ss.id = d.sub_service_id
            WHERE d.ba_id = ?
            ORDER BY d.id DESC`,
            [ba_id]
        );

        return res.json({
            status: true,
            message: "Driver list fetched successfully",
            total: drivers.length,
            data: drivers
        });

    } catch (err) {
        console.error("Get Drivers Error:", err);
        return res.status(500).json({
            status: false,
            message: "Something went wrong",
            error: err.message
        });
    }
};

exports.getBABookings = async (req, res) => {
    try {
        const ba_id = req.user.id;
        // const { status } = req.query;

        // let statusClause = `b.status = 'SEARCHING'`;
const params = [ba_id, ba_id];

        // if (status) {
        //     statusClause = `b.status = ?`;
        //     params.push(status);
        // }

        // params.push(ba_id);

        const [bookings] = await db.query(`
            SELECT
                b.id,
                b.booking_id,
                b.service_id,
                b.booking_type,
                b.pickup_city,
                b.drop_city,
                b.to_city,
                b.pickup_address,
                b.drop_address,
                b.person,
                b.schedule_date,
                b.balance_amount,
                b.distance,
                b.total_fare,
                b.token_amount,
                b.token_paid,
                b.actual_fare,
                b.platform_fee,
                b.access_fee,
                b.status,
                b.user_status,
                b.driver_status,
                b.bussinessassociate_id,
                b.created_at,
                b.user_rated,
                b.user_review,

                s.title  AS service_name,

                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km,

                u.name   AS user_name,
                u.mobile AS user_mobile,

                d.full_name AS driver_name,
                d.phone     AS driver_phone

            FROM bookings b
            LEFT JOIN users u       ON u.id  = b.user_id
            LEFT JOIN drivers d     ON d.id  = b.driver_id
            LEFT JOIN services s    ON s.id  = b.service_id
            LEFT JOIN plans p       ON p.id  = b.plan_id
            INNER JOIN ba_services bs ON bs.service_id = b.service_id AND bs.ba_id = ?
           WHERE b.status = 'SEARCHING'
              AND b.service_id != 1
              AND b.id NOT IN (
                  SELECT booking_id FROM booking_rejections WHERE ba_id = ?
              )
            ORDER BY b.id DESC
        `, params);

        return res.json({
            status: true,
            message: "Bookings fetched successfully",
            total: bookings.length,
            data: bookings
        });

    } catch (err) {
        console.error("getBABookings Error:", err);
        return res.status(500).json({
            status: false,
            message: "Something went wrong",
            error: err.message
        });
    }
};

exports.getMyBABookings = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { status } = req.query;

        let whereClause = "b.bussinessassociate_id = ?";
        const params = [ba_id];

        if (status) {
            whereClause += " AND b.status = ?";
            params.push(status);
        }

        const [bookings] = await db.query(`
            SELECT
                b.id,
                b.booking_id,
                b.service_id,
                b.booking_type,
                b.pickup_city,
                b.drop_city,
                b.to_city,
                b.pickup_address,
                b.drop_address,
                b.person,
                b.schedule_date,
                b.balance_amount,
                b.distance,
                b.total_fare,
                b.token_amount,
                b.token_paid,
                b.actual_fare,
                b.platform_fee,
                b.access_fee,
                b.status,
                b.user_status,
                b.driver_status,
                b.bussinessassociate_id,
                b.created_at,
                b.user_rated,
                b.user_review,

                s.title AS service_name,

                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km,
                p.plan_captain_commission,

                u.name AS user_name,
                u.mobile AS user_mobile,

                d.full_name AS driver_name,
                d.phone AS driver_phone

            FROM bookings b
            LEFT JOIN users u
                ON u.id = b.user_id
            LEFT JOIN drivers d
                ON d.id = b.driver_id
            LEFT JOIN services s
                ON s.id = b.service_id
            LEFT JOIN plans p
                ON p.id = b.plan_id

            WHERE ${whereClause}
              AND b.service_id != 1

            ORDER BY b.id DESC
        `, params);

        let data = bookings;

        if (bookings.length > 0) {
            const bookingIds = bookings.map(b => b.id);

            const [allImages] = await db.query(`
                SELECT id, booking_id, image_type,
                    CONCAT('uploads/meter_images/', image) AS image, created_at
                FROM booking_meter_images
                WHERE booking_id IN (?)
                ORDER BY id ASC
            `, [bookingIds]);

            const [allTopups] = await db.query(`
                SELECT id, booking_id, extra_km, price_per_km, topup_amount, captain_commission, reason, status, created_at
                FROM booking_topups
                WHERE booking_id IN (?)
                ORDER BY id ASC
            `, [bookingIds]);

            const imageMap = {};
            const topupMap = {};

            allImages.forEach(img => {
                if (!imageMap[img.booking_id]) imageMap[img.booking_id] = [];
                imageMap[img.booking_id].push(img);
            });

            allTopups.forEach(topup => {
                if (!topupMap[topup.booking_id]) topupMap[topup.booking_id] = [];
                topupMap[topup.booking_id].push(topup);
            });

            data = bookings.map(booking => {
                const topups = topupMap[booking.id] || [];
                return {
                    ...booking,
                    meter_images:  imageMap[booking.id] || [],
                    topups,
                    driver_amount: computeDriverAmount(booking.plan_captain_commission, topups),
                    plan_captain_commission: undefined
                };
            });
        }

        return res.json({
            status: true,
            message: "My bookings fetched successfully",
            total: data.length,
            data
        });

    } catch (err) {
        console.error("getMyBABookings Error:", err);
        return res.status(500).json({
            status: false,
            message: "Something went wrong",
            error: err.message
        });
    }
};

exports.baRejectBooking = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { booking_id } = req.body;

        if (!booking_id) {
            return res.status(400).json({ status: false, message: "booking_id is required" });
        }

        const [[booking]] = await db.query(
            `SELECT id FROM bookings WHERE booking_id = ? AND status = 'SEARCHING'`,
            [booking_id]
        );

        if (!booking) {
            return res.status(404).json({ status: false, message: "Booking not found or not in SEARCHING state" });
        }

        const [result] = await db.query(`
            INSERT IGNORE INTO booking_rejections (booking_id, ba_id, created_at)
            VALUES (?, ?, NOW())
        `, [booking.id, ba_id]);

        if (result.insertId) {
          await createAdminNotification({
            type: 'booking_rejection',
            source_table: 'booking_rejections',
            source_id: result.insertId,
            message: `Booking ${booking_id} rejected by BA ${ba_id}`,
            sub: `Rejected by BA`,
            payload: { booking_id, ba_id }
          });
        }

        return res.json({ status: true, message: "Booking rejected successfully" });

    } catch (error) {
        console.error("baRejectBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.baacceptBooking = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { booking_id } = req.body;

        if (!booking_id) {
            return res.status(400).json({ status: false, message: "booking_id required hai" });
        }

        const [booking] = await db.query(
            `SELECT b.id, b.status, b.user_id, b.pickup_city FROM bookings b
             INNER JOIN ba_services bs ON bs.service_id = b.service_id AND bs.ba_id = ?
             WHERE b.booking_id = ?`,
            [ba_id, booking_id]
        );

        if (!booking.length) {
            return res.status(404).json({ status: false, message: "Booking not found" });
        }

        if (booking[0].status !== 'SEARCHING') {
            return res.status(400).json({ status: false, message: `Booking already ${booking[0].status} hai` });
        }

        await db.query(
            `UPDATE bookings SET bussinessassociate_id = ?, status = 'ACCEPTED', updated_at = NOW() WHERE booking_id = ?`,
            [ba_id, booking_id]
        );

        await notifyUser(booking[0].user_id, "Booking accepted",
            "Your booking has been accepted. A captain will be assigned shortly.",
            { type: "BOOKING_ACCEPTED", booking_id });

        return res.json({ status: true, message: "Booking Accept Successfully" });

    } catch (err) {
        console.error("acceptBooking Error:", err);
        return res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
    }
};

exports.assignDriverToBooking = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { booking_id, driver_id } = req.body;

        // ✅ Validation
        if (!booking_id || !driver_id) {
            return res.status(400).json({
                status: false,
                message: "booking_id and driver_id are required"
            });
        }

        // ✅ Get Booking
        const [booking] = await db.query(
            `SELECT 
                id,
                status,
                user_status,
                driver_status,
                driver_id
             FROM bookings
             WHERE booking_id = ?
             AND bussinessassociate_id = ?`,
            [booking_id, ba_id]
        );

        if (!booking.length) {
            return res.status(404).json({
                status: false,
                message: "Booking not found"
            });
        }

        const bookingData = booking[0];

        // ✅ Allow Assign/Reassign Only
        if (
            !['ACCEPTED', 'TOKEN_PAID', 'ASSIGN'].includes(
                bookingData.status
            )
        ) {
            return res.status(400).json({
                status: false,
                message: `Booking status is ${bookingData.status}, cannot assign driver`
            });
        }

        // ✅ Prevent Same Driver Reassign
        if (
            bookingData.driver_id &&
            Number(bookingData.driver_id) === Number(driver_id)
        ) {
            return res.status(400).json({
                status: false,
                message: "This driver is already assigned"
            });
        }

        // ✅ Check Driver
        const [driver] = await db.query(
            `SELECT 
                id,
                full_name,
                phone,
                status,
                is_online
             FROM drivers
             WHERE id = ?
             AND ba_id = ?`,
            [driver_id, ba_id]
        );

        if (!driver.length) {
            return res.status(404).json({
                status: false,
                message: "This driver does not belong to you"
            });
        }

        const driverData = driver[0];

        // ✅ Driver Online
        if (!driverData.is_online) {
            return res.status(400).json({
                status: false,
                message: "Driver is offline"
            });
        }

        // ✅ Driver Approved
        if (driverData.status.trim().toLowerCase() !== "approved") {
            return res.status(400).json({
                status: false,
                message: "Driver is not active"
            });
        }

        // ✅ Driver Busy Check
        const [activeRide] = await db.query(
            `SELECT id
             FROM bookings
             WHERE driver_id = ?
             AND status IN ('ASSIGN', 'ARRIVED', 'STARTED')`,
            [driver_id]
        );

        if (activeRide.length) {
            return res.status(400).json({
                status: false,
                message: "Driver is currently on another ride"
            });
        }

        let bookingStatus = 'ASSIGN';
        let userStatus = 'CONFIRMED';
        let driverStatus = 'ACCEPTED';
        let message = 'Driver assigned successfully';

        if (bookingData.driver_id) {
            driverStatus = 'REASSIGN';
            message = 'Driver reassigned successfully';
        }

        await db.query(
            `UPDATE bookings
             SET 
                driver_id = ?,
                status = ?,
                user_status = ?,
                driver_status = ?,
                updated_at = NOW()
             WHERE booking_id = ?`,
            [
                driver_id,
                bookingStatus,
                userStatus,
                driverStatus,
                booking_id
            ]
        );

        const [updated] = await db.query(
            `SELECT 
                b.*,
                d.full_name AS driver_name,
                d.phone AS driver_phone
             FROM bookings b
             LEFT JOIN drivers d
             ON d.id = b.driver_id
             WHERE b.booking_id = ?`,
            [booking_id]
        );

        return res.status(200).json({
            status: true,
            message,
            data: updated[0]
        });

    } catch (err) {
        console.error("assignDriverToBooking Error:", err);

        return res.status(500).json({
            status: false,
            message: "Something went wrong",
            error: err.message
        });
    }
};
//----------------------------------------------bussiness_associate--------------------------------------------------//

exports.getBACurrentBookings = async (req, res) => {
    try {
        const bussinessassociate_id = req.user.id;

        const [bookings] = await db.query(`
            SELECT 
                b.id,
                b.booking_id,
                b.pickup_city,
                b.drop_city,
                b.to_city,
                b.pickup_address,
                b.drop_address,
                b.person,
                b.schedule_date,
                b.balance_amount,
                b.status,
                b.user_status,
                b.driver_status,
                b.created_at,
                b.bussinessassociate_id,
                 b.total_fare,
                b.token_amount,
                b.token_paid,
                b.platform_fee,
                b.access_fee,
                b.service_id,

                s.title       AS service_name,

                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km,

                u.name        AS user_name,
                u.mobile      AS user_mobile,

                d.full_name   AS driver_name,
                d.phone       AS driver_mobile

            FROM bookings b
            LEFT JOIN plans p ON p.id = b.plan_id
            LEFT JOIN users u ON u.id = b.user_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN services s ON s.id = b.service_id

            WHERE b.bussinessassociate_id = ?
            AND b.status IN (
                'PENDING','SEARCHING','ASSIGN','ACCEPTED','TOKEN_PAID','ARRIVED',
                'STARTED','PICKEDUP','DROPPED','TOPUP_PENDING','BALANCE_PAID',
                'SCHEDULED','OTP_VERIFIED'
            )
            ORDER BY b.id DESC
        `, [bussinessassociate_id]);

        if (bookings.length === 0) {
            return res.json({
                status: false,
                message: "No current bookings found",
                total: 0,
                data: []
            });
        }

        const bookingIds = bookings.map(b => b.id);

        const [allImages] = await db.query(`
            SELECT id, booking_id, image_type,
                CONCAT('uploads/meter_images/', image) AS image, created_at
            FROM booking_meter_images
            WHERE booking_id IN (?)
            ORDER BY id ASC
        `, [bookingIds]);

        const [allTopups] = await db.query(`
            SELECT id, booking_id, extra_km, price_per_km, topup_amount, reason, status, created_at
            FROM booking_topups
            WHERE booking_id IN (?)
            ORDER BY id ASC
        `, [bookingIds]);

        const imageMap  = {};
        const topupMap  = {};

        allImages.forEach(img => {
            if (!imageMap[img.booking_id]) imageMap[img.booking_id] = [];
            imageMap[img.booking_id].push(img);
        });

        allTopups.forEach(topup => {
            if (!topupMap[topup.booking_id]) topupMap[topup.booking_id] = [];
            topupMap[topup.booking_id].push(topup);
        });

        // ── Attach to each booking ────────────────────────────────────
        const data = bookings.map(booking => ({
            ...booking,
            meter_images: imageMap[booking.id]  || [],
            topups:       topupMap[booking.id]  || []
        }));

        return res.json({
            status:  true,
            message: "Current bookings fetched successfully",
            total:   data.length,
            data
        });

    } catch (error) {
        console.error("getBACurrentBookings error:", error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.getBusinessAssociates = async (req, res) => {
    try {
        const [baRows] = await db.query(`
            SELECT
                ba.id,
                ba.ba_name,
                ba.ba_mobile,
                ba.pincode,
                ba.status,
                ba.created_at,
                COALESCE(bd.status, 'not_uploaded') AS kyc_status,
                bd.created_at AS kyc_created_at,
                bd.updated_at AS kyc_updated_at
            FROM business_associates ba
            LEFT JOIN ba_documents bd ON bd.ba_id = ba.id
            ORDER BY ba.id DESC
        `);

        const [serviceRows] = await db.query(`
            SELECT 
                bs.id          AS bs_id,
                bs.ba_id,
                bs.service_id,
                bs.commission_rate,
                bs.created_at  AS service_assigned_at,
                s.title
            FROM ba_services bs
            JOIN services s ON s.id = bs.service_id
            ORDER BY bs.ba_id, s.title
        `);

        const serviceMap = {};
        serviceRows.forEach(row => {
            if (!serviceMap[row.ba_id]) serviceMap[row.ba_id] = [];
            serviceMap[row.ba_id].push({
                id:              row.bs_id,
                service_id:      row.service_id,
                service_name:    row.title,
                commission_rate: row.commission_rate,
                assigned_at:     row.service_assigned_at
            });
        });

        const data = baRows.map(ba => ({
            ...ba,
            services: serviceMap[ba.id] || []
        }));

        res.json({
            status:  true,
            message: "Business associates fetched successfully",
            total:   data.length,
            data
        });

    } catch (err) {
        res.status(500).json({
            status:  false,
            message: "Something went wrong",
            error:   err.message
        });
    }
};


exports.createBusinessAssociate = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { ba_name, ba_mobile, company_name, services } = req.body;

        if (!ba_name?.trim() || !ba_mobile?.trim()) {
            conn.release();
            return res.status(400).json({ status: false, message: "Name and mobile are required" });
        }

        const [[existing]] = await conn.query(
            `SELECT id FROM business_associates WHERE ba_mobile = ?`, [ba_mobile.trim()]
        );
        if (existing) {
            conn.release();
            return res.status(409).json({ status: false, message: "Mobile number already exists" });
        }

        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO business_associates (ba_name, ba_mobile, company_name, status) VALUES (?, ?, ?, 1)`,
            [ba_name.trim(), ba_mobile.trim(), company_name?.trim() || null]
        );

        const newId = result.insertId;

        if (Array.isArray(services) && services.length > 0) {
            const values = services.map(s => [
                newId,
                s.service_id,
                parseFloat(s.commission_rate) || 0.00
            ]);
            await conn.query(
                `INSERT INTO ba_services (ba_id, service_id, commission_rate) VALUES ?`,
                [values]
            );
        }

        await conn.commit();

        const [[newBA]] = await conn.query(
            `SELECT id, ba_name, ba_mobile, company_name, status, created_at FROM business_associates WHERE id = ?`, [newId]
        );

        const [newServices] = await conn.query(`
            SELECT 
                bs.id, bs.service_id, bs.commission_rate,
                bs.created_at AS assigned_at,
                s.title AS service_name
            FROM ba_services bs
            JOIN services s ON s.id = bs.service_id
            WHERE bs.ba_id = ?
            ORDER BY s.title
        `, [newId]);

        res.status(201).json({
            status: true,
            message: "Business Associate created successfully",
            data: {
                ...newBA,
                services: newServices
            }
        });

    } catch (err) {
        await conn.rollback();
        res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
    } finally {
        conn.release();
    }
};


exports.updateBusinessAssociate = async (req, res) => {
    const conn = await db.getConnection();
    let transactionStarted = false;

    try {
        const id = req.user.id;
        const { ba_name, ba_mobile, company_name } = req.body;
        let { services } = req.body;

        // multipart/form-data sends services as a JSON string — parse it back to an array
        if (typeof services === "string") {
            try { services = JSON.parse(services); }
            catch { services = undefined; }
        }

        // new profile picture (optional) uploaded via multer
        const profile_pic = req.file ? req.file.filename : undefined;

        if (!ba_name?.trim() || !ba_mobile?.trim()) {
            console.warn("⚠️ Validation failed: Name or mobile missing");
            return res.status(400).json({ status: false, message: "Name and mobile are required" });
        }

        // ── BA exists check ───────────────────────────────────
        const [[ba]] = await conn.query(
            `SELECT id FROM business_associates WHERE id = ?`, [id]
        );
    
        if (!ba) {
            console.warn("⚠️ Associate not found for id:", id);
            return res.status(404).json({ status: false, message: "Associate not found" });
        }

        const [[duplicateMobile]] = await conn.query(
            `SELECT id FROM business_associates WHERE ba_mobile = ? AND id != ?`,
            [ba_mobile.trim(), id]
        );
        console.log("🔍 Duplicate Mobile Check:", duplicateMobile ?? "No duplicate");

        if (duplicateMobile) {
            console.warn("⚠️ Mobile already in use:", ba_mobile);
            return res.status(409).json({ status: false, message: "Mobile number already in use" });
        }

        // ── Transaction Start ─────────────────────────────────
        await conn.beginTransaction();
        transactionStarted = true; // 👈 ab safe hai rollback karna
        console.log("🚀 Transaction started");

        // ── Update BA ─────────────────────────────────────────
        const setParts  = [`ba_name = ?`, `ba_mobile = ?`];
        const setValues = [ba_name.trim(), ba_mobile.trim()];

        if (company_name !== undefined) {
            setParts.push(`company_name = ?`);
            setValues.push(company_name?.trim() || null);
        }

        // if a new profile pic was uploaded, remember the old one to delete after commit
        let oldProfilePic = null;
        if (profile_pic !== undefined) {
            const [[current]] = await conn.query(
                `SELECT profile_pic FROM business_associates WHERE id = ?`, [id]
            );
            oldProfilePic = current?.profile_pic || null;
            setParts.push(`profile_pic = ?`);
            setValues.push(profile_pic);
        }

        setValues.push(id);
        const [updateResult] = await conn.query(
            `UPDATE business_associates SET ${setParts.join(", ")} WHERE id = ?`,
            setValues
        );
        console.log("✏️ Update result:", updateResult);

        // ── Services Update ───────────────────────────────────
        if (Array.isArray(services)) {
            console.log("🗑️ Deleting old services for ba_id:", id);
            await conn.query(`DELETE FROM ba_services WHERE ba_id = ?`, [id]);

            if (services.length > 0) {
                const values = services.map(s => [
                    id,
                    s.service_id,
                    parseFloat(s.commission_rate) || 0.00
                ]);
                console.log("➕ Inserting new services:", values);
                await conn.query(
                    `INSERT INTO ba_services (ba_id, service_id, commission_rate) VALUES ?`,
                    [values]
                );
            } else {
                console.log("ℹ️ No services to insert (empty array)");
            }
        } else {
            console.log("ℹ️ Services not provided, skipping update");
        }

        await conn.commit();
        console.log("✅ Transaction committed");

        // remove the previous profile picture file once the DB update is committed
        if (profile_pic !== undefined && oldProfilePic) {
            const oldPath = path.join("uploads/baprofile/", oldProfilePic);
            try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); }
            catch (e) { console.log("Old BA profile pic delete error:", e.message); }
        }

        // ── Fetch Updated Data ────────────────────────────────
        const [[updatedBA]] = await conn.query(
            `SELECT id, ba_name, ba_mobile, company_name, profile_pic, status, created_at FROM business_associates WHERE id = ?`, [id]
        );
        console.log("📦 Updated BA:", updatedBA);

        const [updatedServices] = await conn.query(`
            SELECT 
                bs.id, bs.service_id, bs.commission_rate,
                bs.created_at AS assigned_at,
                s.title AS service_name
            FROM ba_services bs
            JOIN services s ON s.id = bs.service_id
            WHERE bs.ba_id = ?
            ORDER BY s.title
        `, [id]);
        console.log("📦 Updated Services:", updatedServices);

        res.json({
            status: true,
            message: "Business Associate updated successfully",
            data: {
                ...updatedBA,
                services: updatedServices
            }
        });

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        console.error("❌ STACK:", err.stack);
        if (transactionStarted) {
            await conn.rollback();
            console.log("🔄 Transaction rolled back");
        }

        res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
    } finally {
        conn.release();
        console.log("🔌 Connection released");
    }
};

exports.getBusinessAssociateProfile = async (req, res) => {
    try {
        const id = req.user.id;
        
        const [[ba]] = await db.query(
            `SELECT id, ba_name, ba_mobile, company_name, profile_pic, wallet, status, created_at
             FROM business_associates WHERE id = ?`,
            [id]
        );

        if (!ba) {
            return res.status(404).json({ status: false, message: "Business Associate not found" });
        }

        const [services] = await db.query(`
            SELECT
                bs.id, bs.service_id, bs.commission_rate,
                bs.created_at AS assigned_at,
                s.title AS service_name
            FROM ba_services bs
            JOIN services s ON s.id = bs.service_id
            WHERE bs.ba_id = ?
            ORDER BY s.title
        `, [id]);

        return res.json({
            status: true,
            message: "Business Associate profile fetched successfully",
            data: {
                ...ba,
                services
            }
        });

    } catch (err) {
        console.error("getBusinessAssociateProfile error:", err);
        return res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
    }
};

exports.deleteBusinessAssociate = async (req, res) => {
    const conn = await db.getConnection();
    let transactionStarted = false;
    try {
        const { id } = req.params;
        console.log("🗑️ Delete request for id:", id);

        const [[ba]] = await conn.query(
            `SELECT id FROM business_associates WHERE id = ?`, [id]
        );
        console.log("🔍 BA Found:", ba);

        if (!ba) {
            console.warn("⚠️ Associate not found for id:", id);
            return res.status(404).json({ status: false, message: "Associate not found" });
        }

        await conn.beginTransaction();
        transactionStarted = true;
        console.log("🚀 Transaction started");

        const [delServices] = await conn.query(`DELETE FROM ba_services WHERE ba_id = ?`, [id]);
        console.log("🗑️ Services deleted:", delServices.affectedRows);

        const [delBA] = await conn.query(`DELETE FROM business_associates WHERE id = ?`, [id]);
        console.log("🗑️ BA deleted:", delBA.affectedRows);

        await conn.commit();
        console.log("✅ Transaction committed");

        res.json({ status: true, message: "Business Associate deleted successfully" });

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        console.error("❌ STACK:", err.stack);
        if (transactionStarted) {
            await conn.rollback();
            console.log("🔄 Rolled back");
        }
        res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
    } finally {
        conn.release();
        console.log("🔌 Connection released");
    }
};


exports.getDriversByBAAdmin = async (req, res) => {
    try {
        const { ba_id } = req.params;

        const [[ba]] = await db.query(
            `SELECT id, ba_name, ba_mobile FROM business_associates WHERE id = ?`,
            [ba_id]
        );

        if (!ba) {
            return res.status(404).json({ status: false, message: "Business Associate not found" });
        }

        const [drivers] = await db.query(`
            SELECT
                d.id,
                d.full_name,
                d.phone,
                d.pincode,
                d.status,
                d.is_online,
                d.wallet,
                s.id   AS service_id,
                s.title AS service_name,
                ss.id  AS sub_service_id,
                ss.title AS sub_service_name
            FROM drivers d
            LEFT JOIN services s ON s.id = d.service_id
            LEFT JOIN sub_services ss ON ss.id = d.sub_service_id
            WHERE d.ba_id = ?
            ORDER BY d.id DESC
        `, [ba_id]);

        return res.json({
            status: true,
            message: "Drivers fetched successfully",
            ba,
            total_drivers: drivers.length,
            data: drivers
        });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
    }
};

exports.getDriverBookingHistoryByBAAdmin = async (req, res) => {
    try {
        const { ba_id, driver_id } = req.params;
        const { status } = req.query;

        const [[ba]] = await db.query(
            `SELECT id, ba_name FROM business_associates WHERE id = ?`,
            [ba_id]
        );

        if (!ba) {
            return res.status(404).json({ status: false, message: "Business Associate not found" });
        }

        const [[driver]] = await db.query(
            `SELECT id, full_name, phone FROM drivers WHERE id = ? AND ba_id = ?`,
            [driver_id, ba_id]
        );

        if (!driver) {
            return res.status(404).json({ status: false, message: "Driver not found under this Business Associate" });
        }

        const values = [driver_id];
        let statusFilter = "";
        if (status) {
            statusFilter = " AND b.status = ?";
            values.push(status);
        }

        const [bookings] = await db.query(`
            SELECT
                b.id,
                b.booking_id,
                b.booking_type,
                b.pickup_city,
                b.drop_city,
                b.to_city,
                b.pickup_address,
                b.drop_address,
                b.person,
                b.schedule_date,
                b.balance_amount,
                b.status,
                b.user_status,
                b.driver_status,
                b.cancelled_by,
                b.cancel_reason,
                b.created_at,
                u.id     AS user_id,
                u.name   AS user_name,
                u.mobile AS user_mobile,
                s.title  AS service_name,
                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km
            FROM bookings b
            LEFT JOIN users u   ON u.id = b.user_id
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN plans p   ON p.id = b.plan_id
            WHERE b.driver_id = ?
            ${statusFilter}
            ORDER BY b.id DESC
        `, values);

        const baseUrl = `https://${req.get('host')}`;

        for (const booking of bookings) {
            const [images] = await db.query(`
                SELECT id, image_type, image, meter_text, created_at
                FROM booking_meter_images
                WHERE booking_id = ?
                ORDER BY id ASC
            `, [booking.id]);

            const [topups] = await db.query(`
                SELECT id, extra_km, price_per_km, topup_amount, reason, status, topup_otp, otp_verified, created_at
                FROM booking_topups
                WHERE booking_id = ?
                ORDER BY id ASC
            `, [booking.id]);

            booking.meter_images = images.map(img => ({
                ...img,
                image_url: img.image ? `${baseUrl}/uploads/meter_images/${img.image}` : null
            }));
            booking.topups = topups;
        }

        return res.json({
            status: true,
            message: "Driver booking history fetched successfully",
            ba,
            driver,
            total_bookings: bookings.length,
            data: bookings
        });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
    }
};

exports.getBADriversWithBookings = async (req, res) => {
    try {
        const { ba_id } = req.params;
        const { status } = req.query;

        const [[ba]] = await db.query(
            `SELECT id, ba_name, ba_mobile FROM business_associates WHERE id = ?`,
            [ba_id]
        );

        if (!ba) {
            return res.status(404).json({ status: false, message: "Business Associate not found" });
        }

        const [drivers] = await db.query(`
            SELECT
                d.id,
                d.full_name,
                d.phone,
                d.pincode,
                d.status,
                d.is_online,
                d.wallet,
                s.title  AS service_name,
                ss.title AS sub_service_name
            FROM drivers d
            LEFT JOIN services s   ON s.id = d.service_id
            LEFT JOIN sub_services ss ON ss.id = d.sub_service_id
            WHERE d.ba_id = ?
            ORDER BY d.id DESC
        `, [ba_id]);

        const baseUrl = `https://${req.get('host')}`;

        for (const driver of drivers) {
            const values = [driver.id];
            let statusFilter = "";
            if (status) {
                statusFilter = " AND b.status = ?";
                values.push(status);
            }

            const [bookings] = await db.query(`
                SELECT
                    b.id,
                    b.booking_id,
                    b.booking_type,
                    b.pickup_city,
                    b.drop_city,
                    b.pickup_address,
                    b.drop_address,
                    b.person,
                    b.schedule_date,
                    b.balance_amount,
                    b.status,
                    b.user_status,
                    b.driver_status,
                    b.cancelled_by,
                    b.cancel_reason,
                    b.created_at,
                    u.name   AS user_name,
                    u.mobile AS user_mobile,
                    s.title  AS service_name,
                    p.plan_name,
                    p.plan_price
                FROM bookings b
                LEFT JOIN users u    ON u.id = b.user_id
                LEFT JOIN services s ON s.id = b.service_id
                LEFT JOIN plans p    ON p.id = b.plan_id
                WHERE b.driver_id = ?
                ${statusFilter}
                ORDER BY b.id DESC
            `, values);

            for (const booking of bookings) {
                const [images] = await db.query(`
                    SELECT id, image_type, image, meter_text, created_at
                    FROM booking_meter_images
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [booking.id]);

                booking.meter_images = images.map(img => ({
                    ...img,
                    image_url: img.image ? `${baseUrl}/uploads/meter_images/${img.image}` : null
                }));
            }

            driver.total_bookings = bookings.length;
            driver.bookings = bookings;
        }

        return res.json({
            status: true,
            message: "BA drivers with booking history fetched successfully",
            ba,
            total_drivers: drivers.length,
            data: drivers
        });

    } catch (err) {
        return res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
    }
};

exports.changeBusinessAssociateStatus = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (status === undefined || status === null || ![0, 1].includes(Number(status))) {
            conn.release();
            return res.status(400).json({ status: false, message: "Status must be 0 or 1" });
        }

        const [[ba]] = await conn.query(
            `SELECT id, status FROM business_associates WHERE id = ?`, [id]
        );
        if (!ba) {
            conn.release();
            return res.status(404).json({ status: false, message: "Associate not found" });
        }

        await conn.query(
            `UPDATE business_associates SET status = ? WHERE id = ?`,
            [Number(status), id]
        );

        res.json({
            status: true,
            message: `Business Associate ${Number(status) === 1 ? "activated" : "deactivated"} successfully`,
            data: { id: Number(id), status: Number(status) }
        });

    } catch (err) {
        res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
    } finally {
        conn.release();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  BUSINESS ASSOCIATE  —  KYC  (one row per BA in ba_documents)
//  status ENUM: 'pending' | 'approved' | 'rejected'
// ═══════════════════════════════════════════════════════════════════════════════

const BA_KYC_FILE_FIELDS = ["aadhar_front_image", "aadhar_back_image", "pan_card_image"];

// POST /ba/upload-kyc  — BA uploads / re-uploads its KYC (multipart: image files + gst_number)
exports.uploadBAKycDocument = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { gst_number, aadhar_number, pan_number } = req.body;

        // collect uploaded files by their fieldname
        const fileMap = {};
        if (req.files && req.files.length > 0) {
            req.files.forEach((f) => { fileMap[f.fieldname] = f.filename; });
        }
        const aadharFront = fileMap.aadhar_front_image || null;
        const aadharBack  = fileMap.aadhar_back_image  || null;
        const panCard     = fileMap.pan_card_image     || null;

        const hasAadharNo = aadhar_number !== undefined && aadhar_number !== "";
        const hasPanNo    = pan_number !== undefined && pan_number !== "";
        if (!aadharFront && !aadharBack && !panCard &&
            (gst_number === undefined || gst_number === "") && !hasAadharNo && !hasPanNo) {
            return res.status(400).json({ status: false, message: "Provide at least one document, gst_number, aadhar_number or pan_number" });
        }

        const [[existing]] = await db.query(`SELECT * FROM ba_documents WHERE ba_id = ?`, [ba_id]);
        if (existing) {
            const replaced = {
                aadhar_front_image: aadharFront ? existing.aadhar_front_image : null,
                aadhar_back_image:  aadharBack  ? existing.aadhar_back_image  : null,
                pan_card_image:     panCard     ? existing.pan_card_image     : null
            };
            BA_KYC_FILE_FIELDS.forEach((field) => {
                const oldFile = replaced[field];
                if (oldFile) {
                    const filePath = path.join("uploads/documents/", oldFile);
                    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
                    catch (err) { console.log("BA KYC file delete error:", err.message); }
                }
            });
        }

        // upsert the single KYC row; only provided fields overwrite, status resets to pending
        await db.query(`
            INSERT INTO ba_documents
                (ba_id, aadhar_front_image, aadhar_back_image, pan_card_image, gst_number, aadhar_number, pan_number, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            ON DUPLICATE KEY UPDATE
                aadhar_front_image = COALESCE(VALUES(aadhar_front_image), aadhar_front_image),
                aadhar_back_image  = COALESCE(VALUES(aadhar_back_image), aadhar_back_image),
                pan_card_image     = COALESCE(VALUES(pan_card_image), pan_card_image),
                gst_number         = COALESCE(VALUES(gst_number), gst_number),
                aadhar_number      = COALESCE(VALUES(aadhar_number), aadhar_number),
                pan_number         = COALESCE(VALUES(pan_number), pan_number),
                status             = 'pending',
                updated_at         = CURRENT_TIMESTAMP
        `, [ba_id, aadharFront, aadharBack, panCard, gst_number || null, aadhar_number || null, pan_number || null]);

        const [[doc]] = await db.query(`SELECT * FROM ba_documents WHERE ba_id = ?`, [ba_id]);
        await createAdminNotification({
          type: 'ba_kyc_pending',
          source_table: 'ba_documents',
          source_id: doc?.id || null,
          message: `BA KYC uploaded for ${ba_id}`,
          sub: `KYC pending verification`,
          payload: { ba_id, status: 'pending' }
        });
        return res.json({ status: true, message: "KYC uploaded. Pending verification.", data: doc });
    } catch (error) {
        console.error("uploadBAKycDocument error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /ba/kyc  — BA views its own KYC + status
exports.getBADocuments = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const [[doc]] = await db.query(
            `SELECT id, ba_id, aadhar_front_image, aadhar_back_image, pan_card_image,
                    gst_number, aadhar_number, pan_number, status, remark, verified_at, created_at, updated_at
             FROM ba_documents WHERE ba_id = ?`,
            [ba_id]
        );
        return res.json({ status: true, message: "KYC fetched", data: doc || null });
    } catch (error) {
        console.error("getBADocuments error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /admin/business-associates/:id/documents  — admin views a BA's KYC
exports.getBADocumentsByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const [[doc]] = await db.query(
            `SELECT id, ba_id, aadhar_front_image, aadhar_back_image, pan_card_image,
                    gst_number, aadhar_number, pan_number, status, remark, verified_by, verified_at, created_at, updated_at
             FROM ba_documents WHERE ba_id = ?`,
            [id]
        );
        return res.json({ status: true, message: "KYC fetched", data: doc || null });
    } catch (error) {
        console.error("getBADocumentsByAdmin error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// PATCH /admin/business-associates/:id/kyc/verify  — admin approves / rejects a BA's KYC
exports.verifyBADocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, verified_by, remark } = req.body || {};

        const st = String(status || "").toLowerCase();
        if (!["pending", "approved", "rejected"].includes(st)) {
            return res.status(400).json({ status: false, message: "status required: pending, approved or rejected" });
        }
        const adminId = parseInt(verified_by);
        if (!verified_by || isNaN(adminId)) {
            return res.status(400).json({ status: false, message: "verified_by must be a valid admin ID (integer)" });
        }

        const [[doc]] = await db.query(`SELECT id FROM ba_documents WHERE ba_id = ?`, [id]);
        if (!doc) return res.status(404).json({ status: false, message: "KYC not found for this associate" });

        await db.query(`
            UPDATE ba_documents
            SET status = ?, verified_by = ?, verified_at = NOW(), remark = ?
            WHERE ba_id = ?
        `, [st, adminId, remark || null, id]);

        await createAdminNotification({
          type: st === 'rejected' ? 'ba_kyc_rejected' : 'ba_kyc_approved',
          source_table: 'ba_documents',
          source_id: doc.id,
          message: `BA KYC ${st} for BA ${id}`,
          sub: `KYC ${st}`,
          payload: { ba_id: id, status: st, verified_by: adminId }
        });

        return res.json({ status: true, message: `KYC ${st} successfully` });
    } catch (error) {
        console.error("verifyBADocument error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};