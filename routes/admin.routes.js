const express = require('express');
const { getUsers, getUser, createUser, updateUser, deleteUser } = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(authorize('super-admin'));

router.route('/users')
  .get(getUsers)
  .post(createUser);

router.route('/users/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;