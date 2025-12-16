const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ AJOUTE/VERIFIE CETTE LIGNE
const tournamentsRoutes = require("./routes/tournaments");
app.use("/tournaments", tournamentsRoutes);

app.get("/", (req, res) => res.send("API OK"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on", PORT));
