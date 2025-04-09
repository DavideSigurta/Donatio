import { ethers } from 'ethers';
import web3Service from './Web3Service';

const tokenService = {
    contract: null,
    decimals: 18,  // Modificato da 0 a 18 decimali
    
    initialize: async function(contractAddress, contractArtifact) {
        if (!web3Service.provider) {
            await web3Service.initialize();
        }
        
        this.contract = new ethers.Contract(
            contractAddress,
            contractArtifact.abi,
            web3Service.provider
        );
        
        // Leggiamo i decimali dal contratto che ora implementa questa funzione
        try {
            const decimals = await this.contract.decimals();
            this.decimals = decimals.toNumber();
            console.log("Token decimals:", this.decimals);
        } catch (error) {
            console.warn("Errore nella lettura dei decimals, usando il valore predefinito (18):", error);
            this.decimals = 18; // Valore standard
        }
        
        // Espone tokenService globalmente per le utility functions
        window.tokenService = this;
        
        return this.contract;
    },
    
    getSignedContract: function() {
        if (!this.contract || !web3Service.signer) {
            throw new Error("Token contract or signer not initialized");
        }
        
        return this.contract.connect(web3Service.signer);
    },
    
    getBalance: async function() {
        const account = await web3Service.getAccount();
        const balance = await this.contract.balanceOf(account);
        console.log("Balance raw from contract:", balance.toString());
        // Ora usiamo formatEther come per ETH
        return ethers.utils.formatEther(balance);
    },
    
    approve: async function(spender, amount) {
        const signedContract = this.getSignedContract();
        console.log("Approving tokens:", amount, "decimals:", this.decimals);
        
        // Ora usiamo parseEther come per ETH
        const amountWei = ethers.utils.parseEther(amount.toString());
        console.log("Amount in wei:", amountWei.toString());
        
        const tx = await signedContract.approve(spender, amountWei);
        return await tx.wait();
    }
};

export default tokenService;