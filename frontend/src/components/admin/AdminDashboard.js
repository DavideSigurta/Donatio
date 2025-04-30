import React, { useState } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import { formatEtherValue, formatTokenValue, parseSafeValue, shortenAddress, isAmountExceedingBalance } from '../../utils/formatters';

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
    const [insufficientBalance, setInsufficientBalance] = useState(false);
    
    // Funzione di gestione dell'input per il deposito
    const handleAmountChange = (e) => {
        const value = e.target.value;
        setDepositAmount(value);
        
        try {
            if (value && !isNaN(value)) {
                const amountWei = parseSafeValue(value, true); // Usiamo parseSafeValue per conversione sicura
                setDepositAmountWei(amountWei);
                
                // Verifica se l'importo supera il saldo ETH disponibile
                const hasInsufficientBalance = isAmountExceedingBalance(value, ownerEthBalance);
                setInsufficientBalance(hasInsufficientBalance);
            } else {
                setDepositAmountWei("");
                setInsufficientBalance(false);
            }
        } catch (error) {
            console.error("Errore nella conversione:", error);
            setDepositAmountWei("");
            setInsufficientBalance(false);
        }
    };
    
    const handleDeposit = (e) => {
        e.preventDefault();
        if (depositAmountWei && !insufficientBalance) {
            depositETH(depositAmountWei);
            setDepositAmount("");
            setDepositAmountWei("");
            setInsufficientBalance(false);
        }
    };
    
    return (
        <div>
            <div className="card shadow mb-4">
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
                                {insufficientBalance && (
                                    <small className="text-danger mt-1">
                                        Saldo ETH insufficienteper effettuare il deposito.
                                    </small>
                                )}
                                <div className="form-text">
                                    Il deposito sarà utilizzato per il buffer di scambio DNT → ETH.
                                </div>
                            </div>
                            
                            <button 
                                className="btn btn-primary w-100" 
                                type="submit"
                                disabled={!depositAmountWei || depositAmountWei.isZero() || insufficientBalance}
                            >
                                Deposita ETH nel Contratto
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}