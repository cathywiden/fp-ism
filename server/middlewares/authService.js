// server/middlewares/authService.js

require("dotenv").config({ path: "../../.env" });

// hardcoded credentials for MVP
const USERS = {
    user1: {
      username: "user1",
      password: "user1",
      role: "Sharer, Auditor",
      walletAddress: process.env.WALLET1,
    },
    user2: {
      username: "user2",
      password: "user2",
      role: "Receiver",
      walletAddress: process.env.WALLET2,
    },
  };

  function loginUser(username, password) {
    const user = USERS[username];
    if (user && user.password === password) {
      return user;
    }
    return null;
  }
  
  module.exports = { loginUser };