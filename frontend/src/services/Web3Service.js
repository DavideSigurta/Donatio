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
     * Inizializza la connessione in sola lettura senza richiedere l'account
     * @returns {Object} - Oggetto con provider
     */
    initializeReadOnly: async function() {
        try {
            // Se MetaMask è disponibile, usalo in modalità sola lettura
            if (window.ethereum) {
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
            } else {
                // Altrimenti usa un provider pubblico (network predefinito o configurabile)
                this.provider = new ethers.providers.JsonRpcProvider("https://rpc-sepolia.rockx.com");
            }
            
            return { 
                provider: this.provider 
            };
        } catch (error) {
            console.error("Errore durante l'inizializzazione di Web3 in modalità lettura:", error);
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