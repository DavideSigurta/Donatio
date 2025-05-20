import { ethers } from 'ethers';
import web3Service from './Web3Service';
import GovernanceSystemArtifact from '../contracts/GovernanceSystem.json';
import CampaignArtifact from '../contracts/Campaign.json';
import TokenArtifact from '../contracts/Token.json';
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
            
            if (!web3Service.provider) {
                console.log("[DEBUG] Provider non inizializzato, inizializzazione...");
                await web3Service.initialize();
            }
            
            // Usa l'indirizzo e l'artifact forniti o quelli di default
            const governanceAddress = address || contractAddresses.GovernanceSystem;
            const governanceArtifact = artifact || GovernanceSystemArtifact;
            
            
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
            
            if (!web3Service.provider) {
                console.log("[DEBUG] Provider non inizializzato, inizializzazione in sola lettura...");
                await web3Service.initializeReadOnly();
            }
            
            const governanceAddress = contractAddresses.GovernanceSystem;
            
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
     * Ottiene i dettagli di una specifica proposta
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
                executed,
                proposalType,     // Nuovo campo
                milestoneIndex    // Nuovo campo
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
                executed,
                positivePercentage: positivePercentage > 100 ? 100 : positivePercentage,
                negativePercentage: negativePercentage > 100 ? 100 : negativePercentage,
                timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
                isExpired: timeRemaining <= 0,
                proposalType,     // Campo per il tipo di proposta (0=CAMPAIGN, 1=MILESTONE)
                milestoneIndex: milestoneIndex.toNumber() // Indice della milestone (rilevante solo per proposte di tipo 1)
            };
        } catch (error) {
            console.error("Errore nel recupero della proposta:", error);
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
            
            // Carica le proposte in parallelo con gestione errori migliorata
            const promises = [];
            for (let i = start; i < start + actualCount; i++) {
                promises.push(
                    this.getProposal(i).catch(error => {
                        console.warn(`Errore nel caricamento della proposta ${i}:`, error);
                        return null; // Restituisce null invece di propagare l'errore
                    })
                );
            }
            
            // Filtra le proposte nulle (quelle che hanno generato errori)
            const results = await Promise.all(promises);
            return results.filter(proposal => proposal !== null);
        } catch (error) {
            console.error("Errore nel caricamento delle proposte:", error);
            return []; // Restituisce un array vuoto invece di propagare l'errore
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
            
            try {
                // Verifica che la proposta esista
                const count = await this.contract.getProposalsCount();
                if (proposalId >= count) {
                    console.log(`Proposta ${proposalId} non ancora disponibile (totale: ${count})`);
                    return "0";
                }
                
                // Passa correttamente l'ID della proposta, non la quota
                const votingPower = await this.contract.calculateVotingPower(voter, proposalId);
                return ethers.utils.formatEther(votingPower);
            } catch (err) {
                console.warn(`Errore nel calcolo del potere di voto per proposta ${proposalId}:`, err);
                return "0";
            }
        } catch (error) {
            console.error("Errore nel calcolo del potere di voto:", error);
            return "0";
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
     * Esegue una proposta di governance
     * @param {number} proposalId - ID della proposta
     * @returns {Promise<Object>} - Risultato della transazione
     */
    executeProposal: async function(proposalId) {
        try {
            if (!this.contract) {
                await this.initialize();
            }
            
            const signedContract = this.getSignedContract();
            
            const tx = await signedContract.executeProposal(proposalId, {
                gasLimit: 3000000
            });
            
            console.log("Esecuzione proposta inviata, hash:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("Esecuzione proposta confermata:", receipt);
            
            return receipt;
        } catch (error) {
            console.error("Errore durante l'esecuzione della proposta:", error);
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
                gasLimit: 1000000
            });
            
            console.log("[DEBUG] Voto inviato, hash:", tx.hash);
            const receipt = await tx.wait();
            console.log("[DEBUG] Voto confermato, controllo logs:", receipt.logs.length);

            // Controlla se c'è un evento ProposalReadyForExecution
            for (const log of receipt.logs) {
                try {
                    // Prova a decodificare il log come un evento ProposalReadyForExecution
                    const event = this.contract.interface.parseLog(log);
                    console.log("[DEBUG] Evento trovato:", event.name, event.args);
                } catch (e) {
                    // Ignora errori di parsing
                }
            }
            
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
                gasLimit: 1000000
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
    },

    /**
     * Crea una proposta di governance per una milestone
     * @param {string} campaignAddress - Indirizzo della campagna
     * @param {number} milestoneIndex - Indice della milestone
     * @returns {Promise<Object>} - Risultato della transazione
     */
    createMilestoneProposal: async function(campaignAddress, milestoneIndex) {
        try {
            if (!this.contract) {
                await this.initialize();
            }
            
            const signedContract = this.getSignedContract();
            
            const tx = await signedContract.createMilestoneProposal(campaignAddress, milestoneIndex, {
                gasLimit: 2000000
            });
            
            console.log("Proposta milestone creata, hash:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("Proposta milestone confermata:", receipt);
            
            return receipt;
        } catch (error) {
            console.error("Errore nella creazione della proposta per la milestone:", error);
            throw error;
        }
    },

    /**
     * Calcola il potere di voto di un utente per una proposta di milestone
     * @param {string} voter - Indirizzo del votante
     * @param {string} campaignAddress - Indirizzo della campagna
     * @param {number} proposalId - ID della proposta
     * @returns {Promise<string>} - Potere di voto formattato
     */
    calculateMilestoneVotingPower: async function(voter, campaignAddress, proposalId) {
        try {
            if (!this.contract) {
                await this.initializeReadOnly();
            }
            
            // Se l'utente non ha un indirizzo, non può votare
            if (!voter) {
                return "0";
            }
            
            try {
                // Verifica che la proposta sia valida e completamente caricata
                const count = await this.contract.getProposalsCount();
                
                // Se l'ID è fuori range, restituisci 0
                if (proposalId >= count) {
                    console.log(`Proposta ${proposalId} non ancora disponibile (totale: ${count})`);
                    return "0";
                }
                
                // Ottieni e verifica la proposta prima di calcolare il potere di voto
                const proposal = await this.getProposal(proposalId);
                
                // Controlli aggiuntivi di sicurezza
                if (!proposal || 
                    !proposal.campaignAddress || 
                    proposal.campaignAddress.toLowerCase() !== campaignAddress.toLowerCase()) {
                    return "0";
                }
                
                // Verifica il saldo token dell'utente (per evitare divisioni per zero)
                const tokenContract = new ethers.Contract(
                    contractAddresses.Token, 
                    TokenArtifact.abi,
                    web3Service.provider
                );
                
                const balance = await tokenContract.balanceOf(voter);
                if (balance.isZero()) {
                    return "0";
                }
                
                try {
                    // Se tutti i controlli passano, calcola il potere di voto
                    const votingPower = await this.contract.calculateVotingPower(voter, proposalId);
                    return ethers.utils.formatEther(votingPower);
                } catch (err) {
                    console.warn(`Errore nel calcolo del potere di voto per proposta ${proposalId}, restituisco 0:`, err);
                    return "0";
                }
                
            } catch (error) {
                console.warn("Errore durante la validazione della proposta:", error);
                return "0";
            }
        } catch (error) {
            console.error("Errore nel calcolo del potere di voto:", error);
            return "0";
        }
    }
};

export default governanceService;