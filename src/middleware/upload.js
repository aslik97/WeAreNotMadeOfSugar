'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const config = require('../config');

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, config.uploadDir);
  },
  filename(_req, file, cb) {
    const id = crypto.randomBytes(6).toString('hex');
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_');
    cb(null, `${Date.now()}-${id}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
});

module.exports = upload;
