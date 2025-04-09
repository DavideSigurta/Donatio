import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import web3Service from '../services/Web3Service';
import tokenService from '../services/TokenService';
import exchangeService from '../services/ExchangeService';
import transactionService from '../services/TransactionService';

// Importazione degli artifact
import TokenArtifact from "../contracts/Token.json";
import TokenExchangeArtifact from "../contracts/TokenExchange.json";
import TransactionRegistryArtifact from "../contracts/TransactionRegistry.json";
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
                    if (tx.transactionType === 0) type = 'buy';  // EXCHANGE_BUY
                    else if (tx.transactionType === 1) type = 'sell'; // EXCHANGE_SELL
                    else if (tx.transactionType === 2) type = 'deposit'; // ETH_DEPOSIT
                    
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
                // TransactionType: 0=EXCHANGE_BUY, 1=EXCHANGE_SELL, 2=ETH_DEPOSIT, 3=TOKEN_WITHDRAW, 4=ETH_WITHDRAW
                let type = 'unknown';
                
                if (tx.transactionType === 0) {
                    type = 'buy';  // EXCHANGE_BUY
                } else if (tx.transactionType === 1) {
                    type = 'sell'; // EXCHANGE_SELL
                } else if (tx.transactionType === 2) {
                    type = 'deposit'; // ETH_DEPOSIT
                } else if (tx.transactionType === 3) {
                    type = 'withdraw-token'; // TOKEN_WITHDRAW
                } else if (tx.transactionType === 4) {
                    type = 'withdraw-eth'; // ETH_WITHDRAW
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
        loadGlobalTransactions
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