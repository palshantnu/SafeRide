const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/baprofile/");
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

const uploadBAProfile = multer({ storage });

module.exports = uploadBAProfile;
