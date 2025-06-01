const express = require('express');
const { 
  getAdvocates, 
  getAdvocate, 
  createAdvocate, 
  updateAdvocate 
} = require('../controllers/advocate.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(authorize('super-admin'));

router.route('/')
  .get(getAdvocates)
  .post(createAdvocate);

router.route('/:id')
  .get(getAdvocate)
  .put(updateAdvocate);

module.exports = router;