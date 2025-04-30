    import { ethers } from 'ethers';
    import web3Service from './Web3Service';

    /**
     * Gestisce le interazioni con il contratto CampaignFactory
     */
    const campaignFactoryService = {
        contract: null,
        
        /**
         * Inizializza il contratto CampaignFactory
         * @param {string} contractAddress - Indirizzo del contratto CampaignFactory
         * @param {Object} contractArtifact - ABI del contratto CampaignFactory
         * @returns {Object} - Istanza del contratto
         */
        // Nella funzione initialize
        initialize: async function(contractAddress, contractArtifact) {
            console.log("Inizializzazione CampaignFactory:", contractAddress);
            
            if (!web3Service.provider) {
                console.log("Web3Service non inizializzato, inizializzazione...");
                await web3Service.initialize();
            }
            
            this.contract = new ethers.Contract(
                contractAddress,
                contractArtifact.abi,
                web3Service.provider
            );
            
            console.log("CampaignFactory inizializzato:", !!this.contract);
            return this.contract;
        },

        initializeReadOnly: async function(contractAddress, contractArtifact) {
            // Controlla se web3Service è già inizializzato in modalità sola lettura
            if (!web3Service.provider) {
                await web3Service.initializeReadOnly();
            }
            
            // Usa il provider senza signer
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
                throw new Error("CampaignFactory contract or signer not initialized");
            }
            
            return this.contract.connect(web3Service.signer);
        },
        
        /**
         * Ottiene tutte le campagne disponibili
         * @returns {Promise<Array>} - Array di indirizzi delle campagne
         */
        getAllCampaigns: async function() {
            try {
                const campaignAddresses = await this.contract.getAllCampaigns();
                return campaignAddresses;
            } catch (error) {
                console.error("Errore nel recupero delle campagne:", error);
                throw error;
            }
        },
        
        /**
         * Ottiene le campagne create da un indirizzo specifico
         * @param {string} creatorAddress - Indirizzo del creatore
         * @returns {Promise<Array>} - Array di indirizzi delle campagne
         */
        getCampaignsByCreator: async function(creatorAddress) {
            try {
                const address = creatorAddress || await web3Service.getAccount();
                const campaignAddresses = await this.contract.getCampaignsByCreator(address);
                return campaignAddresses;
            } catch (error) {
                console.error("Errore nel recupero delle campagne del creatore:", error);
                throw error;
            }
        },
        
        /**
         * Verifica se un utente è autorizzato a creare campagne
         * @param {string} address - Indirizzo da verificare
         * @returns {Promise<boolean>} - true se autorizzato
         */
        isAuthorizedCreator: async function(address) {
            try {
                const userAddress = address || await web3Service.getAccount();
                return await this.contract.isAuthorizedCreator(userAddress);
            } catch (error) {
                console.error("Errore nella verifica dell'autorizzazione:", error);
                return false;
            }
        },
        
        createCampaign: async function(campaignData) {
            try {
                const signedContract = this.getSignedContract();
                
                // Assicuriamoci che mainImageCID sia una stringa valida
                const mainImageCID = campaignData.mainImageCID || "";
                
                // Assicuriamoci che additionalImagesCIDs sia un array valido di stringhe
                let additionalImagesCIDs = [];
                if (Array.isArray(campaignData.additionalImagesCIDs)) {
                    additionalImagesCIDs = campaignData.additionalImagesCIDs
                        .filter(cid => typeof cid === 'string' && cid.trim() !== '');
                }
                
                // Preparazione array milestone (con valori di default se non presenti)
                const milestoneTitles = Array.isArray(campaignData.milestoneTitles) ? 
                    campaignData.milestoneTitles : ["Milestone completa"];
                    
                const milestoneDescriptions = Array.isArray(campaignData.milestoneDescriptions) ? 
                    campaignData.milestoneDescriptions : ["Completamento del progetto"];
                    
                const milestoneTargetAmounts = Array.isArray(campaignData.milestoneTargetAmounts) ? 
                    campaignData.milestoneTargetAmounts.map(amount => 
                        ethers.utils.parseEther(amount.toString())) : 
                    [ethers.utils.parseEther(campaignData.goalAmount.toString())];
                    
                console.log("Creazione campagna con parametri:");
                console.log("Titolo:", campaignData.title);
                console.log("Immagine principale CID:", mainImageCID);
                console.log("Immagini aggiuntive CIDs:", additionalImagesCIDs);
                console.log("Milestone titoli:", milestoneTitles);
                console.log("Milestone importi:", milestoneTargetAmounts.map(a => ethers.utils.formatEther(a)));
                
                const tx = await signedContract.createCampaign(
                    campaignData.title,
                    campaignData.description,
                    campaignData.detailedDescription,
                    campaignData.beneficiary || await web3Service.getAccount(),
                    ethers.utils.parseEther(campaignData.goalAmount.toString()),
                    mainImageCID,
                    additionalImagesCIDs,
                    milestoneTitles,
                    milestoneDescriptions,
                    milestoneTargetAmounts,
                    { gasLimit: 5000000 }  // Aumentiamo il gas limit
                );
                
                const receipt = await tx.wait();
                
                // Estrai l'indirizzo della campagna creata dall'evento
                const event = receipt.events.find(e => e.event === 'CampaignCreated');
                const campaignAddress = event.args.campaignAddress;
                
                return {
                    receipt: receipt,
                    campaignAddress: campaignAddress
                };
            } catch (error) {
                console.error("Errore nella creazione della campagna:", error);
                // Messaggio di errore più dettagliato
                if (error.code === -32603) {
                    throw new Error("Errore interno nella transazione blockchain. Verifica che le immagini siano state caricate correttamente su IPFS prima di creare la campagna.");
                }
                throw error;
            }
        },
        
        /**
         * Autorizza un creatore (solo owner)
         * @param {string} creatorAddress - Indirizzo da autorizzare
         * @param {boolean} status - Stato di autorizzazione
         * @returns {Promise<Object>} - Transazione
         */
        authorizeCreator: async function(creatorAddress, status) {
            try {
                const signedContract = this.getSignedContract();
                const tx = await signedContract.authorizeCreator(creatorAddress, status);
                return await tx.wait();
            } catch (error) {
                console.error("Errore nell'autorizzazione del creatore:", error);
                throw error;
            }
        },
        
        /**
         * Disattiva una campagna (solo owner)
         * @param {string} campaignAddress - Indirizzo della campagna
         * @returns {Promise<Object>} - Transazione
         */
        deactivateCampaign: async function(campaignAddress) {
            try {
                const signedContract = this.getSignedContract();
                const tx = await signedContract.deactivateCampaign(campaignAddress);
                return await tx.wait();
            } catch (error) {
                console.error("Errore nella disattivazione della campagna:", error);
                throw error;
            }
        }
    };

    export default campaignFactoryService;