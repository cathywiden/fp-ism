const { listenForDocumentAccessEvents } = require("../utilities/smartContractUtils");

function startEventCapture() {
  try {
    listenForDocumentAccessEvents();
    console.log("Started capturing document access events.");
  } catch (error) {
    console.error("Error starting document access event capture:", error);
  }
}

module.exports = {
  startEventCapture,
};