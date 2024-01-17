// websocketManager.js

import { toast } from "react-hot-toast";
let socket = null;

export function getSocket() {
  return socket;
}

export function setupWebhook(currentUserRole) {
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    socket = new WebSocket("ws://localhost:3001");

    socket.onopen = () => {
      console.log("Connected to notifications socket");
    };

    socket.onmessage = (event) => {
      console.log("Notification received:", event.data);
      const notification = JSON.parse(event.data);
      if (notification.recipient === currentUserRole) {
        toast(`Document ${notification.documentId} has been shared with you`);
      }
    };
  }
}
