// server/routes/requestAccessRoutes.js

const express = require("express");
const router = express.Router();
const { validateToken } = require("../access/tokenValidation");
const { determineUserRole } = require("../middlewares/roleDetermination");
const { requestDocumentAccess } = require("../controllers/requestAcessController");

router.post("/", validateToken, determineUserRole, requestDocumentAccess);

module.exports = router;
