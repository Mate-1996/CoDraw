const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Drawing = require("./models/Drawing");

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: { origin: "*" },
  });


  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error"));

    const jwtSecret = process.env.JWT_SECRET || "riefg4378ofgb1gfb81g3or1gn";
    try {
      const decoded = jwt.verify(token, jwtSecret);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      next();
    } catch {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.userId})`);

    socket.on("drawing:join", async ({ drawingId }) => {
      try {
        const drawing = await Drawing.findById(drawingId);
        if (!drawing) return;

        const isOwner = drawing.ownerId.toString() === socket.userId;
        const isCollaborator = drawing.collaborators.some((c) => c.toString() === socket.userId);

        if (!isOwner && !isCollaborator) return;

        socket.join(`drawing:${drawingId}`);
        socket.currentDrawingId = drawingId;


        socket.to(`drawing:${drawingId}`).emit("collaborator:online", {
          userId: socket.userId,
        });

        socket.emit("socket:ready", { message: "Joined drawing room." });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("drawing:leave", ({ drawingId }) => {
      socket.leave(`drawing:${drawingId}`);
      socket.to(`drawing:${drawingId}`).emit("collaborator:offline", {
        userId: socket.userId,
      });
    });


    socket.on("stroke:start", ({ drawingId, stroke }) => {
      socket.to(`drawing:${drawingId}`).emit("stroke:start", {
        userId: socket.userId,
        stroke,
      });
    });

    socket.on("stroke:point", ({ drawingId, strokeId, point }) => {
      socket.to(`drawing:${drawingId}`).emit("stroke:point", {
        userId: socket.userId,
        strokeId,
        point,
      });
    });

    socket.on("stroke:end", ({ drawingId, stroke }) => {
      Drawing.findByIdAndUpdate(drawingId, { $push: { strokes: stroke } }).catch(console.error);

      socket.to(`drawing:${drawingId}`).emit("stroke:end", {
        userId: socket.userId,
        stroke,
      });
    });

    socket.on("cursor:move", ({ drawingId, x, y }) => {
      socket.to(`drawing:${drawingId}`).emit("cursor:move", {
        userId: socket.userId,
        x,
        y,
      });
    });

    socket.on("cursor:leave", ({ drawingId }) => {
      socket.to(`drawing:${drawingId}`).emit("cursor:leave", {
        userId: socket.userId,
      });
    });

    socket.on("disconnect", () => {
      if (socket.currentDrawingId) {
        socket.to(`drawing:${socket.currentDrawingId}`).emit("collaborator:offline", {
          userId: socket.userId,
        });
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};


const emitDrawingUpdated = (drawingId, drawing) => {
  if (!io) return;
  io.to(`drawing:${drawingId}`).emit("drawing:updated", { drawing });
};

const emitCollaboratorJoined = (drawingId, userId) => {
  if (!io) return;
  io.to(`drawing:${drawingId}`).emit("collaborator:joined", { userId });
};

const emitCommentAdded = (drawingId, comment) => {
  if (!io) return;
  io.to(`drawing:${drawingId}`).emit("comment:added", { comment });
};

module.exports = { initializeSocket, emitDrawingUpdated, emitCollaboratorJoined, emitCommentAdded };
