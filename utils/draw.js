// backend/utils/draw.js

function getStars(team) {
  return Number(team.stars || team.rating || 0);
}

function sumStars(teams) {
  return teams.reduce((acc, t) => acc + getStars(t), 0);
}

function countByStars(teams) {
  const counts = { 1:0, 1.5:0, 2:0, 2.5:0, 3:0, 3.5:0, 4:0, 4.5:0, 5:0 };
  for (const t of teams) {
    const s = getStars(t);
    if (counts[s] !== undefined) counts[s]++;
  }
  return counts;
}

function scoreSplit(left, right) {
  const diffSum = Math.abs(sumStars(left) - sumStars(right));

  const cL = countByStars(left);
  const cR = countByStars(right);

  // Diff de distribution (1..5 et demi)
  const keys = Object.keys(cL);
  let diffDist = 0;
  for (const k of keys) diffDist += Math.abs((cL[k] || 0) - (cR[k] || 0));

  // Priorité: distrib puis somme
  return diffDist * 100 + diffSum;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomTeams(pool, n) {
  return shuffle(pool).slice(0, n);
}

/**
 * Split équilibré scalable (8/16/32):
 * 1) Tri desc par stars
 * 2) Répartition greedy pour équilibrer la somme (et taille égale)
 * 3) Optimisation locale par swaps (améliore score distrib + somme)
 */
function balancedSplitGreedy(teams, perPlayer) {
  const total = teams.length;
  if (total !== perPlayer * 2) {
    throw new Error(`balancedSplitGreedy: teams.length (${total}) != perPlayer*2 (${perPlayer*2})`);
  }

  // Mélange léger pour éviter toujours mêmes splits à étoiles identiques
  const randomized = shuffle(teams);

  // Tri par étoiles desc, puis nom pour stabilité
  const sorted = [...randomized].sort((a, b) => {
    const ds = getStars(b) - getStars(a);
    if (ds !== 0) return ds;
    return String(a.name).localeCompare(String(b.name));
  });

  const left = [];
  const right = [];

  // Greedy : on place dans l’équipe qui a le moins d’étoiles, en respectant la taille
  for (const t of sorted) {
    const sumL = sumStars(left);
    const sumR = sumStars(right);

    const canL = left.length < perPlayer;
    const canR = right.length < perPlayer;

    if (canL && canR) {
      if (sumL <= sumR) left.push(t);
      else right.push(t);
    } else if (canL) left.push(t);
    else right.push(t);
  }

  // Optimisation locale : swaps pour réduire score
  let bestL = left;
  let bestR = right;
  let bestScore = scoreSplit(bestL, bestR);

  // nombre d’itérations raisonnable (rapide)
  const maxIters = 4000;

  for (let iter = 0; iter < maxIters; iter++) {
    const i = Math.floor(Math.random() * perPlayer);
    const j = Math.floor(Math.random() * perPlayer);

    const newL = [...bestL];
    const newR = [...bestR];

    // swap
    const tmp = newL[i];
    newL[i] = newR[j];
    newR[j] = tmp;

    const sc = scoreSplit(newL, newR);
    if (sc < bestScore) {
      bestScore = sc;
      bestL = newL;
      bestR = newR;

      // parfait
      if (bestScore === 0) break;
    }
  }

  return {
    left: bestL,
    right: bestR,
    meta: {
      leftSum: sumStars(bestL),
      rightSum: sumStars(bestR),
      leftDist: countByStars(bestL),
      rightDist: countByStars(bestR),
      score: bestScore,
    },
  };
}

function drawTeamsBalanced({ teamsPool, totalTeams, perPlayer }) {
  if (!Array.isArray(teamsPool) || teamsPool.length < totalTeams) {
    throw new Error("Pas assez d'équipes dans ce tag/filtre.");
  }
  if (totalTeams !== perPlayer * 2) {
    throw new Error("totalTeams doit être égal à perPlayer*2 (ex: 16 et 8).");
  }

  const picked = pickRandomTeams(teamsPool, totalTeams);
  const split = balancedSplitGreedy(picked, perPlayer);

  return {
    picked,
    left: split.left,
    right: split.right,
    meta: split.meta,
  };
}

module.exports = {
  drawTeamsBalanced,
};
