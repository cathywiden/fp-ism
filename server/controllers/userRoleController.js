// server/controllers/userRoleController.js

const { validateJWT } = require("../middlewares/validateJWT");
const { determineUserRole } = require("../middlewares/roleDetermination");
const logger = require("../utilities/logger");

function getUserRole(req, res) {
  res.json({ role: req.user.role });
}

module.exports = { getUserRole };
