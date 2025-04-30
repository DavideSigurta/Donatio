import { ethers } from 'ethers';
import web3Service from './Web3Service';

/**
 * Gestisce le interazioni con il contratto CreatorRequestManager
 */
const creatorRequestManagerService = {
    contract: null,
    
    /**
     * Inizializza il contratto CreatorRequestManager
     * @param {string} contractAddress - Indirizzo del contratto CreatorRequestManager
     * @param {Object} contractArtifact - ABI del contratto CreatorRequestManager
     * @returns {Object} - Istanza del contratto
     */
    initialize: async function(contractAddress, contractArtifact) {
        console.log("Inizializzazione CreatorRequestManager:", contractAddress);
        
        if (!web3Service.provider) {
            console.log("Web3Service non inizializzato, inizializzazione...");
            await web3Service.initialize();
        }
        
        this.contract = new ethers.Contract(
            contractAddress,
            contractArtifact.abi,
            web3Service.provider
        );
        
        console.log("CreatorRequestManager inizializzato:", !!this.contract);
        return this.contract;
    },

    initializeReadOnly: async function(contractAddress, contractArtifact) {
        if (!web3Service.provider) {
            await web3Service.initializeReadOnly();
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
            throw new Error("CreatorRequestManager contract or signer not initialized");
        }
        
        return this.contract.connect(web3Service.signer);
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
    
    /**
     * Invia una richiesta per diventare creatore autorizzato
     * @param {string} description - Descrizione/motivazione della richiesta
     * @returns {Promise<Object>} - Ricevuta della transazione
     */
    submitCreatorRequest: async function(description) {
        try {
            const signedContract = this.getSignedContract();
            
            const tx = await signedContract.submitCreatorRequest(
                description,
                { gasLimit: 500000 }
            );
            
            const receipt = await tx.wait();
            
            const event = receipt.events.find(e => e.event === 'CreatorRequestSubmitted');
            
            return {
                receipt: receipt,
                event: event ? {
                    applicant: event.args.applicant,
                    description: event.args.description
                } : null
            };
        } catch (error) {
            console.error("Errore nell'invio della richiesta di autorizzazione:", error);
            
            if (error.message.includes("Hai gia' una richiesta in attesa")) {
                throw new Error("Hai già una richiesta in attesa di approvazione.");
            } else if (error.message.includes("Sei gia' autorizzato")) {
                throw new Error("Sei già autorizzato a creare campagne.");
            }
            
            throw error;
        }
    },

    /**
     * Ottiene i dettagli di una richiesta per un indirizzo specifico
     * @param {string} address - Indirizzo del richiedente (opzionale, usa l'indirizzo corrente se non specificato)
     * @returns {Promise<Object>} - Dettagli della richiesta
     */
    getCreatorRequest: async function(address) {
        try {
            const requestorAddress = address || await web3Service.getAccount();
            
            const [applicant, description, timestamp, processed, approved] = 
                await this.contract.getCreatorRequest(requestorAddress);
            
            if (applicant === ethers.constants.AddressZero) {
                return null;
            }
            
            const date = new Date(timestamp.toNumber() * 1000);
            
            return {
                applicant,
                description,
                timestamp: timestamp.toNumber(),
                processed,
                approved,
                date
            };
        } catch (error) {
            console.error("Errore nel recupero della richiesta:", error);
            return null;
        }
    },

    /**
     * Ottiene il numero totale di richieste pendenti
     * @returns {Promise<number>} - Numero di richieste pendenti
     */
    getPendingRequestsCount: async function() {
        try {
            const count = await this.contract.getPendingRequestsCount();
            
            return count.toNumber();
        } catch (error) {
            console.error("Errore nel recupero del numero di richieste pendenti:", error);
            return 0;
        }
    },

    /**
     * Ottiene tutte le richieste pendenti (solo admin)
     * @returns {Promise<Array>} - Array di dettagli delle richieste
     */
    getPendingRequests: async function() {
        try {
            const count = await this.getPendingRequestsCount();
            const requests = [];
            
            for (let i = 0; i < count; i++) {
                const [applicant, description, timestamp] = 
                    await this.contract.getPendingRequestAtIndex(i);
                
                requests.push({
                    applicant,
                    description,
                    timestamp: timestamp.toNumber(),
                    date: new Date(timestamp.toNumber() * 1000)
                });
            }
            
            return requests;
        } catch (error) {
            console.error("Errore nel recupero delle richieste pendenti:", error);
            return [];
        }
    },

    /**
     * Approva una richiesta di creatore (solo admin)
     * @param {string} applicantAddress - Indirizzo del richiedente
     * @returns {Promise<Object>} - Ricevuta della transazione
     */
    approveCreatorRequest: async function(applicantAddress) {
        try {
            const signedContract = this.getSignedContract();
            
            const tx = await signedContract.approveCreatorRequest(
                applicantAddress,
                { gasLimit: 500000 }
            );
            
            const receipt = await tx.wait();
            
            const event = receipt.events.find(e => e.event === 'CreatorRequestProcessed');
            
            return {
                receipt,
                event: event ? {
                    applicant: event.args.applicant,
                    approved: event.args.approved
                } : null
            };
        } catch (error) {
            console.error("Errore nell'approvazione della richiesta:", error);
            
            if (error.message.includes("Richiesta non trovata")) {
                throw new Error("Richiesta non trovata. Verifica l'indirizzo del richiedente.");
            } else if (error.message.includes("Richiesta gia' processata")) {
                throw new Error("Questa richiesta è già stata processata.");
            }
            
            throw error;
        }
    },

    /**
     * Rifiuta una richiesta di creatore (solo admin)
     * @param {string} applicantAddress - Indirizzo del richiedente
     * @returns {Promise<Object>} - Ricevuta della transazione
     */
    rejectCreatorRequest: async function(applicantAddress) {
        try {
            const signedContract = this.getSignedContract();
            
            const tx = await signedContract.rejectCreatorRequest(
                applicantAddress,
                { gasLimit: 500000 }
            );
            
            const receipt = await tx.wait();
            
            const event = receipt.events.find(e => e.event === 'CreatorRequestProcessed');
            
            return {
                receipt,
                event: event ? {
                    applicant: event.args.applicant,
                    approved: event.args.approved
                } : null
            };
        } catch (error) {
            console.error("Errore nel rifiuto della richiesta:", error);
            
            if (error.message.includes("Richiesta non trovata")) {
                throw new Error("Richiesta non trovata. Verifica l'indirizzo del richiedente.");
            } else if (error.message.includes("Richiesta gia' processata")) {
                throw new Error("Questa richiesta è già stata processata.");
            }
            
            throw error;
        }
    },

    /**
     * Verifica se un utente ha una richiesta attiva (non processata)
     * @param {string} address - Indirizzo da verificare (opzionale)
     * @returns {Promise<boolean>} - true se l'utente ha una richiesta attiva
     */
    hasActiveRequest: async function(address) {
        try {
            const request = await this.getCreatorRequest(address);
            
            return request && !request.processed;
        } catch (error) {
            console.error("Errore nella verifica della richiesta attiva:", error);
            return false;
        }
    }
};

export default creatorRequestManagerService;