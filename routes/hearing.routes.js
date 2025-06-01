const express = require('express');
const {
  getHearings,
  getHearing,
  createHearing,
  updateHearing,
  deleteHearing
} = require('../controllers/hearing.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

router.route('/')
  .get(getHearings)
  .post(createHearing);

router.route('/:id')
  .get(getHearing)
  .put(updateHearing)
  .delete(deleteHearing);

module.exports = router;