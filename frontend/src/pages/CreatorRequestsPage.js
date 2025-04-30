import React, { useEffect, useState } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { WaitingForTransactionMessage } from '../components/common/WaitingForTransactionMessage';
import { TransactionErrorMessage } from '../components/common/TransactionErrorMessage';
import { formatDate, shortenAddress } from '../utils/formatters';

export function CreatorRequestsPage() {
  const { 
    pendingRequests, 
    pendingRequestsLoading, 
    loadPendingRequests, 
    approveCreatorRequest, 
    rejectCreatorRequest 
  } = useWeb3();
  
  const [processingAddress, setProcessingAddress] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [localLoading, setLocalLoading] = useState(true);
  
  // Carica le richieste pendenti all'inizializzazione (solo una volta)
  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLocalLoading(true);
        await loadPendingRequests();
      } catch (error) {
        console.error("Errore nel caricamento delle richieste:", error);
      } finally {
        // Garantisce che il loading venga disattivato anche in caso di errori
        setLocalLoading(false);
      }
    };
    
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dipendenza vuota per eseguire solo all'avvio
  
  // Toggle per espandere/contrarre le descrizioni lunghe
  const toggleDescription = (address) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [address]: !prev[address]
    }));
  };
  
  // Gestire l'approvazione di una richiesta
  const handleApprove = async (address) => {
    setProcessingAddress(address);
    setActionSuccess(null);
    setActionError(null);
    
    try {
      await approveCreatorRequest(address);
      setActionSuccess(`Richiesta di ${shortenAddress(address)} approvata con successo`);
    } catch (err) {
      setActionError(err.message || `Errore nell'approvazione della richiesta di ${shortenAddress(address)}`);
    } finally {
      setProcessingAddress(null);
    }
  };
  
  // Gestire il rifiuto di una richiesta
  const handleReject = async (address) => {
    if (!window.confirm('Sei sicuro di voler rifiutare questa richiesta?')) {
      return;
    }
    
    setProcessingAddress(address);
    setActionSuccess(null);
    setActionError(null);
    
    try {
      await rejectCreatorRequest(address);
      setActionSuccess(`Richiesta di ${shortenAddress(address)} rifiutata`);
    } catch (err) {
      setActionError(err.message || `Errore nel rifiuto della richiesta di ${shortenAddress(address)}`);
    } finally {
      setProcessingAddress(null);
    }
  };
  
  // Formattazione della descrizione con opzione di espansione
  const renderDescription = (address, description) => {
    const isExpanded = expandedDescriptions[address];
    const MAX_LENGTH = 200;
    
    if (description.length <= MAX_LENGTH || isExpanded) {
      return (
        <div>
          <p className="mb-2">{description}</p>
          {description.length > MAX_LENGTH && (
            <button 
              className="btn btn-sm btn-link p-0" 
              onClick={() => toggleDescription(address)}
            >
              Mostra meno
            </button>
          )}
        </div>
      );
    }
    
    return (
      <div>
        <p className="mb-2">{description.substring(0, MAX_LENGTH)}...</p>
        <button 
          className="btn btn-sm btn-link p-0" 
          onClick={() => toggleDescription(address)}
        >
          Mostra tutto
        </button>
      </div>
    );
  };
  
  // Determina se visualizzare il loading basandosi su pendingRequestsLoading o localLoading
  const isLoading = pendingRequestsLoading || localLoading;
  
  return (
    <div className="container py-5">
      <WaitingForTransactionMessage />
      <TransactionErrorMessage />
      
      <h2 className="mb-4">Gestione Richieste Creatori</h2>
      
      {actionSuccess && (
        <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
          {actionSuccess}
          <button type="button" className="btn-close" onClick={() => setActionSuccess(null)} aria-label="Close"></button>
        </div>
      )}
      
      {actionError && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          {actionError}
          <button type="button" className="btn-close" onClick={() => setActionError(null)} aria-label="Close"></button>
        </div>
      )}
      
      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Caricamento...</span>
          </div>
          <p className="mt-3">Caricamento richieste in corso...</p>
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="card shadow">
          <div className="card-body p-5 text-center">
            <h4 className="mb-3">Nessuna richiesta in attesa</h4>
            <p className="text-muted">
              Non ci sono richieste di autorizzazione da gestire al momento.
            </p>
          </div>
        </div>
      ) : (
        <div className="row">
          {pendingRequests.map((request, index) => (
            <div className="col-12 mb-4" key={request.applicant}>
              <div className="card shadow">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Richiesta #{index + 1}</h5>
                  <span className="badge bg-warning text-dark">In attesa</span>
                </div>
                <div className="card-body">
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <strong>Richiedente:</strong> 
                      <span className="d-block mt-1">{request.applicant}</span>
                    </div>
                    <div className="col-md-6">
                      <strong>Data richiesta:</strong> 
                      <span className="d-block mt-1">{formatDate(request.timestamp)}</span>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <strong>Descrizione:</strong>
                    <div className="p-3 bg-light rounded mt-2">
                      {renderDescription(request.applicant, request.description)}
                    </div>
                  </div>
                  
                  <div className="d-flex justify-content-end gap-2">
                    <button 
                      className="btn btn-outline-danger" 
                      onClick={() => handleReject(request.applicant)}
                      disabled={processingAddress === request.applicant}
                    >
                      {processingAddress === request.applicant ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        'Rifiuta'
                      )}
                    </button>
                    <button 
                      className="btn btn-success" 
                      onClick={() => handleApprove(request.applicant)}
                      disabled={processingAddress === request.applicant}
                    >
                      {processingAddress === request.applicant ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        'Approva'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}