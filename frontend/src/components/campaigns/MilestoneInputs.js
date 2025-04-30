import React from 'react';

/**
 * Componente per gestire l'input delle milestone durante la creazione di una campagna
 * 
 * @param {Array} milestones - Array delle milestone attuali
 * @param {Function} setMilestones - Funzione per aggiornare l'array delle milestone
 * @param {Number} goalAmount - Importo obiettivo totale della campagna
 * @returns {JSX.Element} Componente React
 */
const MilestoneInputs = ({ milestones, setMilestones, goalAmount }) => {
  // Calcola la somma degli importi delle milestone
  const totalMilestoneAmount = milestones.reduce(
    (sum, milestone) => sum + parseFloat(milestone.targetAmount || 0), 
    0
  );
  
  // Calcola la differenza tra l'obiettivo totale e la somma delle milestone
  const amountDifference = goalAmount - totalMilestoneAmount;
  
  // Aggiunge una nuova milestone vuota all'array
  const addMilestone = () => {
    if (milestones.length >= 5) return; // Massimo 5 milestone
    
    setMilestones([
      ...milestones,
      { title: '', description: '', targetAmount: '' }
    ]);
  };
  
  // Rimuove una milestone dall'array
  const removeMilestone = (index) => {
    if (milestones.length <= 1) return; // Almeno una milestone
    
    const newMilestones = [...milestones];
    newMilestones.splice(index, 1);
    setMilestones(newMilestones);
  };
  
  // Aggiorna una proprietà specifica di una milestone
  const updateMilestone = (index, field, value) => {
    const newMilestones = [...milestones];
    newMilestones[index] = {
      ...newMilestones[index],
      [field]: value
    };
    setMilestones(newMilestones);
  };
  
  return (
    <div className="milestone-section mt-4">
      <h4 className="mb-3">Milestone della campagna</h4>
      <p className="text-muted">
        Suddividi l'obiettivo della campagna in milestone. La somma degli importi delle milestone deve essere uguale all'obiettivo totale.
      </p>
      
      {/* Sommario totali */}
      <div className="card mb-3 bg-light">
        <div className="card-body">
          <div className="row">
            <div className="col">
              <p className="mb-1"><strong>Obiettivo totale:</strong> {goalAmount ? goalAmount : '0'} DNT</p>
              <p className="mb-1"><strong>Totale milestone:</strong> {totalMilestoneAmount.toFixed(2)} DNT</p>
              <p className={`mb-0 ${Math.abs(amountDifference) < 0.001 ? 'text-success' : 'text-danger'}`}>
                <strong>Differenza:</strong> {amountDifference.toFixed(2)} DNT
                {Math.abs(amountDifference) < 0.001 ? ' ✓' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Lista delle milestone */}
      {milestones.map((milestone, index) => (
        <div key={index} className="card mb-3 milestone-card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Milestone {index + 1}</h6>
            {milestones.length > 1 && (
              <button 
                className="btn btn-danger btn-sm" 
                onClick={() => removeMilestone(index)}
                type="button"
              >
                <i className="bi bi-trash"></i> Rimuovi
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label">Titolo</label>
              <input
                type="text"
                className="form-control"
                value={milestone.title}
                onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                placeholder="Es. Fase iniziale del progetto"
                required
              />
            </div>
            
            <div className="mb-3">
              <label className="form-label">Descrizione</label>
              <textarea
                className="form-control"
                rows={2}
                value={milestone.description}
                onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                placeholder="Descrivi cosa verrà realizzato in questa milestone"
                required
              ></textarea>
            </div>
            
            <div className="mb-0">
              <label className="form-label">Importo obiettivo (DNT)</label>
              <input
                type="number"
                className="form-control"
                step="0.01"
                min="0"
                value={milestone.targetAmount}
                onChange={(e) => updateMilestone(index, 'targetAmount', e.target.value)}
                placeholder="Importo per questa milestone"
                required
              />
            </div>
          </div>
        </div>
      ))}
      
      {/* Pulsante per aggiungere nuove milestone */}
      {milestones.length < 5 && (
        <button 
          className="btn btn-outline-primary mb-3 w-100"
          onClick={addMilestone}
          type="button"
        >
          <i className="bi bi-plus-circle me-2"></i>
          Aggiungi milestone
        </button>
      )}
      
      {/* Avviso di errore se le somme non corrispondono */}
      {goalAmount && Math.abs(amountDifference) > 0.001 && (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-2"></i>
          La somma degli importi delle milestone deve essere uguale all'obiettivo totale della campagna.
        </div>
      )}
    </div>
  );
};

export default MilestoneInputs;