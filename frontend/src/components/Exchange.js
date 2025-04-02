  import React, { useState } from "react";
  import { ethers } from "ethers"; // Libreria per interagire con la blockchain Ethereum

  /**
   * Componente Exchange: Gestisce lo scambio tra ETH e token DNT
   * Permette agli utenti di acquistare o vendere token DNT in cambio di ETH
   * 
   * @param {Function} buyTokens - Funzione per acquistare token con ETH
   * @param {Function} sellTokens - Funzione per vendere token in cambio di ETH
   * @param {BigNumber} ethBalance - Saldo ETH dell'utente
   * @param {BigNumber} dntBalance - Saldo DNT dell'utente
   * @param {number} exchangeRate - Tasso di cambio (quanti DNT per 1 ETH)
   * @param {string} tokenSymbol - Simbolo del token (es. "DNT")
   */
  export function Exchange({ buyTokens, sellTokens, ethBalance, dntBalance, exchangeRate, tokenSymbol }) {
    // Stati locali per gestire il form di scambio
    const [mode, setMode] = useState('buy'); // Modalità: 'buy' per acquisto, 'sell' per vendita
    const [amount, setAmount] = useState(""); // Importo della transazione in formato BigNumber
    const [ethValue, setEthValue] = useState(""); // Valore ETH inserito dall'utente
    const [tokenValue, setTokenValue] = useState(""); // Valore token inserito dall'utente
    
    /**
     * Cambia la modalità di scambio tra acquisto e vendita
     * Resetta tutti i campi del form dopo il cambio
     * @param {string} newMode - Nuova modalità ('buy' o 'sell')
     */
    const handleModeChange = (newMode) => {
      setMode(newMode);
      setAmount("");
      setEthValue("");
      setTokenValue("");
    };
    
    /**
     * Gestisce l'input del valore ETH nella modalità acquisto
     * Calcola automaticamente i token che l'utente riceverà
     * @param {Event} e - Evento input change
     */
    const handleEthInput = (e) => {
      const value = e.target.value;
      setEthValue(value);
      if (value && !isNaN(value)) {
        const ethAmount = parseFloat(value);
        const tokenAmount = ethAmount * exchangeRate; // Calcola il valore equivalente in token
        setTokenValue(tokenAmount.toString());
        setAmount(ethers.utils.parseEther(value)); // Converte ETH in wei (formato BigNumber)
      } else {
        setTokenValue("");
        setAmount("");
      }
    };
    
    /**
     * Gestisce l'input del valore token nella modalità vendita
     * Calcola automaticamente gli ETH che l'utente riceverà
     * @param {Event} e - Evento input change
     */
    const handleTokenInput = (e) => {
      const value = e.target.value;
      setTokenValue(value);
      if (value && !isNaN(value)) {
        const tokenAmount = parseFloat(value);
        const ethAmount = tokenAmount / exchangeRate; // Calcola il valore equivalente in ETH
        setEthValue(ethAmount.toFixed(6)); // Arrotonda a 6 decimali
        setAmount(ethers.utils.parseUnits(value, 0)); // Converte il valore in unità token (senza decimali)
      } else {
        setEthValue("");
        setAmount("");
      }
    };
    
    /**
     * Gestisce la sottomissione del form e avvia la transazione di scambio
     * @param {Event} e - Evento form submit
     */
    const handleExchange = (e) => {
      e.preventDefault(); // Previene il refresh della pagina
      if (mode === 'buy') {
        buyTokens(amount); // Chiama la funzione di acquisto token
      } else {
        sellTokens(amount); // Chiama la funzione di vendita token
      }
    };
    
    /**
     * Formatta un saldo ETH (in wei) in formato leggibile con 4 decimali
     * @param {BigNumber} balance - Saldo in wei
     * @return {string} - Saldo formattato
     */
    const formatBalance = (balance) => {
      if (!balance) return "0";
      const formatted = ethers.utils.formatEther(balance); // Converte wei in ETH
      return parseFloat(formatted).toFixed(4); // Formatta con 4 decimali
    };
    
    // Renderizzazione dell'interfaccia utente
    return (
      <div>
        <h3 className="mb-4">Token Exchange</h3>
        
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
            <p className="mb-0">{formatBalance(ethBalance)} ETH</p>
            <p>{dntBalance?.toString()} {tokenSymbol}</p>
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
                  step="0.000001" // Permette incrementi molto piccoli
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
                  placeholder="0"
                  value={tokenValue}
                  onChange={handleTokenInput}
                  required
                />
                <span className="input-group-text">{tokenSymbol}</span>
              </div>
              <small className="form-text text-muted">
                Riceverai circa {ethValue} ETH
              </small>
            </div>
          )}
          
          {/* Pulsante per inviare la transazione */}
          <button 
            type="submit" 
            className={`btn btn-${mode === 'buy' ? 'primary' : 'success'} w-100`}
            disabled={!amount || amount.eq(0)} // Disabilitato se non c'è un importo valido
          >
            {mode === 'buy' ? `Acquista ${tokenSymbol}` : `Vendi ${tokenSymbol}`}
          </button>
        </form>
      </div>
    );
  }