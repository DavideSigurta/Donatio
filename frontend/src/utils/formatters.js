import { ethers } from "ethers";

/**
 * Formatta un valore ETH (gestisce qualsiasi formato di input)
 * @param {BigNumber|string|number} value - Valore ETH da formattare
 * @param {number} decimals - Numero di decimali da mostrare
 * @returns {string} - Valore formattato (es. "1.2345")
 */
export function formatEtherValue(value, decimals = 4) {
    if (!value) return "0";
    
    try {
        // Caso 1: BigNumber diretto da contract (convertire con formatEther)
        if (ethers.BigNumber.isBigNumber(value)) {
            const formatted = ethers.utils.formatEther(value);
            return parseFloat(formatted).toFixed(decimals);
        }
        
        // Caso 2: Stringa già formattata (da Web3Service.getEthBalance)
        if (typeof value === 'string') {
            return parseFloat(value).toFixed(decimals);
        }
        
        // Caso 3: Numero normale
        if (typeof value === 'number') {
            return value.toFixed(decimals);
        }
        
        return "0";
    } catch (error) {
        console.error("Errore nella formattazione ETH:", error, value);
        return "0";
    }
}

/**
 * Formatta un valore token (ora trattato come ETH con 18 decimali)
 * @param {BigNumber|string|number} value - Valore token da formattare
 * @param {boolean} withDecimals - Se mostrare i decimali o meno
 * @param {number} decimalsToShow - Numero di decimali da mostrare se withDecimals=true
 * @returns {string} - Valore formattato
 */
export function formatTokenValue(value, withDecimals = false, decimalsToShow = 2) {
    if (!value) return "0";
    
    try {
        // Caso 1: BigNumber diretto da contract - Ora usiamo formatEther
        if (ethers.BigNumber.isBigNumber(value)) {
            const formatted = ethers.utils.formatEther(value);
            return withDecimals ? parseFloat(formatted).toFixed(decimalsToShow) : formatted;
        }
        
        // Caso 2: Stringa già formattata
        if (typeof value === 'string') {
            return withDecimals ? parseFloat(value).toFixed(decimalsToShow) : value;
        }
        
        // Caso 3: Numero normale
        if (typeof value === 'number') {
            return withDecimals ? value.toFixed(decimalsToShow) : String(value);
        }
        
        return "0";
    } catch (error) {
        console.error("Errore nella formattazione token:", error, value);
        return "0";
    }
}

/**
 * Converte un input utente in un BigNumber sicuro per operazioni blockchain
 * @param {string|number} value - Valore inserito dall'utente
 * @param {boolean} isEther - Se il valore è ETH (true) o Token (false)
 * @returns {BigNumber} - BigNumber utilizzabile per transazioni
 */
export function parseSafeValue(value, isEther = true) {
    if (!value) return ethers.constants.Zero;
    
    try {
        // Pulisci l'input e rimuovi spazi
        const cleanValue = String(value).trim();
        
        // Ora usiamo parseEther per entrambi ETH e token
        return ethers.utils.parseEther(cleanValue);
    } catch (error) {
        console.error("Errore nel parsing del valore:", error, value);
        return ethers.constants.Zero;
    }
}

/**
 * Formatta un timestamp Unix in data e ora leggibile
 * @param {number} timestamp - Timestamp UNIX
 * @returns {string} - Data formattata (es. "30/04/2023, 15:30:45")
 */
/**
 * Formatta una data da timestamp o formato ISO a formato leggibile italiano
 * @param {number|string} timestamp - Timestamp o data
 * @returns {string} Data formattata
 */
export function formatDate(timestamp) {
    if (!timestamp) return 'Data non disponibile';
    
    try {
      let date;
      
      // Se è una stringa che rappresenta un numero, convertiamo in numero
      if (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) {
        timestamp = Number(timestamp);
      }
      
      // Se è un BigInt, convertiamolo in un numero standard
      if (typeof timestamp === 'bigint') {
        timestamp = Number(timestamp);
      }
      
      // Verifica lunghezza del timestamp - se è in secondi (tipico della blockchain)
      // dobbiamo convertirlo in millisecondi
      if (typeof timestamp === 'number') {
        // Se il timestamp è in secondi (lunghezza ~10 cifre), moltiplica per 1000
        if (timestamp < 10000000000) {
          date = new Date(timestamp * 1000);
        } else {
          date = new Date(timestamp); // già in millisecondi
        }
      } else {
        // Prova a interpretarlo come stringa di data
        date = new Date(timestamp);
      }
      
      // Verifica che la data sia valida
      if (isNaN(date.getTime())) {
        console.error('Data non valida:', timestamp);
        return 'Data non valida';
      }
      
      // Formato italiano: giorno/mese/anno, ore:minuti
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Errore nella formattazione della data:', error);
      return 'Data non disponibile';
    }
  }

/**
 * Abbrevia un indirizzo Ethereum
 * @param {string} address - Indirizzo completo
 * @param {number} startChars - Numero di caratteri da mostrare all'inizio
 * @param {number} endChars - Numero di caratteri da mostrare alla fine
 * @returns {string} - Indirizzo abbreviato (es. "0xabc...def")
 */
