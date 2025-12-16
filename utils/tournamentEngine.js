const crypto = require("crypto");

function mid() {
  return crypto.randomBytes(8).toString("hex");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Round-robin for a group of 4 => 6 matches
function roundRobinMatches(groupKey, teams) {
  const [t1, t2, t3, t4] = teams;
  const pairs = [
    [t1, t2],
    [t3, t4],
    [t1, t3],
    [t2, t4],
    [t1, t4],
    [t2, t3],
  ];

  return pairs.map(([home, away]) => ({
    matchId: mid(),
    roundKey: `G-${groupKey}`,
    home,
    away,
    homeScore: 0,
    awayScore: 0,
    isValidated: false,
    winner: null,
  }));
}

function createGroups32(teams) {
  const shuffled = shuffle(teams);
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const groups = letters.map((key, idx) => {
    const chunk = shuffled.slice(idx * 4, idx * 4 + 4);
    return {
      key,
      teams: chunk,
      matches: roundRobinMatches(key, chunk),
    };
  });
  return groups;
}

function groupTable(group) {
  const table = new Map();
  group.teams.forEach((t) => {
    table.set(t, { team: t, pts: 0, gf: 0, ga: 0, gd: 0, played: 0 });
  });

  group.matches.forEach((m) => {
    if (!m.isValidated) return;
    const home = table.get(m.home);
    const away = table.get(m.away);
    home.played += 1;
    away.played += 1;
    home.gf += m.homeScore;
    home.ga += m.awayScore;
    away.gf += m.awayScore;
    away.ga += m.homeScore;

    if (m.homeScore > m.awayScore) home.pts += 3;
    else if (m.homeScore < m.awayScore) away.pts += 3;
    else {
      home.pts += 1;
      away.pts += 1;
    }
  });

  // recompute GD
  table.forEach((row) => (row.gd = row.gf - row.ga));

  // sort: points, goal diff, goals for, alphabetical
  return [...table.values()].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });
}

// Knockout helpers
function nextRoundKey(currentKey) {
  const map = { R32: "R16", R16: "QF", QF: "SF", SF: "F", F: null };
  return map[currentKey] ?? null;
}

function createRound(roundKey, teams) {
  // teams length must be even; null allowed to represent BYE slot
  const matches = [];
  for (let i = 0; i < teams.length; i += 2) {
    matches.push({
      matchId: mid(),
      roundKey,
      home: teams[i] ?? null,
      away: teams[i + 1] ?? null,
      homeScore: 0,
      awayScore: 0,
      isValidated: false,
      winner: null,
    });
  }
  return matches;
}

function padToPowerOfTwo(teams) {
  const n = teams.length;
  if (n === 0) return { padded: [], size: 0 };
  let p = 1;
  while (p < n) p *= 2;
  const padded = [...teams];
  while (padded.length < p) padded.push(null); // BYE slots
  return { padded, size: p };
}

function initialKnockoutRoundKey(size) {
  if (size === 32) return "R32";
  if (size === 16) return "R16";
  if (size === 8) return "QF";
  if (size === 4) return "SF";
  if (size === 2) return "F";
  return "R32"; // fallback
}

function autoValidateByes(matches) {
  // If home exists and away null => home auto-wins and validated
  // If away exists and home null => away auto-wins and validated
  matches.forEach((m) => {
    if (m.isValidated) return;
    if (m.home && !m.away) {
      m.isValidated = true;
      m.winner = m.home;
    } else if (!m.home && m.away) {
      m.isValidated = true;
      m.winner = m.away;
    }
  });
  return matches;
}

function canAdvanceRound(matches) {
  return matches.length > 0 && matches.every((m) => m.isValidated && m.winner);
}

function buildKnockoutFromTeams(teams) {
  const { padded, size } = padToPowerOfTwo(shuffle(teams));
  if (size === 0) {
    return { rounds: new Map(), winner: null };
  }
  const firstKey = initialKnockoutRoundKey(size);
  const rounds = new Map();
  rounds.set(firstKey, autoValidateByes(createRound(firstKey, padded)));
  return { rounds, winner: null };
}

function advanceIfRoundComplete(knockout, roundKey) {
  const rounds = knockout.rounds;
  const matches = rounds.get(roundKey) || [];
  if (!canAdvanceRound(matches)) return knockout;

  const nextKey = nextRoundKey(roundKey);
  if (!nextKey) {
    // final complete => winner
    knockout.winner = matches[0]?.winner ?? null;
    return knockout;
  }

  // if next round already exists, do not rebuild it
  if (rounds.has(nextKey) && (rounds.get(nextKey) || []).length > 0) return knockout;

  const winners = matches.map((m) => m.winner);
  const nextMatches = autoValidateByes(createRound(nextKey, winners));
  rounds.set(nextKey, nextMatches);

  // chain advance in case BYE auto validated makes next round complete too
  return advanceIfRoundComplete(knockout, nextKey);
}

module.exports = {
  createGroups32,
  groupTable,
  buildKnockoutFromTeams,
  advanceIfRoundComplete,
};
