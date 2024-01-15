// server/authController.js

const authService = require("../middlewares/authService");
const tokenService = require("../middlewares/tokenService");

function login(req, res) {
  const { username, password } = req.body;
  const user = authService.loginUser(username, password);

  if (user) {
    const token = tokenService.generateAuthToken(user);
    res.json({ token });
  } else {
    res.status(401).send('Invalid credentials');
  }
}

module.exports = {
  login,
};
