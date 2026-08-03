const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createAdminNotification } = require('../services/adminNotification');

exports.register = async (req, res) => {
  const { name, email,password,role } = req.body;
  const hash = await bcrypt.hash(String(password), 10);
  await db.query(
    "INSERT INTO users (name, email, password,role) VALUES (?, ?, ?,?)",
    [name, email,hash,role]
  );
  res.json({ message: "User Registered" });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const [user] = await db.query("SELECT * FROM users WHERE email=?", [email]);

  if (user.length === 0)
    return res.status(400).json({ msg: "User not found" });

  const isMatch = await bcrypt.compare(password, user[0].password);

  if (!isMatch)
    return res.status(400).json({ msg: "Wrong password" });

  const token = jwt.sign({ id: user[0].id }, process.env.JWT_SECRET);

  res.json({ token });
};

exports.getUsers = async (req, res) => {
  const [users] = await db.query("SELECT id,name,email FROM users");
  res.json(users);
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, role, status } = req.body;

    const [existing] = await db.query("SELECT id FROM users WHERE id = ?", [id]);
    if (!existing.length) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    const normalizedStatus = Number(status);
    const normalizedRole = role || 'user';

    await db.query(
      `UPDATE users SET name = ?, email = ?, mobile = ?, role = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [name ?? null, email ?? null, mobile ?? null, normalizedRole, Number.isNaN(normalizedStatus) ? 1 : normalizedStatus, id]
    );

    return res.json({ status: true, message: 'User updated successfully' });
  } catch (error) {
    return res.status(500).json({ status: false, message: 'Server error', error: error.message });
  }
};

exports.sendOTP = async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) {
    return res.status(400).json({ msg: "Mobile required" });
  }

  const otp = Math.floor(1000 + Math.random() * 9000);
  const [user] = await db.query("SELECT * FROM users WHERE mobile=?", [mobile]);

  if (user.length === 0) {
    const [result] = await db.query("INSERT INTO users (mobile, otp) VALUES (?, ?)", [mobile, otp]);
    await createAdminNotification({
      type: 'new_user',
      source_table: 'users',
      source_id: result.insertId,
      message: `New user signup: ${mobile}`,
      sub: 'New user registration',
      payload: { mobile }
    });
  } else {
    await db.query("UPDATE users SET otp=? WHERE mobile=?", [otp, mobile]);
  }

  res.json({
    message: "OTP sent",
    otp 
  });
};

exports.verifyOTP = async (req, res) => {
  const { mobile, otp, fcm_token } = req.body;

  const [user] = await db.query(
    "SELECT * FROM users WHERE mobile=? AND otp=?",
    [mobile, otp]
  );

  if (user.length === 0) {
    return res.status(400).json({ msg: "Invalid OTP" });
  }

  // Check user status
  if (user[0].status === 0) {
    return res.status(403).json({
      message: "You are blocked. Please contact the administrator.",
    });
  }

  // OTP verified — only now persist the FCM token
  if (fcm_token) {
    await db.query(
      "UPDATE users SET fcm_token=? WHERE id=?",
      [fcm_token, user[0].id]
    );
  }

  const token = jwt.sign(
    {
      id: user[0].id,
      role: user[0].role,
    },
    process.env.JWT_SECRET
  );

  res.json({
    message: "Login success",
    token,
    role: user[0].role,
  });
};