
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const ErrorResponse = require('../utils/errorHandler');
const { upload } = require('../utils/fileUpload');

const CHUNKS_DIR = path.join(process.env.UPLOAD_DIR || '../uploads', 'temp', 'chunks');
const UPLOADS_DIR = path.join(process.env.UPLOAD_DIR || '../uploads', 'temp');

// @desc    Check if chunk exists
// @route   GET /api/upload/chunk
// @access  Private
exports.checkChunk = async (req, res, next) => {
  try {
    const { resumableIdentifier, resumableChunkNumber } = req.query;
    if (!resumableIdentifier || !resumableChunkNumber) {
      return next(new ErrorResponse('Missing required parameters', 'INVALID_REQUEST'));
    }

    const chunkPath = path.join(CHUNKS_DIR, `${resumableIdentifier}.part${resumableChunkNumber}`);

    try {
      await fs.access(chunkPath);
      res.status(200).end();
    } catch {
      res.status(204).end();
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

      const {
        resumableChunkNumber,
        resumableIdentifier,
      } = req.body;

      const chunkNumber = parseInt(resumableChunkNumber, 10);
      const identifier = resumableIdentifier;

      const chunkFilename = `${identifier}.part${chunkNumber}`;
      const chunkFilePath = path.join(CHUNKS_DIR, chunkFilename);

      await fs.ensureDir(CHUNKS_DIR);
      await fs.rename(req.file.path, chunkFilePath);

      return res.status(200).json({ success: true, chunk: chunkNumber });
    });
  } catch (error) {
    return next(new ErrorResponse(error.message, 'CHUNK_UPLOAD_ERROR'));
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
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
    const fileExt = path.extname(filename).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      return next(new ErrorResponse('Invalid file type. Only images and PDFs are allowed.', 'INVALID_FILE_TYPE'));
    }
    const fileId = uuidv4();
    const finalFilename = `${fileId}${fileExt}`;
    const finalPath = path.join(UPLOADS_DIR, finalFilename);

    await fs.ensureDir(CHUNKS_DIR);
    await fs.ensureDir(UPLOADS_DIR);

    const chunkFiles = (await fs.readdir(CHUNKS_DIR))
      .filter(chunk => chunk.startsWith(identifier + '.part'))
      .sort((a, b) => {
        const aNum = parseInt(a.split('.part')[1]);
        const bNum = parseInt(b.split('.part')[1]);
        return aNum - bNum;
      });

    if (chunkFiles.length !== parseInt(totalChunks)) {
      return next(new ErrorResponse('Missing chunks', 'INCOMPLETE_UPLOAD'));
    }

    const writeStream = fs.createWriteStream(finalPath);

    for (const chunkFile of chunkFiles) {
      const chunkPath = path.join(CHUNKS_DIR, chunkFile);
      const data = await fs.readFile(chunkPath);
      writeStream.write(data);
      await fs.remove(chunkPath);
    }

    writeStream.end();

    const fileType = fileExt.substring(1);

    res.status(200).json({
      id: fileId,
      fileName: filename,
      fileSize: totalSize,
      fileType,
      url: `${finalFilename}`
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'UPLOAD_COMPLETION_ERROR'));
  }
};

exports.serveStaticFile = (req, res, next) => {
  const filename = req.params.filename;
  const filePath = path.resolve(__dirname, '..', process.env.UPLOAD_DIR, filename);
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    res.sendFile(filePath, (err) => {
      if (err) {
        return next(err);
      }
    });
  });
};