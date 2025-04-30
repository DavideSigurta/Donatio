import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { WaitingForTransactionMessage } from '../components/common/WaitingForTransactionMessage';
import { TransactionErrorMessage } from '../components/common/TransactionErrorMessage';
import { formatDate } from '../utils/formatters';
import { Link } from 'react-router-dom';

export function RequestCreatorPage() {
  const { 
    creatorRequest, 
    isAuthorizedCreator, 
    submitCreatorRequest, 
    loadCreatorRequestStatus 
  } = useWeb3();
  
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Carica lo stato corrente della richiesta all'inizializzazione
  useEffect(() => {
    loadCreatorRequestStatus();
  }, [loadCreatorRequestStatus]);
  
  // Se l'utente è già autorizzato, non dovrebbe vedere questa pagina
  if (isAuthorizedCreator) {
    return (
      <div className="container py-5">
        <div className="card shadow">
          <div className="card-body p-4 text-center">
            <h4 className="card-title mb-4">Sei già un creatore autorizzato!</h4>
            <p className="card-text">
              Hai già i permessi per creare campagne di raccolta fondi sulla piattaforma.
            </p>
            <Link to="/campaigns/create" className="btn btn-primary">
              Crea una nuova campagna
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    
    try {
      await submitCreatorRequest(description);
      setSuccess(true);
      setDescription(''); // Reset form
    } catch (err) {
      setError(err.message || "Si è verificato un errore durante l'invio della richiesta");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Mostra lo stato della richiesta esistente
  const renderRequestStatus = () => {
    if (!creatorRequest || !creatorRequest.applicant) {
      return null;
    }
    
    return (
      <div className="card shadow mb-4">
        <div className="card-header bg-light">
          <h5 className="mb-0">Stato della tua richiesta</h5>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <strong>Data di invio:</strong> {formatDate(creatorRequest.timestamp)}
          </div>
          <div className="mb-3">
            <strong>Descrizione inviata:</strong>
            <p className="mt-2 p-3 bg-light rounded">{creatorRequest.description}</p>
          </div>
          <div>
            <strong>Stato:</strong>{' '}
            {creatorRequest.processed ? (
              creatorRequest.approved ? (
                <span className="badge bg-success">Approvata</span>
              ) : (
                <span className="badge bg-danger">Rifiutata</span>
              )
            ) : (
              <span className="badge bg-warning text-dark">In attesa</span>
            )}
          </div>
          
          {creatorRequest.processed && creatorRequest.approved && (
            <div className="alert alert-success mt-3">
              La tua richiesta è stata approvata! Ora puoi creare campagne.
              <div className="mt-3">
                <Link to="/campaigns/create" className="btn btn-primary">
                  Crea una nuova campagna
                </Link>
              </div>
            </div>
          )}
          
          {creatorRequest.processed && !creatorRequest.approved && (
            <div className="alert alert-danger mt-3">
              La tua richiesta è stata rifiutata. Puoi inviare una nuova richiesta con informazioni aggiuntive.
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Se l'utente ha una richiesta non processata, non può inviarne un'altra
  const canSubmitNewRequest = !creatorRequest || 
    (creatorRequest.processed && !creatorRequest.approved);
  
  return (
    <div className="container py-5">
      <WaitingForTransactionMessage />
      <TransactionErrorMessage />
      
      {success && (
        <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
          Richiesta inviata con successo! L'amministratore la esaminerà al più presto.
          <button type="button" className="btn-close" onClick={() => setSuccess(false)} aria-label="Close"></button>
        </div>
      )}
      
      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
        </div>
      )}
      
      {/* Mostra lo stato della richiesta esistente se presente */}
      {renderRequestStatus()}
      
      {/* Form per inviare una nuova richiesta */}
      {canSubmitNewRequest && (
        <div className="card shadow">
          <div className="card-header bg-light">
            <h5 className="mb-0">Richiedi di diventare creatore di campagne</h5>
          </div>
          <div className="card-body p-4">
            <div className="alert alert-info mb-4">
              <h5 className="alert-heading">Cosa significa diventare creatore?</h5>
              <p>
                I creatori possono avviare campagne di raccolta fondi sulla piattaforma Donatio.
                Per essere approvato, descrivi brevemente i progetti che intendi realizzare 
                e perché dovremmo approvarti come creatore.
              </p>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="description" className="form-label">Descrizione della richiesta</label>
                <textarea 
                  className="form-control" 
                  id="description" 
                  rows="5" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="Descrivi i progetti che vorresti realizzare, la tua esperienza, e perché sei un buon candidato per creare campagne..."
                  minLength="50"
                  maxLength="1000"
                ></textarea>
                <div className="form-text">
                  Min. 50 caratteri, Max. 1000 caratteri. Fornisci dettagli sufficienti per una valutazione adeguata.
                  {description.length > 0 && (
                    <span className="ms-2">
                      Caratteri: {description.length}/1000
                    </span>
                  )}
                </div>
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary w-100" 
                disabled={isSubmitting || description.length < 50}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Invio in corso...
                  </>
                ) : (
                  'Invia richiesta'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}