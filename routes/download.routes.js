const express = require('express');
const { downloadFile } = require('../controllers/download.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/:fileId', protect, downloadFile);

module.exports = router;