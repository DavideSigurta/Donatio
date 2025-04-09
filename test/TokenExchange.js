const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenExchange", function () {
    let Token;
    let token;
    let TransactionRegistry;
    let registry;
    let TokenExchange;
    let exchange;
    let owner;
    let user1;
    let user2;
    const rate = 100; // 1 ETH = 100 DNT
    
    // Enumeration di TransactionType come in Solidity
    const TransactionType = {
        EXCHANGE_BUY: 0,
        EXCHANGE_SELL: 1,
        ETH_DEPOSIT: 2,
        TOKEN_WITHDRAW: 3,
        ETH_WITHDRAW: 4
    };
    
    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        
        // Deploy Token
        Token = await ethers.getContractFactory("Token");
        token = await Token.deploy();
        await token.deployed();
        
        // Deploy TransactionRegistry
        TransactionRegistry = await ethers.getContractFactory("TransactionRegistry");
        registry = await TransactionRegistry.deploy();
        await registry.deployed();
        
        // Deploy TokenExchange
        TokenExchange = await ethers.getContractFactory("TokenExchange");
        exchange = await TokenExchange.deploy(token.address, registry.address);
        await exchange.deployed();
        
        // Autorizza TokenExchange nel registro
        await registry.setContractAuthorization(exchange.address, true);
        
        // Approva TokenExchange a gestire i token dell'owner
        // Ora dobbiamo approvare un ammontare che include 18 decimali
        await token.approve(exchange.address, ethers.utils.parseEther("10000"));
        
        // Deposita ETH nell'exchange per i test di vendita
        await owner.sendTransaction({
            to: exchange.address,
            value: ethers.utils.parseEther("200")
        });
    });
    
    describe("Deployment", function () {
        it("Should set the right token", async function () {
            expect(await exchange.token()).to.equal(token.address);
        });
        
        it("Should set the right registry", async function () {
            expect(await exchange.transactionRegistry()).to.equal(registry.address);
        });
        
        it("Should set the right owner", async function () {
            expect(await exchange.owner()).to.equal(owner.address);
        });
        
        it("Should set the right rate", async function () {
            expect(await exchange.rate()).to.equal(rate);
        });
    });
    
    describe("Buying Tokens", function () {
        it("Should allow users to buy tokens", async function () {
            const etherAmount = ethers.utils.parseEther("1");
            // Con 18 decimali, il calcolo è più semplice: ethAmount * rate
            const expectedTokens = etherAmount.mul(rate);
            
            const initialUserBalance = await token.balanceOf(user1.address);
            
            await expect(exchange.connect(user1).buyTokens({ value: etherAmount }))
            .to.emit(exchange, "TokensPurchased")
            .withArgs(user1.address, etherAmount, expectedTokens);
            
            const finalUserBalance = await token.balanceOf(user1.address);
            expect(finalUserBalance.sub(initialUserBalance)).to.equal(expectedTokens);
        });
        
        it("Should record buy transactions in the registry", async function () {
            const etherAmount = ethers.utils.parseEther("1");
            // TokenAmount ora è ethAmount * rate (non più diviso per 10^18)
            const expectedTokens = etherAmount.mul(rate);
            
            await exchange.connect(user1).buyTokens({ value: etherAmount });
            
            // Verifica che la transazione sia stata registrata
            const txCount = await registry.getTransactionCount();
            expect(txCount).to.equal(2); // 1 buy + 1 deposit
            
            const tx = await registry.getTransaction(1);
            expect(tx.user).to.equal(user1.address);
            expect(tx.transactionType).to.equal(TransactionType.EXCHANGE_BUY);
            expect(tx.tokenAmount).to.equal(expectedTokens);
            expect(tx.etherAmount).to.equal(etherAmount);
        });
        
        it("Should fail if ETH amount is zero", async function () {
            await expect(exchange.connect(user1).buyTokens({ value: 0 }))
            .to.be.revertedWith("Invia ETH per comprare token");
        });
    });
    
    describe("Selling Tokens", function () {
        beforeEach(async function () {
            // User buys tokens first to have some to sell
            await exchange.connect(user1).buyTokens({ value: ethers.utils.parseEther("2") });
            
            // Approve exchange to transfer tokens on behalf of user
            const userTokens = await token.balanceOf(user1.address);
            await token.connect(user1).approve(exchange.address, userTokens);
        });
        
        it("Should allow users to sell tokens", async function () {
            // Ora lavoriamo con 100 token ma tenendo conto dei 18 decimali
            const tokenAmount = ethers.utils.parseEther("100");
            // Il calcolo è ora più semplice: tokenAmount / rate
            const expectedEther = tokenAmount.div(rate);
            
            const initialEtherBalance = await ethers.provider.getBalance(user1.address);
            
            const tx = await exchange.connect(user1).sellTokens(tokenAmount);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            
            expect(tx)
            .to.emit(exchange, "TokensSold")
            .withArgs(user1.address, tokenAmount, expectedEther);
            
            const finalEtherBalance = await ethers.provider.getBalance(user1.address);
            
            // Account for gas costs in the balance check
            expect(finalEtherBalance.add(gasUsed).sub(initialEtherBalance))
            .to.equal(expectedEther);
        });
        
        it("Should record sell transactions in the registry", async function () {
            // Ora lavoriamo con 100 token ma con 18 decimali
            const tokenAmount = ethers.utils.parseEther("100");
            // Il calcolo è ora più semplice: tokenAmount / rate
            const expectedEther = tokenAmount.div(rate);
            
            await exchange.connect(user1).sellTokens(tokenAmount);
            
            // Reset transaction count since we had a buy transaction in beforeEach
            const txCount = await registry.getTransactionCount();
            expect(txCount).to.equal(3); // 1 buy + 1 sell + 1 deposit
            
            const tx = await registry.getTransaction(2); // Index 2 poiché c'erano già transazioni precedenti
            expect(tx.user).to.equal(user1.address);
            expect(tx.transactionType).to.equal(TransactionType.EXCHANGE_SELL);
            expect(tx.tokenAmount).to.equal(tokenAmount);
            expect(tx.etherAmount).to.equal(expectedEther);
        });
        
        it("Should fail if token amount is zero", async function () {
            await expect(exchange.connect(user1).sellTokens(0))
            .to.be.revertedWith("Specifica la quantita di token da vendere");
        });
    });
    
    describe("Admin Functions", function () {
        // La maggior parte dei test per le funzioni admin rimangono invariati
        
        it("Should allow owner to withdraw tokens", async function () {
            // Ora lavoriamo con token con 18 decimali
            const tokenAmount = ethers.utils.parseEther("1000");
            await token.transfer(user1.address, tokenAmount);
            
            expect(await token.balanceOf(user1.address)).to.equal(tokenAmount);
            
            await token.connect(user1).approve(exchange.address, tokenAmount);
            
            // Il calcolo è ora più semplice: tokenAmount / rate
            const expectedEthAmount = tokenAmount.div(rate);
            
            const exchangeBalance = await ethers.provider.getBalance(exchange.address);
            expect(exchangeBalance).to.be.at.least(expectedEthAmount);
            
            await exchange.connect(user1).sellTokens(tokenAmount);
            
            // Trasferiamo direttamente alcuni token all'exchange (ora con 18 decimali)
            const withdrawAmount = ethers.utils.parseEther("500");
            await token.transfer(exchange.address, withdrawAmount);
            
            expect(await token.balanceOf(exchange.address)).to.equal(withdrawAmount);
            
            const initialOwnerBalance = await token.balanceOf(owner.address);
            
            await exchange.withdrawTokens();
            
            const finalOwnerBalance = await token.balanceOf(owner.address);
            expect(finalOwnerBalance.sub(initialOwnerBalance)).to.equal(withdrawAmount);
            
            const txCount = await registry.getTransactionCount();
            expect(txCount).to.be.above(0);
            
            const lastTxIndex = (await registry.getTransactionCount()).sub(1);
            const tx = await registry.getTransaction(lastTxIndex);
            expect(tx.user).to.equal(owner.address);
            expect(tx.transactionType).to.equal(TransactionType.TOKEN_WITHDRAW);
            expect(tx.tokenAmount).to.equal(withdrawAmount);
        });
    });
    
    describe("Transaction Querying Compatibility", function () {
        beforeEach(async function () {
            // Crea alcune transazioni per i test
            await exchange.connect(user1).buyTokens({ value: ethers.utils.parseEther("1") }); 
            await exchange.depositETH({ value: ethers.utils.parseEther("2") });
            
            // Approva e vendi token (ora con 18 decimali)
            const userTokens = await token.balanceOf(user1.address);
            await token.connect(user1).approve(exchange.address, userTokens);
            await exchange.connect(user1).sellTokens(ethers.utils.parseEther("50"));
        });
        
        it("Should return correct transaction count", async function () {
            const txCount = await exchange.getTransactionCount();
            expect(txCount).to.equal(4); // 1 buy + 1 deposit + 1 sell + 1 initial deposit
        });
        
        it("Should get a transaction by index with compatibility format", async function () {
            // Verifica la transazione di acquisto
            const buyTx = await exchange.getTransaction(1);
            expect(buyTx.user).to.equal(user1.address);
            expect(buyTx.isBuy).to.equal(true); // EXCHANGE_BUY viene mappato a true
            // Ora il calcolo è più diretto: ethAmount * rate
            expect(buyTx.tokenAmount).to.equal(ethers.utils.parseEther("1").mul(rate));
            
            // Verifica la transazione di deposito
            const depositTx = await exchange.getTransaction(2);
            expect(depositTx.user).to.equal(owner.address);
            expect(depositTx.isBuy).to.equal(true); // ETH_DEPOSIT viene mappato a true
            expect(depositTx.etherAmount).to.equal(ethers.utils.parseEther("2"));
            
            // Verifica la transazione di vendita
            const sellTx = await exchange.getTransaction(3);
            expect(sellTx.user).to.equal(user1.address);
            expect(sellTx.isBuy).to.equal(false); // EXCHANGE_SELL viene mappato a false
            expect(sellTx.tokenAmount).to.equal(ethers.utils.parseEther("50"));
        });
        
        it("Should get transaction batch with compatibility format", async function () {
            const batch = await exchange.getTransactionBatch(1, 3);
            expect(batch.users.length).to.equal(3);
            expect(batch.isBuys[0]).to.equal(true);   // EXCHANGE_BUY
            expect(batch.isBuys[1]).to.equal(true);   // ETH_DEPOSIT
            expect(batch.isBuys[2]).to.equal(false);  // EXCHANGE_SELL
            expect(batch.users[0]).to.equal(user1.address);
            expect(batch.users[1]).to.equal(owner.address);
            expect(batch.users[2]).to.equal(user1.address);
        });
    });
});