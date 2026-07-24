const multer = require("multer");
const path = require("path");
const fs = require("fs");

if (!fs.existsSync("uploads/subservice/")) {
  fs.mkdirSync("uploads/subservice/", { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/subservice/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "_");
    const uniqueName = Date.now() + "-" + name + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

module.exports = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "logo",  maxCount: 1 },
]);