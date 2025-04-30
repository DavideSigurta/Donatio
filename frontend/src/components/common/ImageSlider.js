import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Componente slider minimalista con solo frecce di navigazione
 */
export function ImageSlider({ images, placeholderImage }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayImages, setDisplayImages] = useState([]);

  // Inizializza le immagini
  useEffect(() => {
    if (!images || images.length === 0) {
      setDisplayImages([placeholderImage]);
    } else {
      setDisplayImages(images);
    }
  }, [images, placeholderImage]);

  // Gestisce l'immagine precedente
  const handlePrevClick = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex > 0 ? prevIndex - 1 : displayImages.length - 1
    );
  };

  // Gestisce l'immagine successiva
  const handleNextClick = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex < displayImages.length - 1 ? prevIndex + 1 : 0
    );
  };

  // Gestisce errori di caricamento immagini
  const handleImageError = () => {
    if (displayImages[currentIndex] !== placeholderImage) {
      const newImages = [...displayImages];
      newImages[currentIndex] = placeholderImage;
      setDisplayImages(newImages);
    }
  };

  return (
    <div style={{ position: 'relative', height: '400px', marginBottom: '20px' }}>
      {/* Immagine corrente */}
      <img
        src={displayImages[currentIndex]}
        alt="Immagine campagna"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}
        onError={handleImageError}
      />
      
      {/* Mostra le frecce solo se ci sono più immagini */}
      {displayImages.length > 1 && (
        <>
          {/* Freccia sinistra */}
          <div 
            onClick={handlePrevClick}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '2rem',
              color: 'white',
              textShadow: '0 0 5px rgba(0,0,0,0.7)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            &#10094;
          </div>
          
          {/* Freccia destra */}
          <div 
            onClick={handleNextClick}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '2rem',
              color: 'white',
              textShadow: '0 0 5px rgba(0,0,0,0.7)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            &#10095;
          </div>
        </>
      )}
    </div>
  );
}

ImageSlider.propTypes = {
  images: PropTypes.arrayOf(PropTypes.string),
  placeholderImage: PropTypes.string.isRequired
};

ImageSlider.defaultProps = {
  images: [],
  placeholderImage: '/donazione_placeholder.png'
};