import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';
import { MilestoneReportForm } from './MilestoneReportForm';
import { VotingPanel } from './VotingPanel';

/**
 * Componente che mostra la lista delle milestone di una campagna
 * 
 * @param {Array} milestones - Array delle milestone
 * @param {String} campaignAddress - Indirizzo della campagna 
 * @param {Boolean} isLoading - Se true, mostra stato di caricamento
 * @returns {JSX.Element} Componente React
 */
const MilestonesList = ({ milestones, campaignAddress, isLoading }) => {

  const { 
    selectedAddress, 
    campaignProposals,
    createMilestoneProposal,
    withdrawMilestoneFunds,
    executeProposal,
    isMilestoneReadyForVoting
  } = useWeb3();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const rejectedIndex = milestones ? milestones.findIndex(m => m.rejected) : -1;
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [milestoneToProposalMap, setMilestoneToProposalMap] = useState({});
  const [readyForVotingMilestones, setReadyForVotingMilestones] = useState({});
  const [readyToExecuteProposals, setReadyToExecuteProposals] = useState({});
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [isExecutingProposal, setIsExecutingProposal] = useState(false);

  const isRefundedDueToPreviousRejection = (index) => {
    return rejectedIndex !== -1 && index > rejectedIndex;
  };
  
  // Controlla se l'utente è il creatore della campagna
  const isBeneficiary = selectedAddress && milestones && milestones.length > 0 && 
                    milestones[0].campaignBeneficiary && 
                    milestones[0].campaignBeneficiary.toLowerCase() === selectedAddress.toLowerCase();

  useEffect(() => {
    if (campaignProposals && campaignAddress) {
      const proposals = campaignProposals[campaignAddress.toLowerCase()];
      console.log("Proposte per campagna:", proposals);
      
      if (proposals && proposals.length > 0) {
        proposals.forEach(p => {
          console.log(`Proposta ID ${p.id}, tipo: ${p.proposalType}, milestone: ${p.milestoneIndex}`, p);
        });
      }
    }
  }, [campaignProposals, campaignAddress]);

  useEffect(() => {
    if (campaignProposals && campaignAddress) {
      const proposals = campaignProposals[campaignAddress.toLowerCase()] || [];
      
      if (proposals && proposals.length > 0) {
        // Costruisci una mappa da indice milestone a proposta
        const newMap = {};
        
        proposals.forEach(proposal => {
          // Solo proposte di tipo MILESTONE (1)
          if (proposal.proposalType === 1) {
            // Converti l'indice in stringa per usarlo come chiave dell'oggetto
            const milestoneIdx = String(proposal.milestoneIndex);
            newMap[milestoneIdx] = proposal;
            console.log(`Associata proposta ID ${proposal.id} alla milestone ${milestoneIdx}`);
          }
        });
        
        setMilestoneToProposalMap(newMap);
        console.log("Mappa milestone -> proposta aggiornata:", newMap);
      }
    }
  }, [campaignProposals, campaignAddress, refreshTrigger]);

  // Verifica quali milestone sono pronte per la votazione
  useEffect(() => {
    const checkMilestones = async () => {
      if (!campaignAddress || !milestones) return;
      
      const readyStatus = {};
      for (let i = 0; i < milestones.length; i++) {
        readyStatus[i] = await isMilestoneReadyForVoting(campaignAddress, i);
      }
      setReadyForVotingMilestones(readyStatus);
    };
    
    checkMilestones();
  }, [campaignAddress, milestones, isMilestoneReadyForVoting, refreshTrigger]);
  
  // Verifica quali proposte sono pronte per essere eseguite
  useEffect(() => {
    if (!campaignProposals || !campaignAddress) return;
    
    const proposals = campaignProposals[campaignAddress] || [];
    const readyProposals = {};
    
    console.log("[DEBUG] Verifica proposte pronte per esecuzione, totali:", proposals.length);
    
    proposals.forEach(proposal => {
      console.log(`[DEBUG] Proposta ${proposal.id}: tipo=${proposal.proposalType}, milestone=${proposal.milestoneIndex}, status=${proposal.status}, executed=${proposal.executed}`);
      
      // Status 4 = READY_FOR_EXECUTION
      if (proposal.status === 4 && !proposal.executed) {
        console.log(`[DEBUG] ✓ Proposta ${proposal.id} PRONTA per milestone ${proposal.milestoneIndex}`);
        readyProposals[proposal.milestoneIndex] = proposal.id;
      }
    });

    if (proposals.length === 0) {
      // Controlla direttamente milestoneToProposalMap
      Object.entries(milestoneToProposalMap).forEach(([milestoneIdx, proposal]) => {
        if (proposal.status === 4 && !proposal.executed) {
          console.log(`[DEBUG] ✓ Proposta ${proposal.id} PRONTA per milestone ${proposal.milestoneIndex} (da mappa)`);
          readyProposals[milestoneIdx] = proposal.id;
        }
      });
    }
    
    console.log("[DEBUG] Proposte pronte trovate:", Object.keys(readyProposals).length);
    setReadyToExecuteProposals(readyProposals);
  }, [campaignProposals, campaignAddress, refreshTrigger, milestoneToProposalMap]);

    
  // Determina lo stato di una milestone
  const getMilestoneStatus = (milestone, index, currentMilestoneIndex) => {
    if (milestone.rejected) {
      return { text: 'Rifiutata - Fondi Rimborsati', variant: 'danger' };
    } else if (isRefundedDueToPreviousRejection(index)) {
      return { text: 'Fondi Rimborsati', variant: 'danger' };
    } else if (milestone.fundsReleased) {
      return { text: 'Fondi rilasciati', variant: 'success' };
    } else if (milestone.approved) {
      return { text: 'Approvata', variant: 'success' };
    } else if (milestone.inVoting) {
      return { text: 'In votazione', variant: 'warning' };
    } else if (milestone.hasReport) {
      return { text: 'Report inviato', variant: 'info' };
    } else if (parseFloat(milestone.raisedAmount) >= parseFloat(milestone.targetAmount)) {
      return { text: 'Completamente finanziata', variant: 'primary' };
    } else if (index === currentMilestoneIndex) {
      return { text: 'In corso', variant: 'warning' };
    } else {
      return { text: 'Non iniziata', variant: 'secondary' };
    }
  };
  
  // Gestisce la creazione della proposta di voto
  const handleCreateMilestoneProposal = async (milestoneIndex) => {
    try {
      if (window.confirm('Sei sicuro di voler avviare la votazione per questa milestone?')) {
        setIsCreatingProposal(true);
        await createMilestoneProposal(campaignAddress, milestoneIndex);
        setRefreshTrigger(prev => prev + 1);
        alert('Votazione avviata con successo!');
      }
    } catch (error) {
      console.error("Errore nella creazione della proposta:", error);
      alert(`Si è verificato un errore: ${error.message || error}`);
    } finally {
      setIsCreatingProposal(false);
    }
  };
  
  // Gestisce l'esecuzione della proposta
  const handleExecuteProposal = async (proposalId, milestoneIndex) => {
    try {
      if (window.confirm('Sei sicuro di voler finalizzare questa votazione?')) {
        setIsExecutingProposal(true);
        await executeProposal(proposalId);
        setRefreshTrigger(prev => prev + 1);
        alert('Votazione finalizzata con successo!');
      }
    } catch (error) {
      console.error("Errore nell'esecuzione della proposta:", error);
      alert(`Si è verificato un errore: ${error.message || error}`);
    } finally {
      setIsExecutingProposal(false);
    }
  };

  const handleWithdrawFunds = async () => {
    try {
      if (window.confirm('Sei sicuro di voler ritirare i fondi disponibili?')) {
        setIsWithdrawing(true); 
        // Chiamata alla funzione withdraw del Web3Context
        await withdrawMilestoneFunds(campaignAddress);
        
        // Aggiorna la vista dopo il prelievo
        setRefreshTrigger(prev => prev + 1);
        alert('Fondi ritirati con successo!');
      }
    } catch (error) {
      console.error("Errore durante il ritiro dei fondi:", error);
      alert(`Si è verificato un errore: ${error.message || error}`);
    } finally {
      setIsWithdrawing(false);
    }
  };
  
  // Resto del codice invariato: loading e no data gestiti allo stesso modo
  if (isLoading) {
    return (
      <div className="text-center py-3">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
        </div>
        <p className="mt-2 mb-0">Caricamento milestone...</p>
      </div>
    );
  }
  
  if (!milestones || milestones.length === 0) {
    return (
      <div className="card mb-4">
        <div className="card-body text-center py-4">
          <p className="mb-0">Nessuna milestone definita per questa campagna.</p>
        </div>
      </div>
    );
  }
  
  const currentMilestoneIndex = milestones.findIndex(m => 
    !m.fundsReleased && parseFloat(m.raisedAmount) < parseFloat(m.targetAmount)
  );
  
  // Trova le proposte relative alle milestone di questa campagna
  const milestoneProposals = campaignProposals 
    ? campaignProposals[campaignAddress] || [] 
    : [];
  
  return (
    <div className="milestones-list">
      <h4 className="mb-3">Milestone della campagna</h4>
      
      {milestones.map((milestone, index) => {
        // Calcola la percentuale di completamento
        const progressPercentage = Math.min(
          (parseFloat(milestone.raisedAmount) / parseFloat(milestone.targetAmount)) * 100,
          100
        );
        
        // Ottiene lo stato della milestone
        const status = getMilestoneStatus(milestone, index, currentMilestoneIndex);
        
        // Determina il colore della barra di progresso
        const progressBarVariant = 
          milestone.rejected || isRefundedDueToPreviousRejection(index) ? 'bg-danger' :
          progressPercentage >= 100 ? 'bg-success' : 
          progressPercentage > 50 ? 'bg-info' : 
          'bg-warning';
        
        let milestoneProposal = milestoneToProposalMap[String(milestone.index)];

        if (!milestoneProposal && milestone.inVoting && milestoneProposals && milestoneProposals.length > 0) {
          console.log(`Tentativo di recupero diretto per milestone ${milestone.index}`);
          
          // Prova tutti i possibili modi per trovare la corrispondenza
          milestoneProposal = milestoneProposals.find(p => 
            p.proposalType === 1 && (
              String(p.milestoneIndex) === String(milestone.index) ||
              Number(p.milestoneIndex) === Number(milestone.index) ||
              p.milestoneIndex == milestone.index // Confronto loose intentionally
            )
          );
          
          if (milestoneProposal) {
            console.log(`Proposta trovata con ricerca diretta: ID ${milestoneProposal.id}`);
          }
        }

        if (milestone.inVoting) {
          console.log(`Milestone ${milestone.index} contrassegnata come 'in votazione':`, {
            propostaTrovata: !!milestoneProposal,
            proposteDisponibili: milestoneProposals.map(p => ({
              id: p.id,
              type: p.proposalType,
              milestoneIndex: p.milestoneIndex
            }))
          });
        }
        
        // Determina se mostrare il form di report
        const showReportForm = 
          isBeneficiary && 
          !milestone.rejected && 
          !milestone.hasReport && 
          milestone.fundsReleased; // Mostra il form solo se i fondi sono stati rilasciati 
        
        // Determina se mostrare il pulsante per creare proposta
        const showCreateProposalBtn = 
          isBeneficiary && 
          !milestone.rejected && 
          !milestone.approved && 
          !milestone.inVoting &&
          // Aggiungi questa condizione per nascondere il pulsante se c'è già una proposta pronta
          !readyToExecuteProposals[milestone.index] &&
          parseFloat(milestone.raisedAmount) >= parseFloat(milestone.targetAmount) &&
          (index === 0 || (milestones[index - 1]?.approved && milestones[index - 1]?.hasReport));
        
        // Determina se mostrare il pulsante per ritirare i fondi
        const showWithdrawButton = 
          isBeneficiary && 
          milestone.approved && 
          !milestone.fundsReleased;
        
        // Determina se mostrare il pulsante per finalizzare la votazione
        const showExecuteProposalBtn = 
          isBeneficiary && 
          readyToExecuteProposals[milestone.index] !== undefined;
        
        return (
          <div key={index} className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div>
                <h6 className="mb-0">{milestone.title}</h6>
                <span className={`badge bg-${status.variant} mt-1 text-white`}>{status.text}</span>
              </div>
              <div>
                <strong>{milestone.raisedAmount} / {milestone.targetAmount} DNT</strong>
              </div>
            </div>
            
            <div className="card-body">
              <p>{milestone.description}</p>
              
              {/* Progress bar personalizzata */}
              <div className="progress mb-3" style={{height: '25px'}}>
                <div 
                  className={`progress-bar ${progressBarVariant}`} 
                  role="progressbar" 
                  style={{width: `${progressPercentage}%`}} 
                  aria-valuenow={progressPercentage} 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                >
                  {progressPercentage.toFixed(0)}%
                </div>
              </div>

              {/* Pulsante per ritirare i fondi (solo per il creatore) */}
              {showWithdrawButton && (
                <div className="mt-3 text-center">
                  <button 
                    className="btn btn-success" 
                    onClick={handleWithdrawFunds}
                    disabled={isWithdrawing}
                  >
                    {isWithdrawing ? (
                      <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Prelievo in corso...</>
                    ) : (
                      <><i className="bi bi-cash-coin me-2"></i> Ritira fondi</>
                    )}
                  </button>
                  <div className="mt-2">
                    <small className="text-muted">
                      I fondi sono disponibili per il ritiro. Una volta prelevati, potrai inserire il report per la milestone successiva.
                    </small>
                  </div>
                </div>
              )}

              {/* Mostra il report se presente */}
              {milestone.hasReport && milestone.report && (
                <div className="alert alert-info mt-3">
                  <h6 className="mb-1">Report per la milestone:</h6>
                  <p className="mb-0">{milestone.report}</p>
                </div>
              )}

              {/* Mostra il form per l'invio del report (solo per il creatore) */}
              {showReportForm && (
                <MilestoneReportForm 
                  campaignAddress={campaignAddress}
                  milestoneIndex={milestone.index} 
                  onSubmitSuccess={() => setRefreshTrigger(prev => prev + 1)}
                />
              )}
              
              {/* Pulsante per creare la proposta di votazione (solo per il creatore) */}
              {showCreateProposalBtn && (
                <div className="mt-3">
                  <button 
                    className="btn btn-primary w-100"
                    onClick={() => handleCreateMilestoneProposal(milestone.index)}
                    disabled={isCreatingProposal}
                  >
                    {isCreatingProposal ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span> Avvio votazione...</>
                    ) : (
                      <><i className="bi bi-check-circle me-2"></i> Avvia votazione per questa milestone</>
                    )}
                  </button>
                  <div className="mt-2">
                    <small className="text-muted">
                      Questa milestone è pronta per essere votata. Come creatore, tocca a te avviare il processo di votazione.
                    </small>
                  </div>
                </div>
              )}

              {/* Pulsante per finalizzare la votazione */}
              {showExecuteProposalBtn && (
                <div className="mt-3">
                  <button 
                    className="btn btn-warning w-100"
                    onClick={() => handleExecuteProposal(readyToExecuteProposals[milestone.index], milestone.index)}
                    disabled={isExecutingProposal}
                  >
                    {isExecutingProposal ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span> Finalizzazione votazione...</>
                    ) : (
                      <><i className="bi bi-flag-fill me-2"></i> Finalizza risultato della votazione</>
                    )}
                  </button>
                  <div className="mt-2">
                    <small className="text-muted">
                      La votazione è terminata e il risultato è pronto per essere finalizzato. Come creatore, tocca a te eseguire questa operazione.
                    </small>
                  </div>
                </div>
              )}

              {/* Segnaposto per il pannello di voto*/}
              {milestone.inVoting && milestoneProposal && (
                <div className="mt-4">
                  <VotingPanel 
                    proposal={milestoneProposal}
                    campaignAddress={campaignAddress}
                    milestoneIndex={milestone.index}
                  />
                </div>
              )}

              {milestone.inVoting && !milestoneProposal && (
                <div className="alert alert-info mt-3">
                  <h5><i className="bi bi-info-circle me-2"></i>Votazione in corso</h5>
                  <p className="mb-2">
                    La votazione per questa milestone è attiva, ma il pannello non può essere visualizzato qui.
                  </p>
                  <a href="/governance" className="btn btn-sm btn-primary">
                    <i className="bi bi-arrow-right me-1"></i>Vai alla Dashboard di Governance per votare
                  </a>
                </div>
              )}
              
              {/* Mostra l'avviso di rimborso per le milestone influenzate dal rifiuto */}
              {isRefundedDueToPreviousRejection(index) && (
                <div className="alert alert-warning mt-3">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-arrow-return-left me-2"></i>
                    <small>I fondi ({milestone.raisedAmount} DNT) sono stati automaticamente rimborsati a causa del rifiuto di una milestone precedente.</small>
                  </div>
                </div>
              )}

              {/* Mostra la motivazione del rifiuto se presente */}
              {milestone.rejected && milestone.rejectionReason && (
                <div className="alert alert-danger mt-3">
                  <h6 className="mb-1">Motivazione del rifiuto:</h6>
                  <p className="mb-0">{milestone.rejectionReason}</p>
                  <div className="d-flex align-items-center mt-2">
                    <i className="bi bi-arrow-return-left me-2"></i>
                    <small>I fondi ({milestone.raisedAmount} DNT) sono stati rimborsati ai donatori.</small>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MilestonesList;