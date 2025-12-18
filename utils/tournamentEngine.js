// backend/utils/tournamentEngine.js

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mkMatch(roundKey, index, home = null, away = null) {
  return {
    matchId: `${roundKey}-${index}`,
    roundKey,
    home,
    away,
    homeScore: 0,
    awayScore: 0,
    isValidated: false,
    winner: null,
  };
}

/* =========================
   GROUPS (32)
========================= */

function createGroups32(teams) {
  // 32 teams -> 8 groups of 4
  const shuffled = shuffle(teams);

  const groups = [];
  const letters = "ABCDEFGH".split("");

  for (let i = 0; i < 8; i++) {
    const key = letters[i];
    const groupTeams = shuffled.slice(i * 4, i * 4 + 4);

    // Matches round-robin (6 matches per group)
    // 1: A vs B, C vs D
    // 2: A vs C, B vs D
    // 3: A vs D, B vs C
    const [A, B, C, D] = groupTeams;

    const matches = [
      { ...mkMatch(`G-${key}`, 1, A, B) },
      { ...mkMatch(`G-${key}`, 2, C, D) },
      { ...mkMatch(`G-${key}`, 3, A, C) },
      { ...mkMatch(`G-${key}`, 4, B, D) },
      { ...mkMatch(`G-${key}`, 5, A, D) },
      { ...mkMatch(`G-${key}`, 6, B, C) },
    ];

    groups.push({
      key,
      teams: groupTeams,
      matches,
    });
  }

  return groups;
}

function groupTable(group) {
  const teams = group.teams || [];
  const matches = group.matches || [];

  const table = {};
  teams.forEach((t) => {
    table[t] = {
      team: t,
      pts: 0,
      played: 0,
      gf: 0,
      ga: 0,
      gd: 0,
    };
  });

  for (const m of matches) {
    if (!m.isValidated) continue;
    if (!m.home || !m.away) continue;

    const home = table[m.home];
    const away = table[m.away];
    if (!home || !away) continue;

    const hs = Number(m.homeScore ?? 0);
    const as = Number(m.awayScore ?? 0);

    home.played += 1;
    away.played += 1;

    home.gf += hs;
    home.ga += as;

    away.gf += as;
    away.ga += hs;

    if (hs > as) {
      home.pts += 3;
    } else if (hs < as) {
      away.pts += 3;
    } else {
      home.pts += 1;
      away.pts += 1;
    }
  }

  // compute gd
  Object.values(table).forEach((r) => {
    r.gd = r.gf - r.ga;
  });

  // sort by pts, gd, gf, name
  return Object.values(table).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });
}

/* =========================
   KNOCKOUT
========================= */

function nextRoundKey(currentKey) {
  if (currentKey === "R32") return "R16";
  if (currentKey === "R16") return "QF";
  if (currentKey === "QF") return "SF";
  if (currentKey === "SF") return "F";
  return null;
}

function firstRoundKeyFromTeamCount(n) {
  if (n === 32) return "R32";
  if (n === 16) return "R16";
  if (n === 8) return "QF";
  throw new Error("Knockout: nombre d'équipes doit être 8, 16 ou 32.");
}

function buildEmptyRoundsObject(firstKey, firstMatchesCount) {
  const rounds = {};
  rounds[firstKey] = [];

  const nextKeys =
    firstKey === "R32" ? ["R16", "QF", "SF", "F"] :
    firstKey === "R16" ? ["QF", "SF", "F"] :
    ["SF", "F"];

  let count = firstMatchesCount / 2;
  for (const rk of nextKeys) {
    rounds[rk] = Array.from({ length: count }).map((_, idx) => mkMatch(rk, idx + 1, null, null));
    count = count / 2;
  }

  return rounds;
}

/**
 * Knockout standard (pas duel) :
 * - prend teams (8/16/32)
 * - crée le premier tour en random (pairing simple)
 * - crée les tours suivants vides
 */
