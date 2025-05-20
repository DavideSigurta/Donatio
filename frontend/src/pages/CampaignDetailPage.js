import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { formatEtherValue, formatDate, shortenAddress } from "../utils/formatters";
import { DonationForm } from "../components/campaigns/DonationForm";
import { CampaignTransactions } from "../components/campaigns/CampaignTransactions";
import { ImageSlider } from "../components/common/ImageSlider";
import { VotingPanel } from "../components/campaigns/VotingPanel";
import campaignService from "../services/CampaignService";
import { ipfsService } from "../services/ipfsService";
import CampaignArtifact from "../contracts/Campaign.json";
import MilestonesList from "../components/campaigns/MilestonesList";


export function CampaignDetailPage() {
  const { id: campaignAddress } = useParams();
  const { selectedAddress, tokenData, makeDonation, campaignProposals, isAdmin, loadProposals, executeProposal } = useWeb3();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState(null);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [donating, setDonating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [campaignImages, setCampaignImages] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [milestonesLoading, setMilestonesLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isExecutingProposal, setIsExecutingProposal] = useState(false);
  const { loadCampaignMilestones, campaignMilestones, milestonesLoading: contextMilestonesLoading } = useWeb3();
  const [isBeneficiary, setIsBeneficiary] = useState(false);

  const proposalArray = campaignProposals && campaignAddress ? campaignProposals[campaignAddress.toLowerCase()] || [] : [];
  const proposal = proposalArray.find(p => p && p.proposalType === 0);
  const isPending = campaign && !campaign.active && proposal && proposal.status === 0 && !proposal.executed;
  const isReadyForExecution = campaign && proposal && proposal.status === 4 && !proposal.executed;

  // Verifica se l'utente è il creatore della campagna
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!selectedAddress || !campaignAddress || !campaign) return;
      
      try {
        // Controllo se è il beneficiario
        const beneficiary = await campaign.beneficiary;
        setIsBeneficiary(beneficiary.toLowerCase() === selectedAddress.toLowerCase());
        
        // Per completezza, manteniamo anche il controllo sul creator originale
        const creator = await campaign.creator;
        setIsCreator(creator.toLowerCase() === selectedAddress.toLowerCase());
      } catch (error) {
        console.error("Errore nel verificare l'autorizzazione:", error);
      }
    };
    
    if (campaign) {
      checkAuthorization();
    }
  }, [selectedAddress, campaignAddress, campaign]);
  
  useEffect(() => {
    const loadCampaignData = async () => {
      try {
        setLoading(true);

        await loadProposals();          
        // Inizializza la campagna
        await campaignService.initializeCampaign(campaignAddress, CampaignArtifact);          
        // Carica i dettagli base
        const details = await campaignService.getCampaignDetails(campaignAddress);
        setCampaign(details);
        
        // Carica le donazioni
        const campaignDonations = await campaignService.getCampaignDonations(campaignAddress);
        setDonations(campaignDonations);
        
        // Carica le immagini
        const images = [];
        if (details.mainImageCID && details.mainImageCID !== "") {
          images.push(ipfsService.getImageUrl(details.mainImageCID));
        }
        
        try {
          const additionalImagesCIDs = await campaignService.getCampaignAdditionalImages(campaignAddress);
          if (additionalImagesCIDs && additionalImagesCIDs.length > 0) {
            for (const cid of additionalImagesCIDs) {
              if (cid && cid !== "") {
                images.push(ipfsService.getImageUrl(cid));
              }
            }
          }
        } catch (imgError) {
          console.warn("Errore nel caricamento delle immagini aggiuntive:", imgError);
        }
        
        setCampaignImages(images);
        
        // MODIFICA: Carica le milestone direttamente qui invece di usare loadCampaignMilestones
        setMilestonesLoading(true);
        const milestonesData = await campaignService.getMilestones(campaignAddress);
        setMilestones(milestonesData);
        setMilestonesLoading(false);
        
      } catch (err) {
        console.error("Errore nel caricamento dei dati della campagna:", err);
        setError(`Impossibile caricare i dati della campagna: ${err.message}`);
      } finally {
        setLoading(false);
        setDataLoaded(true);  // Imposta questo flag a true dopo il caricamento
      }
    };
    
    // Carica i dati solo se non sono già stati caricati
    if (campaignAddress && !dataLoaded) {
      loadCampaignData();
    }
  }, [campaignAddress, dataLoaded, loadProposals]);

  useEffect(() => {
    // Questo effetto servirà solo per aggiornamenti futuri
    if (dataLoaded && campaignAddress && campaignMilestones && campaignMilestones[campaignAddress]) {
      // Confronta i dati per evitare cicli infiniti
      if (JSON.stringify(milestones) !== JSON.stringify(campaignMilestones[campaignAddress])) {
        setMilestones(campaignMilestones[campaignAddress]);
      }
    }
  }, [dataLoaded, campaignMilestones, campaignAddress]);
  
  // Gestisce il processo di donazione
  const handleDonation = async (amount, message = "") => {
    try {
      setDonating(true);
      
      // Effettua la donazione
      await makeDonation(campaignAddress, amount, message);
      
      // Ricarica i dati della campagna e le donazioni
      const details = await campaignService.getCampaignDetails(campaignAddress);
      const campaignDonations = await campaignService.getCampaignDonations(campaignAddress);
      
      const milestonesData = await campaignService.getMilestones(campaignAddress);
      setMilestones(milestonesData);
      
      setCampaign(details);
      setDonations(campaignDonations);
      setSuccess(true);
      
      // Reset stato di successo dopo 5 secondi
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error("Errore durante la donazione:", err);
      setError("Si è verificato un errore durante la donazione. Riprova.");
      
      // Reset errore dopo 5 secondi
      setTimeout(() => setError(null), 5000);
    } finally {
      setDonating(false);
    }
  };
  
  // Gestisce l'esecuzione della proposta
  const handleExecuteProposal = async () => {
      console.log("Tentativo di esecuzione proposta:", proposal);
      
      if (!proposal || proposal.id=== undefined) {
          console.error("Proposta non valida:", proposal);
          return;
      }
      
      try {
        setIsExecutingProposal(true);
        console.log("Chiamata a executeProposal con ID:", proposal.id);
        const result = await executeProposal(proposal.id);
        console.log("Risultato executeProposal:", result);
        
        // Ricarica la pagina dopo la finalizzazione
        window.location.reload();
      } catch (err) {
        console.error("Errore durante la finalizzazione della proposta:", err);
        setError("Si è verificato un errore durante la finalizzazione della proposta: " + err.message);
        setTimeout(() => setError(null), 5000);
      } finally {
        setIsExecutingProposal(false);
      }
  };
  
  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
        </div>
        <p className="mt-3">Caricamento dettagli campagna...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="alert alert-danger">
        <h3>Errore</h3>
        <p>{error}</p>
        <button className="btn btn-outline-primary mt-3" onClick={() => navigate("/campaigns")}>
          Torna alle campagne
        </button>
      </div>
    );
  }
  
  if (!campaign) {
    return (
      <div className="alert alert-warning">
        <h3>Campagna non trovata</h3>
        <p>La campagna richiesta non esiste o è stata rimossa.</p>
        <button className="btn btn-outline-primary mt-3" onClick={() => navigate("/campaigns")}>
          Torna alle campagne
        </button>
      </div>
    );
  }
  
  const progressPercentage = (parseFloat(campaign.raisedAmount) / parseFloat(campaign.goalAmount)) * 100;

  return (
    <div>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/campaigns">Campagne</Link></li>
          <li className="breadcrumb-item active" aria-current="page">{campaign.title}</li>
        </ol>
      </nav>
      
      {/* Slider immagini campagna */}
      <ImageSlider images={campaignImages} placeholderImage="/donazione_placeholder.png" />
      
      {/* Avvisi stato campagna */}
      {!campaign.active && !isPending && !isReadyForExecution && (
        <div className="alert alert-warning mb-4">
          <strong>Attenzione:</strong> Questa campagna non è più attiva e non accetta donazioni.
        </div>
      )}
      
      {isPending && (
        <div className="alert alert-info mb-4">
          <strong>Campagna in attesa di approvazione:</strong> Questa campagna è in fase di approvazione tramite votazione della community.
        </div>
      )}

      {isReadyForExecution && (
        <div className="alert alert-success mb-4">
          <strong>Votazione completata:</strong> La campagna ha ricevuto abbastanza voti positivi e può essere attivata dal creatore.
        </div>
      )}
      
      {/* Pannello per la finalizzazione della proposta */}
      {isReadyForExecution && isBeneficiary && (
        <div className="card mb-4">
          <div className="card-body">
            <h4 className="card-title text-success">
              <i className="bi bi-check-circle me-2"></i>
              Votazione Conclusa con Successo!
            </h4>
            <p>
              La proposta ha raggiunto la soglia di voti necessaria per l'approvazione.
              In quanto beneficiario della campagna, ora devi finalizzare il risultato per attivare la campagna.
            </p>
            <button 
              className="btn btn-success w-100" 
              onClick={handleExecuteProposal}
              disabled={isExecutingProposal}
            >
              {isExecutingProposal ? (
                <><span className="spinner-border spinner-border-sm me-2"></span> Finalizzazione in corso...</>
              ) : (
                <><i className="bi bi-check-circle me-2"></i> Finalizza Risultato Votazione</>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Dettagli campagna */}
      <div className="card mb-4">
        <div className="card-header bg-light d-flex justify-content-between align-items-center">
          <h1 className="card-title h3 mb-0">{campaign.title}</h1>
          <span className="badge bg-primary text-white">Creata il {formatDate(campaign.createdAt)}</span>
        </div>
        
        <div className="card-body">
          {/* Se la campagna è attiva o non è in fase di voto, mostra la barra di progresso */}
          {!isPending && !isReadyForExecution && (
            <div className="mb-4">
              <div className="progress mb-2" style={{ height: '25px' }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${progressPercentage}%` }}
                  aria-valuenow={progressPercentage}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  {progressPercentage.toFixed(0)}%
                </div>
              </div>
              
              <div className="d-flex justify-content-between mb-4">
                <div>
                  <h5>{campaign.raisedAmount} DNT raccolti</h5>
                  <p className="text-muted">su {campaign.goalAmount} DNT</p>
                </div>
                <div>
                  <h5>{campaign.donorsCount} donatori</h5>
                  <p className="text-muted">hanno contribuito</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="mb-4">
            <h4>Descrizione</h4>
            <p>{campaign.description}</p>
            <hr />
            <p className="text-muted">{campaign.detailedDescription}</p>
          </div>
          
          <div className="mb-4">
            <h4>Informazioni</h4>
            <div>
              <p><strong>Beneficiario:</strong> {campaign.beneficiary}</p>
              <p><strong>Indirizzo campagna:</strong> {campaign.address}</p>
              <p><strong>Stato:</strong> {
                isReadyForExecution ? "Pronta per finalizzazione" : 
                (isPending ? "In attesa di approvazione" : 
                (campaign.active ? "Attiva" : "Inattiva"))
              }</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Pannello di votazione (solo se la campagna è in fase di approvazione) */}
      {isPending && (
        <VotingPanel proposal={proposal} campaignAddress={campaignAddress} />
      )}
      
      {/* Milestones (mostrate sempre) */}
      <div className="card mb-4">
        <div className="card-body">
          <MilestonesList 
            milestones={milestones} 
            campaignAddress={campaignAddress}
            isLoading={milestonesLoading}
          />
        </div>
      </div>
      
      {/* Sezione donazioni (nascosta se la campagna è in fase di approvazione o finalizzazione) */}
      {!isPending && !isReadyForExecution && (
        <div className="row">
          <div className="col-md-6 mb-4">
            <div className="card h-100">
              <div className="card-body">
                <h4 className="card-title">Fai una donazione</h4>
                {success && (
                  <div className="alert alert-success">
                    Donazione effettuata con successo! Grazie per il tuo contributo.
                  </div>
                )}
                <DonationForm 
                  onDonate={handleDonation} 
                  isWalletConnected={!!selectedAddress} 
                  isActive={campaign.active}
                  isLoading={donating}
                  campaign={campaign}
                />
              </div>
            </div>
          </div>
          <div className="col-md-6 mb-4">
            <div className="card h-100">
              <div className="card-body">
                <CampaignTransactions transactions={donations} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}