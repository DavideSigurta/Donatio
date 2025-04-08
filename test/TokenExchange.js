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
            const expectedTokens = etherAmount.mul(rate).div(ethers.utils.parseEther("1"));
            
            const initialUserBalance = await token.balanceOf(user1.address);
            
            await expect(exchange.connect(user1).buyTokens({ value: etherAmount }))
            .to.emit(exchange, "TokensPurchased")
            .withArgs(user1.address, etherAmount, expectedTokens);
            
            const finalUserBalance = await token.balanceOf(user1.address);
            expect(finalUserBalance.sub(initialUserBalance)).to.equal(expectedTokens);
        });
        
        it("Should record buy transactions in the registry", async function () {
            const etherAmount = ethers.utils.parseEther("1");
            const expectedTokens = etherAmount.mul(rate).div(ethers.utils.parseEther("1"));
            
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
            const tokenAmount = ethers.BigNumber.from("100");
            const expectedEther = tokenAmount.mul(ethers.utils.parseEther("1")).div(rate);
            
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
            const tokenAmount = ethers.BigNumber.from("100");
            const expectedEther = tokenAmount.mul(ethers.utils.parseEther("1")).div(rate);
            
            await exchange.connect(user1).sellTokens(tokenAmount);
            
            // Reset transaction count since we had a buy transaction in beforeEach
            const txCount = await registry.getTransactionCount();
            expect(txCount).to.equal(3); // 1 buy + 1 sell + 1 deposit
            
            const tx = await registry.getTransaction(2); // Index 1 poiché c'era già una transazione di acquisto
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
        it("Should allow owner to deposit ETH", async function () {
            const initialBalance = await ethers.provider.getBalance(exchange.address);
            const depositAmount = ethers.utils.parseEther("1");
            
            await expect(exchange.depositETH({ value: depositAmount }))
            .to.emit(exchange, "ETHDeposited")
            .withArgs(owner.address, depositAmount);
            
            const finalBalance = await ethers.provider.getBalance(exchange.address);
            expect(finalBalance.sub(initialBalance)).to.equal(depositAmount);
        });
        
        it("Should not allow non-owner to deposit ETH", async function () {
            await expect(exchange.connect(user1).depositETH({ value: ethers.utils.parseEther("1") }))
            .to.be.revertedWith("Solo l'owner puo' depositare ETH");
        });
        
        it("Should allow owner to withdraw ETH", async function () {
            const initialBalance = await ethers.provider.getBalance(owner.address); // Saldo iniziale dell'owner
            const initialExchangeBalance = await ethers.provider.getBalance(exchange.address); // Saldo iniziale dell'exchange
            
            const tx = await exchange.withdrawETH(); 
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            
            const finalBalance = await ethers.provider.getBalance(owner.address);
            expect(finalBalance.add(gasUsed).sub(initialBalance)).to.equal(initialExchangeBalance);
            
            // Verifica che il registro abbia registrato la transazione
            const txCount = await registry.getTransactionCount();
            expect(txCount).to.equal(2); // Solo il prelievo di ETH + 1 deposito
            
            const registryTx = await registry.getTransaction(1);
            expect(registryTx.user).to.equal(owner.address);
            expect(registryTx.transactionType).to.equal(TransactionType.ETH_WITHDRAW);
        });
        
        it("Should not allow non-owner to withdraw ETH", async function () {
            await expect(exchange.connect(user1).withdrawETH())
            .to.be.revertedWith("Solo l'owner puo ritirare ETH");
        });
        
        it("Should allow owner to withdraw tokens", async function () {
            // 1. Prima trasferiamo dei token a user1
            const tokenAmount = ethers.BigNumber.from("1000");
            await token.transfer(user1.address, tokenAmount);
            
            // 2. Verifichiamo che user1 abbia ricevuto i token
            expect(await token.balanceOf(user1.address)).to.equal(tokenAmount);
            
            // 3. User1 approva l'exchange a spendere i suoi token
            await token.connect(user1).approve(exchange.address, tokenAmount);
            
            // 4. Calcoliamo quanti ETH dovrebbe ricevere user1
            // Usare lo stesso calcolo di altri test funzionanti: (tokenAmount * 10^18) / rate
            const expectedEthAmount = tokenAmount.mul(ethers.utils.parseEther("1")).div(rate);
            
            // 5. Verifichiamo che l'exchange abbia abbastanza ETH (debug)
            const exchangeBalance = await ethers.provider.getBalance(exchange.address);
            console.log(`Exchange ETH balance: ${ethers.utils.formatEther(exchangeBalance)} ETH`);
            console.log(`Required ETH: ${ethers.utils.formatEther(expectedEthAmount)} ETH`);
            expect(exchangeBalance).to.be.at.least(expectedEthAmount);
            
            // 6. User1 vende i token
            await exchange.connect(user1).sellTokens(tokenAmount);
            
            // 7. Verifichiamo che i token siano stati trasferiti all'owner
            // Poiché i token vengono immediatamente trasferiti all'owner nel metodo sellTokens
            // Non ci sono token da prelevare, quindi creiamo una situazione diversa
            
            // 8. Trasferiamo direttamente alcuni token all'exchange
            const withdrawAmount = ethers.BigNumber.from("500");
            await token.transfer(exchange.address, withdrawAmount);
            
            // 9. Verifichiamo che l'exchange abbia i token
            expect(await token.balanceOf(exchange.address)).to.equal(withdrawAmount);
            
            // 10. Memorizziamo il saldo iniziale dell'owner
            const initialOwnerBalance = await token.balanceOf(owner.address);
            
            // 11. L'owner esegue il prelievo dei token
            await exchange.withdrawTokens();
            
            // 12. Verifichiamo che l'owner abbia ricevuto i token
            const finalOwnerBalance = await token.balanceOf(owner.address);
            expect(finalOwnerBalance.sub(initialOwnerBalance)).to.equal(withdrawAmount);
            
            // 13. Verifichiamo che la transazione sia stata registrata
            const txCount = await registry.getTransactionCount();
            expect(txCount).to.be.above(0);
            
            // Prendiamo l'ultima transazione registrata
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
            
            // Approva e vendi token
            const userTokens = await token.balanceOf(user1.address);
            await token.connect(user1).approve(exchange.address, userTokens);
            await exchange.connect(user1).sellTokens(50);
        });
        
        it("Should return correct transaction count", async function () {
            const txCount = await exchange.getTransactionCount();
            expect(txCount).to.equal(4); // 1 buy + 1 deposit + 1 sell + 1 withdraw
        });
        
        it("Should get a transaction by index with compatibility format", async function () {
            // Verifica la transazione di acquisto
            const buyTx = await exchange.getTransaction(1);
            expect(buyTx.user).to.equal(user1.address);
            expect(buyTx.isBuy).to.equal(true); // EXCHANGE_BUY viene mappato a true
            expect(buyTx.tokenAmount).to.equal(ethers.utils.parseEther("1").mul(rate).div(ethers.utils.parseEther("1")));
            
            // Verifica la transazione di deposito
            const depositTx = await exchange.getTransaction(2);
            expect(depositTx.user).to.equal(owner.address);
            expect(depositTx.isBuy).to.equal(true); // ETH_DEPOSIT viene mappato a true
            expect(depositTx.etherAmount).to.equal(ethers.utils.parseEther("2"));
            
            // Verifica la transazione di vendita
            const sellTx = await exchange.getTransaction(3);
            expect(sellTx.user).to.equal(user1.address);
            expect(sellTx.isBuy).to.equal(false); // EXCHANGE_SELL viene mappato a false
            expect(sellTx.tokenAmount).to.equal(50);
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