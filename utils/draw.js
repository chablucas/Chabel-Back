// backend/utils/draw.js
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickUnique(list, n) {
  const shuffled = shuffle(list);
  return shuffled.slice(0, n);
}

/**
 * drawTeams({
 *   pool, count,
 *   stars: [5] OU [3,4] OU null
 *   mix: [{stars:5,count:8},{stars:4,count:8}] optionnel
 * })
 */
function drawTeams({ pool, count, stars = null, mix = null }) {
  if (mix && Array.isArray(mix) && mix.length > 0) {
    const chosen = [];
    const used = new Set();

    for (const part of mix) {
      const partPool = pool.filter(t => t.stars === Number(part.stars) && !used.has(t.name));
      if (partPool.length < part.count) {
        throw new Error(`Pas assez d'équipes en ${part.stars}⭐ (demandé ${part.count}, dispo ${partPool.length}).`);
      }
      const pick = pickUnique(partPool, part.count);
      pick.forEach(x => used.add(x.name));
      chosen.push(...pick);
    }

    return shuffle(chosen);
  }

  // stars filter simple
  let filtered = pool;
  if (Array.isArray(stars) && stars.length > 0) {
    const sset = new Set(stars.map(Number));
    filtered = filtered.filter(t => sset.has(t.stars));
  }

  if (filtered.length < count) {
    throw new Error(`Pas assez d'équipes (demandé ${count}, dispo ${filtered.length}).`);
  }

  return pickUnique(filtered, count);
}

module.exports = { drawTeams };
