const express = require("express");
const router = express.Router();
const validateJWT = require("../middlewares/validateJWT");
const { postNotification } = require("../controllers/notificationController");

router.post("/", validateJWT, postNotification);

module.exports = router;
