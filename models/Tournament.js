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

const TournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mode: {
      type: String,
      enum: ["groups32", "knockout"],
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tournament", TournamentSchema);
