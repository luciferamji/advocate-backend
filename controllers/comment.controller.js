const { CaseComment, HearingComment, Admin } = require('../models');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
exports.updateComment = async (req, res, next) => {
  try {
    let comment = await CaseComment.findByPk(req.params.id);
    if (!comment) {
      comment = await HearingComment.findByPk(req.params.id);
    }

    if (!comment) {
      return next(new ErrorResponse(`Comment not found with id of ${req.params.id}`, 404));
    }

    // Check ownership
    if (comment.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this comment', 403));
    }

    // Update comment
    comment = await comment.update({ text: req.body.content });

    const user = await Admin.findByPk(comment.createdBy);

    res.status(200).json({
      id: comment.id.toString(),
      content: comment.text,
      userId: user.id.toString(),
      userName: user.name,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    let comment = await CaseComment.findByPk(req.params.id);
    if (!comment) {
      comment = await HearingComment.findByPk(req.params.id);
    }

    if (!comment) {
      return next(new ErrorResponse(`Comment not found with id of ${req.params.id}`, 404));
    }

    // Check ownership
    if (comment.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this comment', 403));
    }

    await comment.destroy();

    res.status(200).end();
  } catch (error) {
    next(error);
  }
};