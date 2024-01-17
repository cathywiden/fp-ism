const express = require("express");
const router = express.Router();
const validateJWT = require("../middlewares/validateJWT");
require("../middlewares/roleDetermination");

const { getSharedDocuments } = require("../controllers/sharedDocsController");

router.get("/", validateJWT, getSharedDocuments);

module.exports = router;
