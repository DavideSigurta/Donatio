import React from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import { formatEtherValue, formatTokenValue, formatDate } from '../../utils/formatters';

/**
 * Componente che mostra la cronologia delle transazioni dell'utente
 * Utilizza il Web3Context e le funzioni di formattazione universali
 */
export function TransactionHistory() {
    // Utilizza il context per ottenere i dati necessari
    const { 
        transactions, 
        transactionsLoading: isLoading, 
        tokenData
    } = useWeb3();
    
    const tokenSymbol = tokenData?.symbol || 'DNT';
    const contractAddress = tokenData?.exchangeAddress;
    
    // Se non ci sono transazioni e non sta caricando, mostra messaggio
    if (!isLoading && (!transactions || transactions.length === 0)) {
        return (
            <div className="card mt-4 shadow">
                <div className="card-header bg-light">
                    <h5 className="mb-0">Le tue transazioni</h5>
                </div>
                <div className="card-body text-center py-4">
                    <p className="mb-0 text-muted">Non hai ancora effettuato transazioni.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="card mt-4 shadow">
            <div className="card-header bg-light">
                <h5 className="mb-0">Le tue transazioni</h5>
            </div>
            <div className="card-body p-0">
                {isLoading ? (
                    <div className="text-center py-4">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Caricamento...</span>
                        </div>
                        <p className="mt-2">Caricamento transazioni...</p>
                    </div>
                ) : (
                    <div className="transactions-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {transactions.map((tx, index) => (
                            <div key={index} className="transaction-box border-bottom mb-3">
                                {/* Sezione con gli indirizzi */}
                                <div className="address-section p-3">
                                    {/* Layout a griglia per l'indirizzo di destinazione (il contratto) */}
                                    <div className="container-fluid p-0">
                                        <div className="row">
                                            <div className="col-2 col-md-1 text-end">
                                                <span className="badge bg-secondary">A:</span>
                                            </div>
                                            <div className="col-10 col-md-11">
                                                <span className="text-break">{contractAddress}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Sezione con i dettagli della transazione */}
                                <div className="transaction-details p-3 bg-light">
                                    <div className="row">
                                        <div className="col-md-4">
                                            <div className="mb-2">
                                                <small className="text-muted d-block">Data e ora:</small>
                                                <strong>{formatDate(tx.timestamp)}</strong>
                                            </div>
                                        </div>
                                        <div className="col-md-2">
                                            <div className="mb-2">
                                                <small className="text-muted d-block">Tipo:</small>
                                                {tx.type === 'buy' ? (
                                                    <span className="badge bg-primary">Acquisto</span>
                                                ) : (
                                                    <span className="badge bg-success">Vendita</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-md-3">
                                            <div className="mb-2">
                                                <small className="text-muted d-block">Token:</small>
                                                {tx.type === 'buy' ? (
                                                    <span className="text-success">+{formatTokenValue(tx.tokenAmount)} {tokenSymbol}</span>
                                                ) : (
                                                    <span className="text-danger">-{formatTokenValue(tx.tokenAmount)} {tokenSymbol}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-md-3">
                                            <div className="mb-2">
                                                <small className="text-muted d-block">ETH:</small>
                                                {tx.type === 'buy' ? (
                                                    <span className="text-danger">-{formatEtherValue(tx.ethAmount)}</span>
                                                ) : (
                                                    <span className="text-success">+{formatEtherValue(tx.ethAmount)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Descrizione del flusso di valore */}
                                    <div className="mt-2 pt-2 border-top">
                                        <small className="text-muted">
                                            {tx.type === 'buy' ? (
                                                `Hai inviato ${formatEtherValue(tx.ethAmount)} ETH e ricevuto ${formatTokenValue(tx.tokenAmount)} ${tokenSymbol}`
                                            ) : (
                                                `Hai inviato ${formatTokenValue(tx.tokenAmount)} ${tokenSymbol} e ricevuto ${formatEtherValue(tx.ethAmount)} ETH`
                                            )}
                                        </small>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}