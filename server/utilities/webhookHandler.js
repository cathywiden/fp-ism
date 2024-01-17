// server/utilities/webhookHandler.js

async function fetchWrapper(...args) {
  const { default: fetch } = await import("node-fetch");
  return fetch(...args);
}
const EventEmitter = require("./eventEmitter");

function setupWebhookListener() {
  EventEmitter.on("accessChanged", async (eventData) => {
    try {
      await fetchWrapper("http://localhost:3001", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });
      console.log("Notif payload sent:", eventData);
    } catch (error) {
      console.error("Failed to send event to frontend:", error);
    }
  });
}

module.exports = { setupWebhookListener };
