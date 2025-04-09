const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // 1. Deploy Token contract
  const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.deploy();
  await token.deployed();
  console.log("Token deployed to:", token.address);

  // 2. Deploy TransactionRegistry contract
  const TransactionRegistry = await hre.ethers.getContractFactory("TransactionRegistry");
  const transactionRegistry = await TransactionRegistry.deploy();
  await transactionRegistry.deployed();
  console.log("TransactionRegistry deployed to:", transactionRegistry.address);

  // 3. Deploy TokenExchange contract
  const TokenExchange = await hre.ethers.getContractFactory("TokenExchange");
  const exchange = await TokenExchange.deploy(token.address, transactionRegistry.address);
  await exchange.deployed();
  console.log("TokenExchange deployed to:", exchange.address);

  // 4. Authorize TokenExchange in TransactionRegistry
  const authorizeTx = await transactionRegistry.setContractAuthorization(exchange.address, true);
  await authorizeTx.wait();
  console.log("TokenExchange authorized in TransactionRegistry");

  // 5. Approve TokenExchange to transfer tokens on behalf of the owner
  const approveTx = await token.approve(exchange.address, hre.ethers.constants.MaxUint256);
  await approveTx.wait();
  console.log("TokenExchange approved to transfer tokens");

  // 6. Deposit ETH to the exchange for selling tokens
  const depositTx = await exchange.depositETH({value: hre.ethers.utils.parseEther("1000")});
  await depositTx.wait();
  console.log("Deposited 1000 ETH to the exchange");

  // 7. Save contract info for the frontend
  const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  // Save ABIs
  fs.writeFileSync(
    path.join(contractsDir, "Token.json"),
    JSON.stringify({ abi: JSON.parse(token.interface.format("json")) }, null, 2)
  );

  fs.writeFileSync(
    path.join(contractsDir, "TokenExchange.json"),
    JSON.stringify({ abi: JSON.parse(exchange.interface.format("json")) }, null, 2)
  );

  fs.writeFileSync(
    path.join(contractsDir, "TransactionRegistry.json"),
    JSON.stringify({ abi: JSON.parse(transactionRegistry.interface.format("json")) }, null, 2)
  );

  // Save contract addresses
  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify({
      Token: token.address,
      TokenExchange: exchange.address,
      TransactionRegistry: transactionRegistry.address
    }, null, 2)
  );

  console.log("Contract artifacts saved to frontend directory");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });