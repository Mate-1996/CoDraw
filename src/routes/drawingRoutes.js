const express = require("express");
const { createDrawing, getDrawings, getDrawing, updateDrawing, deleteOrLeaveDrawing, joinByCode, inviteCollaborator,
} = require("../controllers/drawingController");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", getDrawings);
router.post("/", createDrawing);
router.post("/join", joinByCode);
router.get("/:id", getDrawing);
router.patch("/:id", updateDrawing);
router.delete("/:id", deleteOrLeaveDrawing);
router.post("/:id/invite", inviteCollaborator);

module.exports = router;
