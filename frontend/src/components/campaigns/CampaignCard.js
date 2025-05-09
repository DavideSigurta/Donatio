import React, { useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

/**
 * Componente che visualizza una card per una singola campagna
 */
export function CampaignCard({ campaign }) {
  const [imageError, setImageError] = useState(false);
  
  // Gestisce errori di caricamento immagine
  const handleImageError = () => {
    setImageError(true);
  };

  // Ottieni lo stato della campagna
  const getStatusBadge = () => {
    if (campaign.isPending) {
      return (
        <span className="badge bg-warning p-2" style={{ 
          fontSize: '0.9rem', 
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>In Approvazione</span>
      );
    } else if (!campaign.active) {
      return (
        <span className="badge bg-danger p-2" style={{ 
          fontSize: '0.9rem', 
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>Disattivata</span>
      );
    }
    return null;
  };

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
              opacity: !campaign.active ? 0.8 : 1
            }}
          />
          
          {/* Badge di stato */}
          <div className="position-absolute" style={{ 
            top: "10px", 
            right: "10px", 
            zIndex: 9999,
            pointerEvents: "none"
          }}>
            {getStatusBadge()}
          </div>
        </div>
        
        <div className="card-body">
          <h5 className="card-title">{campaign.title}</h5>
          <p className="card-text">{campaign.description}</p>
          
          {/* Mostra una barra di progresso per le campagne attive e disattivate, ma non per quelle in approvazione */}
          {!campaign.isPending ? (
            <>
              <div className="progress mb-3">
                <div
                  className={`progress-bar ${!campaign.active ? 'bg-secondary' : ''}`}
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
            </>
          ) : (
            // Per le campagne in approvazione, mostra le informazioni sulla votazione
            <div className="mt-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-warning">
                  <i className="bi bi-hourglass-split me-1"></i>
                  Votazione in corso
                </span>
                {campaign.timeRemaining > 0 && (
                  <small className="text-muted">
                    Scade {formatDistanceToNow(new Date(Date.now() + campaign.timeRemaining * 1000), 
                    { addSuffix: true, locale: it })}
                  </small>
                )}
              </div>
              <div className="text-center mt-3">
                <span className="badge bg-info p-2">Obiettivo: {campaign.goal} DNT</span>
              </div>
            </div>
          )}
          
          {/* Pulsante per le campagne attive */}
          {campaign.active && (
            <div className="text-center">
              <span className="btn btn-primary">
                Dona ora
              </span>
            </div>
          )}
          
          {/* Pulsante per le campagne in approvazione */}
          {campaign.isPending && (
            <div className="text-center">
              <span className="btn btn-warning">
                Vota ora
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
    active: PropTypes.bool,
    isPending: PropTypes.bool,
    proposalId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    proposalStatus: PropTypes.number,
    timeRemaining: PropTypes.number
  }).isRequired
};