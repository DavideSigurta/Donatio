import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';

/**
 * Componente che gestisce l'upload di immagini per le campagne
 * Utilizza react-dropzone per l'interfaccia di caricamento
 * e browser-image-compression per ottimizzare le immagini
 */
export function ImageUploader({ onImagesChange, maxImages = 5 }) {
  const [imageItems, setImageItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  
  const onDrop = useCallback(async (acceptedFiles) => {
    setError(null);
    
    if (imageItems.length + acceptedFiles.length > maxImages) {
      setError(`Puoi caricare al massimo ${maxImages} immagini.`);
      return;
    }
    
    try {
      setUploading(true);
      
      const newImageItems = await Promise.all(
        acceptedFiles.map(async (file) => {
          if (!file.type.startsWith('image/')) {
            throw new Error(`Il file "${file.name}" non è un'immagine valida.`);
          }
          
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true
          };
          
          const compressedFile = await imageCompression(file, options);
          const previewUrl = URL.createObjectURL(compressedFile);
          
          return {
            file: compressedFile,  // Questa è la chiave importante
            preview: previewUrl,
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
        })
      );
      
      const updatedItems = [...imageItems, ...newImageItems];
      setImageItems(updatedItems);
      
      // CORREZIONE: Passare solo i file come array semplice
      const filesOnly = updatedItems.map(item => item.file);
      onImagesChange(filesOnly);
      
    } catch (err) {
      console.error("Errore nel caricamento delle immagini:", err);
      setError(err.message || "Si è verificato un errore nel caricamento delle immagini.");
    } finally {
      setUploading(false);
    }
  }, [imageItems, maxImages, onImagesChange]);
  
  const removeImage = (index) => {
    // Revoca gli URL oggetto per evitare memory leak
    URL.revokeObjectURL(imageItems[index].preview);
    
    const updatedItems = [...imageItems];
    updatedItems.splice(index, 1);
    setImageItems(updatedItems);
    
    // CORREZIONE: Passare solo i file come array semplice
    const filesOnly = updatedItems.map(item => item.file);
    onImagesChange(filesOnly);
  };
  
  // Pulizia URLs quando componente viene smontato
  useEffect(() => {
    return () => {
      imageItems.forEach(item => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    disabled: uploading || imageItems.length >= maxImages
  });
  
  return (
    <div className="image-uploader mb-4">
      <label className="form-label d-block">Immagini della campagna</label>
      
      <div 
        {...getRootProps()} 
        className={`dropzone p-4 mb-3 text-center border rounded ${
          isDragActive ? 'border-primary bg-light' : 'border-dashed'
        }`}
        style={{ cursor: uploading || imageItems.length >= maxImages ? 'not-allowed' : 'pointer' }}
      >
        <input {...getInputProps()} />
        
        {uploading ? (
          <div className="text-center">
            <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span>Elaborazione immagini...</span>
          </div>
        ) : imageItems.length >= maxImages ? (
          <p className="mb-0 text-muted">Hai raggiunto il limite massimo di {maxImages} immagini.</p>
        ) : (
          <>
            <p className="mb-2">
              {isDragActive ? 
                "Rilascia qui le immagini" : 
                "Trascina qui le immagini o clicca per selezionarle"
              }
            </p>
            <small className="text-muted d-block">
              Formati supportati: JPG, PNG, GIF, WEBP (max 5MB per file)
              <br />
              La prima immagine sarà utilizzata come copertina principale.
            </small>
          </>
        )}
      </div>
      
      {/* Messaggio di errore */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {/* Conteggio immagini */}
      {imageItems.length > 0 && (
        <small className="d-block mb-3 text-muted">
          {imageItems.length}/{maxImages} immagini caricate
        </small>
      )}
      
      {/* Preview delle immagini */}
      {imageItems.length > 0 && (
        <div className="row g-2">
          {imageItems.map((item, index) => (
            <div className="col-4 col-md-3 col-lg-2" key={item.id}>
              <div className="position-relative preview-container">
                <div className="card h-100">
                  {index === 0 && (
                    <span className="position-absolute badge bg-primary text-white" style={{ top: '5px', left: '5px' }}>
                      Principale
                    </span>
                  )}
                  
                  <img 
                    src={item.preview} 
                    alt={`Anteprima ${index + 1}`} 
                    className="card-img-top"
                    style={{ objectFit: 'cover', height: '120px' }}
                  />
                  
                  <button
                    type="button"
                    className="btn btn-sm btn-danger position-absolute"
                    style={{ top: '5px', right: '5px', padding: '0.2rem 0.4rem' }}
                    onClick={() => removeImage(index)}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}