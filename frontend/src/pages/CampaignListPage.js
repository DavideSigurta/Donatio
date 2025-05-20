import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { CampaignCard } from "../components/campaigns/CampaignCard";
import { formatEtherValue } from "../utils/formatters";
import { ipfsService } from "../services/ipfsService";

export function CampaignListPage() {
  const { campaigns, campaignsLoading, loadCampaigns, selectedAddress, isOwner, isAuthorizedCreator } = useWeb3();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "active");
  const [categoryCounts, setCategoryCounts] = useState({ active: 0, pending: 0, inactive: 0 });

  // Aggiorna i conteggi quando le campagne cambiano
  useEffect(() => {
    if (campaigns && campaigns.length > 0) {
      const counts = { active: 0, pending: 0, inactive: 0 };
      
      campaigns.forEach(campaign => {
        // Definisci la condizione per le campagne "in approvazione"
        const isPending = (!campaign.active && campaign.proposalId && campaign.proposalStatus === 0 && !campaign.proposalExecuted) || 
                         (!campaign.active && !campaign.proposalExecuted && 
                          (!campaign.proposalId || campaign.proposalId === null));

        // Considera pronte per finalizzazione come "in approvazione"
        if (campaign.proposalStatus === 4 && !campaign.proposalExecuted) {
          counts.pending++;
        }
        else if (campaign.active) {
          counts.active++;
        } else if (isPending) {
          counts.pending++;
        } else {
          counts.inactive++;
        }
      });
      
      setCategoryCounts(counts);
    }
  }, [campaigns]);

  // Carica le campagne quando l'utente è connesso
  useEffect(() => {
    if (selectedAddress) {
      loadCampaigns();
    }
  }, [selectedAddress, loadCampaigns]);

  // Gestisce il cambio di tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Filtra le campagne in base al tab attivo
  const filteredCampaigns = campaigns.filter(campaign => {
    // Definisci la condizione per le campagne "in approvazione"
    const isPending = (!campaign.active && campaign.proposalId && campaign.proposalStatus === 0 && !campaign.proposalExecuted) || 
                     (!campaign.active && !campaign.proposalExecuted && 
                      (!campaign.proposalId || campaign.proposalId === null));

    switch (activeTab) {
      case "active":
        return campaign.active;
      case "pending":
        // Include campagne in approvazione e pronte per finalizzazione
        return isPending || (campaign.proposalStatus === 4 && !campaign.proposalExecuted);
      case "inactive":
        return !campaign.active && !isPending && !(campaign.proposalStatus === 4 && !campaign.proposalExecuted);
      default:
        return true;
    }
  });

  // Funzione per ottenere l'URL dell'immagine (IPFS o placeholder)
  const getImageUrl = (campaign) => {
    if (campaign.mainImageCID && campaign.mainImageCID !== "") {
      return ipfsService.getImageUrl(campaign.mainImageCID);
    }
    return "/donazione_placeholder.png";
  };

  if (campaignsLoading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Caricamento...</span>
        </div>
        <p className="mt-3">Caricamento campagne in corso...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Campagne</h1>
        
        {isAuthorizedCreator && (
          <Link to="/campaigns/create" className="btn btn-primary">
            Crea nuova campagna
          </Link>
        )}
      </div>
      
      {/* Tabs di navigazione */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'active' ? 'active' : ''}`} 
            onClick={() => handleTabChange('active')}
          >
            Attive
            <span className="badge bg-primary rounded-pill ms-2">{categoryCounts.active}</span>
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'pending' ? 'active' : ''}`} 
            onClick={() => handleTabChange('pending')}
          >
            In Approvazione
            <span className="badge bg-warning rounded-pill ms-2">{categoryCounts.pending}</span>
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'inactive' ? 'active' : ''}`} 
            onClick={() => handleTabChange('inactive')}
          >
            Disattivate
            <span className="badge bg-secondary rounded-pill ms-2">{categoryCounts.inactive}</span>
          </button>
        </li>
      </ul>
      
      {/* Contenuto in base al tab selezionato */}
      {!filteredCampaigns || filteredCampaigns.length === 0 ? (
        <div className="alert alert-info text-center">
          <h3 className="mb-3">
            {activeTab === 'active' && "Nessuna campagna attiva"}
            {activeTab === 'pending' && "Nessuna campagna in approvazione"}
            {activeTab === 'inactive' && "Nessuna campagna disattivata"}
          </h3>
          <p>
            {activeTab === 'active' && "Al momento non ci sono campagne attive disponibili."}
            {activeTab === 'pending' && "Non ci sono campagne in attesa di approvazione."}
            {activeTab === 'inactive' && "Non ci sono campagne disattivate."}
          </p>
        </div>
      ) : (
        <div className="row">
          {filteredCampaigns.map((campaign) => {
            // Determina se una campagna è in attesa di approvazione
            const isPending = (!campaign.active && campaign.proposalId && 
                              campaign.proposalStatus === 0 && !campaign.proposalExecuted) || 
                             (!campaign.active && !campaign.proposalExecuted && 
                              (!campaign.proposalId || campaign.proposalId === null));
            
            const isReadyForExecution = campaign.proposalStatus === 4 && !campaign.proposalExecuted;
            
            return (
              <div key={campaign.address} className="col-md-4 mb-4">
                <CampaignCard 
                  campaign={{
                    id: campaign.address,
                    title: campaign.title,
                    description: campaign.description,
                    image: getImageUrl(campaign),
                    raised: formatEtherValue(campaign.raisedAmount),
                    goal: formatEtherValue(campaign.goalAmount),
                    active: campaign.active,
                    isPending: isPending,
                    proposalId: campaign.proposalId,
                    proposalStatus: campaign.proposalStatus,
                    proposalExecuted: campaign.proposalExecuted,
                    timeRemaining: campaign.timeRemaining
                  }} 
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}