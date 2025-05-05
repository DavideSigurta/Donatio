import React, { useState } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';

/**
 * Componente che mostra la lista delle milestone di una campagna
 * 
 * @param {Array} milestones - Array delle milestone
 * @param {String} campaignAddress - Indirizzo della campagna 
 * @param {Boolean} isLoading - Se true, mostra stato di caricamento
 * @returns {JSX.Element} Componente React
 */
const MilestonesList = ({ milestones, campaignAddress, isLoading }) => {
  const { isOwner, approveMilestone, rejectMilestone } = useWeb3();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedMilestoneIndex, setSelectedMilestoneIndex] = useState(null);
  const rejectedIndex = milestones ? milestones.findIndex(m => m.rejected) : -1;

  // Gestisce l'approvazione di una milestone
  const handleApprove = async (milestoneIndex) => {
    if (window.confirm('Sei sicuro di voler approvare questa milestone?')) {
      try {
        await approveMilestone(campaignAddress, milestoneIndex);
      } catch (error) {
        console.error("Errore nell'approvazione della milestone:", error);
        alert("Si è verificato un errore durante l'approvazione della milestone.");
      }
    }
  };

  const isRefundedDueToPreviousRejection = (index) => {
    return rejectedIndex !== -1 && index > rejectedIndex;
  };

  // Gestisce l'apertura del modal per il rifiuto
  const handleOpenRejectModal = (milestoneIndex) => {
    setSelectedMilestoneIndex(milestoneIndex);
    setRejectReason('');
    setShowRejectModal(true);
  };
  
  // Gestisce il rifiuto di una milestone
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("È necessario fornire una motivazione per il rifiuto.");
      return;
    }
    
    try {
      await rejectMilestone(campaignAddress, selectedMilestoneIndex, rejectReason);
      setShowRejectModal(false);
    } catch (error) {
      console.error("Errore nel rifiuto della milestone:", error);
      alert("Si è verificato un errore durante il rifiuto della milestone.");
    }
  };
  
  // Determina lo stato di una milestone
  const getMilestoneStatus = (milestone, index, currentMilestoneIndex) => {
    if (milestone.rejected) {
      return { text: 'Rifiutata - Fondi Rimborsati', variant: 'danger' };
    } else if (isRefundedDueToPreviousRejection(index)) {
      return { text: 'Fondi Rimborsati', variant: 'danger' }; // Stessa variante ma testo diverso
    } else if (milestone.fundsReleased) {
      return { text: 'Fondi rilasciati', variant: 'success' };
    } else if (milestone.approved) {
      return { text: 'Approvata', variant: 'success' };
    } else if (parseFloat(milestone.raisedAmount) >= parseFloat(milestone.targetAmount)) {
      return { text: 'Completamente finanziata', variant: 'primary' };
    } else if (index === currentMilestoneIndex) {
      return { text: 'In corso', variant: 'warning' };
    } else {
      return { text: 'Non iniziata', variant: 'secondary' };
    }
  };
  
  if (isLoading) {
    return (
      <div className="text-center py-3">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Caricamento...</span>
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
  
  // Trova l'indice della milestone attualmente in corso
  const currentMilestoneIndex = milestones.findIndex(m => 
    !m.fundsReleased && parseFloat(m.raisedAmount) < parseFloat(m.targetAmount)
  );
  
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

              {isOwner && 
              !milestone.approved && 
              parseFloat(milestone.raisedAmount) >= parseFloat(milestone.targetAmount) && 
              index > 0 && !milestones[index - 1]?.approved && (
                <div className="text-end">
                  <button 
                    className="btn btn-secondary btn-sm"
                    disabled
                    type="button"
                  >
                    <i className="bi bi-lock me-1"></i> Approva milestone
                  </button>
                  <small className="d-block text-muted mt-1">
                    Approva prima la milestone precedente
                  </small>
                </div>
              )}

              {isOwner && 
              !milestone.approved && 
              !milestone.rejected &&
              parseFloat(milestone.raisedAmount) >= parseFloat(milestone.targetAmount) && 
              (index === 0 || milestones[index - 1]?.approved) && (
                <div className="row g-2">
                  <div className="col-auto">
                    <button 
                      className="btn btn-success btn-sm"
                      onClick={() => handleApprove(milestone.index)}
                      type="button"
                    >
                      <i className="bi bi-check-circle me-1"></i> Approva
                    </button>
                  </div>
                  <div className="col-auto">
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => handleOpenRejectModal(milestone.index)}
                      type="button"
                    >
                      <i className="bi bi-x-circle me-1"></i> Rifiuta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {showRejectModal && (
        <div className="modal d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Rifiuta Milestone</h5>
                <button type="button" className="btn-close" onClick={() => setShowRejectModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>Stai rifiutando questa milestone. La campagna sarà disattivata e i fondi saranno rimborsati ai donatori.</p>
                <div className="mb-3">
                  <label htmlFor="rejectReason" className="form-label">Motivazione del rifiuto:</label>
                  <textarea
                    id="rejectReason"
                    className="form-control"
                    rows="4"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Fornisci una motivazione dettagliata del rifiuto..."
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Annulla</button>
                <button type="button" className="btn btn-danger" onClick={handleReject}>Conferma Rifiuto</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MilestonesList;