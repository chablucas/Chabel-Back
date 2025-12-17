// backend/routes/draw.js
const express = require("express");
const router = express.Router();

const TEAMS = require("../data/teams");
const { drawTeamsBalanced } = require("../utils/draw");

/**
 * POST /draw
 * body: {
 *  tag: string,
 *  type: "club" | "national",
 *  gender: "male" | "female",
 *  totalTeams: number (default 8),
 *  perPlayer: number (default 4)
 * }
 *
 * response: { left: Team[], right: Team[], meta: {...} }
 */
router.post("/", (req, res) => {
  try {
    const {
      tag,
      type,
      gender,
      totalTeams = 8,
      perPlayer = 4,
    } = req.body;

    // ⚠️ adapte ce filtre à TON teams.js
    // Supporte plusieurs styles possibles: t.tags (array) ou t.tag (string)
    const teamsPool = TEAMS.filter((t) => {
      const okTag =
        !tag || (Array.isArray(t.tags) && t.tags.includes(tag)) || t.tag === tag;

      const okType = !type || t.type === type;
      const okGender = !gender || t.gender === gender;

      return okTag && okType && okGender;
    });

    const result = drawTeamsBalanced({
      teamsPool,
      totalTeams: Number(totalTeams),
      perPlayer: Number(perPlayer),
    });

    return res.json({
      left: result.left,
      right: result.right,
      meta: result.meta,
    });
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
});

module.exports = router;
