require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.set('trust proxy', true);

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());

const authRoutes = require('./routes/authRoutes');
app.use('/api', authRoutes);

app.get("/test", (req, res) => {
  res.json({ msg: "working" });
});

app.use('/uploads', express.static('uploads'));

const { startBookingExpiryJob } = require('./services/bookingExpiry');

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running...");
  startBookingExpiryJob();
});