const router = require("express").Router();
const ctrl = require("../controllers/teamController");

// list + filtres
router.get("/", ctrl.listTeams);

// countries (pour alimenter le select pays)
router.get("/countries", ctrl.listCountries);

// random par étoiles
router.get("/random", ctrl.randomTeams);

module.exports = router;
