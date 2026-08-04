const db = require("../config/db");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const path = require("path");

require("dotenv").config();
const SECRET = process.env.JWT_SECRET;
const { notifyUser } = require("../services/notification");
const { createAdminNotification } = require('../services/adminNotification');

const computeDriverAmount = (planCaptainCommission, topups = []) => {
    const planPart  = parseFloat(planCaptainCommission || 0);
    const topupPart = topups
        .filter(t => t.status === 'PAID')
        .reduce((sum, t) => sum + parseFloat(t.captain_commission || 0), 0);
    return Math.round((planPart + topupPart) * 100) / 100;
};

const computeInCityDriverAmount = (actualFare, accessFee, platformFee) => {
    const fare = parseFloat(actualFare || 0);
    if (!(fare > 0)) return null;
    const companyCut = parseFloat(accessFee || 0) + parseFloat(platformFee || 0);
    return Math.round(Math.max(0, fare - companyCut) * 100) / 100;
};

// Sum of PAID topup amounts that rolls into total_fare.
// The captain's captain_commission is still counted separately in driver_amount;
// total_fare gets the full topup_amount of each paid topup.
const computeTopupFareShare = (topups = []) => {
    const share = topups
        .filter(t => t.status === 'PAID')
        .reduce((sum, t) => sum + parseFloat(t.topup_amount || 0), 0);
    return Math.round(share * 100) / 100;
};

exports.sendDriverOTP = async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({ status: false, message: "Phone required" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);
        const expires_at = new Date(Date.now() + 5 * 60 * 1000);

        await db.query(
            "INSERT INTO driver_otps (phone, otp, expires_at) VALUES (?, ?, ?)",
            [mobile, otp, expires_at]
        );

        console.log("Driver OTP:", otp);

        res.json({
            status: true,
            message: "OTP sent",
            otpnumber: otp
        });

    } catch (err) {
        res.status(500).json({ status: false, error: err.message });
    }
};

exports.verifyDriverOTP = async (req, res) => {
    try {
        let { mobile, otp, full_name, service_id, sub_service_id, pincode, fcm_token } = req.body;
        if (!mobile || !otp) {
            return res.status(400).json({
                status: false,
                message: "Mobile and OTP are required"
            });
        }

        otp = parseInt(otp);
        const [rows] = await db.query(
            `SELECT * FROM driver_otps 
             WHERE phone = ? 
             ORDER BY id DESC LIMIT 1`,
            [mobile]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                status: false,
                message: "OTP not found"
            });
        }

        const record = rows[0];
        if (record.otp != otp) {
            return res.status(400).json({
                status: false,
                message: "Invalid OTP"
            });
        }

        if (new Date() > new Date(record.expires_at)) {
            return res.status(400).json({
                status: false,
                message: "OTP expired"
            });
        }

        const [exist] = await db.query(
            "SELECT * FROM drivers WHERE phone = ?",
            [mobile]
        );

        let driver;

        if (exist.length === 0) {
            if (!full_name || !service_id) {
                return res.status(400).json({
                    status: false,
                    message: "Name and service required for new driver"
                });
            }

            const [result] = await db.query(
                `INSERT INTO drivers
                (full_name, phone, service_id, sub_service_id, pincode, status, is_online,wallet, fcm_token)
                VALUES (?, ?, ?, ?, ?, 'pending',0,100, ?)`,
                [
                    full_name,
                    mobile,
                    service_id,
                    sub_service_id ?? null,
                    pincode ?? null,
                    fcm_token ?? null
                ]
            );

            driver = {
                id: result.insertId,
                full_name,
                phone: mobile,
                service_id,
                sub_service_id,
                pincode,
                status: "pending"
            };

            await createAdminNotification({
              type: 'new_captain',
              source_table: 'drivers',
              source_id: result.insertId,
              message: `New captain registered: ${full_name}`,
              sub: `Driver registration pending approval`,
              payload: { driver_id: result.insertId, phone: mobile }
            });

        } else {
            driver = exist[0];

            // OTP verified — update fcm_token for the existing driver
            if (fcm_token) {
                await db.query(
                    "UPDATE drivers SET fcm_token = ? WHERE id = ?",
                    [fcm_token, driver.id]
                );
            }
        }

        const token = jwt.sign(
            { id: driver.id, phone: driver.phone, role: "driver" },
            SECRET,
            { expiresIn: "7d" }
        );

        await db.query(
            "DELETE FROM driver_otps WHERE phone = ? AND otp = ?",
            [mobile, otp]
        );


        res.json({
            status: true,
            message: "Driver login/register successful",
            token,
            driver
        });

    } catch (err) {
        console.error("OTP VERIFY ERROR:", err);

        res.status(500).json({
            status: false,
            message: "Something went wrong",
            error: err.message
        });
    }
};

exports.verifyDriverLoginOTP = async (req, res) => {
    try {
        const { mobile, otp, fcm_token } = req.body;
        if (!mobile || !otp) {
            return res.status(400).json({
                status: false,
                message: "Mobile and OTP are required"
            });
        }

        const [rows] = await db.query(
            `SELECT * FROM driver_otps
             WHERE phone = ? AND otp = ?
             ORDER BY id DESC LIMIT 1`,
            [mobile, otp]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                status: false,
                message: "Invalid OTP"
            });
        }

        const record = rows[0];

        if (new Date() > new Date(record.expires_at)) {
            return res.status(400).json({
                status: false,
                message: "OTP expired"
            });
        }

        const [drivers] = await db.query(
            "SELECT * FROM drivers WHERE phone = ?",
            [mobile]
        );

        if (drivers.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Driver not registered"
            });
        }

        const driver = drivers[0];

        // OTP verified — update fcm_token for the driver
        if (fcm_token) {
            await db.query(
                "UPDATE drivers SET fcm_token = ? WHERE id = ?",
                [fcm_token, driver.id]
            );
        }

        const token = jwt.sign(
            { id: driver.id, phone: driver.phone, role: "driver" },
            SECRET,
            { expiresIn: "7d" }
        );

        await db.query(
            "DELETE FROM driver_otps WHERE phone = ?",
            [mobile]
        );

        res.json({
            status: true,
            message: "Driver login successful",
            token,
            driver
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: false,
            message: "Something went wrong",
            error: err.message
        });
    }
};

exports.uploadDriverKycDocument = async (req, res) => {
  try {
    let { driver_id, documents } = req.body;

    if (!driver_id) {
      return res.status(400).json({
        status: false,
        message: "driver_id is required"
      });
    }

    if (!documents) {
      return res.status(400).json({
        status: false,
        message: "documents is required"
      });
    }

    try {
      documents = typeof documents === "string"
        ? JSON.parse(documents)
        : documents;
    } catch (err) {
      return res.status(400).json({
        status: false,
        message: "Invalid documents JSON format"
      });
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        status: false,
        message: "documents must be a non-empty array"
      });
    }

    let fileMap = {};

    if (req.files && req.files.length > 0) {
      req.files.forEach((file, index) => {
        const match = file.fieldname.match(/\[(\d+)\]/);
        if (match) {
          fileMap[parseInt(match[1])] = file;
        } else {
          fileMap[index] = file;
        }
      });
    }

    const [existingDocs] = await db.query(
      `SELECT document_type, document_file 
       FROM driver_documents 
       WHERE driver_id = ?`,
      [driver_id]
    );

    const existingMap = {};
    existingDocs.forEach(doc => {
      existingMap[doc.document_type] = doc.document_file;
    });

    let finalDocs = [];
    documents.forEach((doc, index) => {
      const newFile = fileMap[index] || null;
      const oldFile = existingMap[doc.document_type] || null;

      if (newFile && oldFile) {
        const filePath = path.join("uploads/documents/", oldFile);

        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.log("File delete error:", err.message);
        }
      }

      finalDocs.push({
        driver_id,
        document_type: doc.document_type || null,
        document_number: doc.document_number || null,
        document_file: newFile ? newFile.filename : oldFile, 
        expiry_date: doc.expiry_date || null,
        remark: doc.remark || null
      });
    });

    if (finalDocs.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No valid data to insert/update"
      });
    }

    const values = finalDocs.map(doc => [
      doc.driver_id,
      doc.document_type,
      doc.document_number,
      doc.document_file,
      doc.expiry_date,
      doc.remark
    ]);

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?)").join(",");

    const sql = `
      INSERT INTO driver_documents 
      (driver_id, document_type, document_number, document_file, expiry_date, remark) 
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        document_number = VALUES(document_number),
        document_file = VALUES(document_file),
        expiry_date = VALUES(expiry_date),
        remark = VALUES(remark),
        updated_at = CURRENT_TIMESTAMP
    `;

    await db.query(sql, values.flat());

    const [[driver]] = await db.query(`SELECT full_name FROM drivers WHERE id = ?`, [driver_id]);
    const driverName = driver?.full_name ? String(driver.full_name) : `ID ${driver_id}`;

    await createAdminNotification({
      type: 'driver_kyc_pending',
      source_table: 'driver_documents',
      source_id: driver_id,
      message: `Driver KYC uploaded for ${driverName}`,
      sub: `KYC pending review`,
      payload: { driver_id, driver_name: driverName, status: 'pending' }
    });

    return res.json({
      status: true,
      message: "KYC uploaded/updated successfully",
      total: finalDocs.length,
      data: finalDocs
    });

  } catch (error) {
    console.error("ERROR:", error);

    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message
    });
  }
};

