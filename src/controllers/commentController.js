const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Drawing = require("../models/Drawing");
const { emitCommentAdded } = require("../socket");

const commentPopulate = [{ path: "userId", select: "_id name email" }];

const canAccessDrawing = async (drawingId, userId) => {
  const drawing = await Drawing.findById(drawingId);
  if (!drawing) return false;
  const isOwner = drawing.ownerId.toString() === userId;
  const isCollaborator = drawing.collaborators.some((c) => c.toString() === userId);
  return isOwner || isCollaborator;
};

const createComment = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { drawingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(drawingId))
      return res.status(400).json({ message: "Invalid drawing id." });

    const { text, pinX, pinY } = req.body;
    if (!text) return res.status(400).json({ message: "Comment text is required." });

    const hasAccess = await canAccessDrawing(drawingId, req.user.id);
    if (!hasAccess) return res.status(403).json({ message: "Access denied." });

    const comment = await Comment.create({
      drawingId,
      userId: req.user.id,
      text,
      pinX: pinX ?? null,
      pinY: pinY ?? null,
    });

    await comment.populate(commentPopulate);
    emitCommentAdded(drawingId, comment);

    return res.status(201).json({
      message: "Comment created successfully.",
      data: { comment },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while creating comment." });
  }
};

const getComments = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { drawingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(drawingId))
      return res.status(400).json({ message: "Invalid drawing id." });

    const hasAccess = await canAccessDrawing(drawingId, req.user.id);
    if (!hasAccess) return res.status(403).json({ message: "Access denied." });

    const comments = await Comment.find({ drawingId })
      .populate(commentPopulate)
      .sort({ createdAt: 1 });

    return res.json({
      message: "Comments fetched successfully.",
      data: { comments },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while fetching comments." });
  }
};

const updateComment = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(commentId))
      return res.status(400).json({ message: "Invalid comment id." });

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found." });

    if (comment.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the comment author can edit it." });
    }

    const { text, pinX, pinY } = req.body;
    if (text !== undefined) comment.text = text;
    if (pinX !== undefined) comment.pinX = pinX;
    if (pinY !== undefined) comment.pinY = pinY;

    await comment.save();
    await comment.populate(commentPopulate);

    return res.json({
      message: "Comment updated successfully.",
      data: { comment },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while updating comment." });
  }
};


const deleteComment = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { commentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(commentId))
      return res.status(400).json({ message: "Invalid comment id." });

    const comment = await Comment.findById(commentId).populate("drawingId");
    if (!comment) return res.status(404).json({ message: "Comment not found." });

    const isAuthor = comment.userId.toString() === req.user.id;
    const isDrawingOwner = comment.drawingId?.ownerId?.toString() === req.user.id;

    if (!isAuthor && !isDrawingOwner) {
      return res.status(403).json({ message: "Not authorized to delete this comment." });
    }

    await comment.deleteOne();

    return res.json({
      message: "Comment deleted successfully.",
      data: { comment },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while deleting comment." });
  }
};

module.exports = { createComment, getComments, updateComment, deleteComment };
