const express = require("express");
const router = express.Router();
const { validateToken } = require("../access/tokenValidation");
const { determineUserRole } = require("../middlewares/roleDetermination");
const { denyDocumentAccess } = require("../controllers/denyAccessController");

router.post("/", validateToken, determineUserRole, denyDocumentAccess);

module.exports = router;
