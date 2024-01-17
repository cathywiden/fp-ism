function getUserRole(req, res) {
  res.json({ role: req.user.role });
}

module.exports = { getUserRole };
