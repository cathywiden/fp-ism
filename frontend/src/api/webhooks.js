// frontend/src/api/webhooks.js

import toast from "react-hot-toast";
let socket;

export function getSocket() {
  return socket;
}

function setupWebhook() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return; // exit if socket already open
  }
  socket = new WebSocket("ws://localhost:3001");

  socket.onopen = () => {
    console.log("Connected to notifications socket");
  };

  socket.onmessage = (event) => {
    console.log("Notification received:", event.data);
    const notification = JSON.parse(event.data);

    switch (notification.type) {
      case "AccessGranted":
        toast(
          `Document ${notification.documentId} has been shared with ${notification.recipient}`
        );
        break;
      case "AccessRevoked":
        toast(
          `Access to document ${notification.documentId} has been revoked from ${notification.recipient}`
        );
        break;
      case "AccessDenied":
        toast(
          `Access to document ${notification.documentId} has been denied for ${notification.recipient}`
        );
        break;
      case "AccessRequested":
        toast(
          `Access to document ${notification.documentId} has been requested by ${notification.recipient}`
        );
        break;
      case "AccessRenewed":
        toast(
          `Access to document ${notification.documentId} has been renewed for ${notification.recipient}`
        );
        break;
      default:
        console.log("Unhandled notification type:", notification.type);
    }
  };
}

export { setupWebhook };
