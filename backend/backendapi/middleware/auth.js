const jwt = require("jsonwebtoken");
require("dotenv").config();

const SECRET = process.env.JWT_SECRET || "mysecretkey";

exports.verifyToken = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ message: "Token required" });
    }

    try {
        // format: Bearer token
        const actualToken = token.split(" ")[1];

        const decoded = jwt.verify(actualToken, SECRET);

        req.user = decoded; // 👈 id, mobile mil jayega
        next();

    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};