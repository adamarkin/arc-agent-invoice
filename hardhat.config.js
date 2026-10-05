require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" } },
  // No networks with keys are configured on purpose: deployment is wallet-UI only.
};
