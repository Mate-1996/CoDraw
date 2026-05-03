const express = require("express");
const { createComment, getComments, updateComment, deleteComment,} = require("../controllers/commentController");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/drawings/:drawingId/comments", getComments);
router.post("/drawings/:drawingId/comments", createComment);
router.patch("/comments/:commentId", updateComment);
router.delete("/comments/:commentId", deleteComment);

module.exports = router;
