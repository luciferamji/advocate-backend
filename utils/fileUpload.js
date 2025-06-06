const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ErrorResponse = require('./errorHandler');

// Create upload directory if it doesn't exist
const createUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = '';
    
    if (req.baseUrl.includes('/api/upload/chunk')) {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'chunks');
    } else if (req.baseUrl.includes('/api/cases')) {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'cases');
    } else if (req.baseUrl.includes('/api/hearings')) {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'hearings');
    } else {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'general');
    }
    
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    if (req.baseUrl.includes('/api/upload/chunk')) {
      // Name for chunk file
      const { resumableIdentifier, resumableChunkNumber } = req.query;
      cb(null, `${resumableIdentifier}.part${resumableChunkNumber}`);
    } else {
      // Name for regular file upload
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allow all files for resumable chunk uploads

  if (req.baseUrl.includes('/api/upload') || (req.baseUrl.includes('/api/document-links') && req.path.includes('/upload'))) {
    return cb(null, true);
  }

  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new ErrorResponse('File type not allowed', 'INVALID_FILE_TYPE'));
  }
};

// Setup multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 100 // 100MB limit
  }
});

module.exports = { upload };