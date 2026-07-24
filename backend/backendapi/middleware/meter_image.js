const multer = require("multer");
const path = require("path");
const fs = require("fs");

const folder = "uploads/meter_images/";

if (!fs.existsSync(folder)) {
  fs.mkdirSync(folder, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + ext;
    cb(null, uniqueName);
  }
});

module.exports = multer({ storage });