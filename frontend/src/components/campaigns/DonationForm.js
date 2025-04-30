import React, { useState } from "react";
import PropTypes from "prop-types";
import { useWeb3 } from "../../contexts/Web3Context";
import { ethers } from "ethers";
import { isAmountExceedingBalance, isAmountExceedingCampaignLimit, formatEtherValue } from "../../utils/formatters";

/**
 * Componente che gestisce il form per effettuare donazioni
 */
export function DonationForm({ onDonate, isWalletConnected, isActive, isLoading, campaign }) {
  const [donationAmount, setDonationAmount] = useState("");
  const [message, setMessage] = useState("");
  const [messageLength, setMessageLength] = useState(0);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  const [exceedsMaxDonation, setExceedsMaxDonation] = useState(false);
  
  // Accedi al contesto Web3 per ottenere il saldo
  const { balance } = useWeb3();
  
  // Calcola il massimo donabile (per visualizzazione)
  const maxDonationAmount = campaign ? calculateMaxDonationAmount(campaign) : "0";

  // Funzione di supporto per calcolare il massimo donabile
  function calculateMaxDonationAmount(campaign) {
    try {
      // Converti i valori in numeri floating point
      const goalValue = typeof campaign.goalAmount === 'string' 
        ? parseFloat(campaign.goalAmount) 
        : parseFloat(ethers.utils.formatEther(campaign.goalAmount));
      
      const raisedValue = typeof campaign.raisedAmount === 'string' 
        ? parseFloat(campaign.raisedAmount) 
        : parseFloat(ethers.utils.formatEther(campaign.raisedAmount));
      
      // Calcola la differenza
      const maxValue = Math.max(0, goalValue - raisedValue);
      
      // Formatta con il numero corretto di decimali
      return maxValue.toFixed(4);
    } catch (err) {
      console.error("Errore nel calcolo della donazione massima:", err);
      return "0";
    }
  }
  
  // Limite massimo di caratteri per il messaggio
  const MAX_MESSAGE_LENGTH = 100;
  
  const handleDonationChange = (e) => {
    const newAmount = e.target.value;
    setDonationAmount(newAmount);
    
    // Verifica il saldo con il nuovo valore inserito
    const hasInsufficientBalance = isAmountExceedingBalance(newAmount, balance);
    setInsufficientBalance(hasInsufficientBalance);
    
    // Verifica il limite massimo della campagna
    const exceedsLimit = isAmountExceedingCampaignLimit(newAmount, campaign);
    setExceedsMaxDonation(exceedsLimit);
  };
  
  const handleMessageChange = (e) => {
    const newMessage = e.target.value;
    if (newMessage.length <= MAX_MESSAGE_LENGTH) {
      setMessage(newMessage);
      setMessageLength(newMessage.length);
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (donationAmount && 
        parseFloat(donationAmount) > 0 && 
        !insufficientBalance && 
        !exceedsMaxDonation) {
      onDonate(donationAmount, message);
      setDonationAmount("");
      setMessage("");
      setMessageLength(0);
    }
  };
  
  if (!isWalletConnected) {
    return (
      <div className="alert alert-warning">
        Per fare una donazione devi prima connettere il tuo wallet.
      </div>
    );
  }
  
  if (!isActive) {
    return (
      <div className="alert alert-danger">
        Questa campagna non è più attiva e non accetta donazioni.
      </div>
    );
  }
  
  // Se la campagna ha raggiunto l'obiettivo
  if (parseFloat(maxDonationAmount) <= 0) {
    return (
      <div className="alert alert-success">
        Questa campagna ha raggiunto l'obiettivo! Grazie a tutti i donatori.
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="donationAmount" className="form-label">Importo in DNT</label>
        <div className="input-group">
          <input
            type="number"
            className="form-control"
            id="donationAmount"
            value={donationAmount}
            onChange={handleDonationChange}
            placeholder="0.0"
            step="0.01"
            min="0.01"
            required
          />
          <span className="input-group-text">DNT</span>
        </div>
        {insufficientBalance && (
          <small className="text-danger d-block mt-1">
            Saldo insufficiente. Il tuo saldo attuale è {balance} DNT.
          </small>
        )}
        {exceedsMaxDonation && (
          <small className="text-danger d-block mt-1">
            Donazione massima: {maxDonationAmount} DNT
          </small>
        )}
      </div>
      
      <div className="mb-3">
        <label htmlFor="donationMessage" className="form-label">
          Messaggio (opzionale)
          <small className="text-muted ms-2">
            {messageLength}/{MAX_MESSAGE_LENGTH}
          </small>
        </label>
        <textarea
          className="form-control"
          id="donationMessage"
          value={message}
          onChange={handleMessageChange}
          placeholder="Scrivi un messaggio di supporto (opzionale)"
          rows="2"
          maxLength={MAX_MESSAGE_LENGTH}
          style={{ resize: "none" }}
        />
      </div>
      
      <button 
        type="submit" 
        className="btn btn-primary"
        disabled={
          !donationAmount || 
          parseFloat(donationAmount) <= 0 || 
          isLoading || 
          insufficientBalance || 
          exceedsMaxDonation
        }
      >
        {isLoading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Donazione in corso...
          </>
        ) : (
          "Dona ora"
        )}
      </button>
    </form>
  );
}

DonationForm.propTypes = {
  onDonate: PropTypes.func.isRequired,
  isWalletConnected: PropTypes.bool.isRequired,
  isActive: PropTypes.bool,
  isLoading: PropTypes.bool,
  campaign: PropTypes.object.isRequired
};

DonationForm.defaultProps = {
  isActive: true,
  isLoading: false
};