const { generateToken } = require("../utilities/JWTGenerator");

function generateAuthToken(user) {
  return generateToken({
    username: user.username,
    role: user.role,
    walletAddress: user.walletAddress,
  });
}

module.exports = { generateAuthToken };
