const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const tournamentsRoutes = require("./routes/tournaments");
const drawRoutes = require("./routes/draw");

app.use("/tournaments", tournamentsRoutes);
app.use("/draw", drawRoutes);

app.get("/", (req, res) => res.send("API OK"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on", PORT));
