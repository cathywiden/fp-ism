const express = require("express");
const router = express.Router();
const { validateToken } = require("../access/tokenValidation");
const { determineUserRole } = require("../middlewares/roleDetermination");
const { grantDocumentAccess } = require("../controllers/grantAccessController");

router.post("/", validateToken, determineUserRole, grantDocumentAccess);

module.exports = router;
