const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const drawingRoutes = require("./routes/drawingRoutes");
const commentRoutes = require("./routes/commentRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/drawings", drawingRoutes);
app.use("/", commentRoutes);

module.exports = app;
