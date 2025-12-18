const express = require("express");
const router = express.Router();
const Tournament = require("../models/Tournament");
const {
  createGroups32,
  groupTable,
  buildKnockoutFromTeams,
  buildKnockoutFromDuelTeams,
  advanceIfRoundComplete,
} = require("../utils/tournamentEngine");

function roundsToObject(rounds) {
  if (!rounds) return {};
  // Map -> Object
  if (rounds instanceof Map) return Object.fromEntries(rounds.entries());
  // Already object
  return rounds;
}

function normalizeTournamentForJson(t) {
  const obj = t.toObject();

  // ✅ IMPORTANT : Mongoose Map -> Object sinon front reçoit {}
  if (t?.knockout?.rounds instanceof Map) {
    obj.knockout = obj.knockout || {};
    obj.knockout.rounds = Object.fromEntries(t.knockout.rounds.entries());
  }

  return obj;
}

// GET list
router.get("/", async (req, res) => {
  try {
    const tournaments = await Tournament.find().sort({ createdAt: -1 });
    res.json(tournaments.map(normalizeTournamentForJson));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET detail
router.get("/:id", async (req, res) => {
  try {
    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Tournoi introuvable" });

    let tables = null;
    if (t.mode === "groups32") {
      tables = {};
      t.groups.forEach((g) => {
        tables[g.key] = groupTable(g);
      });
    }

    const obj = normalizeTournamentForJson(t);
    res.json({ ...obj, tables });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// POST create tournament
router.post("/", async (req, res) => {
  try {
    let { name, mode, teams = [] } = req.body;

    if (!name || !mode) {
      return res.status(400).json({ message: "name et mode requis" });
    }

    let duelPayload = null;

    if (mode === "1v1") {
      const {
        players,
        perPlayer = 4,
        tag = null,
        type = null,
        gender = null,
        meta = null,
      } = req.body;

      if (!Array.isArray(players) || players.length !== 2) {
        return res.status(400).json({ message: "En mode 1v1, il faut players: [J1, J2]." });
      }

      const p1 = players[0];
      const p2 = players[1];

      if (!p1?.name || !p2?.name) {
        return res.status(400).json({ message: "Chaque joueur doit avoir un name." });
      }

      if (!Array.isArray(p1.teams) || !Array.isArray(p2.teams)) {
        return res.status(400).json({ message: "Chaque joueur doit avoir teams: []" });
      }

      const pp = Number(perPlayer);
      if (p1.teams.length !== pp || p2.teams.length !== pp) {
        return res.status(400).json({ message: `Chaque joueur doit avoir exactement ${pp} équipes.` });
      }

      const combined = [...p1.teams, ...p2.teams];
      const set = new Set(combined);
      if (set.size !== combined.length) {
        return res.status(400).json({ message: "Équipes dupliquées détectées (interdit)." });
      }

      teams = combined;
      mode = "knockout";

      duelPayload = {
        enabled: true,
        perPlayer: pp,
        tag,
        type,
        gender,
        players: [
          { name: p1.name, teams: p1.teams },
          { name: p2.name, teams: p2.teams },
        ],
        meta: meta ?? null,
      };
    }

    if (!["groups32", "knockout"].includes(mode)) {
      return res.status(400).json({ message: "Mode invalide (groups32 | knockout | 1v1)" });
    }

    const t = new Tournament({
      name,
      mode,
      teams,
      groups: [],
      knockout: { rounds: new Map(), winner: null },
      duel: duelPayload ? duelPayload : { enabled: false },
    });

    if (mode === "groups32") {
      if (!Array.isArray(teams) || teams.length !== 32) {
        return res.status(400).json({ message: "En mode poules, il faut exactement 32 équipes." });
      }
      t.groups = createGroups32(teams);
    }

    if (mode === "knockout") {
      if (duelPayload?.enabled) {
        const { rounds, winner } = buildKnockoutFromDuelTeams(
          duelPayload.players[0].teams,
          duelPayload.players[1].teams
        );
        t.knockout.rounds = rounds; // object ok, mongoose cast possible
        t.knockout.winner = winner;
        t.markModified("knockout.rounds");
      } else if (Array.isArray(teams) && teams.length > 0) {
        const { rounds, winner } = buildKnockoutFromTeams(teams);
        t.knockout.rounds = rounds;
        t.knockout.winner = winner;
        t.markModified("knockout.rounds");
      }
    }

    await t.save();
    res.status(201).json(normalizeTournamentForJson(t));
  } catch (e) {
    console.error(e);
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
    console.error(e);
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
        const m = (g.matches || []).find((x) => x.matchId === matchId);
        if (m) {
          found = m;
          break;
        }
      }
    } else {
      // ✅ compatible Map OU object
      const roundsObj = roundsToObject(t.knockout?.rounds);

      for (const rk of Object.keys(roundsObj)) {
        const arr = roundsObj[rk] || [];
        const m = arr.find((x) => x.matchId === matchId);
        if (m) {
          found = m;
          break;
        }
      }

      // ⚠️ found est une copie si roundsObj vient d'un Map
      // donc on doit modifier DIRECTEMENT t.knockout.rounds aussi.
      // => le plus simple: on modifie sur roundsObj puis on ré-assigne.
      if (found) {
        if (Number.isFinite(homeScore)) found.homeScore = homeScore;
        if (Number.isFinite(awayScore)) found.awayScore = awayScore;

        if (validate) {
          if (!found.home || !found.away) {
            found.isValidated = true;
            found.winner = found.home || found.away;
          } else if (found.homeScore > found.awayScore) {
            found.isValidated = true;
            found.winner = found.home;
          } else if (found.homeScore < found.awayScore) {
            found.isValidated = true;
            found.winner = found.away;
          } else {
            return res.status(400).json({
              message: "Match nul interdit en éliminatoire (ou décide un gagnant).",
            });
          }

          // advance bracket (engine accepte Map OU object)
          const advanced = advanceIfRoundComplete(
            { rounds: roundsObj, winner: t.knockout?.winner || null },
            found.roundKey
          );

          t.knockout.rounds = advanced.rounds;
          t.knockout.winner = advanced.winner;
          t.markModified("knockout.rounds");
        } else {
          // juste update score
          t.knockout.rounds = roundsObj;
          t.markModified("knockout.rounds");
        }

        await t.save();
        return res.json(normalizeTournamentForJson(t));
      }
    }

    // Si on arrive ici: soit groups32 (found dans doc), soit not found
    if (!found) return res.status(404).json({ message: "Match introuvable" });

    // groups32 update direct sur subdoc mongoose
    if (Number.isFinite(homeScore)) found.homeScore = homeScore;
    if (Number.isFinite(awayScore)) found.awayScore = awayScore;

    if (validate) {
      if (!found.home || !found.away) {
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
    }

    await t.save();
    res.json(normalizeTournamentForJson(t));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
