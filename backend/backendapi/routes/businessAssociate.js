const db = require("../config/db");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const SECRET = process.env.JWT_SECRET;


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
        const { ba_mobile, otp, ba_name, services } = req.body;

        // ✅ BASIC VALIDATION
        if (!ba_mobile) {
            return res.status(400).json({ message: "Mobile number is required" });
        }

        if (!otp) {
            return res.status(400).json({ message: "OTP is required" });
        }

        // ✅ OTP VERIFY
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

        // ✅ CHECK EXISTING BA
        const [exist] = await connection.query(
            "SELECT * FROM business_associates WHERE ba_mobile = ?",
            [ba_mobile]
        );

        let ba_id;
        let ba_data;

        // 👉 SERVICES VALIDATION (before transaction)
        let uniqueServices = [];

        if (services && services.length > 0) {

            uniqueServices = [...new Map(
                services.map(s => [parseInt(s.service_id), s])
            ).values()];

            const serviceIds = uniqueServices.map(s => parseInt(s.service_id));

            // 🔥 FIXED IN QUERY
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

        // ✅ START TRANSACTION
        await connection.beginTransaction();

        // 👉 NEW BA REGISTER
        if (exist.length === 0) {

            if (!ba_name) {
                return res.status(400).json({ message: "Name is required" });
            }

            if (!services || services.length === 0) {
                return res.status(400).json({ message: "At least one service is required" });
            }

            const [result] = await connection.query(
                "INSERT INTO business_associates (ba_name, ba_mobile) VALUES (?, ?)",
                [ba_name, ba_mobile]
            );

            ba_id = result.insertId;

            // 👉 INSERT SERVICES
            for (let s of uniqueServices) {

                const serviceId = parseInt(s.service_id);

                await connection.query(
                    "INSERT INTO ba_services (ba_id, service_id, commission_rate) VALUES (?, ?, ?)",
                    [ba_id, serviceId, s.commission_rate || 0]
                );
            }

            ba_data = { id: ba_id, ba_name, ba_mobile };

        } else {
            // 👉 EXISTING BA LOGIN
            ba_data = exist[0];
            ba_id = ba_data.id;

            // 👉 SERVICES UPDATE (OPTIONAL BUT IMPORTANT)
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
        const { ba_mobile, otp } = req.body;

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

exports.assignDriverToBooking = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { booking_id, driver_id } = req.body;

        if (!booking_id || !driver_id) {
            return res.status(400).json({
                status: false,
                message: "booking_id aur driver_id required hain"
            });
        }

        const [ba] = await db.query(
            "SELECT id FROM business_associates WHERE id = ?",
            [ba_id]
        );
        if (!ba.length) {
            return res.status(404).json({ status: false, message: "Business Associate not found" });
        }

        const [booking] = await db.query(
            `SELECT id, status, driver_id, ba_id FROM bookings WHERE id = ?`,
            [booking_id]
        );
        if (!booking.length) {
            return res.status(404).json({ status: false, message: "Booking not found" });
        }
        if (booking[0].ba_id !== ba_id) {
            return res.status(403).json({ status: false, message: "Ye booking aapki nahi hai" });
        }
        if (booking[0].status !== 'pending') {
            return res.status(400).json({ 
                status: false, 
                message: `Booking already ${booking[0].status} hai, assign nahi ho sakti` 
            });
        }
        if (booking[0].driver_id) {
            return res.status(400).json({ status: false, message: "Driver already assigned hai" });
        }

        const [driver] = await db.query(
            `SELECT id, full_name, phone, status, is_online FROM drivers WHERE id = ? AND ba_id = ?`,
            [driver_id, ba_id]
        );
        if (!driver.length) {
            return res.status(404).json({ status: false, message: "Ye driver aapka nahi hai" });
        }

        if (driver[0].is_online !== 1) {
            return res.status(400).json({ status: false, message: "Driver offline hai" });
        }
        if (driver[0].status !== 1) {
            return res.status(400).json({ status: false, message: "Driver active nahi hai" });
        }

        const [activeBooking] = await db.query(
            `SELECT id FROM bookings WHERE driver_id = ? AND status IN ('accepted', 'arrived', 'started')`,
            [driver_id]
        );
        if (activeBooking.length) {
            return res.status(400).json({ 
                status: false, 
                message: "Driver abhi kisi aur ride par hai" 
            });
        }

        await db.query(
            `UPDATE bookings SET driver_id = ?, status = 'accepted', updated_at = NOW() WHERE id = ?`,
            [driver_id, booking_id]
        );

        const [updated] = await db.query(
            `SELECT 
                b.*,
                d.full_name AS driver_name,
                d.phone AS driver_phone
            FROM bookings b
            LEFT JOIN drivers d ON d.id = b.driver_id
            WHERE b.id = ?`,
            [booking_id]
        );

        return res.json({
            status: true,
            message: "Driver successfully assign ho gaya",
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

exports.getBABookings = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { status } = req.query;

        let query = `
            SELECT 
                b.id,
                b.booking_id,
                b.status,
                b.booking_type,
                b.pickup_city,
                b.drop_city,
                b.person,
                b.created_at,
                b.driver_id,
                u.name AS user_name,
                u.mobile AS user_mobile,
                d.full_name AS driver_name,
                d.phone AS driver_phone,
                s.title AS service_name
            FROM bookings b
            LEFT JOIN users u ON u.id = b.user_id
            LEFT JOIN drivers d ON d.id = b.driver_id
            LEFT JOIN services s ON s.id = b.service_id
            INNER JOIN ba_services bs ON bs.service_id = b.service_id AND bs.ba_id = ?
            WHERE b.status = 'SEARCHING'
        `;
        const params = [ba_id];

        if (status) {
            query = query.replace("WHERE b.status = 'SEARCHING'", "WHERE b.status = ?");
            params.push(status);
        }

        query += ` ORDER BY b.id DESC`;

        const [bookings] = await db.query(query, params);

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

exports.baacceptBooking = async (req, res) => {
    try {
        const ba_id = req.user.id;
        const { booking_id } = req.body;

        if (!booking_id) {
            return res.status(400).json({ status: false, message: "booking_id required hai" });
        }

        const [booking] = await db.query(
            `SELECT b.id, b.status FROM bookings b
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

        if (!booking_id || !driver_id) {
            return res.status(400).json({ status: false, message: "booking_id and driver_id are required" });
        }

        const [booking] = await db.query(
            `SELECT id, status, driver_id FROM bookings WHERE booking_id = ? AND bussinessassociate_id = ?`,
            [booking_id, ba_id]
        );

        if (!booking.length) {
            return res.status(404).json({ status: false, message: "Please accept the booking first" });
        }

        if (booking[0].status !== 'ACCEPTED') {
            return res.status(400).json({ status: false, message: `Booking is already ${booking[0].status}, cannot assign driver` });
        }

        if (booking[0].driver_id) {
            return res.status(400).json({ status: false, message: "Driver is already assigned" });
        }

        const [driver] = await db.query(
            `SELECT id, status, is_online FROM drivers WHERE id = ? AND ba_id = ?`,
            [driver_id, ba_id]
        );

        if (!driver.length) {
            return res.status(404).json({ status: false, message: "This driver does not belong to you" });
        }

        if (!driver[0].is_online) {
            return res.status(400).json({ status: false, message: "Driver is offline" });
        }

        if (driver[0].status.trim() !== "approved") {
            return res.status(400).json({ status: false, message: "Driver is not active" });
        }
        
        const [activeRide] = await db.query(
            `SELECT id FROM bookings WHERE driver_id = ? AND status IN ('ASSIGN', 'ARRIVED', 'STARTED')`,
            [driver_id]
        );

        if (activeRide.length) {
            return res.status(400).json({ status: false, message: "Driver is currently on another ride" });
        }

        await db.query(
            `UPDATE bookings SET driver_id = ?, status = 'ASSIGN', updated_at = NOW() WHERE booking_id = ?`,
            [driver_id, booking_id]
        );

        const [updated] = await db.query(
            `SELECT b.*, d.full_name AS driver_name, d.phone AS driver_phone
             FROM bookings b
             LEFT JOIN drivers d ON d.id = b.driver_id
             WHERE b.booking_id = ?`,
            [booking_id]
        );

        return res.json({
            status: true,
            message: "Driver assigned successfully, booking is now visible to the driver",
            data: updated[0]
        });

    } catch (err) {
        console.error("assignDriverToBooking Error:", err);
        return res.status(500).json({ status: false, message: "Something went wrong", error: err.message });
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
                ba.created_at
            FROM business_associates ba
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
        const { ba_name, ba_mobile, services } = req.body;

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
            `INSERT INTO business_associates (ba_name, ba_mobile, status) VALUES (?, ?, 1)`,
            [ba_name.trim(), ba_mobile.trim()]
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
            `SELECT id, ba_name, ba_mobile, status, created_at FROM business_associates WHERE id = ?`, [newId]
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
        const { id } = req.params;
        const { ba_name, ba_mobile, services } = req.body;

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
        const [updateResult] = await conn.query(
            `UPDATE business_associates SET ba_name = ?, ba_mobile = ? WHERE id = ?`,
            [ba_name.trim(), ba_mobile.trim(), id]
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

        // ── Fetch Updated Data ────────────────────────────────
        const [[updatedBA]] = await conn.query(
            `SELECT id, ba_name, ba_mobile, status, created_at FROM business_associates WHERE id = ?`, [id]
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