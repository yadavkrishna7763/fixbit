const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadRoot = path.join(__dirname, '../../uploads');
const requestUploadDir = uploadRoot;
const profileUploadDir = path.join(uploadRoot, 'profiles');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeFilename(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const base = path
    .basename(originalName || 'upload', ext)
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'upload';

  return `${Date.now()}-${Math.round(Math.random() * 1e9)}-${base}${ext}`;
}

function imageUpload(destination, maxSizeMb = 5) {
  ensureDir(destination);

  return multer({
    storage: multer.diskStorage({
      destination,
      filename: (req, file, cb) => cb(null, safeFilename(file.originalname))
    }),
    limits: {
      fileSize: maxSizeMb * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        cb(null, true);
        return;
      }

      cb(new Error('Only image uploads are allowed'));
    }
  });
}

ensureDir(uploadRoot);
ensureDir(profileUploadDir);

module.exports = {
  uploadRoot,
  requestUpload: imageUpload(requestUploadDir, 10),
  profileUpload: imageUpload(profileUploadDir, 2)
};
