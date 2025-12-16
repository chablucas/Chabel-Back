const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // club | national
    type: { type: String, enum: ["club", "national"], required: true },

    // men | women
    gender: { type: String, enum: ["men", "women"], required: true },

    // Ex: "France", "Espagne"
    country: { type: String, required: true, trim: true },

    // étoiles 1..5 (pour ton random)
    stars: { type: Number, min: 1, max: 5, default: 3 },

    shortName: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TeamSchema.index({ name: "text", country: "text" });

module.exports = mongoose.model("Team", TeamSchema);
