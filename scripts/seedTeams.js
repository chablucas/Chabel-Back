require("dotenv").config();
const connectDB = require("../config/db");
const Team = require("../models/Team");

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function seed() {
  try {
    await connectDB();

    const teams = [
      // ===== CLUBS MEN =====
      ["FC Barcelona", "club", "men", "Espagne", 5],
      ["Real Madrid", "club", "men", "Espagne", 5],
      ["Manchester City", "club", "men", "Angleterre", 5],
      ["Bayern Munich", "club", "men", "Allemagne", 5],
      ["Paris Saint-Germain", "club", "men", "France", 5],

      ["Arsenal", "club", "men", "Angleterre", 4],
      ["Liverpool", "club", "men", "Angleterre", 4],
      ["Chelsea", "club", "men", "Angleterre", 4],
      ["Atlético Madrid", "club", "men", "Espagne", 4],
      ["Juventus", "club", "men", "Italie", 4],
      ["Inter Milan", "club", "men", "Italie", 4],
      ["AC Milan", "club", "men", "Italie", 4],
      ["Borussia Dortmund", "club", "men", "Allemagne", 4],
      ["RB Leipzig", "club", "men", "Allemagne", 4],
      ["Napoli", "club", "men", "Italie", 4],

      ["AS Monaco", "club", "men", "France", 3],
      ["Olympique Marseille", "club", "men", "France", 3],
      ["Olympique Lyonnais", "club", "men", "France", 3],
      ["RC Lens", "club", "men", "France", 3],
      ["Real Sociedad", "club", "men", "Espagne", 3],
      ["Sevilla FC", "club", "men", "Espagne", 3],
      ["Villarreal", "club", "men", "Espagne", 3],
      ["West Ham", "club", "men", "Angleterre", 3],

      ["Stade Brestois", "club", "men", "France", 2],
      ["Getafe", "club", "men", "Espagne", 2],
      ["Torino", "club", "men", "Italie", 2],
      ["Mainz", "club", "men", "Allemagne", 2],

      // ===== CLUBS WOMEN =====
      ["FC Barcelona (F)", "club", "women", "Espagne", 5],
      ["Olympique Lyonnais (F)", "club", "women", "France", 5],
      ["Chelsea (F)", "club", "women", "Angleterre", 5],
      ["Arsenal (F)", "club", "women", "Angleterre", 4],
      ["PSG (F)", "club", "women", "France", 4],

      ["Real Madrid (F)", "club", "women", "Espagne", 4],
      ["Wolfsburg (F)", "club", "women", "Allemagne", 4],
      ["Bayern Munich (F)", "club", "women", "Allemagne", 4],
      ["Juventus (F)", "club", "women", "Italie", 3],
      ["Roma (F)", "club", "women", "Italie", 3],

      // ===== NATIONAL MEN =====
      ["France", "national", "men", "France", 5],
      ["Espagne", "national", "men", "Espagne", 5],
      ["Brésil", "national", "men", "Brésil", 5],
      ["Argentine", "national", "men", "Argentine", 5],
      ["Angleterre", "national", "men", "Angleterre", 5],

      ["Allemagne", "national", "men", "Allemagne", 4],
      ["Portugal", "national", "men", "Portugal", 4],
      ["Italie", "national", "men", "Italie", 4],
      ["Pays-Bas", "national", "men", "Pays-Bas", 4],
      ["Belgique", "national", "men", "Belgique", 4],

      ["Croatie", "national", "men", "Croatie", 3],
      ["Maroc", "national", "men", "Maroc", 3],
      ["Sénégal", "national", "men", "Sénégal", 3],
      ["Japon", "national", "men", "Japon", 3],

      // ===== NATIONAL WOMEN =====
      ["France (F)", "national", "women", "France", 5],
      ["Espagne (F)", "national", "women", "Espagne", 5],
      ["États-Unis (F)", "national", "women", "États-Unis", 5],
      ["Allemagne (F)", "national", "women", "Allemagne", 5],
      ["Angleterre (F)", "national", "women", "Angleterre", 5],

      ["Suède (F)", "national", "women", "Suède", 4],
      ["Pays-Bas (F)", "national", "women", "Pays-Bas", 4],
      ["Canada (F)", "national", "women", "Canada", 4],
      ["Brésil (F)", "national", "women", "Brésil", 4],
    ];

    const docs = teams.map(([name, type, gender, country, stars]) => ({
      name,
      slug: slugify(`${name}-${type}-${gender}`),
      type,
      gender,
      country,
      stars,
      isActive: true,
    }));

    await Team.insertMany(docs);
    console.log(`✅ Seed Teams terminé : ${docs.length}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
}

seed();
