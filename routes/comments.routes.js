const express = require('express');
const { 
  updateComment, 
  deleteComment 
} = require('../controllers/comment.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/:id')
  .put(updateComment)
  .delete(deleteComment);

module.exports = router;