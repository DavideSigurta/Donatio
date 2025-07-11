import axios from "axios"; //axios per le richieste http
import imageCompression from "browser-image-compression"; //compressione immagine
import FormData from "form-data"; //upload image

/**
* Servizio per gestire il caricamento e la visualizzazione delle immagini su IPFS tramite Pinata
*/
class IPFSService {
    constructor() {
        this.apiKey = process.env.REACT_APP_PINATA_API_KEY;
        this.apiSecret = process.env.REACT_APP_PINATA_API_SECRET;
        this.jwt = process.env.REACT_APP_PINATA_JWT;
        this.gateway = process.env.REACT_APP_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
        
        // Controllo iniziale delle configurazioni
        this.checkConfiguration();
    }
    
    /**
     * Verifica che le configurazioni necessarie siano presenti
     */
    checkConfiguration() {
        if (!this.jwt) {
            console.warn("IPFS Service: JWT Pinata non configurato. Le funzionalità di upload non saranno disponibili.");
        }
        if (!this.gateway) {
            console.warn("IPFS Service: Gateway non configurato. Verrà utilizzato il gateway pubblico.");
        }
    }
    
    /**
    * Configura gli header per le richieste a Pinata
    * @returns {Object} - Header per le richieste API
    */
    getHeaders() {
        return {
            headers: {
                Authorization: `Bearer ${this.jwt}`,
            },
        };
    }
    
    /**
    * Comprime un'immagine prima di caricarla su IPFS
    * @param {File} imageFile - File immagine da comprimere
    * @returns {Promise<File>} - File immagine compresso
    */
    async compressImage(imageFile) {
        try {
            // Opzioni di compressione
            const options = {
                maxSizeMB: 1,           // Massima dimensione in MB
                maxWidthOrHeight: 1920, // Massima larghezza/altezza
                useWebWorker: true,     // Usa WebWorker per operazioni in background
                initialQuality: 0.85,   // Qualità iniziale (0-1)
            };
            
            // Comprimi l'immagine
            const compressedFile = await imageCompression(imageFile, options);
            
            // Crea un nuovo File dall'immagine compressa
            return new File([compressedFile], imageFile.name, {
                type: compressedFile.type,
            });
        } catch (error) {
            console.error("Errore nella compressione dell'immagine:", error);
            // Se fallisce la compressione, ritorna il file originale
            return imageFile;
        }
    }
    
    /**
    * Carica un'immagine su IPFS tramite Pinata
    * @param {File} imageFile - File immagine da caricare
    * @param {String} name - Nome dell'immagine (es. nome campagna)
    * @returns {Promise<String>} - CID dell'immagine caricata
    */
    async uploadImage(imageFile, name) {
        try {
            // Comprimi l'immagine prima del caricamento
            const compressedImage = await this.compressImage(imageFile);
            
            // Prepara il form data per l'upload multipart
            const formData = new FormData();
            formData.append("file", compressedImage);
            
            // Aggiungi metadati per identificare meglio il file
            const metadata = JSON.stringify({
                name: `${name}-${Date.now()}`,
                keyvalues: {
                    app: "Donatio",
                    type: "campaign-image",
                    timestamp: Date.now().toString()
                }
            });
            formData.append("pinataMetadata", metadata);
            
            // Configurazioni opzionali di pinning
            const pinataOptions = JSON.stringify({
                cidVersion: 1,
                wrapWithDirectory: false
            });
            formData.append("pinataOptions", pinataOptions);
            
            // Effettua la richiesta di caricamento
            const response = await axios.post(
                "https://api.pinata.cloud/pinning/pinFileToIPFS",
                formData,
                {
                    maxBodyLength: "Infinity",
                    headers: {
                        "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
                        Authorization: `Bearer ${this.jwt}`
                    }
                }
            );
            
            // Ritorna il CID (Content Identifier) dell'immagine caricata
            return response.data.IpfsHash;
        } catch (error) {
            console.error("Errore nel caricamento dell'immagine su IPFS:", error);
            throw new Error("Impossibile caricare l'immagine. Riprova più tardi.");
        }
    }
    
    /**
    * Carica più immagini su IPFS in parallelo
    * @param {File[]} imageFiles - Array di file immagine
    * @param {String} baseName - Nome base per le immagini
    * @returns {Promise<String[]>} - Array di CID delle immagini caricate
    */
    async uploadMultipleImages(imageFiles, baseName) {
        try {
            const uploadPromises = imageFiles.map((file, index) => 
                this.uploadImage(file, `${baseName}-${index+1}`)
        );
        
        // Attendi che tutte le immagini siano caricate
        const cids = await Promise.all(uploadPromises);
        return cids;
    } catch (error) {
        console.error("Errore nel caricamento multiplo di immagini:", error);
        throw new Error("Impossibile caricare alcune immagini. Riprova più tardi.");
    }
}

/**
* Genera un URL completo per visualizzare un'immagine da IPFS
* @param {String} cid - Content Identifier dell'immagine
* @returns {String} - URL completo dell'immagine
*/
getImageUrl(cid) {
    if (!cid) return null;
    return `${this.gateway}${cid}`;
}

/**
* Verifica se un'immagine è disponibile su IPFS
* @param {String} cid - Content Identifier dell'immagine
* @returns {Promise<Boolean>} - true se l'immagine è accessibile
*/
async checkImageAvailability(cid) {
    if (!cid) return false;
    
    try {
        const response = await axios.head(`${this.gateway}${cid}`, { timeout: 5000 });
        return response.status === 200;
    } catch (error) {
        console.warn(`Immagine ${cid} non disponibile:`, error.message);
        return false;
    }
}

/**
* Carica dati JSON su IPFS
* @param {Object} jsonData - Dati JSON da caricare
* @param {String} name - Nome del file JSON
* @returns {Promise<String>} - CID del file JSON
*/
async uploadJSON(jsonData, name) {
    try {
        const response = await axios.post(
            "https://api.pinata.cloud/pinning/pinJSONToIPFS",
            {
                pinataContent: jsonData,
                pinataMetadata: {
                    name: `${name}-metadata-${Date.now()}`
                }
            },
            this.getHeaders()
        );
        
        return response.data.IpfsHash;
    } catch (error) {
        console.error("Errore nel caricamento JSON su IPFS:", error);
        throw new Error("Impossibile caricare i metadati. Riprova più tardi.");
    }
}
}

export const ipfsService = new IPFSService();