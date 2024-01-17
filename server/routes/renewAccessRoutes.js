const express = require("express");
const router = express.Router();
const { validateToken } = require("../access/tokenValidation");
const { determineUserRole } = require("../middlewares/roleDetermination");
const { renewDocumentAccess } = require("../controllers/renewAccessController");

router.post("/:id", validateToken, determineUserRole, renewDocumentAccess);

module.exports = router;
