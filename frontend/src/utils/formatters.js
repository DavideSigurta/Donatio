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
export function formatDate(timestamp) {
    if (!timestamp) return "Data sconosciuta";
    
    try {
        const date = new Date(Number(timestamp) * 1000);
        return date.toLocaleString();
    } catch (error) {
        console.error("Errore nella formattazione data:", error, timestamp);
        return "Data sconosciuta";
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