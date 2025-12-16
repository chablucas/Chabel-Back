const express = require("express");
const router = express.Router();
const Tournament = require("../models/Tournament");
const {
  createGroups32,
  groupTable,
  buildKnockoutFromTeams,
  advanceIfRoundComplete,
} = require("../utils/tournamentEngine");

// GET list
router.get("/", async (req, res) => {
  try {
    const tournaments = await Tournament.find().sort({ createdAt: -1 });
    res.json(tournaments);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET detail
router.get("/:id", async (req, res) => {
  try {
    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Tournoi introuvable" });

    // add computed tables for groups32 (frontend could compute too, but handy)
    let tables = null;
    if (t.mode === "groups32") {
      tables = {};
      t.groups.forEach((g) => {
        tables[g.key] = groupTable(g);
      });
    }

    res.json({ ...t.toObject(), tables });
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST create tournament
router.post("/", async (req, res) => {
  try {
    const { name, mode, teams = [] } = req.body;

    if (!name || !mode) {
      return res.status(400).json({ message: "name et mode requis" });
    }

    const t = new Tournament({
      name,
      mode,
      teams,
      groups: [],
      knockout: { rounds: new Map(), winner: null },
    });

    if (mode === "groups32") {
      if (!Array.isArray(teams) || teams.length !== 32) {
        return res.status(400).json({ message: "En mode poules, il faut exactement 32 équipes." });
      }
      t.groups = createGroups32(teams);
    }

    if (mode === "knockout") {
      // teams can be empty: user can fill later in UI if you want
      // here we build bracket if teams exist
      if (Array.isArray(teams) && teams.length > 0) {
        const { rounds, winner } = buildKnockoutFromTeams(teams);
        t.knockout.rounds = rounds;
        t.knockout.winner = winner;
      }
    }

    await t.save();
    res.status(201).json(t);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// DELETE tournament
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Tournament.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Tournoi introuvable" });
    res.json({ message: "Tournoi supprimé" });
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// PATCH score + validate match (groups or knockout)
router.patch("/:id/matches/:matchId", async (req, res) => {
  try {
    const { homeScore, awayScore, validate } = req.body;

    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Tournoi introuvable" });

    const matchId = req.params.matchId;

    let found = null;

    if (t.mode === "groups32") {
      for (const g of t.groups) {
        const m = g.matches.find((x) => x.matchId === matchId);
        if (m) {
          found = m;
          break;
        }
      }
    } else {
      const rounds = t.knockout.rounds;
      for (const [rk, arr] of rounds.entries()) {
        const m = arr.find((x) => x.matchId === matchId);
        if (m) {
          found = m;
          break;
        }
      }
    }

    if (!found) return res.status(404).json({ message: "Match introuvable" });

    // update score
    if (Number.isFinite(homeScore)) found.homeScore = homeScore;
    if (Number.isFinite(awayScore)) found.awayScore = awayScore;

    if (validate) {
      // determine winner
      if (!found.home || !found.away) {
        // BYE case already handled, but keep safe
        found.isValidated = true;
        found.winner = found.home || found.away;
      } else if (found.homeScore > found.awayScore) {
        found.isValidated = true;
        found.winner = found.home;
      } else if (found.homeScore < found.awayScore) {
        found.isValidated = true;
        found.winner = found.away;
      } else {
        return res.status(400).json({ message: "Match nul interdit en éliminatoire (ou décide un gagnant)." });
      }

      // if knockout, advance bracket
      if (t.mode === "knockout") {
        t.knockout = advanceIfRoundComplete(t.knockout, found.roundKey);
      }
    }

    await t.save();
    res.json(t);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
