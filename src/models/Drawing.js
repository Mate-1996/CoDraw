const mongoose = require("mongoose");

const strokeSchema = new mongoose.Schema(
  {
    tool: { type: String, enum: ["pen", "eraser"], default: "pen" },
    color: { type: String, default: "#000000" },
    size: { type: Number, default: 4 },
    points: [
      {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
      },
    ],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { _id: true }
);

const drawingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    joinCode: {
      type: String,
      required: true,
      unique: true,
    },
    strokes: [strokeSchema],
    canvasWidth: {
      type: Number,
      default: 1920,
    },
    canvasHeight: {
      type: Number,
      default: 1080,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Drawing = mongoose.model("Drawing", drawingSchema);

module.exports = Drawing;
