const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const ErrorResponse = require('../utils/errorHandler');
const { upload } = require('../utils/fileUpload');

// @desc    Check if chunk exists
// @route   GET /api/upload/chunk
// @access  Private
exports.checkChunk = async (req, res, next) => {
  try {
    const { resumableIdentifier, resumableChunkNumber } = req.query;
    
    if (!resumableIdentifier || !resumableChunkNumber) {
      return next(new ErrorResponse('Missing required parameters', 'INVALID_REQUEST'));
    }

    const chunkPath = path.join(
      process.env.UPLOAD_DIR || 'uploads',
      'chunks',
      `${resumableIdentifier}.part${resumableChunkNumber}`
    );

    try {
      await fs.access(chunkPath);
      res.status(200).end();
    } catch {
      res.status(404).end();
    }
  } catch (error) {
    next(new ErrorResponse(error.message, 'CHUNK_CHECK_ERROR'));
  }
};

// @desc    Upload chunk
// @route   POST /api/upload/chunk
// @access  Private
exports.uploadChunk = async (req, res, next) => {
  try {
    const uploadHandler = upload.single('file');

    uploadHandler(req, res, async (err) => {
      if (err) {
        return next(new ErrorResponse('File upload failed', 'UPLOAD_ERROR', { details: err.message }));
      }

      if (!req.file) {
        return next(new ErrorResponse('No file uploaded', 'NO_FILE'));
      }

      res.status(200).json({ success: true });
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'CHUNK_UPLOAD_ERROR'));
  }
};

// @desc    Complete upload and combine chunks
// @route   POST /api/upload/complete
// @access  Private
exports.completeUpload = async (req, res, next) => {
  try {
    const { identifier, filename, totalSize, totalChunks } = req.body;

    if (!identifier || !filename || !totalSize || !totalChunks) {
      return next(new ErrorResponse('Missing required parameters', 'INVALID_REQUEST'));
    }

    const chunksDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'chunks');
    const uploadsDir = path.join(process.env.UPLOAD_DIR || 'uploads');
    const fileId = uuidv4();
    const fileExt = path.extname(filename);
    const finalFilename = `${fileId}${fileExt}`;
    const finalPath = path.join(uploadsDir, finalFilename);

    // Ensure directories exist
    await fs.mkdir(chunksDir, { recursive: true });
    await fs.mkdir(uploadsDir, { recursive: true });

    // Get all chunks
    const chunks = await fs.readdir(chunksDir);
    const fileChunks = chunks
      .filter(chunk => chunk.startsWith(identifier))
      .sort((a, b) => {
        const aNum = parseInt(a.split('.part')[1]);
        const bNum = parseInt(b.split('.part')[1]);
        return aNum - bNum;
      });

    if (fileChunks.length !== parseInt(totalChunks)) {
      return next(new ErrorResponse('Missing chunks', 'INCOMPLETE_UPLOAD'));
    }

    // Combine chunks
    const writeStream = fs.createWriteStream(finalPath);
    
    for (const chunk of fileChunks) {
      const chunkPath = path.join(chunksDir, chunk);
      const chunkData = await fs.readFile(chunkPath);
      await writeStream.write(chunkData);
      await fs.unlink(chunkPath);
    }

    writeStream.end();

    // Get file type
    const fileType = path.extname(filename).substring(1);

    res.status(200).json({
      id: fileId,
      fileName: filename,
      fileSize: totalSize,
      fileType,
      url: `/uploads/${finalFilename}`
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'UPLOAD_COMPLETION_ERROR'));
  }
};