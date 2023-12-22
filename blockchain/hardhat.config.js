// blockchain/hardhat.config.js

require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");

module.exports = {
  solidity: {
    version: "0.8.21",
  },

  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,

      // metaMask account private key
      accounts: [
        process.env.PRIVATE_KEY,
      ],
    },
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
