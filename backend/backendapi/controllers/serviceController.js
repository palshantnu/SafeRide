const db = require('../config/db');
const path = require('path');
const fs = require('fs');

exports.createService = async (req, res) => {
  try {
    const { title, description, position, status } = req.body;
    const image  = req.files?.image?.[0]?.filename  || null;
    const banner = req.files?.banner?.[0]?.filename || null;
    console.log("DATA →", { title, description, position, status, image, banner });

    if (!title) {
      return res.status(400).json({ status: false, error: "Title is required" });
    }

    const [result] = await db.query(
      `INSERT INTO services (title, image, banner, description, position, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        title,
        image,
        banner,
        description || null,
        position    || null,
        status      ?? 1,
      ]
    );

    const [created] = await db.query(
      "SELECT * FROM services WHERE id = ?", [result.insertId]
    );

    res.status(201).json({ status: true, message: "Service created", data: created[0] });

  } catch (err) {
    console.error("❌ createService crash:", err.message);
    console.error("❌ FULL ERROR:", err);
    res.status(500).json({ status: false, error: err.message });
  }
};

exports.getAllServices = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM services WHERE deleted_at IS NULL ORDER BY position ASC, id ASC`
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
};


exports.softDelete = async (req, res) => {
    const table = req.params.type === 'service' ? 'services' : 'sub_services';
    try {
        await db.query(`UPDATE ${table} SET deleted_at = NOW(), status = 0 WHERE id = ?`, [req.params.id]);
        res.json({ message: `${req.params.type} deleted successfully` });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

//---------------------------------------------------------||------------------------------------------------------//
exports.getServiceDocuments = async (req, res) => {
  try {
    const driverId = req.user.id;
    const [drivers] = await db.query(
      "SELECT service_id FROM drivers WHERE id = ?",
      [driverId]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }
    const service_id = drivers[0].service_id;
    const [documents] = await db.query(
      `SELECT id, service_id, document_type, created_at
       FROM service_document
       WHERE service_id = ?
       ORDER BY id DESC`,
      [service_id]
    );

    return res.status(200).json({
      success: true,
      data: documents,
    });

  } catch (error) {
    console.error("❌ ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
exports.getServiceById = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM services WHERE id = ? AND deleted_at IS NULL",
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ status: false, error: "Service nahi mila" });
    }
    res.json({ status: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, position, status,
      user_cancel_before48_type,user_cancel_before48_amount,
      user_cancel_24to48_type,user_cancel_24to48_amount,
      user_cancel_0to24_type,user_cancel_0to24_amount,
      driver_cancel_before48_type,driver_cancel_before48_amount,
      driver_cancel_24to48_type,driver_cancel_24to48_amount,
      driver_cancel_0to24_type,driver_cancel_0to24_amount,
    } = req.body;
    const image  = req.files?.image?.[0]?.filename || req.body.image || null;
    const banner = req.files?.banner?.[0]?.filename || req.body.banner || null;

    const [rows] = await db.query(
      "SELECT * FROM services WHERE id = ? AND deleted_at IS NULL", [id]
    );

    if (!rows.length) {
      return res.status(404).json({ status: false, error: "Service not found" });
    }
    const old = rows[0];
    const finalImage  = image  ?? old.image;
    const finalBanner = banner ?? old.banner;
    const val     = (v, fallback) => (v !== undefined && v !== '') ? v : fallback;
    const enumVal = (v, fallback) => ['flat','percent'].includes((v || '').toLowerCase().trim())
      ? v.toLowerCase().trim()
      : (fallback ?? null);
    const CANCEL_POLICY_SERVICE_IDS = [72, 73];
    const allowCancelPolicy = CANCEL_POLICY_SERVICE_IDS.includes(Number(id));
    if (allowCancelPolicy) {
      await db.query(
        `UPDATE services SET
          title=?, image=?, banner=?, description=?, position=?, status=?,
          user_cancel_before48_type = ?, user_cancel_before48_amount = ?,
          user_cancel_24to48_type = ?,   user_cancel_24to48_amount = ?,
          user_cancel_0to24_type = ?,    user_cancel_0to24_amount = ?,
          driver_cancel_before48_type = ?, driver_cancel_before48_amount = ?,
          driver_cancel_24to48_type = ?,   driver_cancel_24to48_amount = ?,
          driver_cancel_0to24_type = ?,    driver_cancel_0to24_amount = ?,
          updated_at=NOW()
         WHERE id=?`,
        [
          title,
          finalImage,
          finalBanner,
          description || null,
          position    || null,
          status      ?? 1,
          enumVal(user_cancel_before48_type,   old.user_cancel_before48_type),
          val(user_cancel_before48_amount,     old.user_cancel_before48_amount),
          enumVal(user_cancel_24to48_type,     old.user_cancel_24to48_type),
          val(user_cancel_24to48_amount,       old.user_cancel_24to48_amount),
          enumVal(user_cancel_0to24_type,      old.user_cancel_0to24_type),
          val(user_cancel_0to24_amount,        old.user_cancel_0to24_amount),
          enumVal(driver_cancel_before48_type, old.driver_cancel_before48_type),
          val(driver_cancel_before48_amount,   old.driver_cancel_before48_amount),
          enumVal(driver_cancel_24to48_type,   old.driver_cancel_24to48_type),
          val(driver_cancel_24to48_amount,     old.driver_cancel_24to48_amount),
          enumVal(driver_cancel_0to24_type,    old.driver_cancel_0to24_type),
          val(driver_cancel_0to24_amount,      old.driver_cancel_0to24_amount),
          id,
        ]
      );
    } else {
      await db.query(
        `UPDATE services SET
          title=?, image=?, banner=?, description=?, position=?, status=?, updated_at=NOW()
         WHERE id=?`,
        [
          title,
          finalImage,
          finalBanner,
          description || null,
          position    || null,
          status      ?? 1,
          id,
        ]
      );
    }
    const [updated] = await db.query("SELECT * FROM services WHERE id = ?", [id]);
    res.json({ status: true, message: "Service updated", data: updated[0] });

  } catch (err) {
    console.error("❌ updateService crash:", err);
    res.status(500).json({ status: false, error: err.message });
  }
};

exports.toggleServiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
 
    if (status === undefined || ![0, 1].includes(Number(status))) {
      return res.status(400).json({ status: false, error: "Status 0 or 1 required" });
    }
 
    const [existing] = await db.query(
      "SELECT id FROM services WHERE id = ? AND deleted_at IS NULL",
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ status: false, error: "Service not found" });
    }
 
    await db.query(
      "UPDATE services SET status = ?, updated_at = NOW() WHERE id = ?",
      [Number(status), id]
    );
 
    res.json({
      status: true,
      message: `Service ${Number(status) === 1 ? "activate" : "deactivate"} ho gaya`,
      data: { id: Number(id), status: Number(status) },
    });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === 1) {
      return res.status(403).json({ status: false, message: "This service is protected and cannot be deleted." });
    }

    const [existing] = await db.query(
      "SELECT id FROM services WHERE id = ? AND deleted_at IS NULL",
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({ status: false, error: "Service not found" });
    }

    await db.query(
      "UPDATE services SET deleted_at = NOW() WHERE id = ?",
      [id]
    );
 
    res.json({ status: true, message: "Service Delete Successfully", data: { id: Number(id) } });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
};

