// backend/routes/draw.js
const express = require("express");
const router = express.Router();

const TEAMS = require("../data/teams");
const { drawTeams } = require("../utils/draw");

/**
 * POST /draw
 * body: {
 *  tag: "friendly_international_clubs" | "world_cup_women" | ...
 *  type: "club" | "national"
 *  gender: "male" | "female"
 *  count: 8|16|32
 *  stars: [5] ou [3,4]
 *  mix: [{stars:5,count:8},{stars:4,count:8}] (optionnel)
 * }
 */
router.post("/", (req, res) => {
  try {
    const { tag, type, gender, count, stars, mix } = req.body;

    if (!tag || !type || !gender || !count) {
      return res.status(400).json({ message: "tag, type, gender, count requis" });
    }

    const pool = TEAMS.filter(t =>
      t.tags?.includes(tag) &&
      t.type === type &&
      t.gender === gender
    );

    const drawn = drawTeams({
      pool,
      count: Number(count),
      stars: stars || null,
      mix: mix || null,
    });

    res.json({
      criteria: { tag, type, gender, count, stars, mix },
      teams: drawn,
    });
  } catch (e) {
    res.status(400).json({ message: e.message || "Erreur tirage" });
  }
});

module.exports = router;
