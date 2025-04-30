import { ethers } from 'ethers';
import web3Service from './Web3Service';
import tokenService from './TokenService';
import MilestoneManagerArtifact from '../contracts/MilestoneManager.json';
import contractAddresses from '../contracts/contract-address.json';
import campaignFactoryService from './CampaignFactoryService';

/**
 * Gestisce le interazioni con i contratti Campaign
 */
const campaignService = {
    // Mantiene un cache delle istanze dei contratti di campagna
    campaigns: {},

    milestoneManager: null,
    
    /**
     * Inizializza il MilestoneManager
     * @returns {Promise<Object>} - Istanza del contratto MilestoneManager
     */
    initializeMilestoneManager: async function() {
        try {
            console.log("[DEBUG] Inizializzazione MilestoneManager...");
            if (!web3Service.provider) {
                console.log("[DEBUG] Provider non inizializzato, inizializzazione...");
                await web3Service.initialize();
            }
            
            if (!this.milestoneManager) {
                console.log("[DEBUG] MilestoneManager non inizializzato, creazione istanza...");
                // Usa contractAddresses invece di CONTRACT_ADDRESSES
                const mmAddress = contractAddresses.MilestoneManager;
                console.log("[DEBUG] Indirizzo MilestoneManager:", mmAddress);
                
                if (!mmAddress) {
                    console.error("[DEBUG] Indirizzo MilestoneManager non trovato!");
                    return null;
                }
                
                // Usa web3Service.signer direttamente, non getSigner()
                this.milestoneManager = new ethers.Contract(
                    mmAddress,
                    MilestoneManagerArtifact.abi,
                    web3Service.signer
                );
                console.log("[DEBUG] MilestoneManager inizializzato con successo");
            }
            
            return this.milestoneManager;
        } catch (error) {
            console.error("[DEBUG] Errore nell'inizializzazione del MilestoneManager:", error);
            return null;
        }
    },
    
    /**
     * Inizializza un contratto Campaign
     * @param {string} campaignAddress - Indirizzo del contratto Campaign
     * @param {Object} contractArtifact - ABI del contratto Campaign
     * @returns {Object} - Istanza del contratto
     */
    initializeCampaign: async function(campaignAddress, contractArtifact) {
        if (!web3Service.provider) {
            await web3Service.initialize();
        }
        
        // Se abbiamo già questa campagna in cache, ritorna quella
        if (this.campaigns[campaignAddress]) {
            return this.campaigns[campaignAddress];
        }
        
        // Altrimenti crea una nuova istanza
        const campaignContract = new ethers.Contract(
            campaignAddress,
            contractArtifact.abi,
            web3Service.provider
        );
        
        // Memorizza in cache
        this.campaigns[campaignAddress] = campaignContract;
        
        return campaignContract;
    },

    initializeCampaignReadOnly: async function(address, contractArtifact) {
        // Controlla se web3Service è già inizializzato in modalità sola lettura
        if (!web3Service.provider) {
            await web3Service.initializeReadOnly();
        }
        
        // Usa il provider senza signer
        if (!this.campaigns) this.campaigns = {};
        
        this.campaigns[address] = new ethers.Contract(
            address,
            contractArtifact.abi,
            web3Service.provider
        );
        
        return this.campaigns[address];
    },
    
    /**
     * Ottiene il contratto di una campagna connesso al signer
     * @param {string} campaignAddress - Indirizzo della campagna
     * @returns {Object} - Contratto connesso al signer
     */
    getSignedCampaign: function(campaignAddress) {
        if (!this.campaigns[campaignAddress] || !web3Service.signer) {
            throw new Error("Campaign contract or signer not initialized");
        }
        
        return this.campaigns[campaignAddress].connect(web3Service.signer);
    },
    
    /**
     * Ottiene i dettagli completi di una campagna
     * @param {string} campaignAddress - Indirizzo della campagna
     * @returns {Promise<Object>} - Dettagli della campagna
     */
    getCampaignDetails: async function(campaignAddress) {
        try {
            const campaign = this.campaigns[campaignAddress];
            if (!campaign) {
                throw new Error("Campaign not initialized");
            }
            
            const [
                title,
                description,
                detailedDescription,
                beneficiary,
                creator,
                goalAmount,
                raisedAmount,
                createdAt,
                active,
                donorsCount,
                mainImageCID // Aggiungiamo il recupero dell'immagine principale
            ] = await Promise.all([
                campaign.title(),
                campaign.description(),
                campaign.detailedDescription(),
                campaign.beneficiary(),
                campaign.creator(),
                campaign.goalAmount(),
                campaign.raisedAmount(),
                campaign.createdAt(),
                campaign.active(),
                campaign.donorsCount(),
                campaign.mainImageCID() // Chiamata al nuovo getter
            ]);
            
            return {
                address: campaignAddress,
                title,
                description,
                detailedDescription,
                beneficiary,
                creator,
                goalAmount: ethers.utils.formatEther(goalAmount),
                raisedAmount: ethers.utils.formatEther(raisedAmount),
                createdAt: new Date(createdAt.toNumber() * 1000),
                active,
                donorsCount: donorsCount.toNumber(),
                mainImageCID // Aggiungiamo al risultato
            };
        } catch (error) {
            console.error("Errore nel recupero dei dettagli della campagna:", error);
            throw error;
        }
    },

    /**
     * Ottiene tutte le immagini aggiuntive di una campagna
     * @param {string} campaignAddress - Indirizzo della campagna
     * @returns {Promise<Array>} - Array di CID delle immagini aggiuntive
     */
    getCampaignAdditionalImages: async function(campaignAddress) {
        try {
            const campaign = this.campaigns[campaignAddress];
            if (!campaign) {
                throw new Error("Campaign not initialized");
            }
            
            return await campaign.getAllAdditionalImagesCIDs();
        } catch (error) {
            console.error("Errore nel recupero delle immagini aggiuntive:", error);
            throw error;
        }
    },

    /**
     * Aggiorna le immagini di una campagna (solo per il creatore)
     * @param {string} campaignAddress - Indirizzo della campagna
     * @param {string} mainImageCID - CID dell'immagine principale
     * @param {Array<string>} additionalImagesCIDs - Array di CID delle immagini aggiuntive
     * @returns {Promise<Object>} - Transazione
     */
    updateCampaignImages: async function(campaignAddress, mainImageCID, additionalImagesCIDs) {
        try {
            const signedCampaign = this.getSignedCampaign(campaignAddress);
            const tx = await signedCampaign.updateImages(
                mainImageCID,
                additionalImagesCIDs,
                { gasLimit: 300000 }
            );
            return await tx.wait();
        } catch (error) {
            console.error("Errore nell'aggiornamento delle immagini:", error);
            throw error;
        }
    },
    
    /**
     * Ottiene tutte le donazioni di una campagna
     * @param {string} campaignAddress - Indirizzo della campagna
     * @returns {Promise<Array>} - Lista delle donazioni
     */
    getCampaignDonations: async function(campaignAddress) {
        try {
            const campaign = this.campaigns[campaignAddress];
            if (!campaign) {
                throw new Error("Campaign not initialized");
            }
            
            const donationsCount = await campaign.getDonationsCount();
            const donations = [];
            
            for (let i = 0; i < donationsCount; i++) {
                const [donor, amount, message, timestamp] = await campaign.getDonation(i);
                donations.push({
                    donor,
                    amount: ethers.utils.formatEther(amount),
                    message,
                    timestamp: timestamp.toNumber()
                });
            }
            
            // Ordina per timestamp (più recenti prima)
            return donations.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.error("Errore nel recupero delle donazioni:", error);
            throw error;
        }
    },
    
    /**
     * Effettua una donazione a una campagna
     * @param {string} campaignAddress - Indirizzo della campagna
     * @param {string|number} amount - Importo della donazione in DNT
     * @param {string} message - Messaggio opzionale
     * @returns {Promise<Object>} - Transazione
     */
    donate: async function(campaignAddress, amount, message = "") {
        try {
            console.log(`Donazione di ${amount} DNT a ${campaignAddress}`);
            
            // Converti l'importo in wei (18 decimali)
            const amountWei = ethers.utils.parseEther(amount.toString());
            
            // Prima approva il contratto della campagna a spendere i token
            const approveTx = await tokenService.approve(campaignAddress, amount);
            console.log("Token approvati, transaction hash:", approveTx.transactionHash);
            
            // Poi effettua la donazione
            const signedCampaign = this.getSignedCampaign(campaignAddress);
            const tx = await signedCampaign.donate(amountWei, message, { gasLimit: 300000 });
            console.log("Donazione inviata, transaction hash:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("Donazione confermata:", receipt);
            
            return receipt;
        } catch (error) {
            console.error("Errore durante la donazione:", error);
            throw error;
        }
    },
    
    /**
     * Aggiorna i dettagli di una campagna (solo per il creatore)
     * @param {string} campaignAddress - Indirizzo della campagna
     * @param {Object} details - Nuovi dettagli
     * @returns {Promise<Object>} - Transazione
     */
    updateCampaignDetails: async function(campaignAddress, details) {
        try {
            const signedCampaign = this.getSignedCampaign(campaignAddress);
            const tx = await signedCampaign.updateDetails(
                details.title,
                details.description,
                details.detailedDescription,
                { gasLimit: 200000 }
            );
            return await tx.wait();
        } catch (error) {
            console.error("Errore nell'aggiornamento dei dettagli:", error);
            throw error;
        }
    },
    
    /**
     * Cambia lo stato attivo/inattivo di una campagna
     * @param {string} campaignAddress - Indirizzo della campagna
     * @param {boolean} active - Nuovo stato
     * @returns {Promise<Object>} - Transazione
     */
    setActive: async function(campaignAddress, active) {
        try {
            const signedCampaign = this.getSignedCampaign(campaignAddress);
            const tx = await signedCampaign.setActive(active);
            return await tx.wait();
        } catch (error) {
            console.error("Errore nel cambio di stato:", error);
            throw error;
        }
    },
    
    /**
     * Preleva i fondi raccolti (solo per il beneficiario)
     * @param {string} campaignAddress - Indirizzo della campagna
     * @returns {Promise<Object>} - Transazione
     */
    withdraw: async function(campaignAddress) {
        try {
            const signedCampaign = this.getSignedCampaign(campaignAddress);
            const tx = await signedCampaign.withdraw({ gasLimit: 200000 });
            return await tx.wait();
        } catch (error) {
            console.error("Errore nel prelievo dei fondi:", error);
            throw error;
        }
    },

    // Aggiungere questi metodi dopo il metodo withdraw

    /**
     * Ottiene tutte le milestone di una campagna
     * @param {string} campaignAddress - Indirizzo della campagna
     * @returns {Promise<Array>} - Array delle milestone
     */
    getMilestones: async function(campaignAddress) {
        try {
            console.log(`[DEBUG] Inizializzazione MilestoneManager per ${campaignAddress}...`);
            await this.initializeMilestoneManager();
            
            if (!this.milestoneManager) {
                console.warn("[DEBUG] MilestoneManager non inizializzato correttamente!");
                return []; // Ritorna un array vuoto invece di fallire
            }
            
            console.log("[DEBUG] Recupero numero milestone...");
            const milestonesCount = await this.milestoneManager.getMilestonesCount(campaignAddress);
            console.log(`[DEBUG] Numero milestone trovate: ${milestonesCount.toString()}`);
            
            const milestones = [];
            
            for (let i = 0; i < milestonesCount.toNumber(); i++) {
                console.log(`[DEBUG] Recupero milestone ${i}...`);
                const milestone = await this.milestoneManager.getMilestone(campaignAddress, i);
                console.log(`[DEBUG] Milestone ${i} recuperata:`, milestone);
                
                milestones.push({
                    index: i,
                    title: milestone.title,
                    description: milestone.description,
                    targetAmount: ethers.utils.formatEther(milestone.targetAmount),
                    raisedAmount: ethers.utils.formatEther(milestone.raisedAmount),
                    approved: milestone.approved,
                    fundsReleased: milestone.fundsReleased
                });
            }
            
            console.log(`[DEBUG] Milestone recuperate con successo: ${milestones.length}`);
            return milestones;
        } catch (error) {
            console.error("[DEBUG] Errore dettagliato nel recupero delle milestone:", error);
            // Ritorna un array vuoto invece di propagare l'errore per evitare il blocco dell'app
            return [];
        }
    },

    

    /**
     * Approva una milestone (solo admin)
     * @param {string} campaignAddress - Indirizzo della campagna
     * @param {number} milestoneIndex - Indice della milestone da approvare
     * @returns {Promise<Object>} - Risultato della transazione
     */
    approveMilestone: async function(campaignAddress, milestoneIndex) {
        try {
            // Usa il campaignFactoryService.getSignedContract() invece di web3Service.getCampaignFactory()
            const campaignFactory = campaignFactoryService.getSignedContract();
            const tx = await campaignFactory.approveMilestone(campaignAddress, milestoneIndex, { gasLimit: 1000000 });
            return await tx.wait();
        } catch (error) {
            console.error("Errore nell'approvazione della milestone:", error);
            throw error;
        }
    },

    /**
     * Ottiene il MilestoneManager connesso al signer (utile per operazioni dirette)
     * @returns {Object} - Contratto MilestoneManager connesso al signer
     */
    getSignedMilestoneManager: function() {
        if (!this.milestoneManager || !web3Service.signer) {
            throw new Error("MilestoneManager or signer not initialized");
        }
        
        return this.milestoneManager.connect(web3Service.signer);
    },

    /**
     * Verifica se una milestone è pronta per il rilascio dei fondi
     * @param {string} campaignAddress - Indirizzo della campagna
     * @param {number} milestoneIndex - Indice della milestone
     * @returns {Promise<boolean>} - true se la milestone è pronta per il rilascio
     */
    isMilestoneReadyForRelease: async function(campaignAddress, milestoneIndex) {
        try {
            await this.initializeMilestoneManager();
            return await this.milestoneManager.isMilestoneReadyForRelease(campaignAddress, milestoneIndex);
        } catch (error) {
            console.error("Errore nel controllo dello stato della milestone:", error);
            throw error;
        }
    },

    /**
     * Ottiene il totale dei fondi disponibili per il rilascio
     * @param {string} campaignAddress - Indirizzo della campagna
     * @returns {Promise<string>} - Importo disponibile in DNT formattato
     */
    getAvailableFundsToRelease: async function(campaignAddress) {
        try {
            await this.initializeMilestoneManager();
            const amount = await this.milestoneManager.getAvailableFundsToRelease(campaignAddress);
            return ethers.utils.formatEther(amount);
        } catch (error) {
            console.error("Errore nel recupero dei fondi disponibili:", error);
            throw error;
        }
    }
};

export default campaignService;