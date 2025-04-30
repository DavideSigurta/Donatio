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

  // 5. Deploy CreatorRequestManager contract
  const CreatorRequestManager = await hre.ethers.getContractFactory("CreatorRequestManager");
  const requestManager = await CreatorRequestManager.deploy();
  await requestManager.deployed();
  console.log("CreatorRequestManager deployed to:", requestManager.address);

  // 5.5 Deploy MilestoneManager contract (NUOVO)
  const MilestoneManager = await hre.ethers.getContractFactory("MilestoneManager");
  const milestoneManager = await MilestoneManager.deploy();
  await milestoneManager.deployed();
  console.log("MilestoneManager deployed to:", milestoneManager.address);

  // 6. Deploy CampaignFactory contract (MODIFICATO)
  const CampaignFactory = await hre.ethers.getContractFactory("CampaignFactory");
  const campaignFactory = await CampaignFactory.deploy(
    token.address, 
    transactionRegistry.address, 
    requestManager.address,
    milestoneManager.address  // Nuovo parametro
  );
  await campaignFactory.deployed();
  console.log("CampaignFactory deployed to:", campaignFactory.address);
  
  // 7. Set CampaignFactory in CreatorRequestManager
  const setFactoryTx = await requestManager.setCampaignFactory(campaignFactory.address);
  await setFactoryTx.wait();
  console.log("CampaignFactory address set in CreatorRequestManager");

  // 7.5 Set CampaignFactory as admin of MilestoneManager
  const currentAdmin = await milestoneManager.admin(); // Prima verifica l'admin corrente
  if (currentAdmin !== campaignFactory.address) {
    // Solo se necessario, imposta CampaignFactory come admin del MilestoneManager
    const setAdminTx = await milestoneManager.setAdmin(campaignFactory.address);
    await setAdminTx.wait();
    console.log("CampaignFactory set as admin in MilestoneManager");
  }

  // 8. Authorize CampaignFactory as a manager in TransactionRegistry
  const authorizeManagerTx = await transactionRegistry.setManagerAuthorization(campaignFactory.address, true);
  await authorizeManagerTx.wait();
  console.log("CampaignFactory authorized as manager in TransactionRegistry");

  // 9. Approve TokenExchange to transfer tokens on behalf of the owner
  const approveTx = await token.approve(exchange.address, hre.ethers.constants.MaxUint256);
  await approveTx.wait();
  console.log("TokenExchange approved to transfer tokens");

  // 10. Deposit ETH to the exchange for selling tokens
  const depositTx = await exchange.depositETH({value: hre.ethers.utils.parseEther("1000")});
  await depositTx.wait();
  console.log("Deposited 1000 ETH to the exchange");

  // 11. Save contract info for the frontend
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

  fs.writeFileSync(
    path.join(contractsDir, "CampaignFactory.json"),
    JSON.stringify({ abi: JSON.parse(campaignFactory.interface.format("json")) }, null, 2)
  );
  
  fs.writeFileSync(
    path.join(contractsDir, "CreatorRequestManager.json"),
    JSON.stringify({ abi: JSON.parse(requestManager.interface.format("json")) }, null, 2)
  );

  // Salvataggio dell'ABI di MilestoneManager (NUOVO)
  fs.writeFileSync(
    path.join(contractsDir, "MilestoneManager.json"),
    JSON.stringify({ abi: JSON.parse(milestoneManager.interface.format("json")) }, null, 2)
  );

  // Salvataggio aggiornato degli indirizzi dei contratti (MODIFICATO)
  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify({
      Token: token.address,
      TokenExchange: exchange.address,
      TransactionRegistry: transactionRegistry.address,
      CampaignFactory: campaignFactory.address,
      CreatorRequestManager: requestManager.address,
      MilestoneManager: milestoneManager.address  // Nuovo indirizzo
    }, null, 2)
  );

  const Campaign = await hre.ethers.getContractFactory("Campaign");
  fs.writeFileSync(
    path.join(contractsDir, "Campaign.json"),
    JSON.stringify({ abi: JSON.parse(Campaign.interface.format("json")) }, null, 2)
  );
  console.log("Campaign ABI saved for frontend");

  console.log("Contract artifacts saved to frontend directory");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });