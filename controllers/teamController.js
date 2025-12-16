const Team = require("../models/Team");

function escapeRegex(str = "") {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/teams?type=club&gender=men&country=France&stars=5&search=bar&limit=200
exports.listTeams = async (req, res) => {
  try {
    const { type, gender, country, stars, search, limit = 200 } = req.query;

    const filter = { isActive: true };

    if (type) filter.type = type;
    if (gender) filter.gender = gender;
    if (country) filter.country = country;
    if (stars) filter.stars = Number(stars);

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { country: rx }, { shortName: rx }];
    }

    const teams = await Team.find(filter)
      .sort({ stars: -1, name: 1 })
      .limit(Math.min(Number(limit), 500));

    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/teams/countries?type=club&gender=men
exports.listCountries = async (req, res) => {
  try {
    const { type, gender } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    if (gender) filter.gender = gender;

    const countries = await Team.distinct("country", filter);
    countries.sort((a, b) => a.localeCompare(b));
    res.json(countries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/teams/random?type=club&gender=men&stars=4&count=8&country=Espagne
exports.randomTeams = async (req, res) => {
  try {
    const { type, gender, stars, count = 8, country } = req.query;

    const match = { isActive: true };
    if (type) match.type = type;
    if (gender) match.gender = gender;
    if (country) match.country = country;
    if (stars) match.stars = Number(stars);

    const n = Math.min(Math.max(Number(count), 1), 64);

    const teams = await Team.aggregate([
      { $match: match },
      { $sample: { size: n } },
    ]);

    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
