const Tournament = require("../models/Tournament");
const Team = require("../models/Team");

// ✅ Config des tournois officiels (tu complètes quand tu veux)
const OFFICIAL_COMPETITIONS = {
  ucl: { title: "Ligue des Champions", teamCount: 32, type: "club" },
  worldcup: { title: "Coupe du Monde", teamCount: 32, type: "national" },
  laliga: { title: "LaLiga", teamCount: 20, type: "club" },
};

// POST /api/tournaments
// Official: { mode:"official", competitionKey:"ucl", genderMode:"men" }
// WTF: { mode:"wtf", title:"WTF du soir", teamCount:8, genderMode:"mixed" }
exports.createTournament = async (req, res) => {
  try {
    const { mode } = req.body;
    if (!mode) return res.status(400).json({ message: "mode requis" });

    if (mode === "official") {
      const { competitionKey, genderMode = "men" } = req.body;
      const comp = OFFICIAL_COMPETITIONS[competitionKey];
      if (!comp) return res.status(400).json({ message: "competitionKey invalide" });

      if (!["men", "women"].includes(genderMode)) {
        return res.status(400).json({ message: "genderMode doit être men ou women pour un tournoi officiel" });
      }

      const tournament = await Tournament.create({
        mode: "official",
        competitionKey,
        title: comp.title,
        genderMode,
        teamCount: comp.teamCount,
        teams: [],
        status: "draft",
      });

      return res.status(201).json(tournament);
    }

    if (mode === "wtf") {
      const { title, teamCount, genderMode = "mixed" } = req.body;

      if (!title) return res.status(400).json({ message: "title requis" });
      if (!teamCount) return res.status(400).json({ message: "teamCount requis" });

      const tCount = Number(teamCount);
      if (Number.isNaN(tCount) || tCount < 2 || tCount > 64) {
        return res.status(400).json({ message: "teamCount invalide (2..64)" });
      }

      const tournament = await Tournament.create({
        mode: "wtf",
        title,
        genderMode, // mixed ok
        teamCount: tCount,
        teams: [],
        status: "draft",
      });

      return res.status(201).json(tournament);
    }

    return res.status(400).json({ message: "mode invalide" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/tournaments/recent?limit=10
exports.recentTournaments = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 10), 50);

    const items = await Tournament.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select("mode title competitionKey genderMode teamCount status progress updatedAt createdAt");

    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/tournaments/:id
exports.getTournament = async (req, res) => {
  try {
    const t = await Tournament.findById(req.params.id).populate("teams");
    if (!t) return res.status(404).json({ message: "Tournoi introuvable" });
    res.json(t);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/tournaments/:id/teams
// body: { teams:[teamIds...] }
exports.setTournamentTeams = async (req, res) => {
  try {
    const { id } = req.params;
    const { teams } = req.body;

    if (!Array.isArray(teams)) {
      return res.status(400).json({ message: "teams doit être un tableau" });
    }

    const t = await Tournament.findById(id);
    if (!t) return res.status(404).json({ message: "Tournoi introuvable" });

    if (teams.length !== t.teamCount) {
      return res.status(400).json({
        message: `Nombre d'équipes invalide: attendu ${t.teamCount}, reçu ${teams.length}`,
      });
    }

    t.teams = teams;
    t.status = "ongoing";
    await t.save();

    res.json(t);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/tournaments/:id/progress
// body: { currentRound: 2, note: "Quarts" }
exports.updateProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentRound, note } = req.body;

    const t = await Tournament.findById(id);
    if (!t) return res.status(404).json({ message: "Tournoi introuvable" });

    if (currentRound !== undefined) t.progress.currentRound = Number(currentRound) || 1;
    if (note !== undefined) t.progress.note = String(note);

    await t.save();
    res.json(t);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * ✅ Auto-fill random basé sur étoiles
 * PATCH /api/tournaments/:id/autofill
 * body:
 *  - official: { starsMode:"balanced" } (ou "any")
 *  - wtf: { section:"clubMen"|"clubWomen"|"nationalMen"|"nationalWomen", starsMode:"balanced"|"any" }
 *
 * starsMode:
 *  - "any" = full random
 *  - "balanced" = distribution (si possible): 25% 5⭐, 35% 4⭐, 25% 3⭐, 15% 2⭐ (reste 1⭐ si manque)
 */
exports.autofillTeams = async (req, res) => {
  try {
    const { id } = req.params;
    const { starsMode = "balanced", section } = req.body;

    const t = await Tournament.findById(id);
    if (!t) return res.status(404).json({ message: "Tournoi introuvable" });

    // Base filter selon tournoi
    let type, gender;

    if (t.mode === "official") {
      const comp = OFFICIAL_COMPETITIONS[t.competitionKey];
      if (!comp) return res.status(400).json({ message: "competitionKey officiel introuvable" });

      type = comp.type;          // club ou national
      gender = t.genderMode;     // men ou women
    } else {
      // WTF : on peut forcer une section spécifique
      // 4 sections : clubMen, clubWomen, nationalMen, nationalWomen
      const map = {
        clubMen: { type: "club", gender: "men" },
        clubWomen: { type: "club", gender: "women" },
        nationalMen: { type: "national", gender: "men" },
        nationalWomen: { type: "national", gender: "women" },
      };

      if (section && map[section]) {
        type = map[section].type;
        gender = map[section].gender;
      } else {
        // si pas de section -> on respecte genderMode
        // mixed => pas de filtre gender
        type = undefined;
        gender = t.genderMode === "mixed" ? undefined : t.genderMode;
      }
    }

    const matchBase = { isActive: true };
    if (type) matchBase.type = type;
    if (gender) matchBase.gender = gender;

    const count = t.teamCount;

    // ⭐ mode "any" : full random simple
    if (starsMode === "any") {
      const picked = await Team.aggregate([
        { $match: matchBase },
        { $sample: { size: count } },
      ]);

      if (picked.length < count) {
        return res.status(400).json({ message: "Pas assez d'équipes disponibles pour ce filtre" });
      }

      t.teams = picked.map((x) => x._id);
      t.status = "ongoing";
      await t.save();
      return res.json(t);
    }

    // ⭐ mode "balanced"
    const plan = [
      { stars: 5, ratio: 0.25 },
      { stars: 4, ratio: 0.35 },
      { stars: 3, ratio: 0.25 },
      { stars: 2, ratio: 0.15 },
    ];

    // calc quotas
    let quotas = plan.map(p => ({ stars: p.stars, n: Math.floor(count * p.ratio) }));
    let total = quotas.reduce((s, q) => s + q.n, 0);

    // distribue le reste sur 4⭐ puis 5⭐ puis 3⭐
    const priority = [4, 5, 3, 2];
    let remaining = count - total;
    let i = 0;
    while (remaining > 0) {
      const s = priority[i % priority.length];
      const q = quotas.find(x => x.stars === s);
      q.n += 1;
      remaining -= 1;
      i++;
    }

    // pick par groupe avec dédup
    const chosenIds = new Set();

    for (const q of quotas) {
      if (q.n <= 0) continue;

      const group = await Team.aggregate([
        { $match: { ...matchBase, stars: q.stars } },
        { $sample: { size: q.n } },
        { $project: { _id: 1 } },
      ]);

      group.forEach(g => chosenIds.add(String(g._id)));
    }

    // Si manque (pas assez d’équipes dans certains tiers), on complète avec n’importe quelles équipes du filtre
    if (chosenIds.size < count) {
      const need = count - chosenIds.size;

      const extra = await Team.aggregate([
        { $match: matchBase },
        { $sample: { size: Math.min(need * 3, 200) } }, // sur-sample pour éviter doublons
        { $project: { _id: 1 } },
      ]);

      for (const e of extra) {
        if (chosenIds.size >= count) break;
        chosenIds.add(String(e._id));
      }
    }

    if (chosenIds.size < count) {
      return res.status(400).json({ message: "Pas assez d'équipes disponibles pour remplir le tournoi" });
    }

    t.teams = Array.from(chosenIds).slice(0, count);
    t.status = "ongoing";
    await t.save();

    res.json(t);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
