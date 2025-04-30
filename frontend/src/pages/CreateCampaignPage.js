import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import campaignFactoryService from "../services/CampaignFactoryService";
import { ipfsService } from "../services/ipfsService";
import { ImageUploader } from "../components/common/ImageUploader";
import MilestoneInputs from "../components/campaigns/MilestoneInputs";

// Definisci i limiti di caratteri
const TITLE_LIMIT = 50;
const DESCRIPTION_LIMIT = 100;
const DETAILED_DESCRIPTION_LIMIT = 700;

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const { selectedAddress, isAuthorizedCreator } = useWeb3();
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    detailedDescription: "",
    beneficiary: "",
    goalAmount: "",
  });
  
  // Aggiungiamo lo stato per le immagini
  const [campaignImages, setCampaignImages] = useState([]);
  const [imageError, setImageError] = useState(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Aggiungiamo lo stato per le milestone
  const [milestones, setMilestones] = useState([
    { title: '', description: '', targetAmount: '' }
  ]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };
  
  // Gestione del caricamento immagini
  const handleImagesChange = (images) => {
    setCampaignImages(images);
    setImageError(null); // Reset eventuali errori precedenti
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsCreating(true);
      setError(null);

      // Verifica che la somma delle milestone sia uguale al goalAmount
      const totalMilestoneAmount = milestones.reduce(
        (sum, milestone) => sum + parseFloat(milestone.targetAmount || 0),
        0
      );
      
      if (Math.abs(totalMilestoneAmount - parseFloat(formData.goalAmount)) > 0.001) {
        setError("La somma degli importi delle milestone deve essere uguale all'obiettivo totale.");
        setIsCreating(false);
        return;
      }
      
      // Prima carica le immagini su IPFS, se presenti
      let mainImageCID = "";
      let additionalImagesCIDs = [];
      
      if (campaignImages.length > 0) {
        try {
          setIsUploadingImages(true);
          
          // Carica l'immagine principale (la prima)
          const mainImage = campaignImages[0];
          mainImageCID = await ipfsService.uploadImage(mainImage, `campaign-main-${Date.now()}`);
          
          // Carica eventuali immagini aggiuntive
          if (campaignImages.length > 1) {
            const additionalImages = campaignImages.slice(1);
            const baseName = `campaign-additional-${Date.now()}`;
            additionalImagesCIDs = await ipfsService.uploadMultipleImages(additionalImages, baseName);
          }
          
          setIsUploadingImages(false);
        } catch (imgError) {
          console.error("Errore nel caricamento delle immagini:", imgError);
          setImageError(`Errore nel caricamento delle immagini: ${imgError.message}`);
          setIsCreating(false);
          setIsUploadingImages(false);
          return;
        }
      }
      
      // Prepara gli array per i dati delle milestone
      const milestoneTitles = milestones.map(m => m.title);
      const milestoneDescriptions = milestones.map(m => m.description);
      const milestoneTargetAmounts = milestones.map(m => m.targetAmount);
      
      // Ora crea la campagna con i CID delle immagini e i dati delle milestone
      const result = await campaignFactoryService.createCampaign({
        ...formData,
        mainImageCID,
        additionalImagesCIDs,
        milestoneTitles,
        milestoneDescriptions,
        milestoneTargetAmounts
      });
      
      console.log("Campagna creata:", result);
      
      // Reindirizza alla pagina della nuova campagna
      navigate(`/campaigns/${result.campaignAddress}`);
      
    } catch (err) {
      console.error("Errore nella creazione della campagna:", err);
      setError(err.message || "Si è verificato un errore durante la creazione della campagna.");
    } finally {
      setIsCreating(false);
    }
  };
  
  // Se l'utente non è autorizzato, mostra un messaggio
  if (!isAuthorizedCreator) {
    return (
      <div className="container mt-4">
        <div className="card shadow">
          <div className="card-body p-4 text-center">
            <h3>Accesso non autorizzato</h3>
            <p>Non sei autorizzato a creare campagne. Contatta l'amministratore.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mt-4">
      <div className="card shadow">
        <div className="card-header bg-light">
          <h3 className="mb-0">Crea una nuova campagna</h3>
        </div>
        <div className="card-body p-4">
          <form onSubmit={handleSubmit}>
            {/* Uploader di immagini - Aggiunto prima del titolo */}
            <ImageUploader onImagesChange={handleImagesChange} maxImages={5} />
            {imageError && <div className="alert alert-danger">{imageError}</div>}
            
            <div className="mb-3">
              <label htmlFor="title" className="form-label">
                Titolo della campagna *
                <span className="text-muted ms-2">
                  ({formData.title.length}/{TITLE_LIMIT} caratteri)
                </span>
              </label>
              <input
                type="text"
                className="form-control"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                maxLength={TITLE_LIMIT}
                required
              />
              <small className="form-text text-muted">
                Un titolo conciso e chiaro (massimo {TITLE_LIMIT} caratteri)
              </small>
            </div>
            
            <div className="mb-3">
              <label htmlFor="description" className="form-label">
                Descrizione breve * 
                <span className="text-muted ms-2">
                  ({formData.description.length}/{DESCRIPTION_LIMIT} caratteri)
                </span>
              </label>
              <input
                type="text"
                className="form-control"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                maxLength={DESCRIPTION_LIMIT}
                required
              />
              <small className="form-text text-muted">
                Una breve descrizione della campagna (massimo {DESCRIPTION_LIMIT} caratteri)
              </small>
            </div>
            
            <div className="mb-3">
              <label htmlFor="detailedDescription" className="form-label">
                Descrizione dettagliata * 
                <span className="text-muted ms-2">
                  ({formData.detailedDescription.length}/{DETAILED_DESCRIPTION_LIMIT} caratteri)
                </span>
              </label>
              <textarea
                className="form-control"
                id="detailedDescription"
                name="detailedDescription"
                value={formData.detailedDescription}
                onChange={handleChange}
                rows="6"
                maxLength={DETAILED_DESCRIPTION_LIMIT}
                required
              />
              <small className="form-text text-muted">
                Una descrizione più dettagliata della campagna (massimo {DETAILED_DESCRIPTION_LIMIT} caratteri)
              </small>
            </div>
            
            <div className="mb-3">
              <label htmlFor="goalAmount" className="form-label">Obiettivo in DNT *</label>
              <input
                type="number"
                className="form-control"
                id="goalAmount"
                name="goalAmount"
                value={formData.goalAmount}
                onChange={handleChange}
                step="0.01"
                min="1"
                required
              />
            </div>
            
            {formData.goalAmount && (
              <MilestoneInputs 
                milestones={milestones} 
                setMilestones={setMilestones} 
                goalAmount={parseFloat(formData.goalAmount) || 0}
              />
            )}
            <div className="d-flex justify-content-between mt-4">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => navigate("/campaigns")}
              >
                Annulla
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCreating || isUploadingImages}
              > 
                {isCreating || isUploadingImages ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {isUploadingImages ? "Caricamento immagini..." : "Creazione campagna..."}
                  </>
                ) : (
                  "Crea Campagna"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}