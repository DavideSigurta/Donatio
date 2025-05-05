import React, { useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";

/**
 * Componente che visualizza una card per una singola campagna
 */
export function CampaignCard({ campaign }) {
  const [imageError, setImageError] = useState(false);
  
  // Gestisce errori di caricamento immagine
  const handleImageError = () => {
    setImageError(true);
  };

  // Verifica più robusta dello stato inattivo
  const isInactive = campaign.active === false || campaign.active === 0;
  
  // Log per debug
  console.log(`Campaign ${campaign.id}: active=${campaign.active}, isInactive=${isInactive}`);

  return (
    <Link
      to={`/campaigns/${campaign.id}`}
      className="card-link" 
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="card h-100 campaign-card">
        <div className="card-img-container position-relative" style={{ 
            height: "200px", 
            overflow: "hidden",
          }}>
          <img
            src={imageError ? "/donazione_placeholder.png" : campaign.image}
            alt={campaign.title}
            className="card-img-top"
            onError={handleImageError}
            style={{ 
              width: "100%", 
              height: "100%", 
              backgroundColor: "#f8f9fa",
              objectFit: "contain",
              objectPosition: "center",
              opacity: isInactive ? 0.8 : 1
            }}
          />
          
          {/* Badge "Disattivata" sempre visibile per le campagne inattive */}
          {isInactive && (
            <div className="position-absolute" style={{ 
              top: "10px", 
              right: "10px", 
              zIndex: 9999,
              pointerEvents: "none"
            }}>
              <span className="badge bg-danger p-2" style={{ 
                fontSize: '0.9rem', 
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}>Disattivata</span>
            </div>
          )}
        </div>
        
        <div className="card-body">
          <h5 className="card-title">{campaign.title}</h5>
          <p className="card-text">{campaign.description}</p>
          <div className="progress mb-3">
            <div
              className={`progress-bar ${isInactive ? 'bg-secondary' : ''}`}
              role="progressbar"
              style={{
                width: `${Math.min((parseFloat(campaign.raised) / parseFloat(campaign.goal) * 100), 100)}%`,
              }}
              aria-valuenow={(parseFloat(campaign.raised) / parseFloat(campaign.goal) * 100)}
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
          <p className="text-muted">
            {campaign.raised} DNT di {campaign.goal} DNT
          </p>
          {!isInactive && (
            <div className="text-center">
              <span className="btn btn-primary">
                Dona ora
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

CampaignCard.propTypes = {
  campaign: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    raised: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    goal: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    active: PropTypes.bool
  }).isRequired
};