import React from 'react';
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
  const { isOwner, approveMilestone } = useWeb3();
  
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
  
  // Determina lo stato di una milestone
  const getMilestoneStatus = (milestone, index, currentMilestoneIndex) => {
    if (milestone.fundsReleased) {
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
              
              {/* Pulsante di approvazione per l'admin */}
              {isOwner && 
               !milestone.approved && 
               parseFloat(milestone.raisedAmount) >= parseFloat(milestone.targetAmount) && (
                <div className="text-end">
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => handleApprove(milestone.index)}
                    type="button"
                  >
                    <i className="bi bi-check-circle me-1"></i> Approva milestone
                  </button>
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