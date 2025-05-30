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

// Configure storage for chunked uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = '';
    const chunkDir = 'chunks';
    
    // Determine base upload path based on route
    if (req.baseUrl.includes('cases')) {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'cases');
    } else if (req.baseUrl.includes('hearings')) {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'hearings');
    } else {
      uploadPath = path.join(process.env.UPLOAD_DIR || 'uploads', 'general');
    }
    
    // Create directories
    createUploadDir(uploadPath);
    createUploadDir(path.join(uploadPath, chunkDir));
    
    // Store chunks in temporary directory
    if (req.query.resumableChunkNumber) {
      cb(null, path.join(uploadPath, chunkDir));
    } else {
      cb(null, uploadPath);
    }
  },
  filename: (req, file, cb) => {
    if (req.query.resumableChunkNumber) {
      // Name for chunk file
      cb(null, `${req.query.resumableIdentifier}.part${req.query.resumableChunkNumber}`);
    } else {
      // Name for complete file
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
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
    fileSize: 1024 * 1024 * 1024 // 1GB limit per chunk
  }
});

// Handle chunked upload
const handleChunkedUpload = async (req, res, next) => {
  const { resumableIdentifier, resumableTotalChunks, resumableChunkNumber } = req.query;
  const uploadDir = req.file.destination.replace('/chunks', '');
  const chunkDir = path.join(uploadDir, 'chunks');
  
  // Check if all chunks are uploaded
  const chunks = fs.readdirSync(chunkDir)
    .filter(file => file.startsWith(resumableIdentifier))
    .sort();
    
  if (chunks.length === parseInt(resumableTotalChunks)) {
    // Combine chunks
    const finalFilePath = path.join(uploadDir, req.query.resumableFilename);
    const writeStream = fs.createWriteStream(finalFilePath);
    
    for (let i = 1; i <= chunks.length; i++) {
      const chunkPath = path.join(chunkDir, `${resumableIdentifier}.part${i}`);
      const chunkBuffer = fs.readFileSync(chunkPath);
      writeStream.write(chunkBuffer);
      fs.unlinkSync(chunkPath); // Delete chunk after combining
    }
    
    writeStream.end();
    
    // Add file info to request for further processing
    req.finalFile = {
      path: finalFilePath,
      originalname: req.query.resumableFilename,
      mimetype: req.file.mimetype,
      size: parseInt(req.query.resumableTotalSize)
    };
    
    next();
  } else {
    res.status(200).json({ success: true, message: 'Chunk uploaded successfully' });
  }
};

module.exports = {
  upload,
  handleChunkedUpload
};