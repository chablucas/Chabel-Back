require("dotenv").config();
const connectDB = require("../config/db");
const Team = require("../models/Team");

async function clearTeams() {
  try {
    await connectDB();

    const result = await Team.deleteMany({});
    console.log(`🧹 Teams supprimées : ${result.deletedCount}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur clearTeams:", err);
    process.exit(1);
  }
}

clearTeams();
