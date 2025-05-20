import React, { useState } from 'react';
import { useWeb3 } from '../../contexts/Web3Context';

/**
 * Componente per l'invio di report sulle milestone completate
 * Viene usato dai creatori delle campagne per inviare report 
 * che poi verranno votati dalla community
 * 
 * @param {Object} props
 * @param {String} props.campaignAddress - Indirizzo della campagna
 * @param {Number} props.milestoneIndex - Indice della milestone
 * @param {Function} props.onSubmitSuccess - Callback dopo l'invio con successo
 * @returns {JSX.Element} Componente React
 */
export function MilestoneReportForm({ campaignAddress, milestoneIndex, onSubmitSuccess }) {
  const { submitMilestoneReport } = useWeb3();
  const [report, setReport] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Gestisce l'invio del report
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!report.trim()) {
      setError('È necessario fornire un report dettagliato');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Invia il report tramite il context
      await submitMilestoneReport(campaignAddress, milestoneIndex, report);
      
      // Resetta il form
      setReport('');
      
      // Callback di successo (ad es. per ricaricare le milestone)
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err) {
      console.error("Errore nell'invio del report:", err);
      setError(err.message || "Si è verificato un errore nell'invio del report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="milestone-report-form my-3">
      <h5>Invia report per la verifica della milestone</h5>
      <p className="text-muted mb-3">
        Il tuo report verrà valutato dalla community attraverso un sistema di votazione.
        Fornisci dettagli completi sui risultati raggiunti in questa milestone.
      </p>
      
      {error && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i> {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="milestoneReport" className="form-label">Report dettagliato</label>
          <textarea
            id="milestoneReport"
            className="form-control"
            rows={5}
            value={report}
            onChange={e => setReport(e.target.value)}
            placeholder="Descrivi in dettaglio i risultati raggiunti e come sono stati utilizzati i fondi in questa milestone..."
            required
            disabled={isSubmitting}
          />
        </div>
        
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={isSubmitting || !report.trim()}
        >
          {isSubmitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Invio in corso...
            </>
          ) : 'Invia report per votazione'}
        </button>
      </form>
    </div>
  );
}