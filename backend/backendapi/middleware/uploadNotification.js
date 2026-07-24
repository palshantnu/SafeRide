const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIR = "uploads/notification/";

// make sure the destination folder exists (multer does not create it)
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);

    const name = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "_"); // remove space

    const uniqueName = Date.now() + "-" + name + ext;

    cb(null, uniqueName);
  }
});

const uploadNotification = multer({ storage });

module.exports = uploadNotification;
