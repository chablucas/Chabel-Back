// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
const tournamentsRoutes = require("./routes/tournaments");
const drawRoutes = require("./routes/draw");

app.use("/tournaments", tournamentsRoutes);
app.use("/draw", drawRoutes);

app.get("/", (req, res) => res.send("API OK"));

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error("❌ MONGODB_URI manquant dans .env");
    } else {
      // ✅ options safe
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000, // pareil que ton timeout, mais log clair
      });
      console.log("✅ MongoDB connecté");
    }
  } catch (err) {
    console.error("❌ MongoDB connexion échouée:", err.message);
  }

  app.listen(PORT, () => console.log("Server running on", PORT));
}

start();
