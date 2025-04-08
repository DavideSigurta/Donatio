import React from "react";
import { ethers } from "ethers";

// Importazione dei componenti UI
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { Exchange } from "./Exchange";
import { TransactionErrorMessage } from "./TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage";
import { AdminDashboard } from "./AdminDashboard";

// Importazione degli artifact dei contratti
import TokenArtifact from "../contracts/Token.json";
import TokenExchangeArtifact from "../contracts/TokenExchange.json";

// Importazione degli indirizzi dei contratti
import contractAddress from "../contracts/contract-address.json";

// Costante per identificare la rete Hardhat locale
const HARDHAT_NETWORK_ID = '31337';

// Codici di errore utili per gestire errori specifici
const ERROR_CODE_TX_REJECTED_BY_USER = 4001;

/**
* Componente principale dell'applicazione Donatio
* Gestisce la connessione con MetaMask, i contratti e l'UI principale
*/
export class Dapp extends React.Component {
  constructor(props) {
    super(props);
    
    // Stato iniziale dell'applicazione
    this.initialState = {
      // Dati generali del token (nome, simbolo)
      tokenData: undefined,
      // Indirizzo dell'utente connesso
      selectedAddress: undefined,
      // Saldo DNT dell'utente
      balance: undefined,
      // Saldo ETH dell'utente
      ethBalance: undefined,
      // Tasso di cambio tra ETH e DNT
      exchangeRate: undefined,
      // Hash della transazione in corso
      txBeingSent: undefined,
      // Errore dell'ultima transazione
      transactionError: undefined,
      // Errore di rete
      networkError: undefined,
      // Flag per identificare se l'utente è l'owner
      isOwner: false,
      // Indirizzo dell'owner del contratto
      ownerAddress: "",
      // Saldo ETH del contratto
      contractEthBalance: ethers.BigNumber.from(0),
      // Saldo DNT del contratto
      contractDntBalance: ethers.BigNumber.from(0),
      // Lista delle transazioni dell'utente
      transactions: [],
      // Flag per identificare se le transazioni stanno caricando
      transactionsLoading: true,
      // Trigger per aggiornare la lista transazioni globali
      globalTxRefreshTrigger: 0
    };
    
    // Inizializza lo stato con i valori predefiniti
    this.state = this.initialState;
  }
  
  /**
  * React lifecycle method che viene chiamata quando il componente è montato
  * Verifica se l'utente ha un wallet Ethereum e si connette ad esso
  */
  componentDidMount() {
    // Se MetaMask non è installato, non facciamo nulla
    if (window.ethereum === undefined) {
      return;
    }
    
    // Hook per gli eventi di MetaMask
    window.ethereum.on("accountsChanged", this._handleAccountsChanged);
    
    // Nota: accountsChanged NON viene emesso la prima volta
    window.ethereum.on("chainChanged", this._handleChainChanged);
    
    // Verifichiamo subito se abbiamo già l'accesso agli account dell'utente
    this._checkIfWalletIsConnected();
  }
  
  /**
  * React lifecycle method che viene chiamata quando il componente viene smontato
  * Rimuove gli handler degli eventi per evitare memory leak
  */
  componentWillUnmount() {
    // Rimuove tutti gli event listeners se MetaMask è presente
    if (window.ethereum) {
      window.ethereum.removeListener("accountsChanged", this._handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", this._handleChainChanged);
    }
  }
  
  render() {
    // Se MetaMask non è installato
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }
    
    // Se non abbiamo l'indirizzo dell'utente = non connesso
    if (!this.state.selectedAddress) {
      return (
        <ConnectWallet 
        connectWallet={() => this._connectWallet()} 
        networkError={this.state.networkError}
        dismiss={() => this._dismissNetworkError()}
        />
      );
    }
    
    // Se non abbiamo inizializzato i dati del token, mostra loading
    if (!this.state.tokenData) {
      return <Loading />;
    }
    
    // Renderizza l'interfaccia principale
    return (
      <div className="container py-5">
      <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6">
      {/* Notifiche di transazione */}
      {this.state.txBeingSent && (
        <WaitingForTransactionMessage txHash={this.state.txBeingSent} />
      )}
      
      {this.state.transactionError && (
        <TransactionErrorMessage
        message={this._getRpcErrorMessage(this.state.transactionError)}
        dismiss={() => this._dismissTransactionError()}
        />
      )}
      
      {/* Mostra AdminDashboard per l'owner O Exchange per gli altri utenti */}
      {this.state.isOwner ? (
        <AdminDashboard 
        ownerAddress={this.state.ownerAddress}
        contractAddress={this._exchange.address}
        ownerEthBalance={this.state.ethBalance}
        ownerDntBalance={this.state.balance}
        contractEthBalance={this.state.contractEthBalance}
        contractDntBalance={this.state.contractDntBalance}
        depositETH={(amount) => this._depositETH(amount)}
        // Aggiungiamo queste props necessarie per GlobalTransactionHistory
        exchangeContract={this._exchange}
        tokenContract={this._token}
        account={this.state.selectedAddress}
        provider={this._provider}
        tokenSymbol={this.state.tokenData.symbol}
        globalTxRefreshTrigger={this.state.globalTxRefreshTrigger}
        />
      ) : (
        <div className="card shadow">
        <div className="card-body p-4">
        <Exchange
        buyTokens={(amount) => this._buyTokens(amount)}
        sellTokens={(amount) => this._sellTokens(amount)}
        ethBalance={this.state.ethBalance}
        dntBalance={this.state.balance}
        exchangeRate={this.state.exchangeRate}
        tokenSymbol={this.state.tokenData.symbol}
        transactions={this.state.transactions}
        transactionsLoading={this.state.transactionsLoading}
        contractAddress={this._exchange.address}
        />
        </div>
        </div>
      )}
      </div>
      </div>
      </div>
    );
  }
  
  /**
  * Handler per l'evento accountsChanged di MetaMask
  * @param {string[]} accounts - Lista di account connessi
  */
  _handleAccountsChanged = (accounts) => {
    // Se non ci sono account, resettiamo lo stato
    if (accounts.length === 0) {
      this._resetState();
      return;
    }
    
    // Altrimenti inizializziamo con l'account selezionato
    this._initialize(accounts[0]);
  };
  
  /**
  * Handler per l'evento chainChanged di MetaMask
  * Ricarica la pagina quando l'utente cambia rete
  */
  _handleChainChanged = () => {
    // La strategia più semplice è ricaricare la pagina
    window.location.reload();
  };
  
  /**
  * Verifica se il wallet è connesso all'avvio dell'applicazione
  */
  async _checkIfWalletIsConnected() {
    try {
      // Richiede gli account connessi a MetaMask
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      // Se c'è almeno un account connesso, lo utilizziamo
      if (accounts.length > 0) {
        this._initialize(accounts[0]);
      }
    } catch (error) {
      console.error("Errore nella verifica del wallet:", error);
    }
  }
  
  /**
  * Connette il wallet dell'utente all'applicazione
  */
  async _connectWallet() {
    try {
      // Verifica che l'utente sia sulla rete corretta
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (chainId !== HARDHAT_NETWORK_ID) {
        this.setState({ 
          networkError: 'Per favore connetti MetaMask alla rete Localhost 8545'
        });
        return;
      }
      
      // Richiedi l'accesso agli account dell'utente
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Usa il primo account
      await this._initialize(accounts[0]);
      
    } catch (error) {
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }
      console.error("Errore durante la connessione del wallet:", error);
      this.setState({ 
        networkError: 'Si è verificato un errore nella connessione del wallet.'
      });
    }
  }
  
  /**
  * Inizializza l'applicazione con l'account utente selezionato
  * @param {string} userAddress - Indirizzo dell'account connesso
  */
  async _initialize(userAddress) {
    this.setState({
      selectedAddress: userAddress,
    });
    
    // Inizializza ethers, i contratti e recupera i dati iniziali
    try {
      await this._initializeEthers();
      await this._getTokenData();
      await this._startPollingData();
      await this._loadTransactions();
    } catch (error) {
      console.error("Errore nell'inizializzazione:", error);
      this.setState({ 
        networkError: 'Si è verificato un errore nell\'inizializzazione dell\'applicazione.' 
      });
    }
  }
  
  /**
  * Inizializza ethers per interagire con la blockchain
  */
  async _initializeEthers() {
    // Provider per interagire con la blockchain
    this._provider = new ethers.providers.Web3Provider(window.ethereum);
    
    // Signer per firmare le transazioni
    const signer = this._provider.getSigner(0);
    
    // Istanza del contratto Token
    this._token = new ethers.Contract(
      contractAddress.Token,
      TokenArtifact.abi,
      signer
    );
    
    // Istanza del contratto TokenExchange
    this._exchange = new ethers.Contract(
      contractAddress.TokenExchange,
      TokenExchangeArtifact.abi,
      signer
    );
    
    // Recupera il tasso di cambio
    try {
      const rate = await this._exchange.rate();
      this.setState({ exchangeRate: rate.toNumber() });
      
      //Verifica se l'utente è l'owner
      const owner = await this._exchange.owner();
      const isOwner = owner.toLowerCase() === this.state.selectedAddress.toLowerCase();
      this.setState({ 
        isOwner,
        ownerAddress: owner 
      });
      
      //Aggiorna i saldi del contratto
      if (isOwner) {
        this._updateContractBalances();
      }
      
    } catch (error) {
      console.error("Errore nell'inizializzazione:", error);
      this.setState({ exchangeRate: 100 }); // Valore di fallback
    }
  }
  
  /**
  * Recupera i dati principali del token (nome, simbolo)
  */
  async _getTokenData() {
    const name = await this._token.name();
    const symbol = await this._token.symbol();
    
    this.setState({ tokenData: { name, symbol } });
  }
  
  /**
  * Avvia un polling periodico per aggiornare i dati
  */
  _startPollingData() {
    this._pollDataInterval = setInterval(() => this._updateData(), 1000);
    this._updateData();
  }
  
  /**
  * Aggiorna i dati dell'applicazione (saldi, etc.)
  */
  async _updateData() {
    try {
      // Aggiorna il saldo DNT
      await this._updateBalance();
      
      // Aggiorna il saldo ETH
      await this._updateEthBalance();
      
      //Aggiorna i saldi del contratto se l'utente è l'owner
      if (this.state.isOwner) {
        await this._updateContractBalances();
      }
    } catch (error) {
      console.error("Errore nell'aggiornamento dei dati:", error);
    }
  }
  
  /**
  * Aggiorna il saldo DNT dell'utente
  */
  async _updateBalance() {
    const balance = await this._token.balanceOf(this.state.selectedAddress);
    this.setState({ balance });
  }
  
  /**
  * Aggiorna il saldo ETH dell'utente
  */
  async _updateEthBalance() {
    const ethBalance = await this._provider.getBalance(this.state.selectedAddress);
    this.setState({ ethBalance });
  }
  
  /**
  * Aggiorna i saldi del contratto
  */
  async _updateContractBalances() {
    if (this._provider && this._exchange && this._token) {
      try {
        // Ottieni saldo ETH del contratto
        const contractEthBalance = await this._provider.getBalance(this._exchange.address);
        
        // Ottieni saldo DNT del contratto
        const contractDntBalance = await this._token.balanceOf(this._exchange.address);
        
        this.setState({
          contractEthBalance,
          contractDntBalance
        });
      } catch (error) {
        console.error("Errore nell'aggiornamento dei saldi del contratto:", error);
      }
    }
  }
  
  /**
  * Carica le transazioni dell'utente
  */
  async _loadTransactions() {
    this.setState({ transactionsLoading: true });
    
    try {
      const txList = [];
      
      // Ottieni gli eventi di acquisto token
      const purchaseFilter = this._exchange.filters.TokensPurchased(this.state.selectedAddress);
      const purchaseEvents = await this._exchange.queryFilter(purchaseFilter);
      
      // Ottieni gli eventi di vendita token
      const sellFilter = this._exchange.filters.TokensSold(this.state.selectedAddress);
      const sellEvents = await this._exchange.queryFilter(sellFilter);
      
      // Elabora gli eventi di acquisto
      for (const event of purchaseEvents) {
        const block = await this._provider.getBlock(event.blockNumber);
        txList.push({
          type: 'buy',
          tokenAmount: event.args.tokenAmount,
          ethAmount: event.args.ethAmount,
          timestamp: block.timestamp,
          hash: event.transactionHash
        });
      }
      
      // Elabora gli eventi di vendita
      for (const event of sellEvents) {
        const block = await this._provider.getBlock(event.blockNumber);
        txList.push({
          type: 'sell',
          tokenAmount: event.args.tokenAmount,
          ethAmount: event.args.ethAmount,
          timestamp: block.timestamp,
          hash: event.transactionHash
        });
      }
      
      // Ordina le transazioni per timestamp (più recenti prima)
      txList.sort((a, b) => b.timestamp - a.timestamp);
      
      this.setState({
        transactions: txList,
        transactionsLoading: false
      });
    } catch (error) {
      console.error("Errore durante il caricamento delle transazioni:", error);
      this.setState({ transactionsLoading: false });
    }
  }
  
  /**
  * Deposita ETH nel contratto
  * @param {BigNumber} amount - Quantità di ETH in wei da depositare
  */
  async _depositETH(amount) {
    try {
      this._dismissTransactionError();
      
      // Chiama la funzione depositETH del contratto
      const tx = await this._exchange.depositETH({ value: amount });
      this.setState({ txBeingSent: tx.hash });
      
      // Attende la conferma della transazione
      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Transazione fallita");
      }
      
      // Aggiorna i saldi
      await this._updateBalance();
      await this._updateEthBalance();
      await this._updateContractBalances();

      // Incrementa il trigger per forzare l'aggiornamento delle transazioni globali
      this.setState(prevState => ({
        globalTxRefreshTrigger: prevState.globalTxRefreshTrigger + 1
      }));
      
    } catch (error) {
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }
      console.error("Errore nel deposito ETH:", error);
      this.setState({ transactionError: error });
    } finally {
      this.setState({ txBeingSent: undefined });
    }
  }
  
  /**
  * Acquista token DNT con ETH
  * @param {BigNumber} amount - Quantità di ETH in wei da utilizzare per l'acquisto
  */
  async _buyTokens(amount) {
    try {
      this._dismissTransactionError();
      
      // Chiama la funzione buyTokens del contratto
      const tx = await this._exchange.buyTokens({ value: amount });
      this.setState({ txBeingSent: tx.hash });
      
      // Attende la conferma della transazione
      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Transazione fallita");
      }
      
      // Aggiorna i saldi
      await this._updateBalance();
      await this._updateEthBalance();
      
      // Aggiorna la cronologia delle transazioni
      await this._loadTransactions();
      
    } catch (error) {
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }
      console.error("Errore nell'acquisto token:", error);
      this.setState({ transactionError: error });
    } finally {
      this.setState({ txBeingSent: undefined });
    }
  }
  
  /**
  * Vende token DNT per ricevere ETH
  * @param {BigNumber} amount - Quantità di token DNT da vendere
  */
  async _sellTokens(amount) {
    try {
      this._dismissTransactionError();
      
      // Verifica se l'utente ha già dato l'approvazione
      const allowance = await this._token.allowance(
        this.state.selectedAddress,
        this._exchange.address
      );
      
      // Se l'allowance è inferiore all'amount, chiedi l'approvazione
      if (allowance.lt(amount)) {
        const approveTx = await this._token.approve(this._exchange.address, amount);
        this.setState({ txBeingSent: approveTx.hash });
        
        // Attendi la conferma dell'approvazione
        const approveReceipt = await approveTx.wait();
        if (approveReceipt.status === 0) {
          throw new Error("Approvazione fallita");
        }
      }
      
      // Chiama la funzione sellTokens del contratto
      const tx = await this._exchange.sellTokens(amount);
      this.setState({ txBeingSent: tx.hash });
      
      // Attende la conferma della transazione
      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Transazione fallita");
      }
      
      // Aggiorna i saldi
      await this._updateBalance();
      await this._updateEthBalance();
      
      // Aggiorna i saldi del contratto se l'utente è l'owner
      if (this.state.isOwner) {
        await this._updateContractBalances();
      }
      
      // Aggiorna la cronologia delle transazioni
      await this._loadTransactions();
      
    } catch (error) {
      if (error.code === ERROR_CODE_TX_REJECTED_BY_USER) {
        return;
      }
      console.error("Errore nella vendita token:", error);
      this.setState({ transactionError: error });
    } finally {
      this.setState({ txBeingSent: undefined });
    }
  }
  
  /**
  * Verifica che l'utente sia connesso alla rete corretta
  */
  async _checkNetwork() {
    if (window.ethereum.networkVersion === HARDHAT_NETWORK_ID) {
      return true;
    }
    
    this.setState({ 
      networkError: 'Per favore connetti MetaMask alla rete Localhost 8545'
    });
    
    return false;
  }
  
  /**
  * Resetta lo stato dell'applicazione ai valori iniziali
  */
  _resetState() {
    clearInterval(this._pollDataInterval);
    this.setState(this.initialState);
  }
  
  /**
  * Estrae un messaggio di errore leggibile da un'eccezione RPC
  * @param {Error} error - L'errore da cui estrarre il messaggio
  */
  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message;
    }
    
    return error.message;
  }
  
  /**
  * Rimuove l'errore di rete dallo stato
  */
  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }
  
  /**
  * Rimuove l'errore di transazione dallo stato
  */
  _dismissTransactionError() {
    this.setState({ transactionError: undefined });
  }
}