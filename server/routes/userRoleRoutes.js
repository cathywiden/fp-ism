// server/routes/userRoleRoutes.js

const express = require("express");
const router = express.Router();
const userRoleController = require("../controllers/userRoleController");

router.get("/", userRoleController.getUserRole);

module.exports = router;
