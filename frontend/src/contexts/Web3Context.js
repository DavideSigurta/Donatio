import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import web3Service from '../services/Web3Service';
import tokenService from '../services/TokenService';
import exchangeService from '../services/ExchangeService';
import transactionService from '../services/TransactionService';
import campaignFactoryService from '../services/CampaignFactoryService';
import campaignService from '../services/CampaignService';
import creatorRequestManagerService from "../services/CreatorRequestManagerService";
import governanceService from '../services/GovernanceService'; 


// Importazione degli artifact
import TokenArtifact from "../contracts/Token.json";
import TokenExchangeArtifact from "../contracts/TokenExchange.json";
import TransactionRegistryArtifact from "../contracts/TransactionRegistry.json";
import CampaignFactoryArtifact from '../contracts/CampaignFactory.json';
import CampaignArtifact from '../contracts/Campaign.json';
import CreatorRequestManagerArtifact from "../contracts/CreatorRequestManager.json";
import GovernanceSystemArtifact from '../contracts/GovernanceSystem.json'; 
import contractAddress from "../contracts/contract-address.json";

// Costante per identificare la rete Hardhat locale
const HARDHAT_NETWORK_ID = '0x7a69'; // 31337 in esadecimale

// Creazione del contesto
const Web3Context = createContext();

