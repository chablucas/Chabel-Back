// backend/utils/draw.js

function getStars(team) {
  return Number(team.stars || team.rating || 0);
}

function countByStars(teams) {
  const counts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  for (const t of teams) {
    const s = getStars(t);
    if (counts[s] !== undefined) counts[s]++;
  }
  return counts;
}

function sumStars(teams) {
  return teams.reduce((acc, t) => acc + getStars(t), 0);
}

function scoreSplit(left, right) {
  const sumL = sumStars(left);
  const sumR = sumStars(right);
  const diffSum = Math.abs(sumL - sumR);

  const cL = countByStars(left);
  const cR = countByStars(right);

  // Diff de distribution (plus c’est proche, mieux c’est)
  let diffDist = 0;
  for (let s = 1; s <= 5; s++) diffDist += Math.abs((cL[s] || 0) - (cR[s] || 0));

  // Pondération : on privilégie d'abord la distribution, puis la somme
  // (tu peux inverser si tu préfères total stars d'abord)
  return (diffDist * 100) + diffSum;
}

// Génère toutes les combinaisons de k indices parmi n
function combinations(n, k) {
  const res = [];
  const comb = [];

  function backtrack(start, depth) {
    if (depth === k) {
      res.push([...comb]);
      return;
    }
    for (let i = start; i <= n - (k - depth); i++) {
      comb.push(i);
      backtrack(i + 1, depth + 1);
      comb.pop();
    }
  }

  backtrack(0, 0);
  return res;
}

// Tirage simple de N équipes uniques
function pickRandomTeams(pool, n) {
  const copy = [...pool];
  // shuffle Fisher-Yates
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function balancedSplit(teams, perPlayer) {
  const n = teams.length;
  const k = perPlayer;
  if (n !== k * 2) {
    throw new Error(`balancedSplit: teams.length (${n}) doit être = perPlayer*2 (${k*2})`);
  }

  const all = combinations(n, k);

  let best = null;
  let bestScore = Infinity;

  for (const idxs of all) {
    const left = [];
    const right = [];

    const set = new Set(idxs);
    for (let i = 0; i < n; i++) {
      if (set.has(i)) left.push(teams[i]);
      else right.push(teams[i]);
    }

    const sc = scoreSplit(left, right);
    if (sc < bestScore) {
      bestScore = sc;
      best = { left, right, meta: {
        leftSum: sumStars(left),
        rightSum: sumStars(right),
        leftDist: countByStars(left),
        rightDist: countByStars(right),
        score: sc
      }};
      // score 0 = parfait (même distrib ET même somme)
      if (bestScore === 0) break;
    }
  }

  return best;
}

/**
 * drawTeamsBalanced:
 * - filtre les équipes par tag/type/genre si besoin (selon ta structure)
 * - tire N équipes
 * - split équilibré en 1v1
 */
function drawTeamsBalanced({ teamsPool, totalTeams = 8, perPlayer = 4 }) {
  if (!Array.isArray(teamsPool) || teamsPool.length < totalTeams) {
    throw new Error("Pas assez d'équipes dans ce tag.");
  }
  if (totalTeams !== perPlayer * 2) {
    throw new Error("totalTeams doit être égal à perPlayer*2 (ex: 8 et 4).");
  }

  // 1) Tirage brut
  const picked = pickRandomTeams(teamsPool, totalTeams);

  // 2) Split équilibré
  const split = balancedSplit(picked, perPlayer);

  return {
    picked,
    left: split.left,
    right: split.right,
    meta: split.meta
  };
}

module.exports = {
  drawTeamsBalanced
};