export function shortenAddress(address, startChars = 6, endChars = 4) {
    if (!address) return '';
    
    if (address.length <= startChars + endChars + 3) {
        return address;
    }
    
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}

/**
 * Determina se una transazione è un acquisto, vendita o deposito
 * @param {boolean} isBuy - Flag dal contratto
 * @param {BigNumber|string|number} tokenAmount - Quantità di token
 * @returns {string} - Tipo di transazione ("buy", "sell", o "deposit")
 */
export function getTransactionType(isBuy, tokenAmount) {
    // Se è un acquisto ma la quantità di token è 0, è un deposito
    if (isBuy) {
        if (tokenAmount && (
            (ethers.BigNumber.isBigNumber(tokenAmount) && tokenAmount.eq(0)) ||
            tokenAmount === "0" ||
            tokenAmount === 0
        )) {
            return "deposit";
        }
        return "buy";
    }
    return "sell";
}

/**
 * Verifica se un importo supera il saldo disponibile
 * @param {string|number} amount - Importo da verificare
 * @param {string|BigNumber} balance - Saldo disponibile nel wallet
 * @returns {boolean} - True se l'importo supera il saldo, false altrimenti
 */
export function isAmountExceedingBalance(amount, balance) {
  // Se non c'è importo o non c'è saldo, non può essere un problema
  if (!amount) return false;
  
  try {
    // Converti l'importo in un numero per il confronto
    const numAmount = parseFloat(String(amount).trim());
    
    // Se l'importo non è un numero valido o è zero/negativo, non può eccedere
    if (isNaN(numAmount) || numAmount <= 0) return false;
    
    // Gestione sicura del saldo: converti sempre in numero per confronto
    let balanceNum;
    
    // Se è già una stringa (come nel nostro caso)
    if (typeof balance === 'string') {
      balanceNum = parseFloat(balance);
    } 
    // Se è un BigNumber (caso alternativo)
    else if (balance && ethers.BigNumber && ethers.BigNumber.isBigNumber && ethers.BigNumber.isBigNumber(balance)) {
      if (balance.isZero()) return true; // Caso speciale: saldo zero
      balanceNum = parseFloat(ethers.utils.formatEther(balance));
    } 
    // Fallback: prova a convertire direttamente
    else if (balance) {
      balanceNum = parseFloat(String(balance));
    } 
    // Se non c'è saldo definito, assumiamo 0
    else {
      balanceNum = 0;
    }
    
    // Verifica validità del numero ottenuto
    if (isNaN(balanceNum)) {
      console.error("Balance non valido:", balance);
      return true; // Meglio prevenire
    }
    
    // Semplice confronto numerico
    return numAmount > balanceNum;
  } catch (error) {
    console.error("Errore nel confronto degli importi:", error, "Valore:", amount, "Saldo:", balance);
    return true; // Per sicurezza, blocca la transazione
  }
}

/**
 * Verifica se un importo di donazione supera il limite rimanente della campagna
 * @param {string|number} amount - Importo da verificare
 * @param {object} campaign - Oggetto campagna con goalAmount e raisedAmount
 * @returns {boolean} - True se l'importo supera il limite rimanente, false altrimenti
 */
export function isAmountExceedingCampaignLimit(amount, campaign) {
  // Se non c'è importo o non c'è campagna, non può essere un problema
  if (!amount || !campaign) return false;
  
  try {
    // Converti l'importo in un numero per il confronto
    const numAmount = parseFloat(String(amount).trim());
    
    // Se l'importo non è un numero valido o è zero/negativo, non può eccedere
    if (isNaN(numAmount) || numAmount <= 0) return false;
    
    // Gestione sicura dei valori goalAmount e raisedAmount
    let goalNum = 0;
    let raisedNum = 0;
    
    // Gestione del goalAmount
    if (campaign.goalAmount) {
      if (ethers.BigNumber.isBigNumber(campaign.goalAmount)) {
        goalNum = parseFloat(ethers.utils.formatEther(campaign.goalAmount));
      } else if (typeof campaign.goalAmount === 'string') {
        goalNum = parseFloat(campaign.goalAmount);
      } else if (typeof campaign.goalAmount === 'number') {
        goalNum = campaign.goalAmount;
      }
    }
    
    // Gestione del raisedAmount
    if (campaign.raisedAmount) {
      if (ethers.BigNumber.isBigNumber(campaign.raisedAmount)) {
        raisedNum = parseFloat(ethers.utils.formatEther(campaign.raisedAmount));
      } else if (typeof campaign.raisedAmount === 'string') {
        raisedNum = parseFloat(campaign.raisedAmount);
      } else if (typeof campaign.raisedAmount === 'number') {
        raisedNum = campaign.raisedAmount;
      }
    }
    
    // Verifica validità dei numeri ottenuti
    if (isNaN(goalNum) || isNaN(raisedNum)) {
      console.error("Goal o raised non validi:", campaign.goalAmount, campaign.raisedAmount);
      return true; // Per sicurezza, blocca la donazione
    }
    
    // Calcola il massimo donabile e confronta
    const maxDonatable = goalNum - raisedNum;
    return numAmount > maxDonatable;
  } catch (error) {
    console.error("Errore nel confronto dei limiti di donazione:", error, "Valore:", amount, "Campagna:", campaign);
    return true; // Per sicurezza, blocca la donazione
  }
}