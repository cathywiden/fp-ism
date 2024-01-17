// controllers/notificationController.js

const eventEmitter = require('../utilities/eventEmitter');
const logger = require('../utilities/logger');

const postNotification = (req, res) => {
    const { type, recipient, documentId } = req.body;
    logger.info(`Notification received: ${type}, ${recipient}, ${documentId}`);
    eventEmitter.emit("accessChanged", { type, recipient, documentId });
    res.status(200).json({ message: "Notification received" });
};

module.exports = { postNotification };