exports.addDriverProfile = async (req, res) => {
  try {
        const {
            driver_id,
            vehicle_type,
            vehicle_make,
            vehicle_model,
            vehicle_year,
            vehicle_color,
            vehicle_number,
            seat_capacity,
            fuel_type
        } = req.body;

        const driver_profile = req.file ? req.file.filename : null;

        // if (!driver_id || !vehicle_type || !vehicle_number) {
        //     return res.status(400).json({
        //         status: false,
        //         message: "driver_id, vehicle_type and vehicle_number are required"
        //     });
        // }
        const [existing] = await db.query(
            `SELECT id, driver_profile FROM driver_profiles WHERE driver_id = ?`,
            [driver_id]
        );

        if (existing.length > 0) {
            await db.query(
                `UPDATE driver_profiles SET
                    driver_profile = ?,
                    vehicle_type = ?,
                    vehicle_make = ?,
                    vehicle_model = ?,
                    vehicle_year = ?,
                    vehicle_color = ?,
                    vehicle_number = ?,
                    seat_capacity = ?,
                    fuel_type = ?
                 WHERE driver_id = ?`,
                [
                    driver_profile || existing[0].driver_profile,
                   vehicle_type || null,
                    vehicle_make || null,
                    vehicle_model || null,
                    vehicle_year || null,
                    vehicle_color || null,
                    vehicle_number,
                    seat_capacity || 4,
                    fuel_type || null,
                    driver_id
                ]
            );

            return res.json({
                status: true,
                message: "Driver profile updated successfully",
                image: driver_profile || existing[0].driver_profile
            });

        } else {
            await db.query(
                `INSERT INTO driver_profiles 
                (driver_id, driver_profile, vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_number, seat_capacity, fuel_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    driver_id,
                    driver_profile,
                    vehicle_type,
                    vehicle_make || null,
                    vehicle_model || null,
                    vehicle_year || null,
                    vehicle_color || null,
                    vehicle_number,
                    seat_capacity || 4,
                    fuel_type || null
                ]
            );

            return res.json({
                status: true,
                message: "Driver profile added successfully",
                image: driver_profile
            });
        }

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

exports.getDriverProfile = async (req, res) => {
 try {
        const driver_id = req.user.id;

        const [rows] = await db.query(
            `SELECT * FROM driver_profiles WHERE driver_id = ?`,
            [driver_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Driver profile not found"
            });
        }

        const baseUrl = `https://${req.get('host')}`;

        const data = rows.map(item => ({
            ...item,
            driver_profile_url: item.driver_profile ? `${baseUrl}/uploads/driver_profiles/${item.driver_profile}`
                : null
        }));

        return res.json({
            status: true,
            message: "Driver profile fetched successfully",
            data: data
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

exports.getDriverDocuments = async (req, res) => {
  try {
        const driver_id = req.user.id; 

        const [documents] = await db.query(
            `SELECT * FROM driver_documents WHERE driver_id = ?`,
            [driver_id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                status: false,
                message: "No documents found"
            });
        }

        const baseUrl = `https://${req.get('host')}`;

        const data = documents.map(doc => ({
            ...doc,
            document_file_url: doc.document_file
                ? `${baseUrl}/uploads/documents/${doc.document_file}`
                : null
        }));

        return res.json({
            status: true,
            message: "Driver documents fetched successfully",
            data: data
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

exports.updateDriverLocation = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { lat, lng } = req.body;

        if (!lat || !lng) {
            return res.status(400).json({
                status: false,
                message: "lat and lng are required"
            });
        }

        await db.query(
            `UPDATE drivers SET current_lat = ?, current_lng = ?, location_updated_at = NOW() WHERE id = ?`,
            [lat, lng, driver_id]
        );

        return res.json({
            status: true,
            message: "Location updated successfully",
            data: { lat, lng }
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

exports.getDriverLocation = async (req, res) => {
    try {
        const driver_id = req.user.id;

        const [[driver]] = await db.query(
            `SELECT id, full_name, current_lat, current_lng, location_updated_at FROM drivers WHERE id = ?`,
            [driver_id]
        );

        if (!driver) {
            return res.status(404).json({ status: false, message: "Driver not found" });
        }

        return res.json({
            status: true,
            message: "Driver location fetched successfully",
            data: {
                driver_id: driver.id,
                full_name: driver.full_name,
                current_lat: driver.current_lat,
                current_lng: driver.current_lng,
                location_updated_at: driver.location_updated_at
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

exports.updateOnlineStatus = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { is_online } = req.body;
        if (is_online === undefined || ![0, 1].includes(Number(is_online))) {
            return res.status(400).json({
                status: false,
                message: "is_online must be 0 or 1"
            });
        }

        await db.query(
            `UPDATE drivers SET is_online = ? WHERE id = ?`,
            [is_online, driver_id]
        );

        return res.json({
            status: true,
            message: `Driver is now ${is_online == 1 ? 'Online' : 'Offline'}`
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
exports.getOnlineStatus = async (req, res) => {
    try {
        const driver_id = req.user.id;

        const [rows] = await db.query(
            `SELECT id, full_name, is_online FROM drivers WHERE id = ?`,
            [driver_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Driver not found"
            });
        }

        return res.json({
            status: true,
            message: "Driver status fetched",
            data: rows[0]
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

exports.getBookingRequests = async (req, res) => {
    try {
        const driver_id = req.user.id;

        const [[driver]] = await db.query(
            `SELECT id, service_id, sub_service_id, wallet, current_lat, current_lng, status FROM drivers WHERE id = ?`,
            [driver_id]
        );

        if (!driver) {
            return res.status(404).json({ status: false, message: "Driver not found" });
        }

        const isInCity = parseInt(driver.service_id) === 1;
        let searchArea = null;

        if (driver.sub_service_id) {
            const [[subService]] = await db.query(
                `SELECT search_area, driver_min_wallet_balance FROM sub_services WHERE id = ?`,
                [driver.sub_service_id]
            );

            if (subService && parseFloat(driver.wallet) < parseFloat(subService.driver_min_wallet_balance || 0)) {
                return res.status(403).json({
                    status: false,
                    message: `Insufficient wallet balance. Minimum required: ₹${subService.driver_min_wallet_balance}. Please recharge.`,
                    wallet: driver.wallet,
                    required: subService.driver_min_wallet_balance
                });
            }

            searchArea = subService ? parseFloat(subService.search_area) : null;
        }

        // TODO: Haversine distance filter — enable when ready
        // if (searchArea > 0 && driver.current_lat && driver.current_lng) {
        //     distanceClause = `
        //         AND (6371 * acos(
        //             LEAST(1.0,
        //                 cos(radians(?)) * cos(radians(b.start_lat)) * cos(radians(b.start_lng) - radians(?)) +
        //                 sin(radians(?)) * sin(radians(b.start_lat))
        //             )
        //         )) <= ?
        //     `;
        //     queryParams.push(driver.current_lat, driver.current_lng, driver.current_lat, searchArea);
        // }

        let distanceClause = '';
        const queryParams = [driver.service_id, driver.sub_service_id, driver_id];

        const [rows] = await db.query(`
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
                b.start_lat AS pickup_lat,
                b.start_lng AS pickup_lng,
                b.distance,
                b.total_fare,
                b.token_amount,
                b.token_paid,
                b.person,
                b.schedule_date,
                b.status,
                b.created_at,
                s.title  AS service_name,
                ss.title AS sub_service_name,

                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km,
                p.plan_captain_commission,
                p.plan_company_commission,
                p.platform_fee,
                p.access_fee,
                ss.fixed_charge,
                ss.fixed_charge_km,
                ss.charge_after_fixed_per_km,
                ss.access_fee      AS sub_access_fee,
                ss.access_fee_type AS sub_access_fee_type,
                ss.platform_fee    AS sub_platform_fee
            FROM bookings b
            LEFT JOIN services s      ON s.id  = b.service_id
            LEFT JOIN sub_services ss ON ss.id = b.sub_service_id
            LEFT JOIN plans p         ON p.id  = b.plan_id
            WHERE b.status = 'SEARCHING'
              AND b.service_id = ?
              AND b.sub_service_id = ?
              -- hide bookings whose allocated time (sub_service.booking_destroy_min) has expired
              AND (ss.booking_destroy_min IS NULL OR ss.booking_destroy_min <= 0
                   OR b.created_at + INTERVAL ss.booking_destroy_min MINUTE > NOW())
              AND b.id NOT IN (
                  SELECT booking_id FROM booking_rejections WHERE driver_id = ?
              )
              ${distanceClause}
            ORDER BY b.id DESC
        `, queryParams);

        const data = await Promise.all(rows.map(async (b) => {
            const row = { ...b, is_incity: isInCity };
            if (isInCity) {
                row.plan_name               = undefined;
                row.plan_price              = undefined;
                row.plan_hour               = undefined;
                row.plan_km                 = undefined;
                row.plan_captain_commission = undefined;
                row.plan_company_commission = undefined;
                row.meter_images            = undefined;
                row.topups                  = undefined;
                row.driver_amount           = null;
                row.fare_note = parseFloat(b.total_fare) > 0
                    ? `Estimated fare: ₹${b.total_fare} (${b.distance} km)`
                    : "Fare will be calculated on meter at trip end";

                // In-city: fees come from the sub_service
                row.access_fee      = parseFloat(row.sub_access_fee || 0);
                row.access_fee_type = row.sub_access_fee_type || 'flat';
                row.platform_fee    = parseFloat(row.sub_platform_fee || 0);
            } else {
                const [images] = await db.query(`
                    SELECT id, image_type,
                           CONCAT('uploads/meter_images/', image) AS image,
                           created_at
                    FROM booking_meter_images
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [b.id]);

                const [topups] = await db.query(`
                    SELECT id, extra_km, price_per_km, topup_amount,
                           captain_commission, company_commission,
                           reason, status, created_at
                    FROM booking_topups
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [b.id]);

                row.meter_images  = images;
                row.topups        = topups;
                row.driver_amount = computeDriverAmount(b.plan_captain_commission, topups);
                // Other services: fees come from the plan
                row.access_fee    = row.access_fee != null ? parseFloat(row.access_fee) : null;
                row.platform_fee  = row.platform_fee != null ? parseFloat(row.platform_fee) : null;
            }

            // strip raw sub_service helper columns from the response
            row.fixed_charge              = undefined;
            row.fixed_charge_km           = undefined;
            row.charge_after_fixed_per_km = undefined;
            row.sub_access_fee            = undefined;
            row.sub_access_fee_type       = undefined;
            row.sub_platform_fee          = undefined;
            return row;
        }));

        return res.json({
            status: true,
            message: "Incoming booking requests",
            data
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

exports.getCurrentBooking = async (req, res) => {
    try {
        const driver_id = req.user.id;

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
                b.landmark,
                b.person,
                b.schedule_date,
                b.balance_amount,
                b.total_fare,
                b.token_amount,
                b.token_paid,
                b.actual_distance,
                b.actual_fare,
                b.platform_fee,
                b.start_lat,
                b.start_lng,
                b.end_lat,
                b.end_lng,
                b.status,
                b.user_status,
                b.driver_status,
                b.otp_verified,
                b.created_at,

                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km,
                p.plan_captain_commission,
                p.plan_company_commission,
                p.platform_fee AS plan_platform_fee,
                p.access_fee   AS plan_access_fee,
                ss.fixed_charge,
                ss.fixed_charge_km,
                ss.charge_after_fixed_per_km,
                ss.access_fee      AS sub_access_fee,
                ss.access_fee_type AS sub_access_fee_type,
                ss.platform_fee    AS sub_platform_fee,

                u.name   AS user_name,
                u.mobile AS user_mobile,
                s.title  AS service_name

            FROM bookings b
            LEFT JOIN plans p ON p.id = b.plan_id
            LEFT JOIN sub_services ss ON ss.id = b.sub_service_id
            LEFT JOIN users u ON u.id = b.user_id
            LEFT JOIN services s ON s.id = b.service_id

            WHERE b.driver_id = ?
            AND b.status IN (
               'PENDING','SEARCHING','ASSIGN','ACCEPTED','TOKEN_PAID','ARRIVED',
               'STARTED','PICKEDUP','DROPPED','TOPUP_PENDING','BALANCE_PAID',
               'WAITING_FOR_PAYMENT','SCHEDULED','OTP_VERIFIED'
            )
            ORDER BY b.id DESC
        `, [driver_id]);

        if (bookings.length === 0) {
            return res.json({ status: false, message: "No current booking found", data: [] });
        }

        const result = await Promise.all(bookings.map(async (booking) => {
            const isInCity = parseInt(booking.service_id) === 1;
            booking.is_incity = isInCity;
            if (isInCity) {
                booking.plan_name               = undefined;
                booking.plan_price              = undefined;
                booking.plan_hour               = undefined;
                booking.plan_km                 = undefined;
                booking.plan_captain_commission = undefined;
                booking.plan_company_commission = undefined;
                booking.meter_images            = undefined;
                booking.topups                  = undefined;
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

                // Captain earning = metered fare − (access_fee + platform_fee); null until metered
                booking.driver_amount = computeInCityDriverAmount(booking.actual_fare, accessFee, platformFee);

                if (hasActualFare) {
                    const fixedCharge = parseFloat(booking.fixed_charge || 0);
                    const fixedKm     = parseFloat(booking.fixed_charge_km || 0);
                    const perKm       = parseFloat(booking.charge_after_fixed_per_km || 0);
                    const extraKm     = Math.max(0, parseFloat(booking.actual_distance || 0) - fixedKm);
                    booking.fare_breakdown = {
                        fixed_charge  : fixedCharge,
                        fixed_km      : fixedKm,
                        extra_km      : extraKm,
                        extra_fare    : (extraKm * perKm).toFixed(2),
                        access_fee    : accessFee,
                        platform_fee  : platformFee,
                        total_fare    : parseFloat(booking.actual_fare).toFixed(2),
                        driver_amount : booking.driver_amount
                    };
                }
            } else {
                const [images] = await db.query(`
                    SELECT id, image_type,
                           CONCAT('uploads/meter_images/', image) AS image,
                           created_at
                    FROM booking_meter_images
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [booking.id]);

                const [topups] = await db.query(`
                    SELECT id, extra_km, price_per_km, topup_amount,
                           captain_commission, company_commission,
                           reason, status, created_at
                    FROM booking_topups
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [booking.id]);

                booking.meter_images  = images;
                booking.topups        = topups;
                booking.driver_amount = computeDriverAmount(booking.plan_captain_commission, topups);
                const topupFareShare = computeTopupFareShare(topups);
                booking.total_fare = Math.round(((parseFloat(booking.total_fare) || 0) + topupFareShare) * 100) / 100;
                booking.access_fee   = booking.plan_access_fee != null ? parseFloat(booking.plan_access_fee) : null;
                booking.platform_fee = booking.plan_platform_fee != null ? parseFloat(booking.plan_platform_fee) : null;
            }

            if (booking.user_image) {
                booking.user_image = `${process.env.BASE_URL}/uploads/users/${booking.user_image}`;
            }

            // strip raw helper columns from the response
            booking.plan_platform_fee         = undefined;
            booking.plan_access_fee           = undefined;
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
            message: "Current bookings fetched successfully",
            data: result
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.getDriverBookingHistory = async (req, res) => {
    try {
        const driver_id = req.user.id;

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
                b.person,
                b.schedule_date,
                b.total_fare,
                b.token_amount,
                b.token_paid,
                b.actual_distance,
                b.actual_fare,
                b.status,
                b.user_status,
                b.driver_status,
                b.created_at,

                p.plan_name,
                p.plan_price,
                p.plan_captain_commission,
                p.platform_fee AS plan_platform_fee,
                p.access_fee   AS plan_access_fee,

                ss.fixed_charge,
                ss.fixed_charge_km,
                ss.charge_after_fixed_per_km,
                ss.access_fee      AS sub_access_fee,
                ss.access_fee_type AS sub_access_fee_type,
                ss.platform_fee    AS sub_platform_fee,

                u.name   AS user_name,
                u.mobile AS user_mobile,
                s.title  AS service_name

            FROM bookings b
            LEFT JOIN plans p ON p.id = b.plan_id
            LEFT JOIN sub_services ss ON ss.id = b.sub_service_id
            LEFT JOIN users u ON u.id = b.user_id
            LEFT JOIN services s ON s.id = b.service_id

            WHERE b.driver_id = ?
            ORDER BY b.id DESC
        `, [driver_id]);

        for (let booking of bookings) {
            const isInCity = parseInt(booking.service_id) === 1;
            booking.is_incity = isInCity;

            if (isInCity) {
                booking.plan_name               = undefined;
                booking.plan_price              = undefined;
                booking.plan_captain_commission = undefined;
                booking.meter_images = undefined;
                booking.topups       = undefined;
                booking.total_fare   = parseFloat(booking.actual_fare) > 0 ? booking.actual_fare : null;
                booking.final_fare   = parseFloat(booking.actual_fare) > 0 ? booking.actual_fare : null;

                // In-city: fees come from the sub_service (already included in actual_fare)
                const accessFee   = parseFloat(booking.sub_access_fee || 0);
                const platformFee = parseFloat(booking.sub_platform_fee || 0);
                booking.access_fee      = accessFee;
                booking.access_fee_type = booking.sub_access_fee_type || 'flat';
                booking.platform_fee    = platformFee;

                // Captain earning = metered fare − (access_fee + platform_fee); null until metered
                booking.driver_amount = computeInCityDriverAmount(booking.actual_fare, accessFee, platformFee);

                if (parseFloat(booking.actual_fare) > 0) {
                    const fixedCharge = parseFloat(booking.fixed_charge || 0);
                    const fixedKm     = parseFloat(booking.fixed_charge_km || 0);
                    const perKm       = parseFloat(booking.charge_after_fixed_per_km || 0);
                    const extraKm     = Math.max(0, parseFloat(booking.actual_distance || 0) - fixedKm);
                    booking.fare_breakdown = {
                        fixed_charge  : fixedCharge,
                        fixed_km      : fixedKm,
                        extra_km      : extraKm,
                        extra_fare    : (extraKm * perKm).toFixed(2),
                        access_fee    : accessFee,
                        platform_fee  : platformFee,
                        total_fare    : parseFloat(booking.actual_fare).toFixed(2),
                        driver_amount : booking.driver_amount
                    };
                }
            } else {
                const [images] = await db.query(`
                    SELECT id, image_type,
                           CONCAT('uploads/meter_images/', image) AS image,
                           created_at
                    FROM booking_meter_images
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [booking.id]);

                const [topups] = await db.query(`
                    SELECT id, extra_km, price_per_km, topup_amount, captain_commission, reason, status, created_at
                    FROM booking_topups
                    WHERE booking_id = ?
                    ORDER BY id ASC
                `, [booking.id]);

                booking.meter_images = images;
                booking.topups       = topups;
                booking.final_fare   = booking.total_fare ?? null;
                // Captain earning = plan_captain_commission + Σ(PAID topup captain_commission)
                booking.driver_amount = computeDriverAmount(booking.plan_captain_commission, topups);
                // Other services: fees come from the plan
                booking.access_fee   = booking.plan_access_fee != null ? parseFloat(booking.plan_access_fee) : null;
                booking.platform_fee = booking.plan_platform_fee != null ? parseFloat(booking.plan_platform_fee) : null;
            }

            // strip raw helper columns from the response
            booking.plan_platform_fee         = undefined;
            booking.plan_access_fee           = undefined;
            booking.fixed_charge              = undefined;
            booking.fixed_charge_km           = undefined;
            booking.charge_after_fixed_per_km = undefined;
            booking.sub_access_fee            = undefined;
            booking.sub_access_fee_type       = undefined;
            booking.sub_platform_fee          = undefined;
        }

        return res.json({
            status: true,
            message: "Driver booking history fetched successfully",
            total_booking: bookings.length,
            data: bookings
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.rejectBooking = async (req, res) => {
    try {
        const driver_id = req.user.id;
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
            INSERT IGNORE INTO booking_rejections (booking_id, driver_id, created_at)
            VALUES (?, ?, NOW())
        `, [booking.id, driver_id]);

        if (result.insertId) {
          await createAdminNotification({
            type: 'booking_rejection',
            source_table: 'booking_rejections',
            source_id: result.insertId,
            message: `Booking ${booking_id} rejected by driver ${driver_id}`,
            sub: `Rejected by driver`,
            payload: { booking_id, driver_id }
          });
        }

        return res.json({ status: true, message: "Booking rejected successfully" });

    } catch (error) {
        console.error("rejectBooking error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.acceptBooking = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { booking_id } = req.body;

        if (!booking_id) {
            return res.status(400).json({
                status: false,
                message: "booking_id is required"
            });
        }

        const [[driver]] = await db.query(
            `SELECT id, service_id, sub_service_id, status FROM drivers WHERE id = ?`,
            [driver_id]
        );

        if (!driver) {
            return res.status(404).json({ status: false, message: "Driver not found" });
        }

        if (driver.status !== 'approved') {
            return res.status(403).json({ status: false, message: "Please get your KYC approved — only then you can accept bookings." });
        }

        const [booking] = await db.query(
            `SELECT b.id, b.user_id, b.status, b.driver_id, b.service_id, b.sub_service_id,
                    (ss.booking_destroy_min IS NOT NULL AND ss.booking_destroy_min > 0
                     AND b.created_at + INTERVAL ss.booking_destroy_min MINUTE <= NOW()) AS is_expired
             FROM bookings b
             LEFT JOIN sub_services ss ON ss.id = b.sub_service_id
             WHERE b.booking_id = ?`,
            [booking_id]
        );

        if (booking.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Booking not found"
            });
        }

        const { user_id: bk_user_id, status, driver_id: assigned_driver_id, service_id: bk_service_id, sub_service_id: bk_sub_service_id, is_expired } = booking[0];

        if (parseInt(driver.service_id) !== parseInt(bk_service_id) ||
            parseInt(driver.sub_service_id) !== parseInt(bk_sub_service_id)) {
            return res.status(403).json({
                status: false,
                message: "You can only accept bookings matching your registered service"
            });
        }

        // still-searching bookings expire after their allocated time — captain can't accept them
        if (status === 'SEARCHING' && Number(is_expired) === 1) {
            return res.status(400).json({
                status: false,
                message: "This booking time has expired. Please ask the customer to create a new booking."
            });
        }

        if (status === 'ASSIGN') {
            if (assigned_driver_id !== driver_id) {
                return res.status(403).json({
                    status: false,
                    message: "This booking is assigned to another driver"
                });
            }

            await db.query(
                `UPDATE bookings
                 SET status = 'ACCEPTED', driver_status = 'ACCEPTED'
                 WHERE booking_id = ?`,
                [booking_id]
            );

            await notifyUser(bk_user_id, "Captain assigned",
                "Your captain has accepted the booking and is on the way.", { type: "BOOKING_ACCEPTED", booking_id });

            return res.json({
                status: true,
                message: "Booking accepted successfully"
            });
        }

        if (status === 'SEARCHING') {
            const [update] = await db.query(
                `UPDATE bookings
                 SET driver_id = ?, status = 'ACCEPTED', driver_status = 'ACCEPTED'
                 WHERE booking_id = ? AND status = 'SEARCHING'`,
                [driver_id, booking_id]
            );

            if (update.affectedRows === 0) {
                return res.status(400).json({
                    status: false,
                    message: "Booking already taken by another driver"
                });
            }

            await notifyUser(bk_user_id, "Captain assigned",
                "Your captain has accepted the booking and is on the way.", { type: "BOOKING_ACCEPTED", booking_id });

            return res.json({
                status: true,
                message: "Booking accepted successfully"
            });
        }

        return res.status(400).json({
            status: false,
            message: `Booking cannot be accepted, current status is ${status}`
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

exports.driverArrived = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { booking_id } = req.body;

        if (!booking_id) {
            return res.status(400).json({
                status: false,
                message: "booking_id is required"
            });
        }

        const [rows] = await db.query(`
            SELECT id, booking_id, user_id, driver_id, status, service_id
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

        if (booking.driver_id !== driver_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized driver"
            });
        }

        const allowedStatuses = parseInt(booking.service_id) === 1
            ? ['ACCEPTED', 'ASSIGN']
            : ['TOKEN_PAID', 'ACCEPTED', 'ASSIGN'];

        if (!allowedStatuses.includes(booking.status)) {
            return res.status(400).json({
                status: false,
                message: "Cannot mark arrived at this stage"
            });
        }

        await db.query(`UPDATE bookings
            SET
                status = 'ARRIVED',
                user_status = 'ARRIVED',
                driver_status = 'ARRIVED'
            WHERE id = ?
        `, [booking.id]);

        await notifyUser(booking.user_id, "Captain arrived",
            "Your captain has arrived at the pickup location.", { type: "BOOKING_ARRIVED", booking_id });

        return res.json({
            status: true,
            message: "Driver arrived at pickup location"
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

exports.bookingverifyOtp = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { booking_id, otp, pickup_lat, pickup_lng } = req.body;

        if (!booking_id || !otp) {
            return res.status(400).json({ status: false, message: "booking_id and otp are required" });
        }

        const [[booking]] = await db.query(`
            SELECT id, booking_id, user_id, driver_id, otp, status, balance_paid, service_id
            FROM bookings WHERE booking_id = ?
        `, [booking_id]);

        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (booking.driver_id != driver_id) return res.status(403).json({ status: false, message: "Unauthorized driver" });

        if (parseInt(booking.service_id) === 1) {
            if (booking.status !== 'ARRIVED') {
                return res.status(400).json({ status: false, message: `OTP verify allowed only after arrival. Current: ${booking.status}` });
            }
            if (!pickup_lat || !pickup_lng) {
                return res.status(400).json({ status: false, message: "pickup_lat and pickup_lng are required for In-City service" });
            }
        } else {
            if (booking.status !== 'BALANCE_PAID' || booking.balance_paid != 1) {
                return res.status(400).json({ status: false, message: "Remaining payment pending" });
            }
        }

        if (String(booking.otp) !== String(otp)) {
            return res.status(400).json({ status: false, message: "Invalid OTP" });
        }

        const updateFields = `otp_verified = 1, status = 'STARTED', user_status = 'STARTED', driver_status = 'STARTED'`;

        if (parseInt(booking.service_id) === 1) {
            await db.query(`
                UPDATE bookings SET ${updateFields}, start_lat = ?, start_lng = ?
                WHERE id = ?
            `, [pickup_lat, pickup_lng, booking.id]);
        } else {
            await db.query(`
                UPDATE bookings SET ${updateFields}
                WHERE id = ?
            `, [booking.id]);
        }

        if (req.file) {
            await db.query(`INSERT INTO booking_meter_images (booking_id, image_type, image) VALUES (?, 'STARTED', ?)`,
                [booking.id, req.file.filename]);
        }

        await notifyUser(booking.user_id, "Ride started",
            "Your ride has started. Have a safe journey!", { type: "RIDE_STARTED", booking_id: booking.booking_id });

        return res.json({
            status: true,
            message: "OTP verified. Ride started.",
            booking_id: booking.booking_id,
            ...(parseInt(booking.service_id) === 1
                ? { start_location: { lat: pickup_lat, lng: pickup_lng } }
                : {})
        });

    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.requestTopup = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { booking_id, extra_km, reason } = req.body;

        if (!booking_id || !extra_km) {
            return res.status(400).json({
                status: false,
                message: "booking_id and extra_km are required"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                status: false,
                message: "Topup meter image is required"
            });
        }

        if (Number(extra_km) <= 0) {
            return res.status(400).json({
                status: false,
                message: "extra_km must be greater than 0"
            });
        }

        const [rows] = await db.query(`
            SELECT
                b.id,
                b.booking_id,
                b.driver_id,
                b.status,
                b.service_id,
                b.plan_id,
                p.topup_price_perkm,
                p.topup_captain_commission,
                p.topup_company_commission
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

        if (booking.driver_id != driver_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized driver"
            });
        }

        if (parseInt(booking.service_id) === 1) {
            return res.status(400).json({
                status: false,
                message: "Topup is not applicable for In-City service"
            });
        }

        if (
            booking.status !== 'STARTED' &&
            booking.status !== 'PICKEDUP'
        ) {
            return res.status(400).json({
                status: false,
                message: "Topup request allowed only during trip"
            });
        }

        const [pendingRows] = await db.query(`
            SELECT id
            FROM booking_topups
            WHERE booking_id = ?
            AND status = 'PENDING'
            LIMIT 1
        `, [booking.id]);

        if (pendingRows.length > 0) {
            return res.status(400).json({
                status: false,
                message: "Previous topup request is still pending"
            });
        }

        const km = Number(extra_km);
        const price_per_km        = Number(booking.topup_price_perkm        || 0);
        const topup_amount        = km * price_per_km;
        const captain_commission  = km * Number(booking.topup_captain_commission || 0);
        const company_commission  = km * Number(booking.topup_company_commission || 0);

        const topupReason =
            reason && reason.trim() !== ""
                ? reason.trim()
                : null;

        const topup_otp = Math.floor(1000 + Math.random() * 9000);

        const [insertData] = await db.query(`
            INSERT INTO booking_topups (
                booking_id,
                extra_km,
                price_per_km,
                topup_amount,
                captain_commission,
                company_commission,
                reason,
                topup_otp,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `, [
            booking.id,
            km,
            price_per_km,
            topup_amount,
            captain_commission,
            company_commission,
            topupReason,
            topup_otp
        ]);

        const image =  req.file.filename;

        await db.query(`
            INSERT INTO booking_meter_images
            (booking_id, image_type, image)
            VALUES (?, 'TOPUP', ?)
        `, [booking.id, image]);

        await db.query(`
            UPDATE bookings
            SET
                status = 'TOPUP_PENDING',
                user_status = 'TOPUP_REQUESTED',
                driver_status = 'AWAITING_TOPUP_PAYMENT'
            WHERE id = ?
        `, [booking.id]);

        return res.json({
            status: true,
            message: "Topup request sent successfully",
            data: {
                topup_id: insertData.insertId,
                booking_id: booking.booking_id,
                extra_km: km,
                price_per_km,
                topup_amount,
                topup_otp: topup_otp,
                reason: topupReason,
                image: image
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

exports.verifyTopupOtp = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { topup_id, otp } = req.body;

        const [rows] = await db.query(`
            SELECT 
                bt.id,
                bt.booking_id,
                bt.topup_otp,
                bt.status,
                b.driver_id
            FROM booking_topups bt
            JOIN bookings b ON b.id = bt.booking_id
            WHERE bt.id = ?
        `,[topup_id]);

        if(rows.length === 0){
            return res.status(404).json({
                status:false,
                message:"Topup not found"
            });
        }

        const topup = rows[0];

        if(topup.driver_id !== driver_id){
            return res.status(403).json({
                status:false,
                message:"Unauthorized"
            });
        }

        if(String(topup.topup_otp) !== String(otp)){
            return res.status(400).json({
                status:false,
                message:"Invalid OTP"
            });
        }

        await db.query(`
            UPDATE booking_topups
            SET 
            otp_verified = 1,
            status = 'PAID'
            WHERE id = ?
        `, [topup_id]);

        await db.query(`
            UPDATE bookings
            SET
              status='STARTED',
              user_status='TOPUP_PAID',
              driver_status='STARTED'
            WHERE id = ?
        `,[topup.booking_id]);

        return res.json({
            status:true,
            message:"Topup verified successfully"
        });

    } catch(error){
        return res.status(500).json({
            status:false,
            message:error.message
        });
    }
};

exports.completeRide = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { booking_id, actual_distance, meter_text, drop_lat, drop_lng } = req.body;

        if (!booking_id) return res.status(400).json({ status: false, message: "booking_id is required" });

        const [[booking]] = await db.query(`
            SELECT id, booking_id, user_id, driver_id, service_id, sub_service_id,
                   status, distance, total_fare, platform_fee
            FROM bookings WHERE booking_id = ?
        `, [booking_id]);

        if (!booking) return res.status(404).json({ status: false, message: "Booking not found" });
        if (booking.driver_id != driver_id) return res.status(403).json({ status: false, message: "Unauthorized driver" });

        if (parseInt(booking.service_id) === 1 && (!actual_distance || parseFloat(actual_distance) <= 0)) {
            return res.status(400).json({ status: false, message: "actual_distance is required for In-City service" });
        }
        if (!['STARTED', 'PICKEDUP', 'DROPPED'].includes(booking.status)) {
            return res.status(400).json({ status: false, message: `Ride cannot be completed. Current status: ${booking.status}` });
        }

        let finalFare    = parseFloat(booking.total_fare || 0);
        let finalDist    = parseFloat(booking.distance   || 0);
        let fareBreakdown = null;
        // For in-city (service_id=1) we'll charge these fees to the driver's wallet
        let accessFee = 0;
        let platformFee = 0;

        // ── In-City (service_id=1): recalculate fare with actual_distance ──
        if (parseInt(booking.service_id) === 1 && actual_distance) {
            finalDist = parseFloat(actual_distance);

            const [[ss]] = await db.query(`
                SELECT fixed_charge, fixed_charge_km, charge_after_fixed_per_km, access_fee, access_fee_type, platform_fee
                FROM sub_services WHERE id = ?
            `, [booking.sub_service_id]);

            if (ss) {
                const fixedCharge = parseFloat(ss.fixed_charge || 0);
                const fixedKm     = parseFloat(ss.fixed_charge_km || 0);
                const perKm       = parseFloat(ss.charge_after_fixed_per_km || 0);
                platformFee       = parseFloat(ss.platform_fee || 0);
                const chargeableKm = Math.round(finalDist);       // round distance to nearest km (6.7 → 7)
                const extraKm     = Math.max(0, chargeableKm - fixedKm);
                const rideFare    = fixedCharge + (extraKm * perKm);
                // access_fee can be a flat amount OR a percentage of the ride fare
                const accessFeeCfg = parseFloat(ss.access_fee || 0);
                accessFee         = (ss.access_fee_type === 'percent')
                    ? Math.round(rideFare * accessFeeCfg) / 100
                    : accessFeeCfg;
                finalFare         = Math.round(rideFare + accessFee + platformFee);  // round off (114.50 → 115)

                fareBreakdown = {
                    actual_distance : finalDist,
                    fixed_charge    : fixedCharge,
                    fixed_km        : fixedKm,
                    extra_km        : extraKm,
                    extra_fare      : (extraKm * perKm).toFixed(2),
                    access_fee      : accessFee,
                    platform_fee    : platformFee,
                    actual_fare     : finalFare.toFixed(2)
                };
            }
        }

        // meter image optional for in-city
        if (req.file) {
            await db.query(`INSERT INTO booking_meter_images (booking_id, image_type, image, meter_text) VALUES (?, 'COMPLETE', ?, ?)`,
                [booking.id, req.file.filename, meter_text || null]);
        }

        if (parseInt(booking.service_id) === 1) {
            if (!drop_lat || !drop_lng) {
                return res.status(400).json({ status: false, message: "drop_lat and drop_lng are required for In-City service" });
            }
            await db.query(`
                UPDATE bookings SET
                    status = 'WAITING_FOR_PAYMENT',
                    user_status = 'WAITING_FOR_PAYMENT',
                    driver_status = 'WAITING_FOR_PAYMENT',
                    actual_distance = ?, actual_fare = ?, end_lat = ?, end_lng = ?
                WHERE id = ?
            `, [finalDist, finalFare.toFixed(2), drop_lat, drop_lng, booking.id]);
            // Deduct platform/access fees from driver's wallet for In-City bookings
            try {
                const feeToDeduct = parseFloat(accessFee || 0) + parseFloat(platformFee || 0);
                if (feeToDeduct > 0) {
                    await db.query(`UPDATE drivers SET wallet = wallet - ? WHERE id = ?`, [feeToDeduct, booking.driver_id]);
                }
            } catch (err) {
                // do not block ride completion if deduction fails; log and proceed
                console.error('Failed to deduct in-city fees from driver wallet:', err.message || err);
            }
        } else {
            await db.query(`
                UPDATE bookings SET
                    status = 'COMPLETED', user_status = 'COMPLETED', driver_status = 'COMPLETED',
                    actual_distance = ?, actual_fare = ?
                WHERE id = ?
            `, [finalDist, finalFare.toFixed(2), booking.id]);
        }

        if (parseInt(booking.service_id) === 1) {
            await notifyUser(booking.user_id, "Ride completed",
                `Ride completed. Please pay ₹${finalFare.toFixed(2)}.`, { type: "RIDE_WAITING_PAYMENT", booking_id: booking.booking_id });
        } else {
            await notifyUser(booking.user_id, "Ride completed",
                "Your ride has been completed.", { type: "RIDE_COMPLETED", booking_id: booking.booking_id });
        }

        return res.json({
            status: true,
            message: parseInt(booking.service_id) === 1
                ? "Ride completed. Waiting for user payment."
                : "Ride completed. Awaiting payment.",
            booking_id: booking.booking_id,
            fare_breakdown: fareBreakdown || { total_fare: finalFare.toFixed(2) },
            ...(parseInt(booking.service_id) === 1
                ? { end_location: { lat: drop_lat, lng: drop_lng } }
                : {})
        });

    } catch (error) {
        return res.status(500).json({ status: false, message: error.message });
    }
};


//-------------------------------------------------|Driverapi_admin|---------------------------------------------------------//
exports.driverList = async (req, res) => {
    try {
        const [drivers] = await db.query(`
            SELECT 
                d.id,
                d.full_name,
                d.phone,
                d.service_id,
                s.title AS service_name,
                d.sub_service_id,
                ss.title AS sub_service_name,
                d.pincode,
                d.wallet,
                d.status,
                d.ba_id,
                d.is_online,
                d.created_at
            FROM drivers d
            LEFT JOIN services s ON s.id = d.service_id
            LEFT JOIN sub_services ss ON ss.id = d.sub_service_id
            ORDER BY d.id DESC
        `);

        return res.json({
            status: true,
            message: "All drivers fetched successfully",
            total_drivers: drivers.length,
            data: drivers
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

exports.deleteDriver = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await db.query(`SELECT id FROM drivers WHERE id = ?`, [id]);

        if (existing.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Driver not found"
            });
        }

        await db.query(`DELETE FROM drivers WHERE id = ?`, [id]);

        return res.json({
            status: true,
            message: "Driver deleted successfully"
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

exports.getDriverById = async (req, res) => {
    try {
        const { id } = req.params;

        const [driver] = await db.query(`
            SELECT 
                d.id,
                d.full_name,
                d.phone,
                d.service_id,
                s.name AS service_name,
                d.sub_service_id,
                ss.name AS sub_service_name,
                d.pincode,
                d.wallet,
                d.status,
                d.is_online
            FROM drivers d
            LEFT JOIN services s ON s.id = d.service_id
            LEFT JOIN sub_services ss ON ss.id = d.sub_service_id
            WHERE d.id = ?
        `, [id]);

        if (driver.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Driver not found"
            });
        }

        return res.json({
            status: true,
            message: "Driver fetched successfully",
            data: driver[0]
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

exports.updateDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, phone, service_id, sub_service_id, pincode, status } = req.body;
        const [existing] = await db.query(`SELECT id FROM drivers WHERE id = ?`, [id]);

        if (existing.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Driver not found"
            });
        }

        await db.query(`
            UPDATE drivers SET
                full_name     = ?,
                phone         = ?,
                service_id    = ?,
                sub_service_id = ?,
                pincode       = ?,
                status        = ?
            WHERE id = ?
        `, [full_name, phone, service_id, sub_service_id, pincode, status, id]);

        return res.json({
            status: true,
            message: "Driver updated successfully"
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

exports.getDriverBookingsByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.query;

        const [driverRows] = await db.query(
            `SELECT id, full_name, phone FROM drivers WHERE id = ?`,
            [id]
        );

        if (driverRows.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Driver not found"
            });
        }

        const values = [id];
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
                b.token_amount,
                b.token_paid,
                b.status,
                b.user_status,
                b.driver_status,
                b.cancelled_by,
                b.cancel_reason,
                b.created_at,

                u.id AS user_id,
                u.name AS user_name,
                u.mobile AS user_mobile,

                s.title AS service_name,

                p.plan_name,
                p.plan_price,
                p.plan_hour,
                p.plan_km

            FROM bookings b
            LEFT JOIN users u ON u.id = b.user_id
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN plans p ON p.id = b.plan_id
            WHERE b.driver_id = ?
            ${statusFilter}
            ORDER BY b.id DESC
        `, values);

        const baseUrl = `https://${req.get('host')}`;

        for (const booking of bookings) {
            const [images] = await db.query(`
                SELECT
                    id,
                    image_type,
                    image,
                    meter_text,
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
                    otp_verified,
                    created_at
                FROM booking_topups
                WHERE booking_id = ?
                ORDER BY id ASC
            `, [booking.id]);

            booking.meter_images = images.map(item => ({
                ...item,
                image_url: item.image
                    ? `${baseUrl}/uploads/meter_images/${item.image}`
                    : null
            }));
            booking.topups = topups;
        }

        return res.json({
            status: true,
            message: "Driver bookings fetched successfully",
            driver: driverRows[0],
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

exports.getDriverDocumentsByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const [driverRows] = await db.query(
            `SELECT id, full_name, phone 
             FROM drivers 
             WHERE id = ?`,
            [id]
        );

        if (driverRows.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Driver not found"
            });
        }

        const [documents] = await db.query(`
            SELECT
                dd.id,
                dd.driver_id,
                dd.document_type,
                sd.document_type as document_name,
                sd.id AS service_document_id,
                dd.document_number,
                dd.document_file,
                dd.expiry_date,
                dd.remark,
                dd.created_at,
                dd.updated_at,
                dd.status
            FROM driver_documents dd
            LEFT JOIN service_document sd 
                ON sd.id = dd.document_type
            WHERE dd.driver_id = ?
            ORDER BY dd.id DESC
        `, [id]);

        const baseUrl = `https://${req.get('host')}`;

        const data = documents.map(doc => ({
            ...doc,
            document_file_url: doc.document_file
                ? `${baseUrl}/uploads/documents/${doc.document_file}`
                : null
        }));

        return res.json({
            status: true,
            message: "Driver documents fetched successfully",
            driver: driverRows[0],
            total_documents: data.length,
            data
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

exports.getAllDriverDocuments = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                dd.id,
                dd.driver_id,
                dd.document_type,
                sd.document_type AS document_name,
                dd.document_number,
                dd.document_file,
                dd.expiry_date,
                dd.status,
                dd.remark,
                dd.verified_by,
                dd.verified_at,
                dd.created_at,
                dd.updated_at,
                d.full_name AS driver_name,
                d.phone AS driver_phone
            FROM driver_documents dd
            LEFT JOIN drivers d ON d.id = dd.driver_id
            LEFT JOIN service_document sd ON sd.id = dd.document_type
            ORDER BY dd.created_at DESC
            LIMIT 300
        `);

        return res.json({ status: true, message: 'Driver documents fetched successfully', total: rows.length, data: rows });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: 'Server error', error: error.message });
    }
};

exports.verifyDriverDocument = async (req, res) => {
    try {
        const { id, doc_id } = req.params;
        const { status, verified_by, remark } = req.body || {};

        const allowedStatuses = [0, 1, 2];
        if (status === undefined || !allowedStatuses.includes(Number(status))) {
            return res.status(400).json({
                status: false,
                message: "status required: 0=Pending, 1=Verified, 2=Rejected"
            });
        }

        const adminId = parseInt(verified_by);
        if (!verified_by || isNaN(adminId)) {
            return res.status(400).json({
                status: false,
                message: "verified_by must be a valid admin ID (integer)"
            });
        }

        const [doc] = await db.query(
            `SELECT id FROM driver_documents WHERE id = ? AND driver_id = ?`,
            [doc_id, id]
        );

        if (doc.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Document not found"
            });
        }

        await db.query(`
            UPDATE driver_documents
            SET
                status = ?,
                verified_by = ?,
                verified_at = NOW(),
                remark = ?
            WHERE id = ? AND driver_id = ?
        `, [Number(status), adminId, remark || null, doc_id, id]);

        const statusLabel = Number(status) === 1 ? 'Verified' : Number(status) === 2 ? 'Rejected' : 'Pending';

        await createAdminNotification({
          type: Number(status) === 2 ? 'driver_kyc_rejected' : 'driver_kyc_verified',
          source_table: 'driver_documents',
          source_id: doc_id,
          message: `Driver document ${statusLabel} for driver ${id}`,
          sub: `${statusLabel} by admin`,
          payload: { driver_id: id, document_id: doc_id, status: Number(status) }
        });

        return res.json({
            status: true,
            message: `Document ${statusLabel} successfully`
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

// ==================== WALLET / RECHARGE ====================

exports.driverInitiateRecharge = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { amount, payment_mode, transaction_id, remarks } = req.body;

        if (!amount) {
            return res.status(400).json({ status: false, message: "amount is required" });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ status: false, message: "amount must be a positive number" });
        }

        const VALID_MODES = ['CASH', 'ONLINE', 'UPI', 'CARD', 'WALLET', 'BANK_TRANSFER'];
        const mode = (payment_mode || 'ONLINE').toUpperCase();
        if (!VALID_MODES.includes(mode)) {
            return res.status(400).json({
                status: false,
                message: `payment_mode must be one of: ${VALID_MODES.join(', ')}`
            });
        }

        const [[driver]] = await db.query(
            `SELECT id, full_name, wallet FROM drivers WHERE id = ?`,
            [driver_id]
        );
        if (!driver) {
            return res.status(404).json({ status: false, message: "Driver not found" });
        }

        const recharge_id = `RCH-${Date.now()}-${driver_id}`;

        const [result] = await db.query(`
            INSERT INTO driver_recharges
            (driver_id, recharge_id, amount, payment_mode, transaction_id,
             payment_status, recharge_status, remarks, created_by)
            VALUES (?, ?, ?, ?, ?, 'SUCCESS', 'COMPLETED', ?, ?)
        `, [driver_id, recharge_id, parsedAmount, mode, transaction_id || null, remarks || null, driver_id]);

        await db.query(
            `UPDATE drivers SET wallet = wallet + ? WHERE id = ?`,
            [parsedAmount, driver_id]
        );

        const [[updated]] = await db.query(
            `SELECT wallet FROM drivers WHERE id = ?`,
            [driver_id]
        );

        return res.status(201).json({
            status: true,
            message: "Wallet recharged successfully",
            data: {
                id: result.insertId,
                recharge_id,
                driver_id,
                driver_name: driver.full_name,
                amount: parsedAmount,
                payment_mode: mode,
                transaction_id: transaction_id || null,
                payment_status: "SUCCESS",
                recharge_status: "COMPLETED",
                wallet_balance: updated.wallet
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.rechargeDriverWallet = async (req, res) => {
    try {
        const {
            driver_id,
            amount,
            payment_mode,
            transaction_id,
            payment_status,
            recharge_status,
            remarks,
            created_by
        } = req.body;

        if (!driver_id || !amount) {
            return res.status(400).json({
                status: false,
                message: "driver_id and amount are required"
            });
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({
                status: false,
                message: "amount must be a positive number"
            });
        }

        const VALID_MODES = ['CASH', 'ONLINE', 'UPI', 'CARD', 'WALLET', 'BANK_TRANSFER'];
        const mode = (payment_mode || 'ONLINE').toUpperCase();
        if (!VALID_MODES.includes(mode)) {
            return res.status(400).json({
                status: false,
                message: `payment_mode must be one of: ${VALID_MODES.join(', ')}`
            });
        }

        const VALID_PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];
        const pStatus = (payment_status || 'PENDING').toUpperCase();
        if (!VALID_PAYMENT_STATUSES.includes(pStatus)) {
            return res.status(400).json({
                status: false,
                message: `payment_status must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`
            });
        }

        const VALID_RECHARGE_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'];
        const rStatus = (recharge_status || 'PENDING').toUpperCase();
        if (!VALID_RECHARGE_STATUSES.includes(rStatus)) {
            return res.status(400).json({
                status: false,
                message: `recharge_status must be one of: ${VALID_RECHARGE_STATUSES.join(', ')}`
            });
        }

        const [[driver]] = await db.query(
            `SELECT id, full_name, wallet FROM drivers WHERE id = ?`,
            [driver_id]
        );
        if (!driver) {
            return res.status(404).json({ status: false, message: "Driver not found" });
        }

        const recharge_id = `RCH-${Date.now()}-${driver_id}`;

        const [result] = await db.query(`
            INSERT INTO driver_recharges
            (driver_id, recharge_id, amount, payment_mode, transaction_id, payment_status, recharge_status, remarks, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            driver_id,
            recharge_id,
            parsedAmount,
            mode,
            transaction_id || null,
            pStatus,
            rStatus,
            remarks || null,
            created_by || null
        ]);

        let newWallet = parseFloat(driver.wallet || 0);
        if (pStatus === 'SUCCESS' && rStatus === 'COMPLETED') {
            newWallet += parsedAmount;
            await db.query(
                `UPDATE drivers SET wallet = ? WHERE id = ?`,
                [newWallet.toFixed(2), driver_id]
            );
        }

        return res.status(201).json({
            status: true,
            message: "Recharge recorded successfully",
            data: {
                id: result.insertId,
                recharge_id,
                driver_id,
                driver_name: driver.full_name,
                amount: parsedAmount,
                payment_mode: mode,
                transaction_id: transaction_id || null,
                payment_status: pStatus,
                recharge_status: rStatus,
                wallet_balance: newWallet.toFixed(2)
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

exports.updateRechargeStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_status, recharge_status, transaction_id, remarks } = req.body;

        const VALID_PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];
        const VALID_RECHARGE_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'];

        const [[recharge]] = await db.query(
            `SELECT * FROM driver_recharges WHERE id = ?`,
            [id]
        );
        if (!recharge) {
            return res.status(404).json({ status: false, message: "Recharge not found" });
        }

        const newPStatus = payment_status ? payment_status.toUpperCase() : recharge.payment_status;
        const newRStatus = recharge_status ? recharge_status.toUpperCase() : recharge.recharge_status;

        if (!VALID_PAYMENT_STATUSES.includes(newPStatus)) {
            return res.status(400).json({
                status: false,
                message: `payment_status must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`
            });
        }
        if (!VALID_RECHARGE_STATUSES.includes(newRStatus)) {
            return res.status(400).json({
                status: false,
                message: `recharge_status must be one of: ${VALID_RECHARGE_STATUSES.join(', ')}`
            });
        }

        await db.query(`
            UPDATE driver_recharges
            SET payment_status = ?, recharge_status = ?,
                transaction_id = COALESCE(?, transaction_id),
                remarks = COALESCE(?, remarks)
            WHERE id = ?
        `, [newPStatus, newRStatus, transaction_id || null, remarks || null, id]);

        // Credit wallet if status just became SUCCESS + COMPLETED
        const wasComplete = recharge.payment_status === 'SUCCESS' && recharge.recharge_status === 'COMPLETED';
        const nowComplete = newPStatus === 'SUCCESS' && newRStatus === 'COMPLETED';

        if (!wasComplete && nowComplete) {
            await db.query(
                `UPDATE drivers SET wallet = wallet + ? WHERE id = ?`,
                [parseFloat(recharge.amount), recharge.driver_id]
            );
        }

        const [[updated]] = await db.query(
            `SELECT dr.*, d.full_name, d.wallet FROM driver_recharges dr JOIN drivers d ON d.id = dr.driver_id WHERE dr.id = ?`,
            [id]
        );

        return res.json({
            status: true,
            message: "Recharge updated successfully",
            data: updated
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

exports.getDriverWallet = async (req, res) => {
    try {
        const driver_id = req.user.id;

        const [[driver]] = await db.query(
            `SELECT id, full_name, phone, wallet FROM drivers WHERE id = ?`,
            [driver_id]
        );
        if (!driver) {
            return res.status(404).json({ status: false, message: "Driver not found" });
        }

        const [recharges] = await db.query(`
            SELECT id, recharge_id, amount, payment_mode, transaction_id,
                   payment_status, recharge_status, remarks, created_at
            FROM driver_recharges
            WHERE driver_id = ?
            ORDER BY id DESC
        `, [driver_id]);

        return res.json({
            status: true,
            message: "Wallet details fetched successfully",
            data: {
                driver_id: driver.id,
                full_name: driver.full_name,
                phone: driver.phone,
                wallet_balance: driver.wallet,
                recharge_history: recharges
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


exports.getDriverRechargeHistory = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { status, page, limit } = req.query;

        const pageNum  = Math.max(1, parseInt(page)  || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const offset   = (pageNum - 1) * pageSize;

        const VALID_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'];
        let whereClause = `WHERE driver_id = ?`;
        const params = [driver_id];

        if (status) {
            const s = status.toUpperCase();
            if (!VALID_STATUSES.includes(s)) {
                return res.status(400).json({
                    status: false,
                    message: `status filter must be one of: ${VALID_STATUSES.join(', ')}`
                });
            }
            whereClause += ` AND recharge_status = ?`;
            params.push(s);
        }

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM driver_recharges ${whereClause}`,
            params
        );

        const [recharges] = await db.query(`
            SELECT id, recharge_id, amount, payment_mode, transaction_id,
                   payment_status, recharge_status, remarks, created_at
            FROM driver_recharges
            ${whereClause}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        `, [...params, pageSize, offset]);

        const [[driver]] = await db.query(
            `SELECT wallet FROM drivers WHERE id = ?`,
            [driver_id]
        );

        return res.json({
            status: true,
            message: "Recharge history fetched successfully",
            wallet_balance: driver ? driver.wallet : null,
            pagination: {
                total,
                page: pageNum,
                limit: pageSize,
                total_pages: Math.ceil(total / pageSize)
            },
            data: recharges
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

exports.getDriverRechargesByAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const [[driver]] = await db.query(
            `SELECT id, full_name, phone, wallet FROM drivers WHERE id = ?`,
            [id]
        );
        if (!driver) {
            return res.status(404).json({ status: false, message: "Driver not found" });
        }

        const [recharges] = await db.query(`
            SELECT id, recharge_id, amount, payment_mode, transaction_id,
                   payment_status, recharge_status, remarks, created_by, created_at, updated_at
            FROM driver_recharges
            WHERE driver_id = ?
            ORDER BY id DESC
        `, [id]);

        return res.json({
            status: true,
            message: "Driver recharge history fetched successfully",
            driver: {
                id: driver.id,
                full_name: driver.full_name,
                phone: driver.phone,
                wallet_balance: driver.wallet
            },
            total_recharges: recharges.length,
            data: recharges
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

// ==================== CREATE DRIVER ====================
exports.createDriver = async (req, res) => {
    try {
        const { full_name, phone, service_id, sub_service_id, pincode, status } = req.body;
        
        if (!full_name || !phone || !pincode) {
            return res.status(400).json({
                status: false,
                message: "full_name, phone aur pincode required hain"
            });
        }

        const [existing] = await db.query(
            `SELECT id FROM drivers WHERE phone = ?`, [phone]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                status: false,
                message: "Yeh phone number already registered"
            });
        }

        const [result] = await db.query(`
            INSERT INTO drivers (full_name, phone, service_id, sub_service_id, pincode, status, wallet, is_online)
            VALUES (?, ?, ?, ?, ?, ?, 100, 0)
        `, [full_name, phone, service_id || null, sub_service_id || null, pincode, status || 'pending']);

        return res.status(201).json({
            status: true,
            message: "Driver successfully created",
            data: {
                id: result.insertId,
                full_name,
                phone,
                service_id,
                sub_service_id,
                pincode,
                status: status || 'pending'
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

exports.collectPaymentAndCompleteRide = async (req, res) => {
    try {

        const driver_id = req.user.id;
        const { booking_id } = req.body;

        if (!booking_id) {
            return res.status(400).json({
                status: false,
                message: "booking_id is required"
            });
        }

        const [[booking]] = await db.query(`
            SELECT 
                id,
                booking_id,
                driver_id,
                service_id,
                status,
                paid,
                payment_mode,
                actual_fare,
                total_fare
            FROM bookings
            WHERE booking_id = ?
        `, [booking_id]);

        if (!booking) {
            return res.status(404).json({
                status: false,
                message: "Booking not found"
            });
        }

        // Driver validation
        if (booking.driver_id != driver_id) {
            return res.status(403).json({
                status: false,
                message: "Unauthorized"
            });
        }

        // Payment check
        if (booking.paid != 1) {
            return res.status(400).json({
                status: false,
                message: "Payment not completed by user"
            });
        }

        const isInCity = parseInt(booking.service_id) === 1;
        const allowedStatuses = isInCity
            ? ['PAYMENT_DONE']
            : ['BALANCE_PAID'];

        if (!allowedStatuses.includes(booking.status)) {
            return res.status(400).json({
                status: false,
                message: "Ride cannot be completed at this stage"
            });
        }

        const finalFare = parseFloat(
            booking.actual_fare || booking.total_fare || 0
        );

        await db.query(`
            UPDATE bookings
            SET 
                status = 'COMPLETED',
                user_status = 'COMPLETED',
                driver_status = 'COMPLETED',
                completed_at = NOW()
            WHERE id = ?
        `, [booking.id]);

        return res.json({
            status: true,
            message: "Payment collected and ride completed successfully",
            data: {
                booking_id: booking.booking_id,
                payment_mode: booking.payment_mode,
                final_fare: finalFare.toFixed(2),
                booking_status: "COMPLETED"
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

// ─── DRIVER WITHDRAWAL REQUEST ────────────────────────────────────────────────
exports.createWithdrawalRequest = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { amount, bank_name, account_number, ifsc_code, account_holder_name, upi_id } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ status: false, message: "Valid amount is required" });
        }

        if (!upi_id && !account_number) {
            return res.status(400).json({
                status: false,
                message: "Provide either upi_id or account_number"
            });
        }

        const [[driver]] = await db.execute(`SELECT id, wallet FROM drivers WHERE id = ?`, [driver_id]);
        if (!driver) return res.status(404).json({ status: false, message: "Driver not found" });

        if (parseFloat(driver.wallet) < parseFloat(amount)) {
            return res.status(400).json({ status: false, message: "Insufficient wallet balance" });
        }

        const [existing] = await db.execute(
            `SELECT id FROM withdrawal_requests WHERE user_type = 'DRIVER' AND user_id = ? AND status = 'PENDING'`,
            [driver_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ status: false, message: "You already have a pending withdrawal request" });
        }

        await db.execute(`
            INSERT INTO withdrawal_requests
                (user_type, user_id, amount, bank_name, account_number, ifsc_code, account_holder_name, upi_id, status, created_at, updated_at)
            VALUES ('DRIVER', ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())
        `, [driver_id, parseFloat(amount), bank_name || null, account_number || null, ifsc_code || null, account_holder_name || null, upi_id || null]);

        await createAdminNotification({
          type: 'withdrawal_request',
          source_table: 'withdrawal_requests',
          source_id: null,
          message: `Driver withdrawal request for ₹${amount}`,
          sub: `Pending driver payout`,
          payload: { user_type: 'DRIVER', user_id: driver_id, amount: parseFloat(amount) }
        });

        return res.json({ status: true, message: "Withdrawal request submitted successfully" });

    } catch (error) {
        console.error("driver createWithdrawalRequest error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getDriverWithdrawalHistory = async (req, res) => {
    try {
        const driver_id = req.user.id;
        const { page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const [[{ total }]] = await db.execute(
            `SELECT COUNT(*) AS total FROM withdrawal_requests WHERE user_type = 'DRIVER' AND user_id = ?`,
            [driver_id]
        );

        const [rows] = await db.execute(`
            SELECT w.id, w.amount, w.bank_name, w.account_number, w.ifsc_code, w.account_holder_name, w.upi_id,
                   w.status, w.remarks, w.created_at, w.updated_at,
                   d.full_name AS driver_name, d.phone AS driver_mobile
            FROM withdrawal_requests w
            LEFT JOIN drivers d ON d.id = w.user_id
            WHERE w.user_type = 'DRIVER' AND w.user_id = ?
            ORDER BY w.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, [driver_id]);

        return res.json({
            status: true,
            message: "Withdrawal history fetched successfully",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });

    } catch (error) {
        console.error("getDriverWithdrawalHistory error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

