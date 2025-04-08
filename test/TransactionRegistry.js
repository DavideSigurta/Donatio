const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TransactionRegistry", function () {
    let TransactionRegistry;
    let registry;
    let owner;
    let user1;
    let user2;
    let authorizedContract;
    let unauthorizedContract;
    
    // Enumeration di TransactionType come in Solidity
    const TransactionType = {
        EXCHANGE_BUY: 0,
        EXCHANGE_SELL: 1,
        ETH_DEPOSIT: 2,
        TOKEN_WITHDRAW: 3,
        ETH_WITHDRAW: 4
    };
    
    beforeEach(async function () {
        [owner, user1, user2, authorizedContract, unauthorizedContract] = await ethers.getSigners();
        
        TransactionRegistry = await ethers.getContractFactory("TransactionRegistry");
        registry = await TransactionRegistry.deploy();
        await registry.deployed();
        
        // Autorizza un contratto
        await registry.setContractAuthorization(authorizedContract.address, true);
    });
    
    describe("Authorization", function () {
        it("Should set contract authorization correctly", async function () {
            expect(await registry.authorizedContracts(authorizedContract.address)).to.equal(true);
            expect(await registry.authorizedContracts(unauthorizedContract.address)).to.equal(false);
        });
        
        it("Should allow owner to set authorization", async function () {
            await registry.setContractAuthorization(user1.address, true);
            expect(await registry.authorizedContracts(user1.address)).to.equal(true);
        });
        
        it("Should not allow non-owner to set authorization", async function () {
            await expect(
                registry.connect(user1).setContractAuthorization(user2.address, true)
            ).to.be.revertedWith("Solo l'owner puo autorizzare contratti");
        });
    });
    
    describe("Transaction Recording", function () {
        it("Should allow owner to record transactions", async function () {
            const tx = await registry.connect(owner).recordTransaction(
                user1.address, 
                TransactionType.EXCHANGE_BUY, 
                100, 
                50
            );
            const receipt = await tx.wait();
            
            // Verifica l'evento ma non il timestamp
            expect(receipt.events[0].event).to.equal("TransactionRecorded");
            expect(receipt.events[0].args.user).to.equal(user1.address);
        });
        
        it("Should allow authorized contracts to record transactions", async function () {
            const tx = await registry.connect(authorizedContract).recordTransaction(
                user1.address, 
                TransactionType.EXCHANGE_BUY, 
                100, 
                50
            );
            const receipt = await tx.wait();
            
            expect(receipt.events[0].event).to.equal("TransactionRecorded");
            expect(receipt.events[0].args.user).to.equal(user1.address);
        });
        
        it("Should not allow unauthorized contracts to record transactions", async function () {
            await expect(
                registry.connect(unauthorizedContract).recordTransaction(
                    user1.address,
                    TransactionType.EXCHANGE_BUY,
                    100,
                    50
                )
            ).to.be.revertedWith("Non autorizzato");
        });
    });
    
    describe("Transaction Queries", function () {
        beforeEach(async function () {
            // Record some transactions
            await registry.connect(authorizedContract).recordTransaction(
                user1.address, 
                TransactionType.EXCHANGE_BUY, 
                100, 
                50
            );
            
            await registry.connect(authorizedContract).recordTransaction(
                user2.address, 
                TransactionType.EXCHANGE_SELL, 
                200, 
                100
            );
            
            await registry.connect(authorizedContract).recordTransaction(
                user1.address, 
                TransactionType.ETH_DEPOSIT, 
                0, 
                150
            );
        });
        
        it("Should return correct transaction count", async function () {
            expect(await registry.getTransactionCount()).to.equal(3);
        });
        
        it("Should return correct user transaction count", async function () {
            expect(await registry.getUserTransactionCount(user1.address)).to.equal(2);
            expect(await registry.getUserTransactionCount(user2.address)).to.equal(1);
        });
        
        it("Should get a transaction by index", async function () {
            const tx = await registry.getTransaction(1);
            expect(tx.user).to.equal(user2.address);
            expect(tx.transactionType).to.equal(TransactionType.EXCHANGE_SELL);
            expect(tx.tokenAmount).to.equal(200);
            expect(tx.etherAmount).to.equal(100);
        });
        
        it("Should revert when accessing invalid transaction index", async function () {
            await expect(registry.getTransaction(10)).to.be.revertedWith("Indice non valido");
        });
        
        it("Should get transaction batch correctly", async function () {
            const batch = await registry.getTransactionBatch(0, 2);
            expect(batch.users.length).to.equal(2);
            expect(batch.users[0]).to.equal(user1.address);
            expect(batch.users[1]).to.equal(user2.address);
            expect(batch.transactionTypes[0]).to.equal(TransactionType.EXCHANGE_BUY);
            expect(batch.transactionTypes[1]).to.equal(TransactionType.EXCHANGE_SELL);
        });
        
        it("Should limit batch size if it exceeds available transactions", async function () {
            const batch = await registry.getTransactionBatch(1, 10);
            expect(batch.users.length).to.equal(2); // Solo 2 transazioni disponibili a partire dall'indice 1
        });
        
        it("Should get user transactions correctly", async function () {
            const userTxs = await registry.getUserTransactions(user1.address, 0, 10);
            expect(userTxs.transactionIndexes.length).to.equal(2);
            expect(userTxs.transactionTypes[0]).to.equal(TransactionType.EXCHANGE_BUY);
            expect(userTxs.transactionTypes[1]).to.equal(TransactionType.ETH_DEPOSIT);
            expect(userTxs.tokenAmounts[0]).to.equal(100);
            expect(userTxs.etherAmounts[1]).to.equal(150);
        });
    });
    
    // Funzione helper per ottenere il timestamp attuale
    async function getTimestamp() {
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        return block.timestamp;
    }
});