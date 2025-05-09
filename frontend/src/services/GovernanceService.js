import { ethers } from 'ethers';
import web3Service from './Web3Service';
import GovernanceSystemArtifact from '../contracts/GovernanceSystem.json';
import contractAddresses from '../contracts/contract-address.json';

/**
 * Gestisce le interazioni con il sistema di governance e votazioni
 */
const governanceService = {
    // Istanza del contratto
    contract: null,
    
    /**
     * Inizializza il contratto GovernanceSystem
     * @param {string} [address] - Indirizzo opzionale del contratto
     * @param {Object} [artifact] - ABI opzionale del contratto
     * @returns {Promise<Object>} - Istanza del contratto
     */
    initialize: async function(address, artifact) {
        try {
            console.log("[DEBUG] Inizializzazione GovernanceSystem...");
            
            if (!web3Service.provider) {
                console.log("[DEBUG] Provider non inizializzato, inizializzazione...");
                await web3Service.initialize();
            }
            
            // Usa l'indirizzo e l'artifact forniti o quelli di default
            const governanceAddress = address || contractAddresses.GovernanceSystem;
            const governanceArtifact = artifact || GovernanceSystemArtifact;
            
            console.log("[DEBUG] Indirizzo GovernanceSystem:", governanceAddress);
            
            if (!governanceAddress) {
                console.error("[DEBUG] Indirizzo GovernanceSystem non trovato!");
                return null;
            }
            
            // Crea una nuova istanza del contratto con il signer connesso
            this.contract = new ethers.Contract(
                governanceAddress,
                governanceArtifact.abi,
                web3Service.signer
            );
            
            console.log("[DEBUG] GovernanceSystem inizializzato con successo");
            return this.contract;
        } catch (error) {
            console.error("[DEBUG] Errore nell'inizializzazione del GovernanceSystem:", error);
            return null;
        }
    },
    
    /**
     * Inizializza il contratto in modalità di sola lettura
     * @returns {Promise<Object>} - Istanza del contratto
     */
    initializeReadOnly: async function() {
        try {
            console.log("[DEBUG] Inizializzazione GovernanceSystem in modalità sola lettura...");
            
            if (!web3Service.provider) {
                console.log("[DEBUG] Provider non inizializzato, inizializzazione in sola lettura...");
                await web3Service.initializeReadOnly();
            }
            
            const governanceAddress = contractAddresses.GovernanceSystem;
            console.log("[DEBUG] Indirizzo GovernanceSystem:", governanceAddress);
            
            if (!governanceAddress) {
                console.error("[DEBUG] Indirizzo GovernanceSystem non trovato!");
                return null;
            }
            
            // Crea un'istanza di sola lettura del contratto
            this.contract = new ethers.Contract(
                governanceAddress,
                GovernanceSystemArtifact.abi,
                web3Service.provider
            );
            
            console.log("[DEBUG] GovernanceSystem inizializzato in sola lettura con successo");
            return this.contract;
        } catch (error) {
            console.error("[DEBUG] Errore nell'inizializzazione in sola lettura del GovernanceSystem:", error);
            return null;
        }
    },
    
    /**
     * Ottiene il contratto connesso al signer
     * @returns {Object} - Contratto connesso al signer
     */
    getSignedContract: function() {
        if (!this.contract || !web3Service.signer) {
            throw new Error("Contratto GovernanceSystem o signer non inizializzati");
        }
        
        return this.contract.connect(web3Service.signer);
    },
    
    /**
     * Ottiene tutti i dettagli di una proposta
     * @param {number} proposalId - ID della proposta
     * @returns {Promise<Object>} - Dettagli della proposta
     */
    getProposal: async function(proposalId) {
        try {
            if (!this.contract) {
                await this.initializeReadOnly();
            }
            
            const proposal = await this.contract.getProposal(proposalId);
            
            // Estrai i campi dalla tupla restituita dal contratto
            const [
                campaignAddress,
                targetAmount,
                approvalQuota,
                positiveVotes,
                negativeVotes,
                startTime,
                endTime,
                status,
                executed
            ] = proposal;
            
            // Calcola la percentuale di voti positivi rispetto alla soglia
            const positivePercentage = parseFloat(ethers.utils.formatEther(positiveVotes)) / 
                                      (parseFloat(ethers.utils.formatEther(approvalQuota)) / 2) * 100;
            
            // Calcola la percentuale di voti negativi rispetto alla soglia
            const negativePercentage = parseFloat(ethers.utils.formatEther(negativeVotes)) / 
                                      (parseFloat(ethers.utils.formatEther(approvalQuota)) * 3 / 10) * 100;
            
            // Calcola il tempo rimanente
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = endTime.toNumber() - now;
            
            // Determina lo stato leggibile
            let statusText;
            switch (status) {
                case 0: statusText = "Attiva"; break;
                case 1: statusText = "Approvata"; break;
                case 2: statusText = "Rifiutata"; break;
                case 3: statusText = "Scaduta"; break;
                default: statusText = "Sconosciuto";
            }
            
            return {
                id: proposalId,
                campaignAddress,
                targetAmount: ethers.utils.formatEther(targetAmount),
                approvalQuota: ethers.utils.formatEther(approvalQuota),
                positiveVotes: ethers.utils.formatEther(positiveVotes),
                negativeVotes: ethers.utils.formatEther(negativeVotes),
                startTime: new Date(startTime.toNumber() * 1000),
                endTime: new Date(endTime.toNumber() * 1000),
                status: status,
                statusText: statusText,
                executed,
                positivePercentage: positivePercentage > 100 ? 100 : positivePercentage,
                negativePercentage: negativePercentage > 100 ? 100 : negativePercentage,
                timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
                isExpired: timeRemaining <= 0
            };
        } catch (error) {
            console.error("Errore nel recupero della proposta:", error);
            throw error;
        }
    },
    
    /**
     * Ottiene il conteggio totale delle proposte
     * @returns {Promise<number>} - Numero totale di proposte
     */
    getProposalsCount: async function() {
        try {
            if (!this.contract) {
                await this.initializeReadOnly();
            }
            
            const count = await this.contract.getProposalsCount();
            return count.toNumber();
        } catch (error) {
            console.error("Errore nel recupero del conteggio delle proposte:", error);
            throw error;
        }
    },
    
    /**
     * Carica tutte le proposte (o un sottoinsieme)
     * @param {number} [start=0] - Indice di partenza
     * @param {number} [count] - Numero di proposte da caricare
     * @returns {Promise<Array>} - Array di proposte
     */
    getProposals: async function(start = 0, count) {
        try {
            if (!this.contract) {
                await this.initializeReadOnly();
            }
            
            // Ottiene il conteggio totale
            const totalCount = await this.getProposalsCount();
            
            // Se count non è specificato, carica tutte le proposte rimanenti
            const loadCount = count || totalCount - start;
            
            // Limita il numero di proposte da caricare al numero totale disponibile
            const actualCount = Math.min(loadCount, totalCount - start);
            
            // Carica le proposte in parallelo
            const promises = [];
            for (let i = start; i < start + actualCount; i++) {
                promises.push(this.getProposal(i));
            }
            
            return await Promise.all(promises);
        } catch (error) {
            console.error("Errore nel caricamento delle proposte:", error);
            throw error;
        }
    },
    
    /**
     * Calcola il potere di voto di un utente per una proposta
     * @param {string} voter - Indirizzo del votante
     * @param {number} proposalId - ID della proposta
     * @returns {Promise<string>} - Potere di voto formattato
     */
    calculateVotingPower: async function(voter, proposalId) {
        try {
            if (!this.contract) {
                await this.initializeReadOnly();
            }
            
            // Ottiene i dettagli della proposta per avere la quota di approvazione
            const proposal = await this.getProposal(proposalId);
            const approvalQuota = ethers.utils.parseEther(proposal.approvalQuota);
            
            // Calcola il potere di voto
            const votingPower = await this.contract.calculateVotingPower(voter, approvalQuota);
            return ethers.utils.formatEther(votingPower);
        } catch (error) {
            console.error("Errore nel calcolo del potere di voto:", error);
            throw error;
        }
    },
    
    /**
     * Verifica se un utente ha già votato per una proposta
     * @param {number} proposalId - ID della proposta
     * @param {string} [voter] - Indirizzo del votante (usa msg.sender se non specificato)
     * @returns {Promise<boolean>} - true se l'utente ha già votato
     */
    hasVoted: async function(proposalId, voter) {
        try {
            if (!this.contract) {
                await this.initialize();
            }
            
            // Se voter non è specificato, usa l'indirizzo corrente
            const voterAddress = voter || await web3Service.getAccount();
            
            return await this.contract.hasVoted(proposalId, voterAddress);
        } catch (error) {
            console.error("Errore nella verifica del voto:", error);
            throw error;
        }
    },
    
    /**
     * Vota su una proposta
     * @param {number} proposalId - ID della proposta
     * @param {boolean} support - true per approvare, false per rifiutare
     * @returns {Promise<Object>} - Risultato della transazione
     */
    vote: async function(proposalId, support) {
        try {
            if (!this.contract) {
                await this.initialize();
            }
            
            const signedContract = this.getSignedContract();
            
            const tx = await signedContract.vote(proposalId, support, {
                gasLimit: 500000
            });
            
            console.log("Voto inviato, hash:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("Voto confermato:", receipt);
            
            return receipt;
        } catch (error) {
            console.error("Errore durante il voto:", error);
            throw error;
        }
    },
    
    /**
     * Finalizza una proposta scaduta (solo admin)
     * @param {number} proposalId - ID della proposta
     * @returns {Promise<Object>} - Risultato della transazione
     */
    finalizeExpiredProposal: async function(proposalId) {
        try {
            if (!this.contract) {
                await this.initialize();
            }
            
            const signedContract = this.getSignedContract();
            
            const tx = await signedContract.finalizeExpiredProposal(proposalId, {
                gasLimit: 500000
            });
            
            console.log("Finalizzazione inviata, hash:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("Finalizzazione confermata:", receipt);
            
            return receipt;
        } catch (error) {
            console.error("Errore durante la finalizzazione:", error);
            throw error;
        }
    },
    
    /**
     * Imposta la durata del periodo di votazione (solo admin)
     * @param {number} minutes - Durata in minuti
     * @returns {Promise<Object>} - Risultato della transazione
     */
    setVotingPeriod: async function(minutes) {
        try {
            if (!this.contract) {
                await this.initialize();
            }
            
            const signedContract = this.getSignedContract();
            
            const tx = await signedContract.setVotingPeriod(minutes, {
                gasLimit: 200000
            });
            
            console.log("Aggiornamento periodo votazione inviato, hash:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("Periodo votazione aggiornato:", receipt);
            
            return receipt;
        } catch (error) {
            console.error("Errore durante l'aggiornamento del periodo:", error);
            throw error;
        }
    }
};

export default governanceService;