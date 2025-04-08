import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export function GlobalTransactionHistory({ exchangeContract, tokenSymbol, refreshTrigger }) {
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [contractAddress, setContractAddress] = useState("");
    
    useEffect(() => {
        if (exchangeContract) {
            // Ottieni l'indirizzo del contratto
            setContractAddress(exchangeContract.address);
        }
    }, [exchangeContract]);
    
    useEffect(() => {
        const loadTransactions = async () => {
            if (!exchangeContract) return;
            
            try {
                setIsLoading(true);
                
                // Ottiene il numero totale di transazioni
                const count = await exchangeContract.getTransactionCount();
                
                if (count.toNumber() === 0) {
                    setTransactions([]);
                    setIsLoading(false);
                    return;
                }
                
                const batchSize = Math.min(50, count.toNumber());
                const startIndex = Math.max(0, count.toNumber() - batchSize);
                
                const [users, isBuys, tokenAmounts, etherAmounts, timestamps] = 
                await exchangeContract.getTransactionBatch(startIndex, batchSize);
                
                const txArray = [];
                for (let i = 0; i < users.length; i++) {
                    const isDeposit = isBuys[i] && tokenAmounts[i].eq(0);
                    txArray.push({
                        user: users[i],
                        type: isDeposit ? 'deposit' : (isBuys[i] ? 'buy' : 'sell'),
                        tokenAmount: tokenAmounts[i],
                        ethAmount: etherAmounts[i],
                        timestamp: timestamps[i].toNumber()
                    });
                }
                
                const sortedTransactions = txArray.sort((a, b) => b.timestamp - a.timestamp);
                setTransactions(sortedTransactions);
            } catch (error) {
                console.error("Errore nel caricamento delle transazioni globali:", error);
                setTransactions([]);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadTransactions();
    }, [exchangeContract, refreshTrigger]);
    
    // Formatta una timestamp Unix in data e ora leggibile
    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp * 1000);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    };
    
    // Formatta una quantità di ETH in un formato leggibile
    const formatEth = (weiAmount) => {
        return parseFloat(ethers.utils.formatEther(weiAmount)).toFixed(4);
    };
    
    if (!isLoading && (!transactions || transactions.length === 0)) {
        return (
            <div className="card mt-4 shadow">
            <div className="card-header bg-light">
            <h5 className="mb-0">Cronologia globale delle transazioni</h5>
            </div>
            <div className="card-body text-center py-4">
            <p className="mb-0 text-muted">Non ci sono transazioni sulla piattaforma.</p>
            </div>
            </div>
        );
    }
    
    return (
        <div className="card mt-4 shadow">
        <div className="card-header bg-light">
        <h5 className="mb-0">Cronologia globale delle transazioni</h5>
        </div>
        <div className="card-body p-0">
        {isLoading ? (
            <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Caricamento...</span>
            </div>
            <p className="mt-2">Caricamento transazioni globali...</p>
            </div>
        ) : (
            <div className="transactions-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {transactions.map((tx, index) => (
                <div key={index} className="transaction-box border-bottom mb-3">
                {/* Sezione con gli indirizzi */}
                <div className="address-section p-3">
                {/* Da: indirizzo utente */}
                <div className="row border-bottom pb-2 mb-2">
                <div className="col-2 col-md-1 text-end">
                <span className="badge bg-secondary">Da:</span>
                </div>
                <div className="col-10 col-md-11">
                <span className="text-break">{tx.user}</span>
                </div>
                </div>
                
                {/* A: indirizzo destinatario - dedotto dal tipo di transazione */}
                <div className="row">
                <div className="col-2 col-md-1 text-end">
                <span className="badge bg-secondary">A:</span>
                </div>
                {tx.type === 'buy' ? (
                    /* Per acquisti: ETH va al contratto, token vanno all'utente (circolare) */
                    <div className="col-10 col-md-11">
                    <span className="text-break">{contractAddress}</span>
                    </div>
                ) : tx.type === 'sell' ? (
                    /* Per vendite: token vanno al contratto, ETH va all'utente (circolare) */
                    <div className="col-10 col-md-11">
                    <span className="text-break">{contractAddress}</span>
                    </div>
                ) : (
                    /* Per depositi: ETH va al contratto */
                    <div className="col-10 col-md-11">
                    <span className="text-break">{contractAddress}</span>
                    </div>
                )}
                </div>
                </div>
                
                {/* Sezione con i dettagli della transazione */}
                <div className="transaction-details p-3 bg-light">
                <div className="row">
                <div className="col-md-4">
                <div className="mb-2">
                <small className="text-muted d-block">Data e ora:</small>
                <strong>{formatTimestamp(tx.timestamp)}</strong>
                </div>
                </div>
                <div className="col-md-2">
                <div className="mb-2">
                <small className="text-muted d-block">Tipo:</small>
                {tx.type === 'buy' ? (
                    <span className="badge bg-primary">Acquisto</span>
                ) : tx.type === 'sell' ? (
                    <span className="badge bg-success">Vendita</span>
                ) : (
                    <span className="badge bg-info">Deposito</span>
                )}
                </div>
                </div>
                <div className="col-md-3">
                <div className="mb-2">
                <small className="text-muted d-block">Token:</small>
                {tx.type === 'buy' ? (
                    <span className="text-success">+{tx.tokenAmount.toString()} {tokenSymbol}</span>
                ) : tx.type === 'sell' ? (
                    <span className="text-danger">-{tx.tokenAmount.toString()} {tokenSymbol}</span>
                ) : (
                    <span>-</span>
                )}
                </div>
                </div>
                <div className="col-md-3">
                <div className="mb-2">
                <small className="text-muted d-block">ETH:</small>
                {tx.type === 'buy' ? (
                    <span className="text-danger">-{formatEth(tx.ethAmount)}</span>
                ) : tx.type === 'sell' ? (
                    <span className="text-success">+{formatEth(tx.ethAmount)}</span>
                ) : (
                    <span className="text-primary">+{formatEth(tx.ethAmount)}</span>
                )}
                </div>
                </div>
                </div>
                
                {/* Ulteriore descrizione del flusso di valore */}
                <div className="mt-2 pt-2 border-top">
                <small className="text-muted">
                {tx.type === 'buy' ? (
                    `L'utente ha inviato ${formatEth(tx.ethAmount)} ETH al contratto e ha ricevuto ${tx.tokenAmount.toString()} ${tokenSymbol}`
                ) : tx.type === 'sell' ? (
                    `L'utente ha inviato ${tx.tokenAmount.toString()} ${tokenSymbol} al contratto e ha ricevuto ${formatEth(tx.ethAmount)} ETH`
                ) : (
                    `L'admin ha depositato ${formatEth(tx.ethAmount)} ETH nel contratto`
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