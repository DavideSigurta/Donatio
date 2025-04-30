import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { CampaignCard } from "../components/campaigns/CampaignCard";
import { formatEtherValue } from "../utils/formatters";
import { ipfsService } from "../services/ipfsService";

export function CampaignListPage() {
  const { campaigns, campaignsLoading, loadCampaigns, selectedAddress, isOwner, isAuthorizedCreator } = useWeb3();
  console.log("Debug CampaignListPage:", { isOwner, isAuthorizedCreator, selectedAddress });

  useEffect(() => {
    if (selectedAddress) {
      loadCampaigns();
    }
  }, [selectedAddress, loadCampaigns]);

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

  // Funzione per ottenere l'URL dell'immagine (IPFS o placeholder)
  const getImageUrl = (campaign) => {
    if (campaign.mainImageCID && campaign.mainImageCID !== "") {
      return ipfsService.getImageUrl(campaign.mainImageCID);
    }
    return "/donazione_placeholder.png";
  };

  return (
    <div className="text-center">
      <h1 className="mb-4">Tutte le Campagne</h1>
      
      {isAuthorizedCreator && (
        <Link to="/campaigns/create" className="btn btn-primary mb-4">
          Crea nuova campagna
        </Link>
      )}
      
      {!campaigns || campaigns.length === 0 ? (
        <div className="alert alert-info text-center">
          <h3 className="mb-3">Nessuna campagna attiva</h3>
          <p>Al momento non ci sono campagne disponibili.</p>
        </div>
      ) : (
        <div className="row">
          {campaigns.map((campaign) => (
            <div key={campaign.address} className="col-md-4 mb-4">
              <CampaignCard 
                campaign={{
                  id: campaign.address,
                  title: campaign.title,
                  description: campaign.description,
                  image: getImageUrl(campaign),
                  raised: formatEtherValue(campaign.raisedAmount),
                  goal: formatEtherValue(campaign.goalAmount),
                  active: campaign.active
                }} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}