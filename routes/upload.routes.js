const express = require('express');
const { checkChunk, uploadChunk, completeUpload ,serveStaticFile} = require('../controllers/upload.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/chunk', protect, checkChunk);
router.post('/chunk', protect, uploadChunk);
router.post('/complete', protect, completeUpload);
router.get('/files/:filename', protect, serveStaticFile);

module.exports = router;