function buildKnockoutFromTeams(teams) {
  const total = teams.length;
  const firstKey = firstRoundKeyFromTeamCount(total);
  const shuffled = shuffle(teams);

  const matchesCount = total / 2;

  const rounds = buildEmptyRoundsObject(firstKey, matchesCount);

  // fill first round
  rounds[firstKey] = [];
  for (let i = 0; i < matchesCount; i++) {
    const home = shuffled[i * 2] ?? null;
    const away = shuffled[i * 2 + 1] ?? null;
    rounds[firstKey].push(mkMatch(firstKey, i + 1, home, away));
  }

  return { rounds, winner: null };
}

/**
 * ✅ Knockout duel (1v1) :
 * - p1Teams vs p2Teams au premier tour (jamais p1 vs p1)
 * - tours suivants vides
 * - retourne rounds en OBJ (pas Map)
 */
function buildKnockoutFromDuelTeams(p1Teams, p2Teams) {
  const perPlayer = p1Teams.length;
  const total = perPlayer * 2;

  if (![8, 16, 32].includes(total)) {
    throw new Error("Duel: totalTeams doit être 8, 16 ou 32.");
  }

  const firstKey = total === 32 ? "R32" : total === 16 ? "R16" : "QF";

  const left = shuffle(p1Teams);
  const right = shuffle(p2Teams);

  const matchesCount = total / 2;
  const rounds = buildEmptyRoundsObject(firstKey, matchesCount);

  // fill first round with strict cross pairing
  rounds[firstKey] = [];
  for (let i = 0; i < perPlayer; i++) {
    rounds[firstKey].push(mkMatch(firstKey, i + 1, left[i], right[i]));
  }

  return { rounds, winner: null };
}

/**
 * Avance le bracket quand un round est complet
 * - accepte knockout.rounds en Map OU en object
 * - remplit le round suivant par paires (winner1 vs winner2)
 * - si finale complète -> set winner
 */
function advanceIfRoundComplete(knockout, roundKey) {
  // ✅ SAFE CLONE: transforme Mongoose arrays/subdocs en plain JS
  const safe = JSON.parse(JSON.stringify(knockout || {}));

  const roundsObj = safe.rounds || {};
  const current = roundsObj[roundKey];

  if (!Array.isArray(current) || current.length === 0) {
    return safe;
  }

  // round complete only if all matches with teams are validated OR BYE resolved
  const allDone = current.every((m) => {
    if (!m.home && !m.away) return true; // empty slot
    if (!!m.home && !m.away) return true; // bye
    if (!m.home && !!m.away) return true; // bye
    return m.isValidated === true && !!m.winner;
  });

  if (!allDone) return safe;

  // Finale -> winner
  if (roundKey === "F") {
    const finalMatch = current[0];
    if (finalMatch?.winner) safe.winner = finalMatch.winner;
    return safe;
  }

  // winners list in match order
  const winners = current.map((m) => m.winner || m.home || m.away || null);

  const nextKey =
    roundKey === "R32" ? "R16" :
    roundKey === "R16" ? "QF" :
    roundKey === "QF"  ? "SF" :
    roundKey === "SF"  ? "F"  : null;

  if (!nextKey) return safe;

  const nextMatchesCount = winners.length / 2;

  const existingNext = Array.isArray(roundsObj[nextKey]) ? roundsObj[nextKey] : [];
  const nextArr = [];

  for (let i = 0; i < nextMatchesCount; i++) {
    const home = winners[i * 2] ?? null;
    const away = winners[i * 2 + 1] ?? null;

    const existing = existingNext[i];
    const matchId = existing?.matchId || `${nextKey}-${i + 1}`;

    nextArr.push({
      matchId,
      roundKey: nextKey,
      home,
      away,
      homeScore: existing?.homeScore ?? 0,
      awayScore: existing?.awayScore ?? 0,
      isValidated: false,
      winner: null,
    });
  }

  roundsObj[nextKey] = nextArr;
  safe.rounds = roundsObj;

  return safe;
}


module.exports = {
  createGroups32,
  groupTable,
  buildKnockoutFromTeams,
  buildKnockoutFromDuelTeams,
  advanceIfRoundComplete,
};
