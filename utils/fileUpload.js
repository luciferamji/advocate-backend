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
    
    // Determine upload path based on route
    if (req.baseUrl.includes('cases')) {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'cases');
    } else if (req.baseUrl.includes('hearings')) {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'hearings');
    } else {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'general');
    }
    
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allow only certain file types
  const allowedFileTypes = /pdf|doc|docx|txt|jpg|jpeg|png/;
  const extname = allowedFileTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new ErrorResponse('File type not supported', 400));
  }
};

// Setup multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

module.exports = upload;