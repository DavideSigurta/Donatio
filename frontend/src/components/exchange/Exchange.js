import React, { useState, useEffect } from "react";
import { useWeb3 } from "../../contexts/Web3Context";
import { formatEtherValue, formatTokenValue, isAmountExceedingBalance } from "../../utils/formatters";

/**
 * Componente Exchange: Gestisce lo scambio tra ETH e token DNT
 * Utilizza il Web3Context per accedere ai dati e le funzioni di formattazione universali
 */
export function Exchange() {
  // Accedi direttamente al context invece di ricevere props
  const { 
    buyTokens, 
    sellTokens, 
    ethBalance, 
    balance: dntBalance, 
    exchangeRate, 
    tokenData
  } = useWeb3();
  
  const tokenSymbol = tokenData?.symbol || "DNT";
  
  // Stati locali per gestire il form di scambio
  const [mode, setMode] = useState('buy');
  const [amount, setAmount] = useState("");
  const [ethValue, setEthValue] = useState("");
  const [tokenValue, setTokenValue] = useState("");
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  
  // Funzioni di gestione del form
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setAmount("");
    setEthValue("");
    setTokenValue("");
    setInsufficientBalance(false);
  };
  
  // Verifica il saldo in base alla modalità selezionata
  const checkBalance = (value) => {
    if (!value) {
      setInsufficientBalance(false);
      return;
    }
    
    if (mode === 'buy') {
      // Per acquisti, verifica se l'ETH inserito supera il saldo ETH
      const hasInsufficientBalance = isAmountExceedingBalance(value, ethBalance);
      setInsufficientBalance(hasInsufficientBalance);
    } else {
      // Per vendite, verifica se i token inseriti superano il saldo DNT
      const hasInsufficientBalance = isAmountExceedingBalance(value, dntBalance);
      setInsufficientBalance(hasInsufficientBalance);
    }
  };
  
  const handleEthInput = (e) => {
    const value = e.target.value;
    setEthValue(value);
    if (value && !isNaN(value)) {
      const ethAmount = parseFloat(value);
      const tokenAmount = ethAmount * exchangeRate;
      setTokenValue(tokenAmount.toString());
      setAmount(value);
      
      // Verifica il saldo
      checkBalance(value);
    } else {
      setTokenValue("");
      setAmount("");
      setInsufficientBalance(false);
    }
  };
  
  const handleTokenInput = (e) => {
    const value = e.target.value;
    setTokenValue(value);
    if (value && !isNaN(value)) {
      const tokenAmount = parseFloat(value);
      const ethAmount = tokenAmount / exchangeRate;
      setEthValue(ethAmount.toFixed(6));
      setAmount(value);
      
      // Verifica il saldo
      checkBalance(value);
    } else {
      setEthValue("");
      setAmount("");
      setInsufficientBalance(false);
    }
  };
  
  const handleExchange = (e) => {
    e.preventDefault();
    if (mode === 'buy') {
      buyTokens(amount);
      setAmount("");
      setTokenValue("0.0");
      setEthValue("");
    } else {
      sellTokens(amount);
      setAmount("");
      setEthValue("0.0");
      setTokenValue("");
    }
    setInsufficientBalance(false);
  };
  
  // Verifica il saldo quando cambiano ethBalance o dntBalance
  useEffect(() => {
    if (amount) {
      checkBalance(amount);
    }
  }, [mode, ethBalance, dntBalance]);
  
  return (
    <div>
      <div className="card shadow">
        <div className="card-body p-4">
          
          {/* Tabs per selezionare la modalità di scambio */}
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button 
                className={`nav-link ${mode === 'buy' ? 'active' : ''}`}
                onClick={() => handleModeChange('buy')}
              >
                Acquista {tokenSymbol}
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`nav-link ${mode === 'sell' ? 'active' : ''}`}
                onClick={() => handleModeChange('sell')}
              >
                Vendi {tokenSymbol}
              </button>
            </li>
          </ul>
          
          {/* Visualizzazione saldi utente e tasso di cambio */}
          <div className="row mb-3">
            <div className="col">
              <small className="text-muted d-block">Il tuo saldo</small>
              <p className="mb-0">{formatEtherValue(ethBalance)} ETH</p>
              <p>{formatTokenValue(dntBalance)} {tokenSymbol}</p>
            </div>
            <div className="col text-end">
              <small className="text-muted d-block">Tasso di cambio</small>
              <p className="mb-0">1 ETH = {exchangeRate} {tokenSymbol}</p>
            </div>
          </div>
          
          {/* Form di scambio che cambia in base alla modalità */}
          <form onSubmit={handleExchange}>
            {mode === 'buy' ? (
              /* Form di acquisto token con ETH */
              <div className="form-group mb-3">
                <label htmlFor="ethAmount">Quantità di ETH da scambiare</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    type="number"
                    step="0.000001"
                    id="ethAmount"
                    placeholder="0.0"
                    value={ethValue}
                    onChange={handleEthInput}
                    required
                  />
                  <span className="input-group-text">ETH</span>
                </div>
                <small className="form-text text-muted">
                  Riceverai circa {tokenValue} {tokenSymbol}
                </small>
                {insufficientBalance && (
                  <small className="text-danger mt-1">
                    Saldo ETH insufficiente per completare questa operazione.
                  </small>
                )}
              </div>
            ) : (
              /* Form di vendita token per ETH */
              <div className="form-group mb-3">
                <label htmlFor="tokenAmount">Quantità di {tokenSymbol} da vendere</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    type="number"
                    id="tokenAmount"
                    placeholder="0.0"
                    value={tokenValue}
                    onChange={handleTokenInput}
                    required
                  />
                  <span className="input-group-text">{tokenSymbol}</span>
                </div>
                <small className="form-text text-muted">
                  Riceverai circa {ethValue} ETH
                </small>
                {insufficientBalance && (
                  <small className="text-danger mt-1">
                    Saldo {tokenSymbol} insufficiente per completare questa operazione.
                  </small>
                )}
              </div>
            )}
            
            {/* Pulsante per inviare la transazione */}
            <button 
              type="submit" 
              className={`btn btn-primary w-100`}
              disabled={!amount || amount === "0" || insufficientBalance}
            >
              {mode === 'buy' ? `Acquista ${tokenSymbol}` : `Vendi ${tokenSymbol}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}