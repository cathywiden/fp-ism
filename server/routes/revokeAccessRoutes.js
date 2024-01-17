const express = require("express");
const router = express.Router();
const { validateToken } = require("../access/tokenValidation");
const { determineUserRole } = require("../middlewares/roleDetermination");
const { revokeDocumentAccess } = require("../controllers/revokeAccessController");

router.post("/", validateToken, determineUserRole, revokeDocumentAccess);

module.exports = router;