// Provider del contesto
export function Web3Provider({ children }) {
    // Stato completo dell'applicazione
    const [state, setState] = useState({
        selectedAddress: null,
        networkError: null,
        tokenData: null,
        balance: null,
        ethBalance: null,
        exchangeRate: null,
        txBeingSent: null,
        transactionError: null,
        isOwner: false,
        ownerAddress: "",
        // Saldo ETH del contratto
        contractEthBalance: ethers.BigNumber.from(0),
        // Saldo DNT del contratto
        contractDntBalance: ethers.BigNumber.from(0),
        transactions: [],
        transactionsLoading: true,
        globalTxRefreshTrigger: 0
    });
    
    // Stato per le transazioni globali
    const [globalTransactions, setGlobalTransactions] = useState([]);
    const [globalTransactionsLoading, setGlobalTransactionsLoading] = useState(true);
    const [campaigns, setCampaigns] = useState([]);
    const [userCampaigns, setUserCampaigns] = useState([]);
    const [campaignsLoading, setCampaignsLoading] = useState(true);
    const [userCampaignsLoading, setUserCampaignsLoading] = useState(true);
    const [isAuthorizedCreator, setIsAuthorizedCreator] = useState(false);
    const [creatorRequest, setCreatorRequest] = useState(null);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [pendingRequestsLoading, setPendingRequestsLoading] = useState(true);
    const [campaignMilestones, setCampaignMilestones] = useState({});
    const [milestonesLoading, setMilestonesLoading] = useState({});
    const [proposals, setProposals] = useState([]);
    const [proposalsLoading, setProposalsLoading] = useState(true);
    const [campaignProposals, setCampaignProposals] = useState({});
    const [userVotingPower, setUserVotingPower] = useState({});
    const [isAdmin, setIsAdmin] = useState(false);
    
    
    // Inizializza ethers, i contratti e recupera i dati iniziali
    const initialize = async (userAddress) => {
        setState(prevState => ({
            ...prevState,
            selectedAddress: userAddress
        }));
        
        try {
            // Inizializza i servizi
            await web3Service.initialize();
            
            await tokenService.initialize(contractAddress.Token, TokenArtifact);
            window.tokenService = tokenService;
            await exchangeService.initialize(contractAddress.TokenExchange, TokenExchangeArtifact);
            await transactionService.initialize(contractAddress.TransactionRegistry, TransactionRegistryArtifact);
            await campaignFactoryService.initialize(contractAddress.CampaignFactory, CampaignFactoryArtifact);
            await creatorRequestManagerService.initialize(contractAddress.CreatorRequestManager, CreatorRequestManagerArtifact);
            await governanceService.initialize(contractAddress.GovernanceSystem, GovernanceSystemArtifact);
            await campaignService.initializeMilestoneManager();
            
            // Carica i dati del token
            const token = tokenService.contract;
            const name = await token.name();
            const symbol = await token.symbol();
            
            // Carica il balance di token
            const balance = await tokenService.getBalance();
            
            // Carica il balance di ETH
            const ethBalance = await web3Service.getEthBalance();
            
            // Controlla se l'utente è owner
            const exchange = exchangeService.contract;
            const owner = await exchange.owner();
            const isOwner = owner.toLowerCase() === userAddress.toLowerCase();
            const isAdminUser = isOwner; 
            setIsAdmin(isAdminUser);
            
            // Carica il rate di scambio
            const exchangeRate = await exchangeService.getExchangeRate();
        
            // Aggiorna lo stato con i dati recuperati
            setState(prevState => ({
                ...prevState,
                tokenData: { 
                    name, 
                    symbol,
                    exchangeAddress: contractAddress.TokenExchange
                },
                balance,
                ethBalance,
                exchangeRate,
                isOwner,
                ownerAddress: owner
            }));
            
            // Carica le transazioni dell'utente
            await loadTransactions(userAddress);
            
            // Verifica se l'utente è autorizzato a creare campagne
            const authorized = await campaignFactoryService.isAuthorizedCreator(userAddress);
            setIsAuthorizedCreator(authorized);
            
            // Carica le campagne create dall'utente
            await loadCampaigns();

            // Carica lo stato della richiesta dell'utente
            await loadCreatorRequestStatus();

            // Carica le proposte di governance
            await loadProposals();
            
            // Se l'utente è owner, carica anche i saldi del contratto e le transazioni globali
            if (isOwner) {
                await updateContractBalances();
                await loadGlobalTransactions();
            }
            
            // Avvia il polling dei dati
            startPollingData();
            
        } catch (error) {
            console.error("Errore nell'inizializzazione:", error);
            setState(prevState => ({
                ...prevState,
                networkError: "Errore nell'inizializzazione dell'applicazione."
            }));
        }
    };
    
    // Connessione al wallet
    const connectWallet = async () => {
        try {
            // Verifica che l'utente sia sulla rete corretta
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            
            if (chainId !== HARDHAT_NETWORK_ID) {
                setState(prevState => ({
                    ...prevState,
                    networkError: 'Per favore connetti MetaMask alla rete Localhost 8545'
                }));
                return;
            }
            
            await web3Service.initialize();
            const account = await web3Service.getAccount();
            
            // Inizializza l'app con l'account
            await initialize(account);
            
        } catch (error) {
            console.error("Errore durante la connessione del wallet:", error);
            setState(prevState => ({
                ...prevState,
                networkError: "Impossibile connettersi al wallet. Assicurati che MetaMask sia installato e sbloccato."
            }));
        }
    };
    
    // Rimuove l'errore di rete
    const dismissNetworkError = () => {
        setState(prevState => ({
            ...prevState,
            networkError: null
        }));
    };
    
    // Rimuove l'errore di transazione
    const dismissTransactionError = () => {
        setState(prevState => ({
            ...prevState,
            transactionError: null
        }));
    };
    
    // Carica le transazioni per l'utente
    const loadTransactions = async (userAddress) => {
        setState(prevState => ({
            ...prevState,
            transactionsLoading: true
        }));
        
        try {
            // Ottiene il conteggio delle transazioni
            const count = await transactionService.getTransactionCount();
            
            if (count === 0) {
                setState(prevState => ({
                    ...prevState,
                    transactions: [],
                    transactionsLoading: false
                }));
                return;
            }
            
            // Dimensione del batch limitata a 20
            const batchSize = Math.min(20, count);
            
            // Carica il batch di transazioni
            const response = await transactionService.getTransactionBatch(0, batchSize);
            
            if (!response.success) {
                setState(prevState => ({
                    ...prevState,
                    transactions: [],
                    transactionsLoading: false
                }));
                return;
            }
            
            // Filtra le transazioni dell'utente e le formatta
            const userTransactions = response.transactions
            .filter(tx => tx.user.toLowerCase() === userAddress.toLowerCase())
            .map(tx => {
                // Determina il tipo di transazione
                let type = 'unknown';
                if (tx.transactionType === 0) type = 'buy';         // EXCHANGE_BUY
                else if (tx.transactionType === 1) type = 'sell';   // EXCHANGE_SELL
                else if (tx.transactionType === 2) type = 'deposit'; // ETH_DEPOSIT
                else if (tx.transactionType === 3) type = 'donation'; // DONATION
                else if (tx.transactionType === 4) type = 'milestone-release'; // MILESTONE_RELEASE
                else if (tx.transactionType === 5) type = 'milestone-refund'; // MILESTONE_REFUND
                
                return {
                    type: type,
                    tokenAmount: tx.tokenAmount,
                    ethAmount: tx.etherAmount,
                    timestamp: tx.timestamp
                };
            }).sort((a, b) => b.timestamp - a.timestamp);
            
            // Aggiorna lo stato
            setState(prevState => ({
                ...prevState,
                transactions: userTransactions,
                transactionsLoading: false
            }));
            
        } catch (error) {
            console.error("Errore nel caricamento delle transazioni:", error);
            setState(prevState => ({
                ...prevState,
                transactions: [],
                transactionsLoading: false
            }));
        }
    };
    
    // Carica le transazioni globali
    const loadGlobalTransactions = async () => {
        try {
            setGlobalTransactionsLoading(true);
            
            // Ottiene il conteggio delle transazioni
            const count = await transactionService.getTransactionCount();
            
            if (count === 0) {
                setGlobalTransactions([]);
                setGlobalTransactionsLoading(false);
                return;
            }
            
            // Dimensione del batch limitata a 50 transazioni
            const batchSize = Math.min(50, count);
            const startIndex = Math.max(0, count - batchSize);
            
            // Carica il batch di transazioni
            const response = await transactionService.getTransactionBatch(startIndex, batchSize);
            
            if (!response.success) {
                setGlobalTransactions([]);
                setGlobalTransactionsLoading(false);
                return;
            }
            
            // Elabora e formatta le transazioni
            const formattedTransactions = response.transactions.map(tx => {
                // TransactionType: 0=EXCHANGE_BUY, 1=EXCHANGE_SELL, 2=ETH_DEPOSIT, 3=DONATION, 4=MILESTONE_RELEASE
                let type = 'unknown';
                
                if (tx.transactionType === 0) {
                    type = 'buy';  // EXCHANGE_BUY
                } else if (tx.transactionType === 1) {
                    type = 'sell'; // EXCHANGE_SELL
                } else if (tx.transactionType === 2) {
                    type = 'deposit'; // ETH_DEPOSIT
                } else if (tx.transactionType === 3) {
                    type = 'donation'; // DONATION
                } else if (tx.transactionType === 4) {
                    type = 'milestone-release'; // MILESTONE_RELEASE
                } else if (tx.transactionType === 5) {
                    type = 'milestone-refund'; // MILESTONE_REFUND
                }
                
                return {
                    user: tx.user,
                    type: type,
                    tokenAmount: tx.tokenAmount,
                    ethAmount: tx.etherAmount,
                    timestamp: tx.timestamp
                };
            });
            
            // Ordina per timestamp decrescente (più recenti prima)
            const sortedTransactions = formattedTransactions
            .sort((a, b) => b.timestamp - a.timestamp);
            
            setGlobalTransactions(sortedTransactions);
            
        } catch (error) {
            console.error("Errore nel caricamento delle transazioni globali:", error);
            setGlobalTransactions([]);
        } finally {
            setGlobalTransactionsLoading(false);
        }
    };
    
    // Aggiorna i saldi del contratto (solo per owner)
    const updateContractBalances = async () => {
        try {
            const exchangeAddress = contractAddress.TokenExchange;
            const token = tokenService.contract;
            
            // Carica il saldo ETH del contratto
            const contractEthBalance = await web3Service.provider.getBalance(exchangeAddress);
            
            // Carica il saldo token del contratto
            const contractDntBalance = await token.balanceOf(exchangeAddress);
            
            setState(prevState => ({
                ...prevState,
                contractEthBalance,
                contractDntBalance
            }));
        } catch (error) {
            console.error("Errore nell'aggiornamento dei saldi del contratto:", error);
        }
    };
    
    // Avvia il polling per aggiornare i dati periodicamente
    const startPollingData = () => {
        const pollingId = setInterval(async () => {
            await updateData();
        }, 5000);
        
        // Salva l'ID del polling per poterlo cancellare dopo
        window._pollingId = pollingId;
    };
    
    // Aggiorna i dati dell'applicazione
    const updateData = async () => {
        try {
            // Aggiorna i saldi
            const balance = await tokenService.getBalance();
            const ethBalance = await web3Service.getEthBalance();
            
            setState(prevState => ({
                ...prevState,
                balance,
                ethBalance
            }));
            
            // Se l'utente è owner, aggiorna anche i saldi del contratto
            if (state.isOwner) {
                await updateContractBalances();
            }
        } catch (error) {
            console.error("Errore nell'aggiornamento dei dati:", error);
        }
    };
    
    // Acquista token con ETH
    const buyTokens = async (amount) => {
        try {
            // Imposta la transazione in corso
            setState(prevState => ({ ...prevState, txBeingSent: "In attesa..." }));
            
            // Esegue la transazione
            const receipt = await exchangeService.buyTokens(amount);
            
            // Imposta l'hash della transazione
            setState(prevState => ({ ...prevState, txBeingSent: receipt.transactionHash }));
            
            // Una volta confermata, aggiorna i dati
            await updateData();
            await loadTransactions(state.selectedAddress);
            
            // Imposta il trigger per aggiornare le transazioni globali
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                globalTxRefreshTrigger: prevState.globalTxRefreshTrigger + 1
            }));
            
            // Se sei owner, ricarica anche le transazioni globali
            if (state.isOwner) {
                await loadGlobalTransactions();
            }
        } catch (error) {
            console.error("Errore nell'acquisto di token:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
        }
    };
    
    // Vende token per ETH
    const sellTokens = async (amount) => {
        try {
            setState(prevState => ({ ...prevState, txBeingSent: "Approvazione in corso..." }));
            
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const contractEthBal = await provider.getBalance(contractAddress.TokenExchange);
            const tokenContract = tokenService.contract;
            
            // Calcola valore ETH atteso - ora più semplice con 18 decimali standard
            const exchangeContract = await exchangeService.getSignedContract();
            const rate = await exchangeContract.rate();
            
            // Calcolo standardizzato per token con 18 decimali
            const tokenAmountBN = ethers.utils.parseEther(amount.toString());
            const ethAmountExpected = tokenAmountBN.div(rate);
            
            // Verifica se il contratto ha abbastanza ETH
            if (contractEthBal.lt(ethAmountExpected)) {
                throw new Error("Non c'è abbastanza ETH nel contratto per completare questa vendita.");
            }
            
            // Procedi con approvazione
            const approveReceipt = await tokenService.approve(contractAddress.TokenExchange, amount);
            
            setState(prevState => ({ ...prevState, txBeingSent: "Vendita in corso..." }));
            
            // Procedi con la vendita
            const receipt = await exchangeService.sellTokens(amount.toString());
            
            setState(prevState => ({ ...prevState, txBeingSent: receipt.transactionHash }));
            
            // Aggiorna i dati
            await updateData();
            await loadTransactions(state.selectedAddress);
            
            setState(prevState => ({
                ...prevState, 
                txBeingSent: null,
                globalTxRefreshTrigger: prevState.globalTxRefreshTrigger + 1
            }));
            
            if (state.isOwner) {
                await loadGlobalTransactions();
            }
        } catch (error) {
            console.error("Errore nella vendita di token:", error);
            
            // Estrai il messaggio di errore per renderlo più leggibile
            let errorMessage = error.message;
            
            // Cerca specificamente l'errore "Non c'e abbastanza ETH nel contratto"
            if (error.message && error.message.includes("Non c'e abbastanza ETH")) {
                errorMessage = "Non c'è abbastanza ETH nel contratto per completare questa vendita.";
            }
            
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: {
                    ...error,
                    message: errorMessage
                }
            }));
        }
    };
    
    // Deposita ETH nel contratto (solo per owner)
    const depositETH = async (amount) => {
        try {
            // Imposta la transazione in corso
            setState(prevState => ({ ...prevState, txBeingSent: "In attesa..." }));
            
            // Esegue la transazione
            const tx = await exchangeService.contract.connect(web3Service.signer).depositETH({
                value: amount
            });
            
            // Imposta l'hash della transazione
            setState(prevState => ({ ...prevState, txBeingSent: tx.hash }));
            
            // Attende che la transazione sia confermata
            const receipt = await tx.wait();
            
            // Una volta confermata, aggiorna i dati
            await updateData();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Aggiorna anche le transazioni globali
            await loadGlobalTransactions();
            
            // Imposta il trigger per aggiornare le transazioni globali
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                globalTxRefreshTrigger: prevState.globalTxRefreshTrigger + 1
            }));
        } catch (error) {
            console.error("Errore nel deposito di ETH:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
        }
    };
    
    // Estrae un messaggio di errore leggibile da un'eccezione RPC
    const getRpcErrorMessage = (error) => {
        if (error.data) {
            return error.data.message;
        }
        
        return error.message;
    };
    
    // Caricamento campagne
    const loadCampaigns = useCallback(async () => {
        setCampaignsLoading(true);
        try {
            console.log("Caricamento campagne...");
            
            // Se non c'è un indirizzo selezionato, inizializziamo solo il provider senza signer
            if (!state.selectedAddress) {
                // Inizializza un provider di sola lettura se non è già inizializzato
                if (!web3Service.provider) {
                    await web3Service.initializeReadOnly();
                }
                
                if (!campaignFactoryService.contract) {
                    await campaignFactoryService.initializeReadOnly(contractAddress.CampaignFactory, CampaignFactoryArtifact);
                }
            } else if (!campaignFactoryService.contract) {
                // Se l'utente è connesso ma il contratto non è inizializzato, lo inizializziamo normalmente
                await campaignFactoryService.initialize(contractAddress.CampaignFactory, CampaignFactoryArtifact);
            }
            
            // Verificare che il contratto sia ora inizializzato
            if (!campaignFactoryService.contract) {
                throw new Error("Impossibile inizializzare il contratto CampaignFactory");
            }
            
            const addresses = await campaignFactoryService.getAllCampaigns();
            
            const campaignList = [];
            
            for (const address of addresses) {
                // Inizializza la campagna in modalità di sola lettura se l'utente non è connesso
                if (!state.selectedAddress) {
                    await campaignService.initializeCampaignReadOnly(address, CampaignArtifact);
                } else {
                    await campaignService.initializeCampaign(address, CampaignArtifact);
                }
                const details = await campaignService.getCampaignDetails(address);
                campaignList.push(details);
            }

            if (!governanceService.contract) {
                await governanceService.initializeReadOnly();
            }

            let proposalsByCampaign = campaignProposals;
            if (Object.keys(proposalsByCampaign).length === 0) {
                try {
                    const count = await governanceService.getProposalsCount();
                    if (count > 0) {
                        const allProposals = await governanceService.getProposals(0, count);
                        
                        const proposalsByCampaign = {};
                        allProposals.forEach(proposal => {
                            const campaignKey = proposal.campaignAddress.toLowerCase();
                            if (!proposalsByCampaign[campaignKey]) {
                                proposalsByCampaign[campaignKey] = [];
                            }
                            proposalsByCampaign[campaignKey].push(proposal);
                        });

                        setCampaignProposals(proposalsByCampaign);
                    }
                } catch (error) {
                    console.error("Errore nel caricamento delle proposte:", error);
                }
            }

            const enhancedCampaigns = campaignList.map(campaign => {
                const campaignAddress = campaign.address.toLowerCase();
                const proposalArray = proposalsByCampaign[campaignAddress] || [];
                // Cerca specificamente la proposta di tipo CAMPAIGN (tipo 0)
                const proposal = proposalArray.find(p => p && p.proposalType === 0);
                    
                if (proposal) {
                    const isPendingValue = Boolean(!campaign.active && proposal.status === 0 && !proposal.executed);
                    return {
                        ...campaign,
                        proposalId: proposal.id,
                        proposalStatus: proposal.status,
                        proposalExecuted: proposal.executed,
                        positiveVotes: proposal.positiveVotes,
                        negativeVotes: proposal.negativeVotes,
                        positivePercentage: proposal.positivePercentage,
                        negativePercentage: proposal.negativePercentage,
                        votingEndTime: proposal.endTime,
                        timeRemaining: proposal.timeRemaining,
                        isPending: Boolean(!campaign.active && proposal.status === 0 && !proposal.executed),

                    };
                }
                
                return {
                    ...campaign,
                    isPending: Boolean(!campaign.active),
                };
            });
        
        setCampaigns(enhancedCampaigns);
        } catch (error) {
            console.error("Errore nel caricamento delle campagne", error);
            // Imposta l'array delle campagne come vuoto in caso di errore
            setCampaigns([]);
        } finally {
            setCampaignsLoading(false);
        }
    }, [campaignFactoryService, campaignService, state.selectedAddress, web3Service, campaignProposals]);
    
    const makeDonation = async (campaignAddress, amount, message = "") => {
        try {
            
            // Converti l'importo in wei (18 decimali)
            const amountWei = ethers.utils.parseEther(amount.toString());
            
            // Verifica se la campagna è inizializzata, altrimenti la inizializza
            if (!campaignService.campaigns[campaignAddress]) {
                await campaignService.initializeCampaign(campaignAddress, CampaignArtifact);
            }
            
            // Prima approva il contratto della campagna a spendere i token
            const approveTx = await tokenService.approve(campaignAddress, amount);
            
            // Poi effettua la donazione
            const signedCampaign = campaignService.getSignedCampaign(campaignAddress);
            
            const tx = await signedCampaign.donate(amountWei, message, { 
                gasLimit: 2000000 
            });
            
            const receipt = await tx.wait();
            
            // Aggiorna le transazioni dell'utente dopo la donazione
            await loadTransactions(state.selectedAddress);

            await checkAndTriggerAutomaticVoting(campaignAddress);
            
            return receipt;
        } catch (error) {
            console.error("Errore durante la donazione:", error);
            // Aggiungi dettagli più specifici sull'errore
            if (error.error && error.error.message) {
                console.error("Messaggio errore specifico:", error.error.message);
            }
            throw error;
        }
    };
    
    // Invia una richiesta per diventare creatore autorizzato
    const submitCreatorRequest = async (description) => {
        try {
            setState(prevState => ({ ...prevState, txBeingSent: "Invio richiesta..." }));
            
            const result = await creatorRequestManagerService.submitCreatorRequest(description);
            
            setState(prevState => ({ ...prevState, txBeingSent: result.receipt.transactionHash }));
            
            // Carica lo stato aggiornato della richiesta
            await loadCreatorRequestStatus();
            
            setState(prevState => ({ ...prevState, txBeingSent: null }));
            
            return result;
        } catch (error) {
            console.error("Errore nell'invio della richiesta:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
            throw error;
        }
    };
    
    // Carica lo stato della richiesta dell'utente corrente
    const loadCreatorRequestStatus = async () => {
        try {
            if (!state.selectedAddress) return;
            
            const request = await creatorRequestManagerService.getCreatorRequest();
            setCreatorRequest(request);
            
            // Se la richiesta è stata approvata, aggiorniamo anche lo stato di autorizzazione
            if (request && request.processed && request.approved) {
                setIsAuthorizedCreator(true);
            }
            
            return request;
        } catch (error) {
            console.error("Errore nel caricamento dello stato della richiesta:", error);
            setCreatorRequest(null);
        }
    };
    
    // Carica tutte le richieste pendenti (solo admin)
    const loadPendingRequests = async () => {
        try {
            if (!state.selectedAddress || !state.isOwner) return [];
            
            setPendingRequestsLoading(true);
            const requests = await creatorRequestManagerService.getPendingRequests();
            setPendingRequests(requests);
            
            return requests;
        } catch (error) {
            console.error("Errore nel caricamento delle richieste pendenti:", error);
            setPendingRequests([]);
        } finally {
            setPendingRequestsLoading(false);
        }
    };

    // Carica le milestone di una campagna
    const loadCampaignMilestones = async (campaignAddress) => {
        if (!campaignAddress) return [];
        
        setMilestonesLoading(prev => ({ ...prev, [campaignAddress]: true }));
        
        try {
            // Inizializza la campagna se necessario
            if (!campaignService.campaigns[campaignAddress]) {
                await campaignService.initializeCampaign(campaignAddress, CampaignArtifact);
            }
            
            const milestones = await campaignService.getMilestones(campaignAddress);
            setCampaignMilestones(prev => ({ ...prev, [campaignAddress]: milestones }));
            
            return milestones;  
        } catch (error) {
            console.error(`Errore nel caricamento delle milestone per ${campaignAddress}:`, error);
            setCampaignMilestones(prev => ({ ...prev, [campaignAddress]: [] }));
            return [];  
        } finally {
            setMilestonesLoading(prev => ({ ...prev, [campaignAddress]: false }));
        }
    };

    const loadProposals = async () => {
        try {
            console.log("[DEBUG] Inizio loadProposals");
            setProposalsLoading(true);
            
            // Inizializza in modalità sola lettura se necessario
            if (!governanceService.contract) {
                await governanceService.initializeReadOnly();
            }
            
            // Ottieni il numero totale di proposte
            const count = await governanceService.getProposalsCount();
            
            if (count === 0) {
                setProposals([]);
                setCampaignProposals({});
                setProposalsLoading(false);
                return;
            }
            
            // Carica tutte le proposte
            const allProposals = await governanceService.getProposals(0, count);

            // Organizza le proposte per indirizzo della campagna per accesso rapido
            const proposalsByCampaign = {};
            allProposals.forEach(proposal => {
                const campaignKey = proposal.campaignAddress.toLowerCase();
                if (!proposalsByCampaign[campaignKey]) {
                    proposalsByCampaign[campaignKey] = [];
                }
                proposalsByCampaign[campaignKey].push(proposal);
            });
            
            setProposals(allProposals);
            setCampaignProposals(proposalsByCampaign);

            console.log("[DEBUG] Proposte caricate:", allProposals.map(p => ({
                id: p.id, 
                status: p.status, 
                executed: p.executed,
                type: p.proposalType,
                milestoneIndex: p.milestoneIndex
            })));


            
            // Se l'utente è connesso, calcola il potere di voto per le proposte attive
            if (state.selectedAddress) {
                const votingPowerMap = {};
                
                for (const proposal of allProposals) {
                    if (proposal.status === 0 && !proposal.executed) { // Solo per proposte attive
                        try {
                            const votingPower = await governanceService.calculateVotingPower(
                                state.selectedAddress, 
                                proposal.id
                            );
                            votingPowerMap[proposal.id] = votingPower;
                        } catch (error) {
                            console.error(`Errore nel calcolo del potere di voto per proposta ${proposal.id}:`, error);
                        }
                    }
                }
                
                setUserVotingPower(votingPowerMap);
            }
        } catch (error) {
            console.error("Errore nel caricamento delle proposte:", error);
            setProposals([]);
            setCampaignProposals({});
        } finally {
            setProposalsLoading(false);
        }
    };

    /**
     * Vota su una proposta di governance per approvare o rifiutare una campagna
     * @param {number} proposalId - ID della proposta
     * @param {boolean} support - true per approvare, false per rifiutare
     * @returns {Promise<Object>} - Ricevuta della transazione
     */
    const voteOnProposal = async (proposalId, support) => {
        try {
            setState(prevState => ({ ...prevState, txBeingSent: "Invio voto..." }));
            
            const receipt = await governanceService.vote(proposalId, support);
            
            setState(prevState => ({ ...prevState, txBeingSent: receipt.transactionHash }));
            
            // Ricarica le proposte dopo il voto
            await loadProposals();
            
            // Ricarica le campagne per riflettere eventuali cambiamenti di stato
            await loadCampaigns();
            
            setState(prevState => ({ ...prevState, txBeingSent: null }));
            
            return receipt;
        } catch (error) {
            console.error("Errore nell'invio del voto:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
            throw error;
        }
    };

    const hasVoted = async (proposalId, voter) => {
        return await governanceService.hasVoted(proposalId, voter);
    };

    /**
     * Finalizza una proposta scaduta (solo per admin)
     * @param {number} proposalId - ID della proposta 
     * @returns {Promise<Object>} - Ricevuta della transazione
     */
    const finalizeProposal = async (proposalId) => {
        try {
            setState(prevState => ({ ...prevState, txBeingSent: "Finalizzazione proposta..." }));
            
            const receipt = await governanceService.finalizeExpiredProposal(proposalId);
            
            setState(prevState => ({ ...prevState, txBeingSent: receipt.transactionHash }));
            
            // Ricarica le proposte dopo la finalizzazione
            await loadProposals();
            
            // Ricarica le campagne per riflettere eventuali cambiamenti di stato
            await loadCampaigns();
            
            setState(prevState => ({ ...prevState, txBeingSent: null }));
            
            return receipt;
        } catch (error) {
            console.error("Errore nella finalizzazione della proposta:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
            throw error;
        }
    };
    
    // Approva una richiesta di creatore (solo admin)
    const approveCreatorRequest = async (applicantAddress) => {
        try {
            setState(prevState => ({ ...prevState, txBeingSent: "Approvazione richiesta..." }));
            
            const result = await creatorRequestManagerService.approveCreatorRequest(applicantAddress);
            
            setState(prevState => ({ ...prevState, txBeingSent: result.receipt.transactionHash }));
            
            // Ricarica le richieste pendenti
            await loadPendingRequests();
            
            setState(prevState => ({ ...prevState, txBeingSent: null }));
            
            return result;
        } catch (error) {
            console.error("Errore nell'approvazione della richiesta:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
            throw error;
        }
    };

    // Invia un report per una milestone completata (per creatori di campagne)
    const submitMilestoneReport = async (campaignAddress, milestoneIndex, reportText) => {
        try {
            setState(prevState => ({ ...prevState, txBeingSent: "Invio report milestone..." }));
            
            // Inizializza il MilestoneManager se necessario
            if (!campaignService.milestoneManager) {
                await campaignService.initializeMilestoneManager();
            }
            
            const milestoneManager = campaignService.getSignedMilestoneManager();
            
            const tx = await milestoneManager.submitMilestoneReport(
                campaignAddress, 
                milestoneIndex, 
                reportText,
                { gasLimit: 2000000 }
            );
            
            setState(prevState => ({ ...prevState, txBeingSent: tx.hash }));
            
            const receipt = await tx.wait();
            
            // Ricarica le milestone dopo l'invio del report
            await loadCampaignMilestones(campaignAddress);
            
            setState(prevState => ({ ...prevState, txBeingSent: null }));

            await checkAndTriggerAutomaticVoting(campaignAddress);
            
            return receipt;
        } catch (error) {
            console.error("Errore nell'invio del report per la milestone:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
            throw error;
        }
    };

    // Funzione di debug per la creazione di proposte di milestone
    const debugMilestoneProposalCreation = async (campaignAddress, milestoneIndex) => {
        try {
            console.log("======= DEBUG MILESTONE PROPOSAL CREATION =======");
            
            // Verifica account
            const account = await web3Service.getAccount();
            console.log("Account connesso:", account);
            
            // Verifica governance
            if (!governanceService.contract) {
                await governanceService.initialize(contractAddress.GovernanceSystem, GovernanceSystemArtifact);
            }
            
            // Verifica campagna
            if (!campaignService.campaigns[campaignAddress]) {
                await campaignService.initializeCampaign(campaignAddress, CampaignArtifact);
            }
            const campaign = campaignService.campaigns[campaignAddress];
            
            // Verifica permessi
            const beneficiary = await campaign.beneficiary();
            const admin = await governanceService.contract.admin();
            
            console.log("Autorizzazioni:");
            console.log("- Beneficiario:", beneficiary);
            console.log("- Admin:", admin);
            console.log("- Utente è beneficiario:", account.toLowerCase() === beneficiary.toLowerCase());
            console.log("- Utente è admin:", account.toLowerCase() === admin.toLowerCase());
            
            // Verifica milestone
            await campaignService.initializeMilestoneManager();
            const mm = campaignService.milestoneManager;
            const milestone = await mm.getMilestone(campaignAddress, milestoneIndex);
            
            console.log("Stato milestone:");
            console.log("- Finanziata completamente:", milestone[3].gte(milestone[2]));
            console.log("- Approvata:", milestone[4]);
            
            console.log("===================================");
        } catch (e) {
            console.error("DEBUG ERROR:", e);
        }
    };

    // Crea una proposta di votazione per una milestone (per creatori di campagne)
    const createMilestoneProposal = async (campaignAddress, milestoneIndex) => {
        try {
            console.log("Esecuzione debug pre-creazione proposta...");
            await debugMilestoneProposalCreation(campaignAddress, milestoneIndex);
            setState(prevState => ({ ...prevState, txBeingSent: "Creazione proposta milestone..." }));
            
            // Inizializza il contratto GovernanceSystem se necessario
            if (!governanceService.contract) {
                await governanceService.initialize(contractAddress.GovernanceSystem, GovernanceSystemArtifact);
            }
            
            const signedContract = governanceService.getSignedContract();
            
            const tx = await signedContract.createMilestoneProposal(
                campaignAddress, 
                milestoneIndex,
                { gasLimit: 2000000 }
            );
            
            setState(prevState => ({ ...prevState, txBeingSent: tx.hash }));
            
            const receipt = await tx.wait();
            
            // Ricarica le proposte e le milestone dopo la creazione
            await loadProposals();
            await loadCampaignMilestones(campaignAddress);

            // Aggiungi 1 secondo di timeout per assicurarsi che le proposte siano caricate
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Forza un aggiornamento della pagina per mostrare il pannello di voto
            window.location.reload();
            
            setState(prevState => ({ ...prevState, txBeingSent: null }));
            
            return receipt;
        } catch (error) {
            console.error("Errore nella creazione della proposta per la milestone:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
            throw error;
        }
    };

    // Calcola il potere di voto specifico per le milestone (20% donatori, 15% non donatori)
    const calculateMilestoneVotingPower = async (voter, campaignAddress, proposalId) => {
        try {
            // Usa direttamente la funzione dal servizio invece di chiamare il contratto
            return await governanceService.calculateMilestoneVotingPower(voter, campaignAddress, proposalId);
        } catch (error) {
            console.error("Errore nel calcolo del potere di voto per la milestone:", error);
            throw error;
        }
    };

    /**
     * Ritira i fondi disponibili per una campagna (milestone approvate)
     * @param {string} campaignAddress - Indirizzo della campagna
     * @returns {Promise<Object>} - Ricevuta della transazione
     */

    const withdrawMilestoneFunds = async (campaignAddress) => {
        try {
            setState(prevState => ({ ...prevState, txBeingSent: "Ritiro fondi in corso..." }));
            
            // Inizializza la campagna se necessario
            if (!campaignService.campaigns[campaignAddress]) {
            await campaignService.initializeCampaign(campaignAddress, CampaignArtifact);
            }
            
            // Esegue il ritiro dei fondi
            const receipt = await campaignService.withdraw(campaignAddress);
            
            // Ricarica le milestone dopo il ritiro
            await loadCampaignMilestones(campaignAddress);
            
            setState(prevState => ({ ...prevState, txBeingSent: null }));
            
            return receipt;
        } catch (error) {
            console.error("Errore nel ritiro dei fondi:", error);
            setState(prevState => ({
            ...prevState,
            txBeingSent: null,
            transactionError: error
            }));
            throw error;
        }
    };

    /**
     * Helper per controllare e avviare automaticamente la votazione per milestone pronte
     * @param {string} campaignAddress - Indirizzo della campagna
     */
    const checkAndTriggerAutomaticVoting = async (campaignAddress) => {
        try {
            // Carica le milestone
            const milestones = await loadCampaignMilestones(campaignAddress);
            
            if (!milestones || !Array.isArray(milestones)) {
                return;
            }
            
            // Invece di creare automaticamente le proposte, aggiorna solo lo stato delle milestone
            // per mostrare quali sono pronte per la votazione
            for (let i = 1; i < milestones.length; i++) {
                const milestone = milestones[i];
                
                // Verifica se la milestone è pronta per la votazione
                const isReady = await campaignService.milestoneManager.isMilestoneReadyForVoting(campaignAddress, i);
                console.log(`Milestone ${i} pronta per votazione:`, isReady);
            }
        } catch (error) {
            console.error("Errore nel controllo delle milestone:", error);
        }
    };

    const isMilestoneReadyForVoting = async (campaignAddress, milestoneIndex) => {
        try {
            await campaignService.initializeMilestoneManager();
            const manager = campaignService.milestoneManager;
            return await manager.isMilestoneReadyForVoting(campaignAddress, milestoneIndex);
        } catch (error) {
            console.error("Errore nella verifica dello stato della milestone:", error);
            return false;
        }
    };

    const executeProposal = async (proposalId) => {
        try {
            setState(prevState => ({ ...prevState, txBeingSent: "Esecuzione proposta..." }));
            
            const signedContract = governanceService.getSignedContract();
            const tx = await signedContract.executeProposal(proposalId, { gasLimit: 2000000 });
            
            setState(prevState => ({ ...prevState, txBeingSent: tx.hash }));
            
            const receipt = await tx.wait();
            
            // Ricarica le proposte e le milestone
            await loadProposals();
            
            // Trova la campagna associata alla proposta e ricarica le sue milestone
            const proposal = proposals.find(p => p.id === proposalId);
            if (proposal && proposal.campaignAddress) {
                await loadCampaignMilestones(proposal.campaignAddress);
            }
            
            // Aggiungi un piccolo delay per assicurare che i dati siano aggiornati
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Importante: ricarica le campagne per aggiornare lo stato
            await loadCampaigns();
            
            // Reset dello stato txBeingSent
            setState(prevState => ({ ...prevState, txBeingSent: null }));
            
            console.log("Esecuzione proposta completata con successo");
            return receipt;
        } catch (error) {
            console.error("Errore nell'esecuzione della proposta:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
            throw error;
        }
    };
    
    // Rifiuta una richiesta di creatore (solo admin)
    const rejectCreatorRequest = async (applicantAddress) => {
        try {
            setState(prevState => ({ ...prevState, txBeingSent: "Rifiuto richiesta..." }));
            
            const result = await creatorRequestManagerService.rejectCreatorRequest(applicantAddress);
            
            setState(prevState => ({ ...prevState, txBeingSent: result.receipt.transactionHash }));
            
            // Ricarica le richieste pendenti
            await loadPendingRequests();
            
            setState(prevState => ({ ...prevState, txBeingSent: null }));
            
            return result;
        } catch (error) {
            console.error("Errore nel rifiuto della richiesta:", error);
            setState(prevState => ({
                ...prevState,
                txBeingSent: null,
                transactionError: error
            }));
            throw error;
        }
    };
    
    
    // Effetto per caricare le transazioni globali quando cambia il trigger
    useEffect(() => {
        if (state.selectedAddress && state.isOwner) {
            loadGlobalTransactions();
        }
    }, [state.selectedAddress, state.globalTxRefreshTrigger, state.isOwner]);
    
    // Ascolto dei cambiamenti di account
    useEffect(() => {
        const handleAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                // L'utente si è disconnesso
                setState(prevState => ({
                    ...prevState,
                    selectedAddress: null,
                    balance: null,
                    ethBalance: null,
                    tokenData: null
                }));
                
                setCampaigns([]);
                setUserCampaigns([]);
                setCampaignsLoading(true);
                setUserCampaignsLoading(true);
                setIsAuthorizedCreator(false);
            } else if (accounts[0] !== state.selectedAddress) {
                // Cambio account
                initialize(accounts[0]);
            }
        };
        
        const handleChainChanged = () => {
            // La strategia più semplice è ricaricare la pagina
            window.location.reload();
        };
        
        if (window.ethereum) {
            window.ethereum.on("accountsChanged", handleAccountsChanged);
            window.ethereum.on("chainChanged", handleChainChanged);
        }
        
        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
                window.ethereum.removeListener("chainChanged", handleChainChanged);
                
                // Ferma il polling se è attivo
                if (window._pollingId) {
                    clearInterval(window._pollingId);
                    window._pollingId = undefined;
                }
            }
        };
    }, [state.selectedAddress]);
    
    // Controlla se il wallet è connesso all'avvio
    useEffect(() => {
        const checkIfWalletIsConnected = async () => {
            if (window.ethereum) {
                try {
                    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                    
                    if (chainId !== HARDHAT_NETWORK_ID) {
                        setState(prevState => ({
                            ...prevState,
                            networkError: 'Per favore connetti MetaMask alla rete Localhost 8545'
                        }));
                        return;
                    }
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts.length > 0) {
                        await initialize(accounts[0]);
                    }
                } catch (error) {
                    console.error("Errore nel controllo del wallet:", error);
                }
            }
        };
        
        checkIfWalletIsConnected();
    }, []);
    
    // Valore esposto dal context
    const contextValue = {
        ...state,
        connectWallet,
        dismissNetworkError,
        dismissTransactionError,
        buyTokens,
        sellTokens,
        depositETH,
        updateData,
        loadTransactions,
        getRpcErrorMessage,
        globalTransactions,
        globalTransactionsLoading,
        loadGlobalTransactions,
        campaigns,
        campaignsLoading,
        userCampaigns,
        userCampaignsLoading,
        isAuthorizedCreator,
        proposals,
        proposalsLoading,
        campaignProposals,
        userVotingPower,
        isAdmin,
        loadProposals,
        voteOnProposal,
        hasVoted,
        finalizeProposal,
        loadCampaigns,
        makeDonation,
        creatorRequest,
        pendingRequests,
        pendingRequestsLoading,
        submitCreatorRequest,
        loadCreatorRequestStatus,
        loadPendingRequests,
        approveCreatorRequest,
        rejectCreatorRequest,
        campaignMilestones,
        milestonesLoading,
        loadCampaignMilestones,
        submitMilestoneReport,
        createMilestoneProposal,
        withdrawMilestoneFunds,
        calculateMilestoneVotingPower,
        isMilestoneReadyForVoting,
        executeProposal
    };
    
    return (
        <Web3Context.Provider value={contextValue}>
        {children}
        </Web3Context.Provider>
    );
}

// Hook personalizzato per usare il contesto
export function useWeb3() {
    return useContext(Web3Context);
}