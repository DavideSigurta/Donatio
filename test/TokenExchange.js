// File di test per il contratto TokenExchange
// Testa le funzionalità di scambio tra ETH e token DNT

// Importiamo Chai per utilizzare le sue funzioni di asserzione
const { expect } = require("chai");

// Utilizziamo loadFixture per condividere setup comuni tra i test
// Questo semplifica i test e li rende più veloci, sfruttando
// la funzionalità di snapshot di Hardhat Network
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

// `describe` è una funzione Mocha che permette di organizzare i test
// Avere i test organizzati rende il debug più semplice
describe("TokenExchange contract", function () {
    // Definiamo un fixture per riutilizzare lo stesso setup in ogni test
    // Utilizziamo loadFixture per eseguire questo setup una volta,
    // creare uno snapshot e ripristinare Hardhat Network a quello snapshot in ogni test
    async function deployExchangeFixture() {
        // Otteniamo la ContractFactory e i Signer
        const Token = await ethers.getContractFactory("Token");
        const TokenExchange = await ethers.getContractFactory("TokenExchange");
        const [owner, addr1, addr2] = await ethers.getSigners();
        
        // Deployiamo prima il contratto Token
        const token = await Token.deploy();
        await token.deployed();
        
        // Deployiamo il contratto TokenExchange con l'indirizzo del Token
        const exchange = await TokenExchange.deploy(token.address);
        await exchange.deployed();
        
        // L'owner deve approvare l'exchange per spendere i suoi token
        // altrimenti il test buyTokens fallirà
        const initialApproval = ethers.utils.parseEther("10000");
        await token.approve(exchange.address, initialApproval);
        
        // Depositiamo ETH nel contratto per poter testare sellTokens
        const initialETH = ethers.utils.parseEther("10");
        await owner.sendTransaction({
            to: exchange.address,
            value: initialETH
        });
        
        return { Token, TokenExchange, token, exchange, owner, addr1, addr2, initialApproval, initialETH };
    }
    
    // Testiamo la fase di deployment
    describe("Deployment", function () {
        // Testiamo se l'indirizzo del token è impostato correttamente
        it("Should set the correct token address", async function () {
            const { token, exchange } = await loadFixture(deployExchangeFixture);
            expect(await exchange.token()).to.equal(token.address);
        });
        
        // Testiamo se il proprietario è impostato correttamente
        it("Should set the right owner", async function () {
            const { exchange, owner } = await loadFixture(deployExchangeFixture);
            expect(await exchange.owner()).to.equal(owner.address);
        });
        
        // Testiamo il rate di cambio
        it("Should set the correct exchange rate", async function () {
            const { exchange } = await loadFixture(deployExchangeFixture);
            expect(await exchange.rate()).to.equal(100);
        });
    });
    
    // Testiamo le operazioni di scambio
    describe("Exchange Operations", function () {
        // Testiamo l'acquisto di token
        it("Should allow users to buy tokens with ETH", async function () {
            const { exchange, token, owner, addr1 } = await loadFixture(deployExchangeFixture);
            
            // Registriamo i saldi iniziali
            const initialOwnerTokenBalance = await token.balanceOf(owner.address);
            const initialAddr1TokenBalance = await token.balanceOf(addr1.address);
            const initialOwnerETHBalance = await ethers.provider.getBalance(owner.address);
            
            // L'utente acquista token con 1 ETH
            const ethAmount = ethers.utils.parseEther("1.0");
            await exchange.connect(addr1).buyTokens({ value: ethAmount });
            
            // Calcoliamo quanti token dovrebbero essere stati acquistati (rate = 100)
            const expectedTokens = ethAmount.mul(100).div(ethers.utils.parseEther("1.0"));
            
            // Verifichiamo che il saldo token dell'utente sia aumentato
            expect(await token.balanceOf(addr1.address)).to.equal(
                initialAddr1TokenBalance.add(expectedTokens)
            );
            
            // Verifichiamo che il saldo token dell'owner sia diminuito
            expect(await token.balanceOf(owner.address)).to.equal(
                initialOwnerTokenBalance.sub(expectedTokens)
            );
            
            // Verifichiamo che l'owner abbia ricevuto l'ETH (esclusi i costi di gas)
            expect(await ethers.provider.getBalance(owner.address)).to.be.above(initialOwnerETHBalance);
        });
        
        // Testiamo la vendita di token
        it("Should allow users to sell tokens for ETH", async function () {
            const { exchange, token, addr1 } = await loadFixture(deployExchangeFixture);
            
            // Prima, l'utente acquista alcuni token
            const ethAmount = ethers.utils.parseEther("1.0");
            await exchange.connect(addr1).buyTokens({ value: ethAmount });
            
            // Registriamo il saldo token dopo l'acquisto
            const tokenBalance = await token.balanceOf(addr1.address);
            const tokenAmountToSell = tokenBalance.div(2); // Vendiamo metà dei token
            
            // Approviamo l'exchange a spendere i token dell'utente
            await token.connect(addr1).approve(exchange.address, tokenAmountToSell);
            
            // Registriamo il saldo ETH iniziale
            const initialETHBalance = await ethers.provider.getBalance(addr1.address);
            
            // Vendiamo i token
            await exchange.connect(addr1).sellTokens(tokenAmountToSell);
            
            // Verifichiamo che il saldo token sia diminuito correttamente
            expect(await token.balanceOf(addr1.address)).to.equal(tokenBalance.sub(tokenAmountToSell));
            
            // Verifichiamo che il saldo ETH sia aumentato (esclusi i costi di gas)
            expect(await ethers.provider.getBalance(addr1.address)).to.be.above(
                initialETHBalance.sub(ethers.utils.parseEther("0.01")) // Consideriamo il gas
            );
        });
        
        // Testiamo gli eventi durante l'acquisto
        it("Should emit TokensPurchased event when buying tokens", async function () {
            const { exchange, addr1 } = await loadFixture(deployExchangeFixture);
            
            const ethAmount = ethers.utils.parseEther("1.0");
            // Calcoliamo quanti token dovrebbero essere acquistati
            const expectedTokens = ethAmount.mul(100).div(ethers.utils.parseEther("1.0"));
            
            await expect(exchange.connect(addr1).buyTokens({ value: ethAmount }))
            .to.emit(exchange, "TokensPurchased")
            .withArgs(addr1.address, ethAmount, expectedTokens);
        });
        
        // Testiamo gli eventi durante la vendita
        it("Should emit TokensSold event when selling tokens", async function () {
            const { exchange, token, addr1, owner } = await loadFixture(deployExchangeFixture);
            
            // Prima, l'utente acquista alcuni token
            const ethAmount = ethers.utils.parseEther("1.0");
            await exchange.connect(addr1).buyTokens({ value: ethAmount });
            
            // Depositiamo una quantità sufficiente di ETH nel contratto per la vendita
            await owner.sendTransaction({
                to: exchange.address,
                value: ethers.utils.parseEther("2.0")
            });
            
            // Vendiamo una quantità piccola di token (50 token)
            // Usando un valore che non sia in wei per chiarezza
            const tokenAmountToSell = 50;
            
            // Approviamo l'exchange a spendere i token dell'utente
            await token.connect(addr1).approve(exchange.address, tokenAmountToSell);
            
            // Calcoliamo l'ETH atteso: 50 token / 100 = 0.5 ETH
            const expectedEthAmount = ethers.utils.parseEther("0.5");
            
            await expect(exchange.connect(addr1).sellTokens(tokenAmountToSell))
            .to.emit(exchange, "TokensSold")
            .withArgs(addr1.address, tokenAmountToSell, expectedEthAmount);
        });
    });
    
    // Testiamo la gestione della liquidità
    describe("Liquidity Management", function () {
        // Testiamo il deposito di ETH
        it("Should allow owner to deposit ETH", async function () {
            const { exchange, owner } = await loadFixture(deployExchangeFixture);
            
            const depositAmount = ethers.utils.parseEther("2.0");
            const initialBalance = await ethers.provider.getBalance(exchange.address);
            
            await expect(exchange.connect(owner).depositETH({ value: depositAmount }))
            .to.emit(exchange, "ETHDeposited")
            .withArgs(owner.address, depositAmount);
            
            // Verifichiamo che il saldo ETH del contratto sia aumentato
            expect(await ethers.provider.getBalance(exchange.address)).to.equal(
                initialBalance.add(depositAmount)
            );
        });
        
        // Testiamo che solo l'owner possa depositare ETH
        it("Should not allow non-owners to deposit ETH", async function () {
            const { exchange, addr1 } = await loadFixture(deployExchangeFixture);
            
            const depositAmount = ethers.utils.parseEther("1.0");
            
            await expect(
                exchange.connect(addr1).depositETH({ value: depositAmount })
            ).to.be.revertedWith("Solo l'owner puo' depositare ETH");
        });
        
        // Testiamo il ritiro di ETH
        it("Should allow owner to withdraw ETH", async function () {
            const { exchange, owner } = await loadFixture(deployExchangeFixture);
            
            const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
            const exchangeBalance = await ethers.provider.getBalance(exchange.address);
            
            // Eseguiamo il ritiro
            const tx = await exchange.connect(owner).withdrawETH();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
            
            // Verifichiamo che il contratto abbia un saldo ETH di 0
            expect(await ethers.provider.getBalance(exchange.address)).to.equal(0);
            
            // Verifichiamo che l'owner abbia ricevuto i fondi (considerando il gas)
            expect(await ethers.provider.getBalance(owner.address)).to.equal(
                initialOwnerBalance.add(exchangeBalance).sub(gasUsed)
            );
        });
        
        // Testiamo che solo l'owner possa ritirare ETH
        it("Should not allow non-owners to withdraw ETH", async function () {
            const { exchange, addr1 } = await loadFixture(deployExchangeFixture);
            
            await expect(
                exchange.connect(addr1).withdrawETH()
            ).to.be.revertedWith("Solo l'owner puo ritirare ETH");
        });
        
        it("Should fail to withdraw tokens when contract has no tokens", async function () {
            const { exchange, owner } = await loadFixture(deployExchangeFixture);
            
            await expect(
                exchange.connect(owner).withdrawTokens()
            ).to.be.revertedWith("Nessun token da ritirare");
        });
        
        // Testiamo che solo l'owner possa ritirare token
        it("Should not allow non-owners to withdraw tokens", async function () {
            const { exchange, addr1 } = await loadFixture(deployExchangeFixture);
            
            await expect(
                exchange.connect(addr1).withdrawTokens()
            ).to.be.revertedWith("Solo l'owner puo ritirare token");
        });
    });
    
    // Testiamo gli errori e la sicurezza
    describe("Security and Error Handling", function () {
        // Testiamo che non si possano acquistare token senza ETH
        it("Should not allow buying tokens with 0 ETH", async function () {
            const { exchange, addr1 } = await loadFixture(deployExchangeFixture);
            
            await expect(
                exchange.connect(addr1).buyTokens({ value: 0 })
            ).to.be.revertedWith("Invia ETH per comprare token");
        });
        
        // Testiamo che non si possano vendere 0 token
        it("Should not allow selling 0 tokens", async function () {
            const { exchange, addr1 } = await loadFixture(deployExchangeFixture);
            
            await expect(
                exchange.connect(addr1).sellTokens(0)
            ).to.be.revertedWith("Specifica la quantita di token da vendere");
        });
        
        // Testiamo che l'exchange non permetta di vendere token se non ha abbastanza ETH
        it("Should not allow selling tokens if contract doesn't have enough ETH", async function () {
            const { exchange, token, addr1, owner } = await loadFixture(deployExchangeFixture);
            
            // L'owner ritira tutto l'ETH dal contratto
            await exchange.connect(owner).withdrawETH();
            
            // L'utente tenta di vendere token
            const tokenAmountToSell = ethers.utils.parseEther("50");
            await token.connect(addr1).approve(exchange.address, tokenAmountToSell);
            
            await expect(
                exchange.connect(addr1).sellTokens(tokenAmountToSell)
            ).to.be.revertedWith("Non c'e abbastanza ETH nel contratto");
        });
        
        // Testiamo che l'exchange non permetta di acquistare token se l'owner non ne ha abbastanza
        it("Should not allow buying tokens if owner doesn't have enough", async function () {
            const { exchange, token, addr1, owner } = await loadFixture(deployExchangeFixture);
            
            // Trasferiamo tutti i token dell'owner a un altro indirizzo
            const ownerBalance = await token.balanceOf(owner.address);
            await token.transfer(addr1.address, ownerBalance);
            
            // Tentiamo di acquistare token
            const ethAmount = ethers.utils.parseEther("1.0");
            
            await expect(
                exchange.connect(addr1).buyTokens({ value: ethAmount })
            ).to.be.revertedWith("L'owner non ha abbastanza token");
        });
    });
});