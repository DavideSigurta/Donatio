import React, { useState, useEffect, useRef } from "react";
import { useWeb3 } from "../../contexts/Web3Context";
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import campaignService from '../../services/CampaignService'; // Aggiungi questa riga

/**
 * Componente che gestisce il pannello di votazione per le campagne e le milestone
 * 
 * @param {Object} props
 * @param {Object} props.proposal - Dati della proposta di votazione
 * @param {String} props.campaignAddress - Indirizzo della campagna
 * @param {Number} props.milestoneIndex - Indice della milestone (solo per proposte di tipo milestone)
 * @returns {JSX.Element} Componente React
 */
export function VotingPanel({ proposal, campaignAddress, milestoneIndex }) {
    // Stati del componente
    const [currentProposal, setCurrentProposal] = useState(null);
    const [isVoting, setIsVoting] = useState(false);
    const [isFinalizationPending, setIsFinalizationPending] = useState(false);
    const [userHasVoted, setUserHasVoted] = useState(false);
    const [transactionCompleted, setTransactionCompleted] = useState(false);
    const [votingPower, setVotingPower] = useState('0');
    const [isExpired, setIsExpired] = useState(false);
    const [countdown, setCountdown] = useState('');
    const [isDonator, setIsDonator] = useState(false);
    const [isCreatorOfCampaign, setIsCreatorOfCampaign] = useState(false);

    
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
        loadProposals, 
        calculateMilestoneVotingPower
    } = useWeb3();

    // Determina se questa proposta è per una milestone
    const isMilestoneProposal = proposal && proposal.proposalType === 1; // 0 = CAMPAIGN, 1 = MILESTONE
    
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
                setIsDonator(false);
                return;
            }
            
            // Se l'indirizzo è cambiato, resetta immediatamente
            if (addressChanged) {
                console.log("Indirizzo cambiato, reset immediato dei valori");
                setUserHasVoted(false);
                setVotingPower('0');
                setIsDonator(false);
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
                
                // Ottieni il potere di voto in base al tipo di proposta
                if (isMilestoneProposal && campaignAddress) {
                    // Per le milestone, usiamo la funzione specifica con il peso differenziato
                    const power = await calculateMilestoneVotingPower(
                        selectedAddress,
                        campaignAddress, 
                        currentProposal.id
                    );
                    setVotingPower(power);
                    
                    // Verifica se l'utente è un donatore per questa campagna
                    try {
                        // Ottieni la lista delle donazioni per la campagna
                        const campaign = await campaignService.initializeCampaign(campaignAddress);
                        const donationsCount = await campaign.getDonationsCount();
                        
                        // Controlla se l'utente è tra i donatori
                        let userIsDonator = false;
                        for (let i = 0; i < donationsCount; i++) {
                            const donation = await campaign.donations(i);
                            if (donation.donor.toLowerCase() === selectedAddress.toLowerCase()) {
                                userIsDonator = true;
                                break;
                            }
                        }
                        
                        setIsDonator(userIsDonator);
                        console.log(`Utente ${selectedAddress} è donatore: ${userIsDonator}`);
                    } catch (error) {
                        console.error("Errore nel verificare lo stato di donatore:", error);
                        setIsDonator(false);
                    }
                } else {
                    // Per le campagne, usiamo il potere di voto standard
                    if (userVotingPower && 
                        userVotingPower[currentProposal.id] && 
                        parseFloat(userVotingPower[currentProposal.id]) > 0) {
                        setVotingPower(userVotingPower[currentProposal.id]);
                    } else {
                        setVotingPower('0');
                    }
                }
            } catch (error) {
                console.error("Errore nel caricamento dello stato di voto:", error);
            }
        };
        
        checkVotingStatus();
    }, [currentProposal, selectedAddress, userVotingPower, hasVoted, calculateMilestoneVotingPower, campaignAddress, isMilestoneProposal]);
    
    // Gestisce il countdown usando l'endTime memorizzato
    useEffect(() => {
        if (!currentProposal || !endTimeRef.current) {
            setCountdown("00:00");
            setIsExpired(true);
            return;
        }
        
        // Funzione per aggiornare il countdown basato sul tempo rimanente reale
        const updateCountdown = (intervalId = null) => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((endTimeRef.current - now) / 1000));
            
            setCountdown(formatTimeRemaining(remaining));
            
            if (remaining <= 0) {
                setIsExpired(true);
                if (intervalId !== null) {
                    clearInterval(intervalId);
                }
                loadProposals(); // Ricarica le proposte quando il timer scade
            }
        };

        // Prima chiamata senza l'ID dell'intervallo
        updateCountdown();

        // Crea l'intervallo e passa l'ID come parametro alla funzione
        const timerInterval = setInterval(() => {
            updateCountdown(timerInterval);
        }, 1000);
        
        // Pulizia dell'intervallo quando il componente viene smontato
        return () => clearInterval(timerInterval);
    }, [currentProposal?.id, loadProposals]); // Dipende solo dall'ID della proposta, non dal timeRemaining

    // Verifica se l'utente è il creatore della campagna
    useEffect(() => {
        const checkIfCreator = async () => {
            if (!selectedAddress || !campaignAddress) return;
            
            try {
                const campaign = await campaignService.initializeCampaign(campaignAddress);
                const creator = await campaign.creator();
                setIsCreatorOfCampaign(creator.toLowerCase() === selectedAddress.toLowerCase());
            } catch (error) {
                console.error("Errore nel verificare il creatore:", error);
            }
        };
        
        checkIfCreator();
    }, [selectedAddress, campaignAddress]);
    
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
            console.log("[DEBUG] Invio voto con supporto:", support);
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
            
            console.log("[DEBUG] Stato dopo voto:", {
            proposta: currentProposal.id,
            positiveVotes: newPositiveVotes,
            negativeVotes: newNegativeVotes,
            approvalThreshold,
            rejectionThreshold,
            sogliaSuperata: newPositiveVotes >= approvalThreshold || newNegativeVotes >= rejectionThreshold,
            statoAttuale: currentProposal.status
            });
            
            // Se questo voto ha raggiunto una soglia critica, ricarica la pagina
            if (newPositiveVotes >= approvalThreshold || newNegativeVotes >= rejectionThreshold) {
                // Attendi che la blockchain aggiorni lo stato
                setTimeout(() => {
                    // Prima carica nuovamente le proposte per aggiornare lo stato in memoria
                    loadProposals().then(() => {
                        // Poi attendi un altro breve periodo prima di ricaricare completamente
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    });
                }, 5000);  // Aumenta il tempo di attesa da 2000 a 5000 ms
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
        <h3 className="card-title mb-0">
            Votazione per Approvazione {isMilestoneProposal ? 'Milestone' : 'Campagna'}
        </h3>
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
            {isMilestoneProposal ? (
                <p><strong>Indice milestone:</strong> {milestoneIndex !== undefined ? milestoneIndex + 1 : "N/A"}</p>
            ) : (
                <p><strong>Target raccolta:</strong> {currentProposal.targetAmount} DNT</p>
            )}
            <p><strong>Quota approvazione:</strong> {currentProposal.approvalQuota} DNT</p>

            {/* Mostra messaggio quando la proposta è pronta per l'esecuzione ma non eseguita */}
            {currentProposal.status === 4 && !currentProposal.executed && (
                <div className="alert alert-warning mt-3">
                    <h5><i className="bi bi-exclamation-triangle me-2"></i>Votazione conclusa</h5>
                    <p>
                        La votazione ha raggiunto la soglia richiesta 
                        {currentProposal.positiveVotes >= currentProposal.approvalQuota / 2 ? " per l'approvazione" : " per il rifiuto"}. 
                        Il risultato è pronto per essere finalizzato dal creatore della campagna.
                    </p>
                    {isCreatorOfCampaign && (
                        <div className="mt-2">
                            <small>
                                In quanto creatore della campagna, puoi finalizzare questa votazione dalla pagina della campagna.
                            </small>
                        </div>
                    )}
                </div>
            )}
            
            {/* Informazioni sul peso differenziato per le milestone */}
            {isMilestoneProposal && (
                <div className="alert alert-info mt-2 mb-3">
                    <i className="bi bi-info-circle me-2"></i>
                    <small>
                        I donatori hanno un peso di voto pari al <strong>20%</strong> dei loro token, 
                        mentre i non donatori hanno un peso del <strong>15%</strong>.
                    </small>
                </div>
            )}
            
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
            <small className="text-muted ml-2">
                {isMilestoneProposal 
                    ? `(${isDonator ? "20% del peso come donatore" : "15% del peso come non-donatore"})`
                    : "(basato sui tuoi token e limitato al 20% della quota)"
                }
            </small>
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
                `Approva ${isMilestoneProposal ? 'milestone' : 'campagna'}`
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
                `Rifiuta ${isMilestoneProposal ? 'milestone' : 'campagna'}`
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