  // Script per il deployment dei contratti Donatio sulla blockchain
  // Può essere eseguito tramite `npx hardhat run scripts/deploy.js`

  const { ethers } = require("hardhat");
  const fs = require("fs");

  /**
   * Funzione principale per il deployment dei contratti
   * Configura e deployer i contratti Token e TokenExchange
   */
  async function main() {
    // Ottieni l'account del deployer
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString()); 

    // ========== DEPLOY TOKEN CONTRACT ==========
    // Ottieni la factory del contratto Token
    const Token = await ethers.getContractFactory("Token");
    // Deploy del contratto Token
    const token = await Token.deploy();
    // Attendi che il deploy sia completato e confermato sulla blockchain
    await token.deployed();
    console.log("Token address:", token.address);
    
    // Verifica il saldo del deployer (dovrebbe avere tutti i token)
    const deployerBalance = await token.balanceOf(deployer.address);
    console.log("Deployer token balance:", deployerBalance.toString()); 
  
    // ========== DEPLOY EXCHANGE CONTRACT ==========
    // Ottieni la factory del contratto TokenExchange
    const TokenExchange = await ethers.getContractFactory("TokenExchange");
    // Deploy del contratto TokenExchange passando l'indirizzo del token come parametro
    const exchange = await TokenExchange.deploy(token.address);
    // Attendi che il deploy sia completato
    await exchange.deployed();
    console.log("TokenExchange address:", exchange.address);
    
    // ========== CONFIGURA APPROVAZIONI ==========
    // Approva l'exchange a spendere i token del deployer (necessario per buyTokens)
    const totalSupply = await token.totalSupply();
    const approveTx = await token.approve(exchange.address, totalSupply);
    await approveTx.wait();
    console.log("Exchange approved to spend up to", totalSupply.toString(), "tokens");
    
    // Verifica che l'approvazione sia stata registrata correttamente
    const allowance = await token.allowance(deployer.address, exchange.address);
    console.log("Exchange allowance:", allowance.toString());
    
    // ========== DEPOSITA ETH NEL CONTRATTO ==========
    // NUOVO: Utilizza la funzione depositETH per alimentare il buffer iniziale
    console.log("Depositando ETH nel contratto exchange...");
    // Deposita 1 ETH inizialmente nel contratto per consentire scambi immediati
    const ethToDeposit = ethers.utils.parseEther("1000");
    
    // Chiama depositETH e passa l'ETH come valore della transazione
    const depositTx = await exchange.depositETH({ value: ethToDeposit });
    await depositTx.wait();
    console.log(`Depositato ${ethers.utils.formatEther(ethToDeposit)} ETH nel contratto exchange`);

    // ========== SALVA INDIRIZZI E ABI PER IL FRONTEND ==========
    // Crea la directory se non esiste
    const contractsDir = __dirname + "/../frontend/src/contracts";
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }

    // Salva gli indirizzi dei contratti in un file JSON
    fs.writeFileSync(
      contractsDir + "/contract-address.json",
      JSON.stringify({ Token: token.address, TokenExchange: exchange.address }, undefined, 2)
    );

    // Salva gli ABI dei contratti
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
  }

  // Gestione degli errori e avvio della funzione principale
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });