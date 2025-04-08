import React, { useState } from 'react';
import { ethers } from 'ethers';
import { GlobalTransactionHistory } from './GlobalTransactionHistory'; // Nuovo import

/**
* Dashboard di amministrazione per l'owner del contratto
* Mostra informazioni sul wallet dell'owner e sul contratto, e permette di depositare ETH
* 
* @param {string} ownerAddress - Indirizzo dell'owner del contratto
* @param {string} contractAddress - Indirizzo del contratto TokenExchange
* @param {BigNumber} ownerEthBalance - Saldo ETH dell'owner
* @param {BigNumber} ownerDntBalance - Saldo DNT dell'owner
* @param {BigNumber} contractEthBalance - Saldo ETH del contratto
* @param {BigNumber} contractDntBalance - Saldo DNT del contratto
* @param {Function} depositETH - Funzione per depositare ETH nel contratto
*/
export function AdminDashboard({ 
    account, 
    exchangeContract, 
    tokenContract, 
    provider,
    ownerAddress, 
    contractAddress,
    ownerEthBalance, 
    ownerDntBalance,
    contractEthBalance,
    contractDntBalance,
    depositETH,
    globalTxRefreshTrigger
}) {
    // Stato locale per gestire l'input dell'importo da depositare
    const [depositAmount, setDepositAmount] = useState("");
    // Conversione dell'importo in Wei (formato BigNumber per Ethereum)
    const [depositAmountWei, setDepositAmountWei] = useState("");
    
    // Stato per le transazioni personali dell'admin
    const [adminTransactions, setAdminTransactions] = useState([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [tokenSymbol, setTokenSymbol] = useState('DNT');
    
    /**
    * Gestisce il cambiamento dell'importo nell'input
    * Converte l'importo da ETH a Wei
    * @param {Event} e - Evento input change
    */
    const handleAmountChange = (e) => {
        const value = e.target.value;
        setDepositAmount(value);
        
        try {
            if (value && !isNaN(value)) {
                // Converte l'importo da ETH a Wei (1 ETH = 10^18 Wei)
                const amountWei = ethers.utils.parseEther(value);
                setDepositAmountWei(amountWei);
            } else {
                setDepositAmountWei("");
            }
        } catch (error) {
            console.error("Errore nella conversione:", error);
            setDepositAmountWei("");
        }
    };
    
    /**
    * Gestisce la sottomissione del form per depositare ETH
    * @param {Event} e - Evento form submit
    */
    const handleDeposit = (e) => {
        e.preventDefault();
        if (depositAmountWei) {
            // Chiama la funzione depositETH passata come prop
            depositETH(depositAmountWei);
            // Resetta il form
            setDepositAmount("");
            setDepositAmountWei("");
        }
    };
    
    /**
    * Formatta un valore in Wei come ETH con 4 decimali
    * @param {BigNumber} value - Valore in Wei
    * @return {string} - Valore formattato in ETH
    */
    const formatEther = (value) => {
        if (!value) return "0";
        return parseFloat(ethers.utils.formatEther(value)).toFixed(4);
    };
    
    /**
    * Abbrevia un indirizzo mostrandone solo l'inizio
    * @param {string} address - Indirizzo completo
    * @return {string} - Indirizzo abbreviato
    */
    const shortenAddress = (address) => {
        if (!address) return "";
        return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
    };
    
    return (
        <div>
        <div className="card shadow mb-4">
        <div className="card-header bg-primary text-white">
        <h4 className="mb-0">Admin Dashboard</h4>
        </div>
        <div className="card-body">
        {/* Sezione informazioni wallet e contratto con layout verticale */}
        <div className="mb-4">
        <h5 className="border-bottom pb-2 mb-3">Informazioni Wallet</h5>
        
        {/* Card wallet owner */}
        <div className="card mb-3">
        <div className="card-header bg-light">
        <h6 className="mb-0">I tuoi saldi</h6>
        </div>
        <div className="card-body">
        <div className="d-flex justify-content-between mb-2">
        <span className="text-muted">ETH Balance:</span>
        <span className="fw-bold">{formatEther(ownerEthBalance)} ETH</span>
        </div>
        <div className="d-flex justify-content-between">
        <span className="text-muted">DNT Balance:</span>
        <span className="fw-bold">{ownerDntBalance?.toString() || "0"} DNT</span>
        </div>
        </div>
        </div>
        
        {/* Card contratto exchange */}
        <div className="card mb-3">
        <div className="card-header bg-light">
        <h6 className="mb-0">Saldi del Contratto</h6>
        </div>
        <div className="card-body">
        <div className="d-flex justify-content-between mb-2">
        <span className="text-muted">ETH Balance:</span>
        <span className="fw-bold">{formatEther(contractEthBalance)} ETH</span>
        </div>
        <div className="d-flex justify-content-between">
        <span className="text-muted">DNT Balance:</span>
        <span className="fw-bold">{contractDntBalance?.toString() || "0"} DNT</span>
        </div>
        </div>
        </div>
        </div>
        
        {/* Sezione per depositare ETH nel contratto */}
        <div className="mb-3">
        <h5 className="border-bottom pb-2 mb-3">Deposita ETH nel Contratto</h5>
        <form onSubmit={handleDeposit}>
        <div className="mb-3">
        <label htmlFor="ethDeposit" className="form-label">Importo ETH da depositare:</label>
        <div className="input-group">
        <input 
        type="number" 
        className="form-control" 
        id="ethDeposit"
        placeholder="0.0" 
        value={depositAmount}
        onChange={handleAmountChange}
        step="0.001"
        min="0"
        />
        <span className="input-group-text">ETH</span>
        </div>
        <div className="form-text">
        Il deposito sarà utilizzato per il buffer di scambio DNT → ETH.
        </div>
        </div>
        
        <button 
        className="btn btn-primary w-100" 
        type="submit"
        disabled={!depositAmountWei || depositAmountWei.eq(0)}
        >
        Deposita ETH nel Contratto
        </button>
        </form>
        </div>
        </div>
        </div>
        
        <div className="mt-4">
        <h5 className="mb-3">Cronologia globale delle transazioni</h5>
        <p className="text-muted mb-4">
        Visualizza tutte le transazioni effettuate dagli utenti sulla piattaforma Donatio.
        </p>
        <GlobalTransactionHistory 
        exchangeContract={exchangeContract} 
        tokenSymbol={tokenSymbol} 
        refreshTrigger = {globalTxRefreshTrigger}
        />
        </div>
        </div>
    );
}