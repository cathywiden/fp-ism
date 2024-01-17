const express = require("express");
const router = express.Router();
const documentController = require("../controllers/documentController");
const { validateToken } = require("../access/tokenValidation");

router.get("/:id", validateToken, documentController.getDocument);

module.exports = router;




