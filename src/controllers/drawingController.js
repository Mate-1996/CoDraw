const mongoose = require("mongoose");
const { nanoid } = require("nanoid");
const Drawing = require("../models/Drawing");
const User = require("../models/User");
const Comment = require("../models/Comment");
const { emitDrawingUpdated, emitCollaboratorJoined } = require("../socket");

const drawingPopulate = [
  { path: "ownerId", select: "_id name email" },
  { path: "collaborators", select: "_id name email" },
];

const createDrawing = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { title, description, isPublic } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required." });

    const joinCode = nanoid(8).toUpperCase();

    const drawing = await Drawing.create({
      title,
      description,
      isPublic: isPublic ?? false,
      ownerId: req.user.id,
      collaborators: [],
      joinCode,
      strokes: [],
    });

    await drawing.populate(drawingPopulate);

    return res.status(201).json({
      message: "Drawing created successfully.",
      data: { drawing },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while creating drawing." });
  }
};

const getDrawings = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const drawings = await Drawing.find({
      $or: [{ ownerId: req.user.id }, { collaborators: req.user.id }],
    })
      .populate(drawingPopulate)
      .select("-strokes")
      .sort({ updatedAt: -1 });

    return res.json({
      message: "Drawings fetched successfully.",
      data: { drawings },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while fetching drawings." });
  }
};

const getDrawing = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid drawing id." });

    const drawing = await Drawing.findById(id).populate(drawingPopulate);
    if (!drawing) return res.status(404).json({ message: "Drawing not found." });

    const isOwner = drawing.ownerId._id.toString() === req.user.id;
    const isCollaborator = drawing.collaborators.some((c) => c._id.toString() === req.user.id);

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: "Access denied." });
    }

    return res.json({
      message: "Drawing fetched successfully.",
      data: { drawing },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while fetching drawing." });
  }
};

const updateDrawing = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid drawing id." });

    const drawing = await Drawing.findById(id);
    if (!drawing) return res.status(404).json({ message: "Drawing not found." });

    if (drawing.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the owner can update drawing details." });
    }

    const { title, description, isPublic } = req.body;
    if (title !== undefined) drawing.title = title;
    if (description !== undefined) drawing.description = description;
    if (isPublic !== undefined) drawing.isPublic = isPublic;

    await drawing.save();
    await drawing.populate(drawingPopulate);

    return res.json({
      message: "Drawing updated successfully.",
      data: { drawing },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while updating drawing." });
  }
};

const deleteOrLeaveDrawing = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid drawing id." });

    const drawing = await Drawing.findById(id);
    if (!drawing) return res.status(404).json({ message: "Drawing not found." });

    const isOwner = drawing.ownerId.toString() === req.user.id;
    const isCollaborator = drawing.collaborators.some((c) => c.toString() === req.user.id);

    if (isOwner) {
      await Comment.deleteMany({ drawingId: id });
      await drawing.deleteOne();
      return res.json({ message: "Drawing deleted successfully.", data: { drawing } });
    }

    if (isCollaborator) {
      drawing.collaborators = drawing.collaborators.filter((c) => c.toString() !== req.user.id);
      await drawing.save();
      return res.json({ message: "You have left the drawing.", data: { drawing } });
    }

    return res.status(403).json({ message: "You are not part of this drawing." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while deleting/leaving drawing." });
  }
};

const joinByCode = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Join code is required." });

    const drawing = await Drawing.findOne({ joinCode: String(code).toUpperCase() }).populate(
      drawingPopulate
    );
    if (!drawing) return res.status(404).json({ message: "Drawing not found for this code." });

    const isOwner = drawing.ownerId._id.toString() === req.user.id;
    const isCollaborator = drawing.collaborators.some((c) => c._id.toString() === req.user.id);

    if (isOwner || isCollaborator) {
      return res.json({
        message: "You are already part of this drawing.",
        data: { drawing },
      });
    }

    drawing.collaborators.push(req.user.id);
    await drawing.save();
    await drawing.populate(drawingPopulate);

    emitCollaboratorJoined(drawing._id.toString(), req.user.id);

    return res.json({
      message: "Joined drawing successfully.",
      data: { drawing },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while joining drawing." });
  }
};

const inviteCollaborator = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { id } = req.params;
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required." });
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid drawing id." });

    const drawing = await Drawing.findById(id);
    if (!drawing) return res.status(404).json({ message: "Drawing not found." });

    if (drawing.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the owner can invite collaborators." });
    }

    const invitee = await User.findOne({ email: String(email).toLowerCase() });
    if (!invitee) return res.status(404).json({ message: "No user found with that email." });

    const alreadyIn =
      drawing.ownerId.toString() === invitee._id.toString() ||
      drawing.collaborators.some((c) => c.toString() === invitee._id.toString());

    if (alreadyIn) {
      return res.status(409).json({ message: "User is already a collaborator." });
    }

    drawing.collaborators.push(invitee._id);
    await drawing.save();
    await drawing.populate(drawingPopulate);

    emitCollaboratorJoined(drawing._id.toString(), invitee._id.toString());

    return res.json({
      message: "Collaborator invited successfully.",
      data: { drawing },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error while inviting collaborator." });
  }
};

module.exports = {
  createDrawing,
  getDrawings,
  getDrawing,
  updateDrawing,
  deleteOrLeaveDrawing,
  joinByCode,
  inviteCollaborator,
};
