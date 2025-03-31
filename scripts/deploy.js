// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  // Get the signers
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy Token contract
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy();
  await token.deployed();
  console.log("Token address:", token.address);
  
  // Verifica il saldo del deployer (dovrebbe avere tutti i token)
  const deployerBalance = await token.balanceOf(deployer.address);
  console.log("Deployer token balance:", deployerBalance.toString());

  // Deploy TokenExchange contract
  const TokenExchange = await ethers.getContractFactory("TokenExchange");
  const exchange = await TokenExchange.deploy(token.address);
  await exchange.deployed();
  console.log("TokenExchange address:", exchange.address);
  
  // IMPORTANTE: Approva l'exchange a spendere i token del deployer
  // Usa la totalSupply come quantità massima di approvazione
  const totalSupply = await token.totalSupply();
  const approveTx = await token.approve(exchange.address, totalSupply);
  await approveTx.wait();
  console.log("Exchange approved to spend up to", totalSupply.toString(), "tokens");
  
  // Verifica l'approvazione
  const allowance = await token.allowance(deployer.address, exchange.address);
  console.log("Exchange allowance:", allowance.toString());
  
  // I token rimangono nel wallet del deployer
  console.log("Deployer keeps all tokens. Final balance:", deployerBalance.toString());

  // Salva gli indirizzi dei contratti in un file JSON per il frontend
  const contractsDir = __dirname + "/../frontend/src/contracts";
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  fs.writeFileSync(
    contractsDir + "/contract-address.json",
    JSON.stringify({ Token: token.address, TokenExchange: exchange.address }, undefined, 2)
  );

  // Copia gli artefatti dei contratti nel frontend
  const TokenArtifact = artifacts.readArtifactSync("Token");
  fs.writeFileSync(
    contractsDir + "/Token.json",
    JSON.stringify(TokenArtifact, null, 2)
  );

  const TokenExchangeArtifact = artifacts.readArtifactSync("TokenExchange");
  fs.writeFileSync(
    contractsDir + "/TokenExchange.json",
    JSON.stringify(TokenExchangeArtifact, null, 2)
  );

  console.log("Deployment completed! Contract addresses and artifacts saved.");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});