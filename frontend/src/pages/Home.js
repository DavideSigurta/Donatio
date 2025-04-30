import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { CampaignCard } from "../components/campaigns/CampaignCard";
import { formatEtherValue } from "../utils/formatters";
import { ipfsService } from "../services/ipfsService";

export function Home() {
  const { campaigns, campaignsLoading, loadCampaigns, selectedAddress } = useWeb3();
  
  // Carica le campagne quando la pagina viene montata
  useEffect(() => {
      loadCampaigns();
  }, [selectedAddress, loadCampaigns]);

  // Funzione per ottenere l'URL dell'immagine (IPFS o placeholder)
  const getImageUrl = (campaign) => {
    if (campaign.mainImageCID && campaign.mainImageCID !== "") {
      return ipfsService.getImageUrl(campaign.mainImageCID);
    }
    return "/donazione_placeholder.png";
  };

  // Ottieni fino a 3 campagne attive da mostrare in evidenza
  const getFeaturedCampaigns = () => {
    if (!campaigns || campaigns.length === 0) {
      return [];
    }
    
    // Filtra solo le campagne attive e limita a 3
    return campaigns
      .filter(campaign => campaign.active)
      .slice(0, 3)
      .map(campaign => ({
        id: campaign.address,
        title: campaign.title,
        description: campaign.description,
        image: getImageUrl(campaign), // Usa l'immagine IPFS o il placeholder
        raised: formatEtherValue(campaign.raisedAmount),
        goal: formatEtherValue(campaign.goalAmount),
        active: campaign.active
      }));
  };

  const featuredCampaigns = getFeaturedCampaigns();

  return (
    <div>
      <section className="mb-5">
        <div className="jumbotron bg-primary text-white rounded p-4">
          <h1>Donatio: Dona in modo trasparente e sicuro</h1>
          <p className="lead">
            Piattaforma di donazioni basata su blockchain che garantisce totale
            trasparenza. Aiuta a fare la differenza nel mondo.
          </p>
          <Link to="/campaigns" className="btn btn-light btn-lg">
            Scopri le campagne
          </Link>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-4">Campagne in evidenza</h2>
        {campaignsLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Caricamento...</span>
            </div>
            <p className="mt-3">Caricamento campagne in corso...</p>
          </div>
        ) : featuredCampaigns.length > 0 ? (
          <>
            <div className="row">
              {featuredCampaigns.map((campaign) => (
                <div key={campaign.id} className="col-md-4 mb-4">
                  <CampaignCard campaign={campaign} />
                </div>
              ))}
            </div>
            <div className="text-center mt-4">
              <Link to="/campaigns" className="btn btn-outline-primary">
                Vedi tutte le campagne
              </Link>
            </div>
          </>
        ) : (
          <div className="alert alert-info text-center">
            <p>Non ci sono ancora campagne disponibili.</p>
            <Link to="/campaigns" className="btn btn-outline-primary mt-3">
              Esplora tutte le campagne
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}