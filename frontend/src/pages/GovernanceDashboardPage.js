import React, { useState, useEffect, useRef } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

export function GovernanceDashboardPage() {
    const { 
        proposals, 
        proposalsLoading, 
        loadProposals, 
        finalizeProposal, 
        selectedAddress, 
        isAdmin 
    } = useWeb3();
    
    const [filterStatus, setFilterStatus] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [statsCounts, setStatsCounts] = useState({ active: 0, approved: 0, rejected: 0, expired: 0, total: 0 });
    const [selectedProposals, setSelectedProposals] = useState([]);
    const [isProcessingBatch, setIsProcessingBatch] = useState(false);
    const [localLoading, setLocalLoading] = useState(true);
    const loadProposalsRef = useRef(loadProposals);
    
    // Carica le proposte all'avvio della pagina
    useEffect(() => {
        // Salva l'ultima funzione loadProposals nella ref
        loadProposalsRef.current = loadProposals;
        
        // Flag per tenere traccia dello stato di montaggio
        let isMounted = true;
        
        // Flag per prevenire caricamenti multipli
        let isLoading = false;
        
        const loadData = async () => {
            // Evita caricamenti multipli simultanei
            if (isLoading) return;
            
            isLoading = true;
            setLocalLoading(true);
            console.log("Iniziando caricamento proposte...");
            
            try {
                // Usa la funzione dalla ref, non dalla dipendenza
                await loadProposalsRef.current();
                console.log("Proposte caricate con successo");
                
                if (isMounted) {
                    setTimeout(() => {
                        console.log("Nascondo il loader");
                        setLocalLoading(false);
                        isLoading = false;
                    }, 1000);
                }
            } catch (error) {
                console.error("Errore durante il caricamento delle proposte:", error);
                if (isMounted) {
                    setLocalLoading(false);
                    isLoading = false;
                }
            }
        };
        
        // Esegui il caricamento una sola volta all'avvio
        loadData();
        
        return () => {
            isMounted = false;
        };
    }, []); // <-- Rimuovi loadProposals dalle dipendenze
    
    // Calcola le statistiche quando le proposte cambiano
    useEffect(() => {
        if (!proposalsLoading && proposals && proposals.length > 0) {
            const counts = {
                active: 0,
                approved: 0,
                rejected: 0,
                expired: 0,
                total: proposals.length
            };
            
            proposals.forEach(proposal => {
                if (proposal.status === 0 && !proposal.isExpired) {
                    counts.active++;
                } else if (proposal.status === 1) {
                    // Conta come approvate solo quelle con status=1
                    counts.approved++;
                } else if (proposal.status === 2) {
                    // Conta come rifiutate quelle con status=2
                    counts.rejected++;
                } else if (proposal.isExpired || proposal.status === 3) {
                    // Conta come scadute quelle scadute ma non ancora finalizzate
                    counts.expired++;
                }
            });
            
            setStatsCounts(counts);
        }
    }, [proposals, proposalsLoading]);
    
    // Filtra le proposte in base allo stato e al termine di ricerca
    const filteredProposals = proposals.filter(proposal => {
        // Filtra per stato
        if (filterStatus === "active" && (proposal.status !== 0 || proposal.isExpired)) return false;
        if (filterStatus === "approved" && (proposal.status !== 1 && !proposal.executed)) return false;
        if (filterStatus === "rejected" && proposal.status !== 2) return false;
        if (filterStatus === "expired" && (!proposal.isExpired || proposal.executed)) return false;
        
        // Filtra per termine di ricerca
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                proposal.id.toString().includes(searchLower) ||
                proposal.campaignAddress.toLowerCase().includes(searchLower)
            );
        }
        
        return true;
    });
    
    // Gestisce la selezione di una proposta per l'azione batch
    const handleSelectProposal = (proposalId) => {
        if (selectedProposals.includes(proposalId)) {
            setSelectedProposals(selectedProposals.filter(id => id !== proposalId));
        } else {
            setSelectedProposals([...selectedProposals, proposalId]);
        }
    };
    
    // Finalizza le proposte selezionate in batch
    const handleFinalizeBatch = async () => {
        if (selectedProposals.length === 0) return;
        
        try {
            setIsProcessingBatch(true);
            
            // Processa le proposte una alla volta in sequenza
            for (const proposalId of selectedProposals) {
                await finalizeProposal(proposalId);
            }
            
            // Ricarica le proposte e reimposta la selezione
            await loadProposals();
            setSelectedProposals([]);
            
        } catch (error) {
            console.error("Errore durante la finalizzazione batch:", error);
        } finally {
            setIsProcessingBatch(false);
        }
    };
    
    // Renderizza la dashboard
    return (
        <div className="container my-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Dashboard di Governance</h1>
        <Link to="/campaigns" className="btn btn-outline-secondary">
        <i className="bi bi-arrow-left me-2"></i>
        Torna alle campagne
        </Link>
        </div>
        
        {/* Statistiche */}
        <div className="row mb-4">
        <div className="col-md-3">
        <div className="card text-white bg-primary">
        <div className="card-body">
        <h5 className="card-title">Proposte Attive</h5>
        <p className="card-text display-6">{statsCounts.active}</p>
        </div>
        </div>
        </div>
        <div className="col-md-3">
        <div className="card text-white bg-success">
        <div className="card-body">
        <h5 className="card-title">Approvate</h5>
        <p className="card-text display-6">{statsCounts.approved}</p>
        </div>
        </div>
        </div>
        <div className="col-md-3">
        <div className="card text-white bg-danger">
        <div className="card-body">
        <h5 className="card-title">Rifiutate</h5>
        <p className="card-text display-6">{statsCounts.rejected}</p>
        </div>
        </div>
        </div>
        <div className="col-md-3">
        <div className="card text-white bg-warning">
        <div className="card-body">
        <h5 className="card-title">Scadute</h5>
        <p className="card-text display-6">{statsCounts.expired}</p>
        </div>
        </div>
        </div>
        </div>
        
        {/* Filtri e ricerca */}
        <div className="card mb-4">
        <div className="card-body">
        <div className="row g-3">
        <div className="col-md-4">
        <label className="form-label">Filtra per stato</label>
        <select 
        className="form-select" 
        value={filterStatus} 
        onChange={(e) => setFilterStatus(e.target.value)}
        >
        <option value="all">Tutte le proposte</option>
        <option value="active">Attive</option>
        <option value="approved">Approvate</option>
        <option value="rejected">Rifiutate</option>
        <option value="expired">Scadute</option>
        </select>
        </div>
        <div className="col-md-4">
        <label className="form-label">Cerca</label>
        <input
        type="text"
        className="form-control"
        placeholder="Cerca per ID o indirizzo"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        />
        </div>
        <div className="col-md-4 d-flex align-items-end">
        {filterStatus === "expired" && selectedProposals.length > 0 && (
            <button 
            className="btn btn-warning w-100" 
            onClick={handleFinalizeBatch}
            disabled={isProcessingBatch}
            >
            {isProcessingBatch ? (
                <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Finalizzazione in corso...
                </>
            ) : (
                `Finalizza ${selectedProposals.length} proposte selezionate`
            )}
            </button>
        )}
        </div>
        </div>
        </div>
        </div>
        
        {/* Tabella delle proposte */}
        <div className="card">
        <div className="card-body">
        {localLoading ? (
            <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Caricamento...</span>
            </div>
            <p className="mt-3">Caricamento proposte...</p>
            </div>
        ) : (!proposals || proposals.length === 0) ? (
            <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            Non ci sono ancora proposte nel sistema.
            </div>
        ) : filteredProposals.length === 0 ? (
            <div className="alert alert-info">
            <i className="bi bi-filter me-2"></i>
            Nessuna proposta trovata con i filtri attuali.
            </div>
        ) : (
            <div className="table-responsive">
            <table className="table table-hover">
            <thead>
            <tr>
            {filterStatus === "expired" && (
                <th>
                <input 
                type="checkbox" 
                className="form-check-input" 
                onChange={(e) => {
                    if (e.target.checked) {
                        const expiredIds = filteredProposals
                        .filter(p => p.isExpired && p.status === 0 && !p.executed)
                        .map(p => p.id);
                        setSelectedProposals(expiredIds);
                    } else {
                        setSelectedProposals([]);
                    }
                }} 
                checked={
                    filteredProposals.length > 0 && 
                    filteredProposals.every(p => 
                        !p.isExpired || p.status !== 0 || p.executed || selectedProposals.includes(p.id)
                    )
                }
                />
                </th>
            )}
            <th>ID</th>
            <th>Campagna</th>
            <th>Stato</th>
            <th>Voti Positivi</th>
            <th>Voti Negativi</th>
            <th>Obiettivo</th>
            <th>Tempo Rimanente</th>
            <th>Azioni</th>
            </tr>
            </thead>
            <tbody>
            {filteredProposals.map((proposal) => (
                <tr key={proposal.id} className={proposal.isExpired && proposal.status === 0 && !proposal.executed ? "table-warning" : ""}>
                {filterStatus === "expired" && (
                    <td>
                    {proposal.isExpired && proposal.status === 0 && !proposal.executed && (
                        <input 
                        type="checkbox" 
                        className="form-check-input" 
                        checked={selectedProposals.includes(proposal.id)} 
                        onChange={() => handleSelectProposal(proposal.id)} 
                        />
                    )}
                    </td>
                )}
                <td>{proposal.id}</td>
                <td>
                <Link to={`/campaigns/${proposal.campaignAddress}`} className="text-decoration-none">
                {proposal.campaignAddress.substring(0, 8)}...{proposal.campaignAddress.substring(36)}
                </Link>
                </td>
                <td>
                {proposal.statusText === "Attiva" && !proposal.isExpired && (
                    <span className="badge bg-primary">Attiva</span>
                )}
                {proposal.statusText === "Attiva" && proposal.isExpired && (
                    <span className="badge bg-warning">Scaduta</span>
                )}
                {proposal.statusText === "Approvata" && (
                    <span className="badge bg-success">Approvata</span>
                )}
                {proposal.statusText === "Rifiutata" && (
                    <span className="badge bg-danger">Rifiutata</span>
                )}
                {proposal.statusText === "Scaduta" && (
                    <span className="badge bg-secondary">Scaduta</span>
                )}
                </td>
                <td>
                <div className="d-flex align-items-center">
                <div className="progress flex-grow-1 me-2" style={{ height: "10px" }}>
                <div 
                className="progress-bar bg-success" 
                role="progressbar" 
                style={{ width: `${proposal.positivePercentage}%` }}
                aria-valuenow={proposal.positivePercentage} 
                aria-valuemin="0" 
                aria-valuemax="100"
                />
                </div>
                <span>{proposal.positiveVotes}</span>
                </div>
                </td>
                <td>
                <div className="d-flex align-items-center">
                <div className="progress flex-grow-1 me-2" style={{ height: "10px" }}>
                <div 
                className="progress-bar bg-danger" 
                role="progressbar" 
                style={{ width: `${proposal.negativePercentage}%` }}
                aria-valuenow={proposal.negativePercentage} 
                aria-valuemin="0" 
                aria-valuemax="100"
                />
                </div>
                <span>{proposal.negativeVotes}</span>
                </div>
                </td>
                <td>{proposal.targetAmount} DNT</td>
                <td>
                {proposal.status === 0 && !proposal.executed && (
                    proposal.timeRemaining > 0 
                    ? formatDistanceToNow(new Date(Date.now() + proposal.timeRemaining * 1000), { addSuffix: true, locale: it })
                    : "Scaduta"
                )}
                {(proposal.status !== 0 || proposal.executed) && (
                    <span className="text-muted">N/A</span>
                )}
                </td>
                <td>
                {proposal.isExpired && proposal.status === 0 && !proposal.executed && (
                    <button 
                    className="btn btn-sm btn-warning" 
                    onClick={() => finalizeProposal(proposal.id)}
                    >
                    Finalizza
                    </button>
                )}
                <Link 
                to={`/campaigns/${proposal.campaignAddress}`} 
                className="btn btn-sm btn-outline-primary ms-2"
                >
                Dettagli
                </Link>
                </td>
                </tr>
            ))}
            </tbody>
            </table>
            </div>
        )}
        </div>
        </div>
        </div>
    );
}