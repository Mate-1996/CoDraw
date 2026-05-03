const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    drawingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drawing",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    pinX: {
      type: Number,
      default: null,
    },
    pinY: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
