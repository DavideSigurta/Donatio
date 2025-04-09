import { ethers } from 'ethers';
import web3Service from './Web3Service';

/**
 * Gestisce le interazioni con il contratto TransactionRegistry
 */
const TransactionService = {
    contract: null,
    signer: null,

    initialize: async function(address, artifact) {
        const { ethereum } = window;
        if (!ethereum) {
            throw new Error("MetaMask non disponibile");
        }
        
        const provider = new ethers.providers.Web3Provider(ethereum);
        this.signer = provider.getSigner();
        
        this.contract = new ethers.Contract(
            address,
            artifact.abi,
            this.signer
        );
        
        return this.contract;
    },
    
    /**
     * Ottiene il numero di transazioni registrate
     */
    getTransactionCount: async function() {
        try {
            const count = await this.contract.getTransactionCount();
            return count.toNumber();
        } catch (error) {
            console.error("Errore nell'ottenere il numero di transazioni:", error);
            return 0;
        }
    },
    
    /**
     * Ottiene una singola transazione per indice
     */
    getTransaction: async function(index) {
        try {
            const tx = await this.contract.getTransaction(index);
            
            // Formato coerente della transazione
            return {
                user: tx.user,
                isBuy: tx.transactionType === 0, // 0 = EXCHANGE_BUY
                tokenAmount: tx.tokenAmount,
                etherAmount: tx.etherAmount,
                timestamp: tx.timestamp.toNumber()
            };
        } catch (error) {
            console.error("Errore nell'ottenere la transazione:", error);
            return null;
        }
    },
    
    /**
     * Ottiene un batch di transazioni in modo sicuro
     */
    getTransactionBatch: async function(start, count) {
        try {
            // Controlla che i parametri siano validi
            if (start < 0 || count <= 0) {
                return { success: false, transactions: [] };
            }
            
            // Il contratto restituisce 5 array separati, non un array di oggetti
            const batchResult = await this.contract.getTransactionBatch(start, count);
            
            // Verifica che la risposta sia valida
            if (!batchResult || !batchResult.users) {
                return { success: false, transactions: [] };
            }
            
            const users = batchResult.users;
            const transactionTypes = batchResult.transactionTypes;
            const tokenAmounts = batchResult.tokenAmounts;
            const etherAmounts = batchResult.etherAmounts;
            const timestamps = batchResult.timestamps;
            
            const transactions = [];
            
            // Crea array di oggetti transazione
            for (let i = 0; i < users.length; i++) {
                transactions.push({
                    user: users[i],
                    transactionType: transactionTypes[i],
                    // TransactionType 0 = EXCHANGE_BUY (vedi contratto)
                    isBuy: transactionTypes[i] === 0, 
                    tokenAmount: tokenAmounts[i],
                    etherAmount: etherAmounts[i],
                    timestamp: timestamps[i].toNumber()
                });
            }
            
            return { success: true, transactions };
        } catch (error) {
            console.error("Errore nel recuperare il batch di transazioni:", error);
            return { success: false, transactions: [] };
        }
    }
};

export default TransactionService;