const mongoose = require("mongoose");

const MatchSchema = new mongoose.Schema(
  {
    matchId: { type: String, required: true }, // stable id
    roundKey: { type: String, required: true }, // e.g. "G-A" or "R16" or "QF"
    home: { type: String, default: null }, // team name or null (bye slot)
    away: { type: String, default: null },
    homeScore: { type: Number, default: 0 },
    awayScore: { type: Number, default: 0 },
    isValidated: { type: Boolean, default: false },
    winner: { type: String, default: null },
  },
  { _id: false }
);

const GroupSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // "A".."H"
    teams: [{ type: String, required: true }],
    matches: [MatchSchema],
  },
  { _id: false }
);

// ✅ NEW: duel mode storage (J1/J2 split, stars meta, etc.)
const DuelSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    perPlayer: { type: Number, default: 4 }, // 4 teams each by default
    tag: { type: String, default: null },
    type: { type: String, default: null },
    gender: { type: String, default: null },
    players: [
      {
        name: { type: String, required: true },
        teams: [{ type: String, required: true }],
      },
    ],
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const TournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mode: {
      type: String,
      enum: ["groups32", "knockout"], // ✅ on garde ça pour ne rien casser
      required: true,
    },
    teams: [{ type: String }], // list of team names (can be empty for knockout)
    groups: [GroupSchema], // for groups32
    knockout: {
      rounds: {
        type: Map,
        of: [MatchSchema], // keys: R32, R16, QF, SF, F
      },
      winner: { type: String, default: null },
    },

    // ✅ NEW
    duel: { type: DuelSchema, default: { enabled: false } },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tournament", TournamentSchema);
