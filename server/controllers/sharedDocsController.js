const logger = require("../utilities/logger");
const { getAllSharedDocs } = require("../utilities/dbUtils");

async function getSharedDocuments(req, res) {
  try {
    const userType = req.user.role.includes("Receiver") ? "user2" : "user1";
    let sharedDocs = await getAllSharedDocs(userType);
    const currentTime = Math.floor(Date.now() / 1000);

    if (userType === "user2") {
      // do not display expired documents for user2
      sharedDocs = sharedDocs.filter((doc) => doc.TOKEN_EXP_TS > currentTime);
    } else {
      // for user1:
      // mark documents as expired based on timestamp
      sharedDocs = sharedDocs.map((doc) => {
        if (doc.STATUS === "granted" && doc.TOKEN_EXP_TS < currentTime) {
          return { ...doc, STATUS: "expired" };
        }
        return doc;
      });
    }

    res.json(sharedDocs);
  } catch (error) {
    console.error("Error in /shared-docs endpoint:", error);
    res.status(500).send("Error fetching shared documents");
  }
}

module.exports = { getSharedDocuments };
