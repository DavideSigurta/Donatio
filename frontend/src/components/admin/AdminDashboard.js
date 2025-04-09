import React, { useState } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import { GlobalTransactionHistory } from '../transaction/GlobalTransactionHistory';
import { formatEtherValue, formatTokenValue, parseSafeValue, shortenAddress } from '../../utils/formatters';

/**
 * Dashboard di amministrazione per l'owner del contratto
 * Utilizza il Web3Context e le funzioni di formattazione universali
 */
export function AdminDashboard() {
    const {
        selectedAddress: account,
        ethBalance: ownerEthBalance,
        balance: ownerDntBalance,
        contractEthBalance,
        contractDntBalance,
        depositETH,
        tokenData
    } = useWeb3();
    
    const tokenSymbol = tokenData?.symbol || 'DNT';
    
    // Stato locale per gestire l'input dell'importo da depositare
    const [depositAmount, setDepositAmount] = useState("");
    const [depositAmountWei, setDepositAmountWei] = useState("");
    
    // Funzione di gestione dell'input per il deposito
    const handleAmountChange = (e) => {
        const value = e.target.value;
        setDepositAmount(value);
        
        try {
            if (value && !isNaN(value)) {
                const amountWei = parseSafeValue(value, true); // Usiamo parseSafeValue per conversione sicura
                setDepositAmountWei(amountWei);
            } else {
                setDepositAmountWei("");
            }
        } catch (error) {
            console.error("Errore nella conversione:", error);
            setDepositAmountWei("");
        }
    };
    
    const handleDeposit = (e) => {
        e.preventDefault();
        if (depositAmountWei) {
            depositETH(depositAmountWei);
            setDepositAmount("");
            setDepositAmountWei("");
        }
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
                                    <span className="fw-bold">{formatEtherValue(ownerEthBalance)} ETH</span>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <span className="text-muted">DNT Balance:</span>
                                    <span className="fw-bold">{formatTokenValue(ownerDntBalance)} {tokenSymbol}</span>
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
                                    <span className="fw-bold">{formatEtherValue(contractEthBalance)} ETH</span>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <span className="text-muted">DNT Balance:</span>
                                    <span className="fw-bold">{formatTokenValue(contractDntBalance)} {tokenSymbol}</span>
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
                                disabled={!depositAmountWei || depositAmountWei.isZero()}
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
                <GlobalTransactionHistory />
            </div>
        </div>
    );
}