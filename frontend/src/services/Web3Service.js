import { ethers } from 'ethers';

/**
* Gestisce la connessione Web3 e le interazioni base con Ethereum
*/
const web3Service = {
    // Variabili per memorizzare provider e signer
    provider: null,
    signer: null,
    
    /**
    * Inizializza la connessione con MetaMask
    * @returns {Object} - Oggetto con provider e signer
    */
    initialize: async function() {
        // Verifica che MetaMask sia installato
        if (!window.ethereum) {
            throw new Error("MetaMask non trovato. Installa MetaMask per utilizzare questa applicazione.");
        }
        
        try {
            // Crea provider e richiedi connessione account
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            await this.provider.send("eth_requestAccounts", []);
            this.signer = this.provider.getSigner();
            
            return { 
                provider: this.provider, 
                signer: this.signer 
            };
        } catch (error) {
            console.error("Errore durante l'inizializzazione di Web3:", error);
            throw error;
        }
    },
    
    /**
    * Ottiene l'indirizzo dell'account connesso
    * @returns {Promise<string>} - Indirizzo dell'account
    */
    getAccount: async function() {
        if (!this.signer) {
            await this.initialize();
        }
        
        return await this.signer.getAddress();
    },
    
    /**
    * Ottiene il saldo ETH dell'account connesso
    * @returns {Promise<string>} - Saldo in ETH formattato
    */
    getEthBalance: async function() {
        const account = await this.getAccount();
        const balance = await this.provider.getBalance(account);
        return ethers.utils.formatEther(balance);
    }
};

export default web3Service;