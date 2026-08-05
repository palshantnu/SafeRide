const db = require("../config/db");
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { notifyDriversByService } = require("../services/notification");
const { createAdminNotification } = require('../services/adminNotification');

exports.createBookingRequest = async (req, res) => {
    try {
        const user_id = req.user.id;
        const {
            service_id, sub_service_id, plan_id,
            pickup_city,drop_city,to_city,pickup_address, drop_address,
            pickup_lat, pickup_lng, drop_lat, drop_lng,
            distance, person, schedule_date
        } = req.body;

        if (!service_id || !pickup_city || !person) {
            return res.status(400).json({
                status: false,
                message: "service_id, pickup_city, person required"
            });
        }

        if (parseInt(service_id) === 1 && !drop_city) {
            return res.status(400).json({ status: false, message: "drop_city is required for In-City service" });
        }

        if (![1, 70].includes(parseInt(service_id)) && !to_city) {
            return res.status(400).json({ status: false, message: "to_city is required for this service" });
        }

        if (parseInt(service_id) === 1) {
            if (!sub_service_id) {
                return res.status(400).json({ status: false, message: "sub_service_id is required for In-City service" });
            }
            if (!distance) {
                return res.status(400).json({ status: false, message: "distance is required for In-City service" });
            }
            if (!pickup_lat || !pickup_lng || !drop_lat || !drop_lng) {
                return res.status(400).json({ status: false, message: "pickup_lat, pickup_lng, drop_lat, drop_lng are required for In-City service" });
            }
        }

        // service validate
        const [[service]] = await db.execute(
            `SELECT id FROM services WHERE id = ? AND status = 1 AND deleted_at IS NULL`,
            [parseInt(service_id)]
        );
        if (!service) return res.status(400).json({ status: false, message: "Invalid service" });
        let subService = null;
        if (parseInt(service_id) === 1) {
            const [[ss]] = await db.execute(
                `SELECT id, fixed_charge, fixed_charge_km, charge_after_fixed_per_km,
                        access_fee, access_fee_type, platform_fee, search_area, driver_min_wallet_balance
                 FROM sub_services
                 WHERE id = ? AND service_id = ? AND status = 1 AND deleted_at IS NULL`,
                [parseInt(sub_service_id), parseInt(service_id)]
            );
            if (!ss) return res.status(400).json({ status: false, message: "Invalid sub-service for this service" });
            subService = ss;
        }

        let formattedDate = null;
        if (schedule_date) {
            formattedDate = moment(schedule_date).format('YYYY-MM-DD HH:mm:ss');
            if (moment(formattedDate).isBefore(moment())) {
                return res.status(400).json({ status: false, message: "Schedule date must be in future" });
            }
        }

        const booking_id = 'BK' + uuidv4().slice(0, 8).toUpperCase();
        const otp        = Math.floor(1000 + Math.random() * 9000);

        if (parseInt(service_id) === 1) {
            const dist        = parseFloat(distance);
            const fixedCharge = parseFloat(subService.fixed_charge || 0);
            const fixedKm     = parseFloat(subService.fixed_charge_km || 0);
            const perKm       = parseFloat(subService.charge_after_fixed_per_km || 0);
            const platformFee = parseFloat(subService.platform_fee || 0);
            const chargeableKm = Math.round(dist);            // round distance to nearest km (6.7 → 7)
            const extraKm     = Math.max(0, chargeableKm - fixedKm);
            const rideFare    = fixedCharge + (extraKm * perKm);
            // access_fee can be a flat amount OR a percentage of the ride fare
            const accessFeeCfg  = parseFloat(subService.access_fee || 0);
            const accessFee     = (subService.access_fee_type === 'percent')
                ? Math.round(rideFare * accessFeeCfg) / 100
                : accessFeeCfg;
            const totalFare   = Math.round(rideFare + accessFee + platformFee);  // round off (114.50 → 115)

            const [result] = await db.execute(`
                INSERT INTO bookings (
                    booking_id, user_id, service_id, sub_service_id,
                    booking_type, status, user_status, driver_status, cancelled_by,
                    pickup_city, drop_city, pickup_address, drop_address,
                    start_lat, start_lng, end_lat, end_lng,
                    distance, total_fare, platform_fee,
                    person, schedule_date, otp, created_at
                ) VALUES (?, ?, ?, ?, ?, 'SEARCHING', 'SEARCHING', 'SEARCHING', 'NONE',
                          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                booking_id, user_id, service_id, sub_service_id,
                formattedDate ? '1' : '0',
                pickup_city, drop_city, pickup_address || null, drop_address || null,
                pickup_lat || null, pickup_lng || null, drop_lat || null, drop_lng || null,
                dist, totalFare.toFixed(2), platformFee.toFixed(2),
                person, formattedDate, otp
            ]);
            await createAdminNotification({
              type: 'booking_new',
              source_table: 'bookings',
              source_id: result.insertId,
              message: `New booking request ${booking_id}`,
              sub: `${pickup_city} → ${drop_city || to_city || 'N/A'}`,
              payload: { booking_id, service_id, sub_service_id }
            });

            // notify all captains registered for this service/sub-service
            await notifyDriversByService(service_id, sub_service_id, "New booking request",
                `New ride request from ${pickup_city}`, { type: "NEW_BOOKING", booking_id });

            return res.json({
                status: true,
                message: "Booking request created (Searching for driver)",
                booking_id,
                fare_breakdown: {
                    distance_km  : dist,
                    fixed_charge : fixedCharge,
                    fixed_km     : fixedKm,
                    extra_km     : extraKm,
                    extra_fare   : (extraKm * perKm).toFixed(2),
                    access_fee   : accessFee,
                    platform_fee : platformFee,
                    total_fare   : totalFare.toFixed(2)
                }
            });
        }

        if (!plan_id) {
            return res.status(400).json({ status: false, message: "plan_id is required for this service" });
        }

        const [[plan]] = await db.execute(
            `SELECT id, plan_price, token_price, topup_price_perkm, sub_service_id,
                    topup_captain_commission, topup_company_commission,
                    plan_captain_commission, plan_company_commission,
                    platform_fee, access_fee
             FROM plans
             WHERE id = ? AND service_id = ? AND status = 1 AND deleted_at IS NULL`,
            [plan_id, service_id]
        );

        if (!plan) return res.status(400).json({ status: false, message: "Invalid plan for selected service" });
        
        const planPrice   = parseFloat(plan.plan_price  || 0);
        const platformFee = parseFloat(plan.platform_fee || 0);
        const accessFee   = parseFloat(plan.access_fee   || 0);
        const tokenAmount = parseFloat(plan.token_price || 0);
        const subservice_id = plan.sub_service_id || null;
        const totalFare   = planPrice + platformFee + accessFee;

        await db.execute(`
            INSERT INTO bookings (
                booking_id, user_id, service_id, sub_service_id, plan_id,
                booking_type, status, user_status, driver_status, cancelled_by,
                pickup_city, drop_city, to_city, pickup_address, drop_address,
                total_fare, platform_fee, token_amount, person, schedule_date, otp, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'SEARCHING', 'SEARCHING', 'SEARCHING', 'NONE',
                      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            booking_id, user_id, service_id, subservice_id || null, plan_id,
            formattedDate ? '1' : '0',
            pickup_city, drop_city || null, to_city || null, pickup_address || null, drop_address || null,
            totalFare.toFixed(2), platformFee.toFixed(2), tokenAmount.toFixed(2),
            person, formattedDate, otp
        ]);

        // notify all captains registered for this service/sub-service
        await notifyDriversByService(service_id, subservice_id, "New booking request",
            `New booking request from ${pickup_city}`, { type: "NEW_BOOKING", booking_id });

        return res.json({
            status: true,
            message: "Booking request created (Searching for captain)",
            booking_id,
            fare_breakdown: {
                plan_price                 : planPrice.toFixed(2),
                platform_fee               : platformFee.toFixed(2),
                access_fee                 : accessFee.toFixed(2),
                total_fare                 : totalFare.toFixed(2),
                token_price                : plan.token_price,
                topup_price_perkm          : plan.topup_price_perkm,
                topup_captain_commission   : plan.topup_captain_commission,
                topup_company_commission   : plan.topup_company_commission,
                plan_captain_commission    : plan.plan_captain_commission,
                plan_company_commission    : plan.plan_company_commission,
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getBookingHistory = async (req, res) => {
    try {
        const { status, service_id, from_date, to_date, search, page, limit } = req.query;

        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page) || 1);
        const offset   = (pageNum - 1) * limitNum;
        const conditions = [];
        const values = [];

        if (status)      { conditions.push(`b.status = ?`);               values.push(status); }
        if (service_id)  { conditions.push(`b.service_id = ?`);           values.push(service_id); }
        if (from_date)   { conditions.push(`DATE(b.created_at) >= ?`);    values.push(from_date); }
        if (to_date)     { conditions.push(`DATE(b.created_at) <= ?`);    values.push(to_date); }

        if (search) {
            conditions.push(`(b.booking_id LIKE ? OR u.name LIKE ? OR u.mobile LIKE ? OR b.pickup_city LIKE ? OR b.drop_city LIKE ?)`);
            const like = `%${search}%`;
            values.push(like, like, like, like, like);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [countRows] = await db.execute(`
            SELECT COUNT(*) AS total FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN drivers d ON b.driver_id = d.id
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN plans p ON b.plan_id = p.id
            ${whereClause}
        `, values);

        const total = countRows[0].total;

        const [rows] = await db.execute(`
            SELECT
                b.id, b.booking_id, b.booking_type,
                b.service_id, b.sub_service_id,
                b.status, b.user_status, b.driver_status,
                b.cancelled_by, b.cancel_reason, b.cancellation_fee,
                b.pickup_city, b.drop_city, b.to_city, b.pickup_address, b.drop_address,
                b.distance, b.total_fare, b.actual_distance, b.actual_fare,
                b.platform_fee, b.access_fee, b.paid, b.payment_mode,
                b.person, b.schedule_date, b.created_at,
                u.id AS user_id, u.name AS user_name, u.mobile AS user_mobile, u.wallet AS user_wallet,
                d.id AS driver_id, d.full_name AS driver_name, d.phone AS driver_mobile, d.wallet AS driver_wallet,
                s.title AS service_name,
                ss.title AS sub_service_name,
                p.plan_name, p.plan_price, p.plan_captain_commission, p.plan_company_commission,
                COALESCE(bt.topup_count, 0)                 AS topup_count,
                COALESCE(bt.topup_paid_amount, 0)            AS topup_paid_amount,
                COALESCE(bt.topup_pending_amount, 0)         AS topup_pending_amount,
                COALESCE(bt.topup_captain_commission, 0)     AS topup_captain_commission,
                COALESCE(bt.topup_company_commission, 0)     AS topup_company_commission
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN drivers d ON b.driver_id = d.id
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN sub_services ss ON ss.id = b.sub_service_id
            LEFT JOIN plans p ON b.plan_id = p.id
            LEFT JOIN (
                SELECT
                    booking_id,
                    COUNT(*) AS topup_count,
                    SUM(CASE WHEN status = 'PAID'    THEN topup_amount       ELSE 0 END) AS topup_paid_amount,
                    SUM(CASE WHEN status = 'PENDING' THEN topup_amount       ELSE 0 END) AS topup_pending_amount,
                    SUM(CASE WHEN status = 'PAID'    THEN captain_commission ELSE 0 END) AS topup_captain_commission,
                    SUM(CASE WHEN status = 'PAID'    THEN company_commission ELSE 0 END) AS topup_company_commission
                FROM booking_topups
                GROUP BY booking_id
            ) bt ON bt.booking_id = b.id
            ${whereClause}
            ORDER BY b.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        // Money split per booking — mirrors the same formulas used at ride-completion time
        // (driverController.completeRide / computeDriverAmount) so the Accounts view matches
        // what was actually deducted from/credited to wallets, rather than re-deriving new numbers.
        const data = rows.map(b => {
            const isInCity = parseInt(b.service_id) === 1;
            const isCancelled = b.status === 'CANCELLED';
            const finalFare = parseFloat(b.actual_fare || b.total_fare || 0);

            let company_amount = 0;
            let captain_amount = 0;

            if (isInCity) {
                company_amount = parseFloat(b.access_fee || 0) + parseFloat(b.platform_fee || 0);
                captain_amount = Math.max(0, finalFare - company_amount);
            } else {
                company_amount = parseFloat(b.plan_company_commission || 0) + parseFloat(b.topup_company_commission || 0);
                captain_amount = parseFloat(b.plan_captain_commission || 0) + parseFloat(b.topup_captain_commission || 0);
            }

            // Wallet impact actually applied in code today: the In-City company cut is deducted
            // from the driver's wallet on completion; a cancellation fee is deducted from whoever
            // cancelled. Plan-based commissions are computed/displayed but never credited to any
            // wallet in the current backend — surfaced as `wallet_impact: null` rather than guessed.
            let wallet_impact = null;
            if (isCancelled && parseFloat(b.cancellation_fee || 0) > 0) {
                wallet_impact = {
                    amount: parseFloat(b.cancellation_fee),
                    target: b.cancelled_by === 'DRIVER' ? 'CAPTAIN' : b.cancelled_by === 'USER' ? 'USER' : null,
                    reason: 'CANCELLATION_FEE',
                };
            } else if (isInCity && !isCancelled && company_amount > 0 && ['WAITING_FOR_PAYMENT', 'PAYMENT_DONE', 'COMPLETED'].includes(b.status)) {
                wallet_impact = { amount: company_amount, target: 'CAPTAIN', reason: 'PLATFORM_COMMISSION' };
            }

            return {
                ...b,
                total_amount: finalFare,
                company_amount: Math.round(company_amount * 100) / 100,
                captain_amount: Math.round(captain_amount * 100) / 100,
                wallet_impact,
            };
        });

        return res.json({
            status: true,
            message: "Booking history fetched successfully",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data
        });

    } catch (error) {
        console.error("getBookingHistory Error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// ─── ADMIN: topup line-items for a single booking (booking_topups.booking_id = bookings.id) ──
exports.getBookingTopups = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.execute(`
            SELECT
                id, booking_id, extra_km, price_per_km, topup_amount,
                captain_commission, company_commission, reason, status,
                payment_mode, topup_otp, otp_verified,
                created_at, paid_at, updated_at
            FROM booking_topups
            WHERE booking_id = ?
            ORDER BY id DESC
        `, [id]);

        return res.json({
            status: true,
            message: "Booking topups fetched successfully",
            total: rows.length,
            data: rows
        });
    } catch (error) {
        console.error("getBookingTopups Error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getPlans = async (req, res) => {
    try {
        const { service_id, sub_service_id } = req.body;

        if (!service_id || !sub_service_id) {
            return res.json({ status: false, message: "service_id and sub_service_id are required" });
        }

        const [plans] = await db.query(`
            SELECT id, service_id, sub_service_id, plan_name, image,
                   plan_hour, plan_km, token_price,
                   topup_price_perkm, topup_captain_commission, topup_company_commission,
                   plan_price, plan_captain_commission, plan_company_commission,
                   platform_fee, access_fee,
                   description, status, booking_destroy_time, created_at
            FROM plans
            WHERE service_id = ? AND sub_service_id = ? AND status = 1 AND deleted_at IS NULL
            ORDER BY id ASC
        `, [service_id, sub_service_id]);

        return res.json({
            status: true,
            message: "Plans fetched successfully",
            total_plan: plans.length,
            data: plans
        });

    } catch (error) {
        console.log("ERROR =>", error);
        return res.status(500).json({ status: false, message: "Server error", error: error.message });
    }
};

// ─── DESTROY BOOKING (In-City / sub_service only) ────────────────────────────
exports.destroyBooking = async (req, res) => {
    try {
        const { booking_id } = req.params;

        const [[booking]] = await db.execute(
            `SELECT id, service_id, sub_service_id, status, cancelled_by
             FROM bookings
             WHERE booking_id = ? AND deleted_at IS NULL`,
            [booking_id]
        );

        if (!booking) {
            return res.status(404).json({ status: false, message: "Booking not found" });
        }
        
        if (parseInt(booking.service_id) !== 1 || !booking.sub_service_id) {
            return res.status(400).json({
                status: false,
                message: "Booking destroy is only allowed for In-City (sub_service) bookings"
            });
        }

        const nonDestroyable = ['COMPLETED', 'CANCELLED'];
        if (nonDestroyable.includes(booking.status)) {
            return res.status(400).json({
                status: false,
                message: `Booking is already ${booking.status.toLowerCase()}`
            });
        }

        await db.execute(
            `UPDATE bookings SET
                status = 'CANCELLED',
                user_status = 'CANCELLED',
                driver_status = 'CANCELLED',
                cancelled_by = 'AUTOMATIC',
                cancel_reason = 'Destroyed by admin',
                deleted_at = NOW(),
                updated_at = NOW()
             WHERE booking_id = ?`,
            [booking_id]
        );

        return res.json({
            status: true,
            message: "In-City booking destroyed successfully",
            booking_id
        });

    } catch (error) {
        console.error("destroyBooking Error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// ─── ADMIN: WITHDRAWAL REQUESTS ───────────────────────────────────────────────
exports.getWithdrawalRequests = async (req, res) => {
    try {
        const { user_type, status, from_date, to_date, search, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 10);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [];
        const values = [];

        if (user_type) { conditions.push(`w.user_type = ?`);           values.push(user_type.toUpperCase()); }
        if (status)    { conditions.push(`w.status = ?`);              values.push(status.toUpperCase()); }
        if (from_date) { conditions.push(`DATE(w.created_at) >= ?`);   values.push(from_date); }
        if (to_date)   { conditions.push(`DATE(w.created_at) <= ?`);   values.push(to_date); }
        if (search) {
            conditions.push(`(u.name LIKE ? OR d.full_name LIKE ? OR u.mobile LIKE ? OR d.phone LIKE ? OR w.account_number LIKE ? OR w.upi_id LIKE ?)`);
            const like = `%${search}%`;
            values.push(like, like, like, like, like, like);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const [[{ total }]] = await db.execute(`
            SELECT COUNT(*) AS total FROM withdrawal_requests w
            LEFT JOIN users u ON w.user_type = 'USER' AND w.user_id = u.id
            LEFT JOIN drivers d ON w.user_type = 'DRIVER' AND w.user_id = d.id
            ${whereClause}
        `, values);

        const [rows] = await db.execute(`
            SELECT
                w.id, w.user_type, w.user_id, w.amount,
                w.bank_name, w.account_number, w.ifsc_code, w.account_holder_name, w.upi_id,
                w.status, w.remarks, w.created_at, w.updated_at,
                u.name        AS user_name,
                u.mobile      AS user_mobile,
                d.full_name   AS driver_name,
                d.phone       AS driver_mobile,
                COALESCE(u.wallet, d.wallet) AS wallet_balance
            FROM withdrawal_requests w
            LEFT JOIN users u ON w.user_type = 'USER' AND w.user_id = u.id
            LEFT JOIN drivers d ON w.user_type = 'DRIVER' AND w.user_id = d.id
            ${whereClause}
            ORDER BY w.id DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        return res.json({
            status: true,
            message: "Withdrawal requests fetched successfully",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: rows
        });

    } catch (error) {
        console.error("getWithdrawalRequests Error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.getBookingRejections = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                br.id,
                br.booking_id,
                br.driver_id,
                br.ba_id,
                br.created_at AS rejected_at,
                br.updated_at AS updated_at,
                b.booking_id AS booking_ref,
                b.service_id,
                b.status AS booking_status,
                d.full_name AS driver_name,
                d.phone AS driver_phone,
                ba.ba_name AS ba_name,
                ba.ba_mobile AS ba_mobile
            FROM booking_rejections br
            LEFT JOIN bookings b ON b.id = br.booking_id
            LEFT JOIN drivers d ON d.id = br.driver_id
            LEFT JOIN business_associates ba ON ba.id = br.ba_id
            ORDER BY br.id DESC
            LIMIT 200
        `);

        const data = rows.map(row => ({
            ...row,
            rejected_by_type: row.driver_id ? 'DRIVER' : 'BA',
            rejected_by_name: row.driver_id ? row.driver_name : row.ba_name,
        }));

        return res.json({ status: true, message: 'Booking rejections fetched successfully', total: data.length, data });
    } catch (error) {
        console.error('getBookingRejections Error:', error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

exports.updateWithdrawalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        const allowedStatuses = ['APPROVED', 'REJECTED'];
        if (!status || !allowedStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({ status: false, message: "status must be APPROVED or REJECTED" });
        }

        const [[wr]] = await db.execute(`SELECT * FROM withdrawal_requests WHERE id = ?`, [id]);
        if (!wr) return res.status(404).json({ status: false, message: "Withdrawal request not found" });

        if (wr.status !== 'PENDING') {
            return res.status(400).json({ status: false, message: `Request is already ${wr.status}` });
        }

        const newStatus = status.toUpperCase();

        if (newStatus === 'APPROVED') {
            const walletTable = wr.user_type === 'USER' ? 'users' : 'drivers';
            const walletCol   = 'wallet';
            const [[entity]] = await db.execute(`SELECT ${walletCol} FROM ${walletTable} WHERE id = ?`, [wr.user_id]);

            if (!entity || parseFloat(entity[walletCol]) < parseFloat(wr.amount)) {
                return res.status(400).json({ status: false, message: "Insufficient balance to approve" });
            }

            await db.execute(
                `UPDATE ${walletTable} SET ${walletCol} = ${walletCol} - ? WHERE id = ?`,
                [parseFloat(wr.amount), wr.user_id]
            );
        }

        await db.execute(
            `UPDATE withdrawal_requests SET status = ?, remarks = ?, updated_at = NOW() WHERE id = ?`,
            [newStatus, remarks || null, id]
        );

        return res.json({
            status: true,
            message: `Withdrawal request ${newStatus.toLowerCase()} successfully`,
            id: parseInt(id),
            new_status: newStatus
        });

    } catch (error) {
        console.error("updateWithdrawalStatus Error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};