//-----------------------------------------------------|sub-service|------------------------------------------------------------------//
exports.getAllSubServices = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
          ss.id, ss.service_id, ss.title, ss.image, ss.description, ss.status,
          ss.driver_min_wallet_balance, ss.search_area,
          ss.fixed_charge, ss.fixed_charge_km, ss.charge_after_fixed_per_km,
          ss.access_fee, ss.access_fee_type, ss.platform_fee,
          ss.user_cancel_before48_type, ss.user_cancel_before48_amount,
          ss.user_cancel_24to48_type,   ss.user_cancel_24to48_amount,
          ss.user_cancel_0to24_type,    ss.user_cancel_0to24_amount,
          ss.driver_cancel_before48_type, ss.driver_cancel_before48_amount,
          ss.driver_cancel_24to48_type,   ss.driver_cancel_24to48_amount,
          ss.driver_cancel_0to24_type,    ss.driver_cancel_0to24_amount,
          ss.booking_destroy_min, ss.position,
          ss.created_at, ss.updated_at,
          s.title AS service_title
       FROM sub_services ss
       LEFT JOIN services s ON s.id = ss.service_id
       WHERE ss.deleted_at IS NULL
       ORDER BY ss.position IS NULL, ss.position ASC, ss.id ASC`
    );
    res.json({ status: "success", data: rows });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
};

exports.createSubService = async (req, res) => {
  try {
    const {
      service_id, title, description, status,
      driver_min_wallet_balance, search_area,
      fixed_charge, fixed_charge_km, charge_after_fixed_per_km,
      access_fee, access_fee_type, platform_fee,
      user_cancel_before48_type, user_cancel_before48_amount,
      user_cancel_24to48_type,   user_cancel_24to48_amount,
      user_cancel_0to24_type,    user_cancel_0to24_amount,
      driver_cancel_before48_type, driver_cancel_before48_amount,
      driver_cancel_24to48_type,   driver_cancel_24to48_amount,
      driver_cancel_0to24_type,    driver_cancel_0to24_amount,
      booking_destroy_min, position
    } = req.body;

    if (!service_id) return res.status(400).json({ status: "error", message: "service_id is required" });
    if (!title)      return res.status(400).json({ status: "error", message: "title is required" });

    const image = req.files?.image?.[0]?.filename || null;
    const values = [
        service_id, title, image, description || null, status ?? 1,
        driver_min_wallet_balance !== '' ? (driver_min_wallet_balance || null) : null,
        search_area !== '' ? (search_area || null) : null,
        fixed_charge !== '' ? (fixed_charge || null) : null,
        fixed_charge_km !== '' ? (fixed_charge_km || null) : null,
        charge_after_fixed_per_km !== '' ? (charge_after_fixed_per_km || null) : null,
        access_fee !== '' ? (access_fee || null) : null,
        (['flat','percent'].includes(access_fee_type) ? access_fee_type : 'flat'),
        platform_fee !== '' ? (platform_fee || null) : null,
        (['flat','percent'].includes(user_cancel_before48_type) ? user_cancel_before48_type : 'flat'), (user_cancel_before48_amount !== '' ? parseFloat(user_cancel_before48_amount) || 0 : 0),
        (['flat','percent'].includes(user_cancel_24to48_type)   ? user_cancel_24to48_type   : 'flat'), (user_cancel_24to48_amount   !== '' ? parseFloat(user_cancel_24to48_amount)   || 0 : 0),
        (['flat','percent'].includes(user_cancel_0to24_type)    ? user_cancel_0to24_type    : 'flat'), (user_cancel_0to24_amount    !== '' ? parseFloat(user_cancel_0to24_amount)    || 0 : 0),
        (['flat','percent'].includes(driver_cancel_before48_type) ? driver_cancel_before48_type : 'flat'), (driver_cancel_before48_amount !== '' ? parseFloat(driver_cancel_before48_amount) || 0 : 0),
        (['flat','percent'].includes(driver_cancel_24to48_type)   ? driver_cancel_24to48_type   : 'flat'), (driver_cancel_24to48_amount   !== '' ? parseFloat(driver_cancel_24to48_amount)   || 0 : 0),
        (['flat','percent'].includes(driver_cancel_0to24_type)    ? driver_cancel_0to24_type    : 'flat'), (driver_cancel_0to24_amount    !== '' ? parseFloat(driver_cancel_0to24_amount)    || 0 : 0),
        booking_destroy_min !== '' ? (booking_destroy_min || null) : null,
        position !== '' ? (position || null) : null
    ];
    const [result] = await db.query(
      `INSERT INTO sub_services
        (service_id, title, image, description, status,
         driver_min_wallet_balance, search_area,
         fixed_charge, fixed_charge_km, charge_after_fixed_per_km,
         access_fee, access_fee_type, platform_fee,
         user_cancel_before48_type, user_cancel_before48_amount,
         user_cancel_24to48_type,   user_cancel_24to48_amount,
         user_cancel_0to24_type,    user_cancel_0to24_amount,
         driver_cancel_before48_type, driver_cancel_before48_amount,
         driver_cancel_24to48_type,   driver_cancel_24to48_amount,
         driver_cancel_0to24_type,    driver_cancel_0to24_amount,
         booking_destroy_min, position,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      values
    );

    res.status(201).json({ status: "success", message: "Sub service created", id: result.insertId });
  } catch (err) {
    console.error("❌ createSubService ERROR →", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
};

exports.updateSubService = async (req, res) => {
  try {
    const {
      service_id, title, description, status,
      driver_min_wallet_balance, search_area,
      fixed_charge, fixed_charge_km, charge_after_fixed_per_km,
      access_fee, access_fee_type, platform_fee,
      user_cancel_before48_type, user_cancel_before48_amount,
      user_cancel_24to48_type,   user_cancel_24to48_amount,
      user_cancel_0to24_type,    user_cancel_0to24_amount,
      driver_cancel_before48_type, driver_cancel_before48_amount,
      driver_cancel_24to48_type,   driver_cancel_24to48_amount,
      driver_cancel_0to24_type,    driver_cancel_0to24_amount,
      booking_destroy_min, position
    } = req.body;

    const id = req.params.id;
    const [existing] = await db.query(`SELECT * FROM sub_services WHERE id = ?`, [id]);
    if (!existing.length) return res.status(404).json({ status: "error", message: "Not found" });
    const old = existing[0];
    const image = req.files?.image?.[0]?.filename ?? old.image;
    const val = (v, fallback) => (v !== undefined && v !== '') ? v : fallback;
    const enumVal = (v, fallback) => ['flat','percent'].includes((v || '').toLowerCase().trim()) ? (v).toLowerCase().trim() : (fallback || 'flat');

    await db.query(
      `UPDATE sub_services SET
        service_id = ?, title = ?, image = ?, description = ?, status = ?,
        driver_min_wallet_balance = ?, search_area = ?,
        fixed_charge = ?, fixed_charge_km = ?, charge_after_fixed_per_km = ?,
        access_fee = ?, access_fee_type = ?, platform_fee = ?,
        user_cancel_before48_type = ?, user_cancel_before48_amount = ?,
        user_cancel_24to48_type = ?,   user_cancel_24to48_amount = ?,
        user_cancel_0to24_type = ?,    user_cancel_0to24_amount = ?,
        driver_cancel_before48_type = ?, driver_cancel_before48_amount = ?,
        driver_cancel_24to48_type = ?,   driver_cancel_24to48_amount = ?,
        driver_cancel_0to24_type = ?,    driver_cancel_0to24_amount = ?,
        booking_destroy_min = ?, position = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        val(service_id, old.service_id),
        val(title, old.title),
        image,
        val(description, old.description),
        val(status, old.status),
        val(driver_min_wallet_balance, old.driver_min_wallet_balance),
        val(search_area, old.search_area),
        val(fixed_charge, old.fixed_charge),
        val(fixed_charge_km, old.fixed_charge_km),
        val(charge_after_fixed_per_km, old.charge_after_fixed_per_km),
        val(access_fee, old.access_fee),
        enumVal(access_fee_type, old.access_fee_type),
        val(platform_fee, old.platform_fee),
        enumVal(user_cancel_before48_type,   old.user_cancel_before48_type),
        val(user_cancel_before48_amount, old.user_cancel_before48_amount),
        enumVal(user_cancel_24to48_type,     old.user_cancel_24to48_type),
        val(user_cancel_24to48_amount,   old.user_cancel_24to48_amount),
        enumVal(user_cancel_0to24_type,      old.user_cancel_0to24_type),
        val(user_cancel_0to24_amount,    old.user_cancel_0to24_amount),
        enumVal(driver_cancel_before48_type,   old.driver_cancel_before48_type),
        val(driver_cancel_before48_amount, old.driver_cancel_before48_amount),
        enumVal(driver_cancel_24to48_type,     old.driver_cancel_24to48_type),
        val(driver_cancel_24to48_amount,   old.driver_cancel_24to48_amount),
        enumVal(driver_cancel_0to24_type,      old.driver_cancel_0to24_type),
        val(driver_cancel_0to24_amount,    old.driver_cancel_0to24_amount),
        val(booking_destroy_min, old.booking_destroy_min),
        val(position, old.position),
        id
      ]
    );

    const [[updated]] = await db.query(`SELECT * FROM sub_services WHERE id = ?`, [id]);
    res.json({ status: "success", message: "Updated", data: updated });

  } catch (err) {
    console.error("❌ updateSubService ERROR →", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
};

exports.getSubByServiceId = async (req, res) => {
    try {
        const [rows] = await db.query(
          `SELECT
              id, service_id, title, image, description, status,
              driver_min_wallet_balance, search_area,
              fixed_charge, fixed_charge_km, charge_after_fixed_per_km,
              access_fee, access_fee_type, platform_fee,
              user_cancel_before48_type, user_cancel_before48_amount,
              user_cancel_24to48_type,   user_cancel_24to48_amount,
              user_cancel_0to24_type,    user_cancel_0to24_amount,
              driver_cancel_before48_type, driver_cancel_before48_amount,
              driver_cancel_24to48_type,   driver_cancel_24to48_amount,
              driver_cancel_0to24_type,    driver_cancel_0to24_amount,
              booking_destroy_min, position,
              created_at, updated_at
           FROM sub_services
           WHERE service_id = ? AND status = 1 AND deleted_at IS NULL
           ORDER BY position IS NULL, position ASC, id ASC`,
          [req.params.id]
        );
        res.json({ status: true, data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteSubService = async (req, res) => {
  try {
    const [existing] = await db.query(`SELECT id FROM sub_services WHERE id = ? AND deleted_at IS NULL`, [req.params.id]);
    if (!existing.length) return res.status(404).json({ status: "error", message: "Not found" });
    await db.query(
      `UPDATE sub_services SET deleted_at = NOW() WHERE id = ?`,
      [req.params.id]
    );
    res.json({ status: "success", message: "Sub service deleted" });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
};

exports.toggleSubServiceStatus = async (req, res) => {
  try {
    const [existing] = await db.query(
      `SELECT id, status FROM sub_services WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ status: "error", message: "Not found" });
 
    const newStatus = existing[0].status === 1 ? 0 : 1;
 
    await db.query(
      `UPDATE sub_services SET status = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, req.params.id]
    );
 
    res.json({ status: "success", message: `Status updated`, data: { status: newStatus } });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
};

//--------------------------------------------|ServiceDocumentType|-----------------------------------------------//
exports.getAllServiceDocuments = async (req, res) => {
  try {
    const { service_id } = req.query;
 
    let query = `
      SELECT 
        sd.id,
        sd.service_id,
        sd.document_type,
        sd.created_at,
        s.title AS service_title
      FROM service_document sd
      LEFT JOIN services s ON s.id = sd.service_id
    `;
    const params = [];
 
    if (service_id) {
      query += ` WHERE sd.service_id = ?`;
      params.push(service_id);
    }
 
    query += ` ORDER BY sd.id DESC`;
 
    const [rows] = await db.query(query, params);
    res.json({ status: true, data: rows });
  } catch (err) {
    console.error("❌ getAllServiceDocuments:", err.message);
    res.status(500).json({ status: false, error: err.message });
  }
};
 
// ──---------------------------------------------------------- GET BY ID ────────────────────────────────────────────────────────────────
exports.getServiceDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT sd.*, s.title AS service_title
       FROM service_document sd
       LEFT JOIN services s ON s.id = sd.service_id
       WHERE sd.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ status: false, error: "Document not found" });
    }
    res.json({ status: true, data: rows[0] });
  } catch (err) {
    console.error("❌ getServiceDocumentById:", err.message);
    res.status(500).json({ status: false, error: err.message });
  }
};
 
// ── CREATE ───────────────────────────────────────────────────────────────────

exports.createServiceDocument = async (req, res) => {
  console.log("=== createServiceDocument HIT ===");
  console.log("BODY →", req.body);
  try {
    const { service_id, document_type } = req.body;
 
    // Validation
    if (!service_id) {
      return res.status(400).json({ status: false, error: "service_id is required" });
    }
    if (!document_type) {
      return res.status(400).json({ status: false, error: "document_type is required" });
    }
 
    // Check service exists
    const [svc] = await db.query(
      "SELECT id FROM services WHERE id = ? AND deleted_at IS NULL",
      [service_id]
    );
    if (!svc.length) {
      return res.status(404).json({ status: false, error: "Service not found" });
    }
 
    // Check duplicate
    const [existing] = await db.query(
      "SELECT id FROM service_document WHERE service_id = ? AND document_type = ?",
      [service_id, document_type]
    );
    if (existing.length) {
      return res.status(409).json({
        status: false,
        error: `"${document_type}" document already exists for this service`,
      });
    }
 
    const [result] = await db.query(
      `INSERT INTO service_document (service_id, document_type, created_at)
       VALUES (?, ?, NOW())`,
      [service_id, document_type]
    );
 
    const [created] = await db.query(
      `SELECT sd.*, s.title AS service_title
       FROM service_document sd
       LEFT JOIN services s ON s.id = sd.service_id
       WHERE sd.id = ?`,
      [result.insertId]
    );
 
    res.status(201).json({
      status: true,
      message: "Service document created successfully",
      data: created[0],
    });
  } catch (err) {
    console.error("❌ createServiceDocument crash:", err.message);
    res.status(500).json({ status: false, error: err.message });
  }
};
 
// ── UPDATE ───────────────────────────────────────────────────────────────────

exports.updateServiceDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { service_id, document_type } = req.body;

    if (!service_id)    return res.status(400).json({ status: false, error: "service_id is required" });
    if (!document_type) return res.status(400).json({ status: false, error: "document_type is required" });

    const [rows] = await db.query(
      "SELECT id FROM service_document WHERE id = ?", [id]
    );
    if (!rows.length) return res.status(404).json({ status: false, error: "Document not found" });

    const [dup] = await db.query(
      "SELECT id FROM service_document WHERE service_id = ? AND document_type = ? AND id != ?",
      [service_id, document_type, id]
    );

    if (dup.length) {
      return res.status(200).json({
        status: false,
        message: `"${document_type}" document already added for this service`,
      });
    }

    await db.query(
      `UPDATE service_document SET service_id = ?, document_type = ? WHERE id = ?`,
      [service_id, document_type, id]
    );

    const [updated] = await db.query(
      `SELECT sd.*, s.title AS service_title
       FROM service_document sd
       LEFT JOIN services s ON s.id = sd.service_id
       WHERE sd.id = ?`, [id]
    );

    res.json({ status: true, message: "Document updated successfully", data: updated[0] });
  } catch (err) {
    console.error("❌ updateServiceDocument:", err.message);
    res.status(500).json({ status: false, error: err.message });
  }
};
 
// ──------------------------------------------------------------------DELETE ───────────────────────────────────────────────────────────────────
exports.deleteServiceDocument = async (req, res) => {
  try {
    const { id } = req.params;
 
    const [rows] = await db.query(
      "SELECT id FROM service_document WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ status: false, error: "Document not found" });
    }

    await db.query("DELETE FROM service_document WHERE id = ?", [id]);

    res.json({
      status: true,
      message: "Service document deleted successfully",
    });
  } catch (err) {
    console.error("❌ deleteServiceDocument crash:", err.message);
    res.status(500).json({ status: false, error: err.message });
  }
};
//------------------------------------------------------------Plan-------------------------------------------------------//
exports.getAllPlans = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM plans WHERE deleted_at IS NULL ORDER BY id DESC`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('getAllPlans:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
// ─── GET PLANS BY SUB SERVICE ─────────────────────────────────────────────────
exports.getPlansBySubService = async (req, res) => {
  try {
    const { service_id, sub_service_id } = req.params;
    const [[subService]] = await db.query(
      `SELECT
          ss.id,
          ss.title,
          ss.image,
          ss.description,
          ss.service_id,
          ss.driver_min_wallet_balance,
          ss.search_area,
          ss.fixed_charge,
          ss.fixed_charge_km,
          ss.charge_after_fixed_per_km,
          ss.access_fee,
          ss.platform_fee,
          ss.user_cancel_before48_type, ss.user_cancel_before48_amount,
          ss.user_cancel_24to48_type,   ss.user_cancel_24to48_amount,
          ss.user_cancel_0to24_type,    ss.user_cancel_0to24_amount,
          ss.driver_cancel_before48_type, ss.driver_cancel_before48_amount,
          ss.driver_cancel_24to48_type,   ss.driver_cancel_24to48_amount,
          ss.driver_cancel_0to24_type,    ss.driver_cancel_0to24_amount,
          s.title AS service_title
       FROM sub_services ss
       LEFT JOIN services s
         ON s.id = ss.service_id
       WHERE ss.id = ?
         AND ss.service_id = ?
         AND ss.deleted_at IS NULL
         AND ss.status = 1`,
      [sub_service_id, service_id]
    );

    if (!subService) {
      return res.status(404).json({
        status: false,
        message: "Service or Sub-service not found"
      });
    }

    const [plans] = await db.query(
      `SELECT
          id,
          service_id,
          sub_service_id,
          plan_name,
          image,
          plan_hour,
          plan_km,
          token_price,
          plan_price,
          topup_price_perkm,
          topup_captain_commission,
          topup_company_commission,
          plan_captain_commission,
          plan_company_commission,
          platform_fee,
          access_fee,
          access_fee_type,
          driver_amount,
          booking_destroy_time,
          description,
          status,
          created_at,
          updated_at
       FROM plans
       WHERE service_id = ?
         AND sub_service_id = ?
         AND deleted_at IS NULL
         AND status = 1
       ORDER BY id ASC`,
      [service_id, sub_service_id]
    );

    return res.status(200).json({
      status: true,
      message: "Plans fetched successfully",
      service: {
        id: subService.service_id,
        title: subService.service_title
      },
      sub_service: subService,
      total: plans.length,
      data: plans
    });

  } catch (err) {

    console.error("Get Plans Error:", err);

    return res.status(500).json({
      status: false,
      message: "Server error",
      error: err.message
    });

  }
};

// ─── GET PLAN BY ID ───────────────────────────────────────────────────────────
exports.getPlanById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM plans WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getPlanById:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
// ─── CREATE PLAN ──────────────────────────────────────────────────────────────
exports.createPlan = async (req, res) => {
  try {
    const {
      service_id, sub_service_id, plan_name, plan_hour,
      plan_km, token_price, topup_price_perkm,
      topup_captain_commission, topup_company_commission,
      plan_price, plan_captain_commission, plan_company_commission,
      platform_fee, access_fee, access_fee_type,
      description, status, booking_destroy_time,
    } = req.body;

    if (!plan_name) {
      return res.status(400).json({ success: false, message: 'plan_name is required' });
    }
    if (!plan_price) {
      return res.status(400).json({ success: false, message: 'plan_price is required' });
    }

    const image = req.file ? req.file.filename : null;
    const enumVal = (v) => ['flat', 'percent'].includes((v || '').toLowerCase().trim()) ? (v).toLowerCase().trim() : 'flat';

    const [result] = await db.query(
      `INSERT INTO plans
        (service_id, sub_service_id, plan_name, image, plan_hour, plan_km,
         token_price, topup_price_perkm, topup_captain_commission, topup_company_commission,
         plan_price, plan_captain_commission, plan_company_commission,
         platform_fee, access_fee, access_fee_type,
         description, status, booking_destroy_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        service_id                 || null,
        sub_service_id             || null,
        plan_name,
        image,
        plan_hour                  || null,
        plan_km                    || null,
        token_price                || null,
        topup_price_perkm          || null,
        topup_captain_commission   || null,
        topup_company_commission   || null,
        plan_price,
        plan_captain_commission    || null,
        plan_company_commission    || null,
        platform_fee               || null,
        access_fee                 || null,
        enumVal(access_fee_type),
        description                || null,
        status                     ?? 1,
        booking_destroy_time       || null,
      ]
    );

    const [newPlan] = await db.query(`SELECT * FROM plans WHERE id = ?`, [result.insertId]);
    res.status(201).json({ success: true, message: 'Plan created', data: newPlan[0] });
  } catch (err) {
    console.error('createPlan:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
// ─── UPDATE PLAN ──────────────────────────────────────────────────────────────
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      `SELECT * FROM plans WHERE id = ? AND deleted_at IS NULL`, [id]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Plan not found' });

    const {
      service_id, sub_service_id, plan_name, plan_hour,
      plan_km, token_price, topup_price_perkm,
      topup_captain_commission, topup_company_commission,
      plan_price, plan_captain_commission, plan_company_commission,
      platform_fee, access_fee, access_fee_type,
      description, status, booking_destroy_time,
    } = req.body;

    let image = existing[0].image;
    if (req.file) {
      if (image) {
        const oldPath = path.join('uploads/plans', image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image = req.file.filename;
    }

    const enumVal = (v, fallback) => ['flat', 'percent'].includes((v || '').toLowerCase().trim()) ? (v).toLowerCase().trim() : (fallback || 'flat');

    await db.query(
      `UPDATE plans SET
        service_id = ?, sub_service_id = ?, plan_name = ?, image = ?,
        plan_hour = ?, plan_km = ?, token_price = ?,
        topup_price_perkm = ?, topup_captain_commission = ?, topup_company_commission = ?,
        plan_price = ?, plan_captain_commission = ?, plan_company_commission = ?,
        platform_fee = ?, access_fee = ?, access_fee_type = ?,
        description = ?, status = ?, booking_destroy_time = ?
       WHERE id = ?`,
      [
        service_id                ?? existing[0].service_id,
        sub_service_id            ?? existing[0].sub_service_id,
        plan_name                 || existing[0].plan_name,
        image,
        plan_hour                 ?? existing[0].plan_hour,
        plan_km                   ?? existing[0].plan_km,
        token_price               ?? existing[0].token_price,
        topup_price_perkm         ?? existing[0].topup_price_perkm,
        topup_captain_commission  ?? existing[0].topup_captain_commission,
        topup_company_commission  ?? existing[0].topup_company_commission,
        plan_price                ?? existing[0].plan_price,
        plan_captain_commission   ?? existing[0].plan_captain_commission,
        plan_company_commission   ?? existing[0].plan_company_commission,
        platform_fee              ?? existing[0].platform_fee,
        access_fee                ?? existing[0].access_fee,
        enumVal(access_fee_type, existing[0].access_fee_type),
        description               ?? existing[0].description,
        status                    ?? existing[0].status,
        booking_destroy_time      ?? existing[0].booking_destroy_time,
        id,
      ]
    );

    const [updated] = await db.query(`SELECT * FROM plans WHERE id = ?`, [id]);
    res.status(200).json({ success: true, message: 'Plan updated', data: updated[0] });
  } catch (err) {
    console.error('updatePlan:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
// ─── DELETE PLAN (soft delete) ────────────────────────────────────────────────
exports.deletePlan = async (req, res) => {
  try {
    const [existing] = await db.query(
      `SELECT id FROM plans WHERE id = ? AND deleted_at IS NULL`, [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Plan not found' });
 
    await db.query(
      `UPDATE plans SET deleted_at = NOW() WHERE id = ?`, [req.params.id]
    );
    res.status(200).json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    console.error('deletePlan:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
 
// ─── TOGGLE STATUS ────────────────────────────────────────────────────────────
exports.togglePlanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;   // frontend sends already-toggled value
 
    const [existing] = await db.query(
      `SELECT id FROM plans WHERE id = ? AND deleted_at IS NULL`, [id]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Plan not found' });
 
    await db.query(`UPDATE plans SET status = ? WHERE id = ?`, [status, id]);
 
    const [updated] = await db.query(`SELECT * FROM plans WHERE id = ?`, [id]);
    res.status(200).json({ success: true, message: 'Status updated', data: updated[0] });
  } catch (err) {
    console.error('togglePlanStatus:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

