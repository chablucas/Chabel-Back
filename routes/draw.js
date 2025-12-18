// backend/routes/draw.js
const express = require("express");
const router = express.Router();

const TEAMS = require("../data/teams");
const { drawTeamsBalanced } = require("../utils/draw");

function getStars(team) {
  return Number(team.stars || team.rating || 0);
}

router.post("/", (req, res) => {
  try {
    const {
      tag,
      type,
      gender,
      count,
      totalTeams,
      perPlayer,
      stars,
      mix,
    } = req.body;

    const finalTotal = Number(totalTeams ?? count ?? 8);
    const finalPerPlayer = Number(perPlayer ?? Math.floor(finalTotal / 2));

    if (!finalTotal || finalTotal % 2 !== 0) {
      return res.status(400).json({ message: "Le nombre d'équipes doit être pair (8/16/32)." });
    }
    if (finalPerPlayer * 2 !== finalTotal) {
      return res.status(400).json({ message: "perPlayer invalide (doit être total/2)." });
    }

    // Base pool: tag/type/gender
    let pool = TEAMS.filter((t) => {
      const okTag =
        !tag || (Array.isArray(t.tags) && t.tags.includes(tag)) || t.tag === tag;

      const okType = !type || t.type === type;
      const okGender = !gender || t.gender === gender;

      return okTag && okType && okGender;
    });

    // ✅ Filtre étoiles SIMPLE
    if (Array.isArray(stars) && stars.length > 0) {
      const set = new Set(stars.map(Number));
      pool = pool.filter((t) => set.has(getStars(t)));
    }

    // ✅ Filtre étoiles MIX (pool exact)
    // Exemple: mix=[{stars:5,count:8},{stars:4.5,count:8}]
    // -> on construit une liste de teamsCandidates en respectant les quantités
    let poolExact = null;
    if (Array.isArray(mix) && mix.length > 0) {
      poolExact = [];
      for (const part of mix) {
        const s = Number(part.stars);
        const c = Number(part.count);

        const candidates = pool.filter((t) => getStars(t) === s);
        if (candidates.length < c) {
          return res.status(400).json({
            message: `Pas assez d'équipes en ${s}⭐ (demandé: ${c}, dispo: ${candidates.length}).`,
          });
        }

        // pick random c in this stars group
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        poolExact.push(...shuffled.slice(0, c));
      }

      // sécurité: pas de doublons (si TEAMS contient des doublons)
      const uniq = [];
      const seen = new Set();
      for (const t of poolExact) {
        if (!seen.has(t.name)) {
          seen.add(t.name);
          uniq.push(t);
        }
      }
      poolExact = uniq;
    }

    const usablePool = poolExact || pool;

    // ✅ draw équilibré 1v1 (8/16/32)
    const result = drawTeamsBalanced({
      teamsPool: usablePool,
      totalTeams: finalTotal,
      perPlayer: finalPerPlayer,
    });

    return res.json({
      left: result.left,
      right: result.right,
      meta: result.meta,
    });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ message: e.message });
  }
});

module.exports = router;
