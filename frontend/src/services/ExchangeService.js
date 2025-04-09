import { ethers } from 'ethers';
import web3Service from './Web3Service';
import tokenService from './TokenService';

/**
* Gestisce le interazioni con il contratto TokenExchange
*/
const exchangeService = {
    // Riferimento al contratto
    contract: null,
    
    /**
    * Inizializza il contratto TokenExchange
    * @param {string} contractAddress - Indirizzo del contratto TokenExchange
    * @param {Object} contractArtifact - ABI del contratto TokenExchange
    * @returns {Object} - Istanza del contratto
    */
    initialize: async function(contractAddress, contractArtifact) {
        if (!web3Service.provider) {
            await web3Service.initialize();
        }
        
        this.contract = new ethers.Contract(
            contractAddress,
            contractArtifact.abi,
            web3Service.provider
        );
        
        return this.contract;
    },
    
    /**
    * Ottiene il contratto connesso al signer (per transazioni)
    * @returns {Object} - Contratto connesso al signer
    */
    getSignedContract: function() {
        if (!this.contract || !web3Service.signer) {
            throw new Error("Exchange contract or signer not initialized");
        }
        
        return this.contract.connect(web3Service.signer);
    },
    
    /**
    * Acquista token con ETH
    * @param {string|number} ethAmount - Quantità di ETH da inviare
    * @returns {Promise<Object>} - Transazione
    */
    buyTokens: async function(ethAmount) {
        const signedContract = this.getSignedContract();
        const tx = await signedContract.buyTokens({
            value: ethers.utils.parseEther(ethAmount.toString())
        });
        
        return await tx.wait();
    },
    
    /**
    * Vende token per ETH
    * @param {string|number} tokenAmount - Quantità di token da vendere
    * @returns {Promise<Object>} - Transazione
    */
    sellTokens: async function(tokenAmount) {
        console.log("ExchangeService: Inizio vendita token", tokenAmount);
        
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const contractBalance = await provider.getBalance(this.contract.address);
            console.log("Saldo ETH del contratto:", ethers.utils.formatEther(contractBalance));
            
            // Semplificato: ora usiamo parseEther per i token con 18 decimali
            const tokenAmountBN = ethers.utils.parseEther(String(tokenAmount));
            console.log("Token da vendere:", tokenAmountBN.toString());
            
            const signedContract = this.getSignedContract();
            console.log("Chiamata a sellTokens del contratto con tokenAmount:", tokenAmount);
            
            const tx = await signedContract.sellTokens(
                tokenAmountBN,
                { gasLimit: 300000 }
            );
            
            console.log("Transazione inviata, hash:", tx.hash);
            const receipt = await tx.wait();
            console.log("Transazione confermata, receipt:", receipt);
            return receipt;
        } catch (error) {
            console.error("Errore durante sellTokens:", error);
            throw error;
        }
    },
    
    /**
    * Ottiene il tasso di cambio corrente
    * @returns {Promise<number>} - Tasso di cambio (token per ETH)
    */
    getExchangeRate: async function() {
        const rate = await this.contract.rate();
        return rate.toNumber();
    }
};

export default exchangeService;