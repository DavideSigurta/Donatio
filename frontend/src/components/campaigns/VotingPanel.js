import React, { useState, useEffect, useRef } from "react";
import { useWeb3 } from "../../contexts/Web3Context";
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

export function VotingPanel({ proposal, campaignAddress }) {
    // Stati del componente
    const [currentProposal, setCurrentProposal] = useState(null);
    const [isVoting, setIsVoting] = useState(false);
    const [isFinalizationPending, setIsFinalizationPending] = useState(false);
    const [userHasVoted, setUserHasVoted] = useState(false);
    const [transactionCompleted, setTransactionCompleted] = useState(false);
    const [votingPower, setVotingPower] = useState('0');
    const [isExpired, setIsExpired] = useState(false);
    const [countdown, setCountdown] = useState('');
    
    // Ref per tracciare l'ultimo indirizzo e l'endTime
    const lastAddressRef = useRef(null);
    const endTimeRef = useRef(null);
    
    // Polling interval in ms
    const refreshInterval = 15000; // 15 secondi
    
    // Accesso al context web3
    const { 
        selectedAddress, 
        isAdmin, 
        campaignProposals, 
        voteOnProposal, 
        hasVoted, 
        finalizeProposal,
        userVotingPower,
        loadProposals 
    } = useWeb3();
    
    // Funzione di utilità per formattare il tempo rimanente
    const formatTimeRemaining = (seconds) => {
        if (seconds <= 0) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Imposta la proposta corrente quando cambia
    useEffect(() => {
        if (proposal) {
            setCurrentProposal(proposal);
            setIsExpired(proposal.timeRemaining <= 0);
            
            // Se è una nuova proposta o la prima inizializzazione, imposta l'endTime
            if (!endTimeRef.current || proposal.id !== currentProposal?.id) {
                endTimeRef.current = Date.now() + (proposal.timeRemaining * 1000);
            }
        }
    }, [proposal, currentProposal]);
    
    // Listener per cambio account di MetaMask
    useEffect(() => {
        // Funzione che forza un ricaricamento completo della pagina quando cambia l'account
        const handleAccountChanged = () => {
            console.log("Account MetaMask cambiato, ricarico la pagina");
            window.location.reload();
        };
        
        // Aggiunge l'evento listener
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountChanged);
        }
        
        // Pulizia quando il componente viene smontato
        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountChanged);
            }
        };
    }, []);
    
    // Controlla lo stato di voto dell'utente
    useEffect(() => {
        const checkVotingStatus = async () => {
            // Verifica se l'indirizzo è cambiato
            const addressChanged = lastAddressRef.current !== selectedAddress;
            
            // Aggiorna il riferimento all'indirizzo corrente
            lastAddressRef.current = selectedAddress;
            
            // Se non c'è proposta o indirizzo, resetta tutto
            if (!currentProposal || !selectedAddress) {
                setUserHasVoted(false);
                setVotingPower('0');
                return;
            }
            
            // Se l'indirizzo è cambiato, resetta immediatamente
            if (addressChanged) {
                console.log("Indirizzo cambiato, reset immediato dei valori");
                setUserHasVoted(false);
                setVotingPower('0');
                // Piccolo ritardo prima di caricare i nuovi valori
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            try {
                // Verifica se l'utente ha già votato
                const voted = await hasVoted(currentProposal.id, selectedAddress);
                setUserHasVoted(voted);
                
                // Per sicurezza, resetta il potere di voto prima di aggiornarlo
                if (addressChanged) {
                    setVotingPower('0');
                }
                
                // Ottieni il potere di voto solo se c'è un potere specifico per questo utente e questa proposta
                if (userVotingPower && 
                    userVotingPower[currentProposal.id] && 
                    parseFloat(userVotingPower[currentProposal.id]) > 0) {
                    setVotingPower(userVotingPower[currentProposal.id]);
                } else {
                    setVotingPower('0');
                }
            } catch (error) {
                console.error("Errore nel caricamento dello stato di voto:", error);
            }
        };
        
        checkVotingStatus();
    }, [currentProposal, selectedAddress, userVotingPower, hasVoted]);
    
    // Gestisce il countdown usando l'endTime memorizzato
    useEffect(() => {
        if (!currentProposal || !endTimeRef.current) {
            setCountdown("00:00");
            setIsExpired(true);
            return;
        }
        
        // Funzione per aggiornare il countdown basato sul tempo rimanente reale
        const updateCountdown = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((endTimeRef.current - now) / 1000));
            
            setCountdown(formatTimeRemaining(remaining));
            
            if (remaining <= 0) {
                setIsExpired(true);
                clearInterval(timerInterval);
                loadProposals(); // Ricarica le proposte quando il timer scade
            }
        };
        
        // Aggiorna subito e poi ogni secondo
        updateCountdown();
        const timerInterval = setInterval(updateCountdown, 1000);
        
        // Pulizia dell'intervallo quando il componente viene smontato
        return () => clearInterval(timerInterval);
    }, [currentProposal?.id, loadProposals]); // Dipende solo dall'ID della proposta, non dal timeRemaining
    
    // Gestisce il voto favorevole
    const handleApprove = async () => {
        await handleVote(true);
    };
    
    // Gestisce il voto contrario
    const handleReject = async () => {
        await handleVote(false);
    };
    
    // Gestisce la logica di voto
    const handleVote = async (support) => {
        if (!currentProposal || !selectedAddress) return;
        
        // Verifica se la proposta è scaduta prima di votare
        if (isExpired) {
            console.error("La votazione è già scaduta.");
            alert("La votazione è già scaduta. La pagina verrà ricaricata per aggiornare lo stato.");
            window.location.reload();
            return;
        }
        
        // Controlla se l'utente ha davvero potere di voto (verifica extra)
        if (parseFloat(votingPower) <= 0) {
            alert("Non hai potere di voto sufficiente per questa proposta.");
            return;
        }
        
        try {
            setIsVoting(true);
            await voteOnProposal(currentProposal.id, support);
            setUserHasVoted(true);
            setTransactionCompleted(true);
            
            // Calcola i nuovi voti totali dopo questo voto
            const newPositiveVotes = support ? 
            parseFloat(currentProposal.positiveVotes) + parseFloat(votingPower) : 
            parseFloat(currentProposal.positiveVotes);
            
            const newNegativeVotes = !support ? 
            parseFloat(currentProposal.negativeVotes) + parseFloat(votingPower) : 
            parseFloat(currentProposal.negativeVotes);
            
            // Calcola le soglie
            const approvalThreshold = parseFloat(currentProposal.approvalQuota) / 2;
            const rejectionThreshold = parseFloat(currentProposal.approvalQuota) * 0.3;
            
            // Se questo voto ha raggiunto una soglia critica, ricarica la pagina
            if (newPositiveVotes >= approvalThreshold || newNegativeVotes >= rejectionThreshold) {
                // Attendi che la blockchain aggiorni lo stato
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
            
        } catch (error) {
            console.error("Errore durante il voto:", error);
        } finally {
            setIsVoting(false);
        }
    };
    
    // Gestisce la finalizzazione della proposta
    const handleFinalize = async () => {
        if (!currentProposal || !isAdmin) return;
        
        try {
            setIsFinalizationPending(true);
            await finalizeProposal(currentProposal.id);
            setTransactionCompleted(true);
            
            // Attendi che la blockchain aggiorni lo stato e ricarica la pagina
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error("Errore durante la finalizzazione:", error);
        } finally {
            setIsFinalizationPending(false);
        }
    };
    
    // Se la proposta non è caricata, mostra un placeholder
    if (!currentProposal) {
        return <div className="alert alert-info">Caricamento proposta in corso...</div>;
    }
    
    return (
        <div className="voting-panel">
        <div className="card mb-4">
        <div className="card-header bg-warning text-dark d-flex justify-content-between align-items-center">
        <h3 className="card-title mb-0">Votazione per Approvazione Campagna</h3>
        <span className="badge bg-info text-white">
        {isExpired ? "Votazione scaduta" : "Votazione in corso"}
        </span>
        </div>
        <div className="card-body">
        <div className="mb-4">
        <h5>Stato della votazione:</h5>
        <div className="row mb-3">
        <div className="col-md-6">
        <p className="mb-1">Voti favorevoli:</p>
        <div className="progress" style={{ height: "20px" }}>
        <div
        className="progress-bar bg-success"
        role="progressbar"
        style={{ width: `${currentProposal.positivePercentage}%` }}
        aria-valuenow={currentProposal.positivePercentage}
        aria-valuemin="0"
        aria-valuemax="100"
        >
        {Math.round(currentProposal.positivePercentage)}%
        </div>
        </div>
        <small className="text-muted">
        {currentProposal.positiveVotes} / {currentProposal.approvalQuota / 2} DNT necessari
        </small>
        </div>
        <div className="col-md-6">
        <p className="mb-1">Voti contrari:</p>
        <div className="progress" style={{ height: "20px" }}>
        <div
        className="progress-bar bg-danger"
        role="progressbar"
        style={{ width: `${currentProposal.negativePercentage}%` }}
        aria-valuenow={currentProposal.negativePercentage}
        aria-valuemin="0"
        aria-valuemax="100"
        >
        {Math.round(currentProposal.negativePercentage)}%
        </div>
        </div>
        <small className="text-muted">
        {currentProposal.negativeVotes} / {currentProposal.approvalQuota * 0.3} DNT necessari
        </small>
        </div>
        </div>
        
        <p className="mb-1">
        <i className="bi bi-clock"></i> Termine votazione: {
            currentProposal.timeRemaining > 0 
            ? <><span className="badge bg-danger">{countdown}</span> ({
                formatDistanceToNow(
                    new Date(Date.now() + currentProposal.timeRemaining * 1000), 
                    { addSuffix: true, locale: it }
                )
            })</>
            : "Votazione scaduta"
        }
        </p>
        
        {/* Dettagli proposta */}
        <div className="mt-3">
        <p><strong>Target raccolta:</strong> {currentProposal.targetAmount} DNT</p>
        <p><strong>Quota approvazione:</strong> {currentProposal.approvalQuota} DNT</p>
        <small className="text-muted">
        <i className="bi bi-arrow-clockwise me-1"></i>
        Dati aggiornati automaticamente ogni {refreshInterval/1000} secondi
        </small>
        </div>
        </div>
        
        {/* Messaggio di transazione completata */}
        {transactionCompleted && (
            <div className="alert alert-success mb-4">
            Transazione completata con successo!
            </div>
        )}
        
        {/* Sezione per votare */}
        {selectedAddress && !userHasVoted && !isExpired && (
            <div className="mb-4">
            <h5>Il tuo voto:</h5>
            <p>
            <strong>Il tuo potere di voto:</strong> {votingPower} DNT 
            <small className="text-muted ml-2">(basato sui tuoi token e limitato al 20% della quota)</small>
            </p>
            <div className="d-flex mt-3">
            <button 
            className="btn btn-success me-3" 
            onClick={handleApprove}
            disabled={isVoting || parseFloat(votingPower) <= 0}
            >
            {isVoting ? 
                <span>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Invio in corso...
                </span> : 
                "Approva campagna"
            }
            </button>
            <div className="mx-2"></div>
            <button 
            className="btn btn-danger" 
            onClick={handleReject}
            disabled={isVoting || parseFloat(votingPower) <= 0}
            >
            {isVoting ? 
                <span>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Invio in corso...
                </span> : 
                "Rifiuta campagna"
            }
            </button>
            </div>
            
            {/* Messaggio per utenti senza token */}
            {parseFloat(votingPower) <= 0 && (
                <div className="alert alert-warning mt-3">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Non hai DNT sufficienti per votare. Acquista token per partecipare alla governance.
                </div>
            )}
            </div>
        )}
        
        {/* Messaggio per utenti che hanno già votato */}
        {selectedAddress && userHasVoted && (
            <div className="alert alert-info mb-4">
            <i className="bi bi-check-circle me-2"></i> 
            Hai già espresso il tuo voto per questa proposta. Grazie per la partecipazione!
            </div>
        )}
        
        {/* Messaggio per utenti non connessi */}
        {!selectedAddress && (
            <div className="alert alert-warning mb-4">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Connetti il tuo wallet per votare su questa proposta.
            </div>
        )}
        
        {/* Sezione admin per finalizzare proposte scadute */}
        {isAdmin && isExpired && currentProposal.status === 0 && !currentProposal.executed && (
            <div className="mt-4">
            <h5>Azioni amministrative:</h5>
            <button 
            className="btn btn-warning" 
            onClick={handleFinalize}
            disabled={isFinalizationPending}
            >
            {isFinalizationPending ? 
                <span>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Finalizzazione in corso...
                </span> : 
                "Finalizza proposta scaduta"
            }
            </button>
            <small className="text-muted d-block mt-2">
            La finalizzazione è necessaria per le proposte scadute che non hanno raggiunto le soglie di approvazione o rifiuto automatico.
            </small>
            </div>
        )}
        </div>
        </div>
        </div>
    );
}