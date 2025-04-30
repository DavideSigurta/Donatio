// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

/**
 * @title CreatorRequestManager
 * @dev Contratto per gestire le richieste di autorizzazione come creatore di campagne
 */
contract CreatorRequestManager {
    // Struttura per le richieste di autorizzazione come creatore
    struct CreatorRequest {
        address applicant;         // Indirizzo che ha fatto richiesta
        string description;        // Descrizione del progetto/motivazione
        uint256 timestamp;         // Timestamp della richiesta
        bool processed;            // Se la richiesta è stata processata
        bool approved;             // Se la richiesta è stata approvata
    }
    
    // Indirizzo del proprietario (admin)
    address public owner;
    
    // Indirizzo della factory
    address public campaignFactory;
    
    // Mappatura delle richieste per indirizzo
    mapping(address => CreatorRequest) public creatorRequests;
    
    // Array degli indirizzi con richieste in attesa
    address[] public pendingRequests;
    
    // Mappatura degli indirizzi autorizzati
    mapping(address => bool) public authorizedCreators;
    
    // Eventi
    event CreatorRequestSubmitted(address indexed applicant, string description);
    event CreatorRequestProcessed(address indexed applicant, bool approved);
    event CreatorAuthorized(address indexed creator, bool status);
    
    // Modificatori
    modifier onlyOwner() {
        require(msg.sender == owner, "Solo l'owner puo' eseguire questa azione");
        _;
    }
    
    modifier noExistingRequest() {
        require(creatorRequests[msg.sender].applicant == address(0) || 
                creatorRequests[msg.sender].processed == true, 
                "Hai gia' una richiesta in attesa");
        _;
    }
    
    modifier notAuthorizedYet() {
        require(!authorizedCreators[msg.sender] && msg.sender != owner, 
                "Sei gia' autorizzato a creare campagne");
        _;
    }
    
    /**
     * @dev Costruttore che inizializza il gestore delle richieste
     */
    constructor() {
        owner = msg.sender;
        // L'owner è sempre autorizzato
        authorizedCreators[msg.sender] = true;
    }
    
    /**
     * @dev Imposta l'indirizzo della factory (può essere chiamato solo una volta)
     * @param _campaignFactory Indirizzo della factory di campagne
     */
    function setCampaignFactory(address _campaignFactory) external onlyOwner {
        require(campaignFactory == address(0), "L'indirizzo della factory e' gia' impostato");
        require(_campaignFactory != address(0), "Indirizzo factory non valido");
        campaignFactory = _campaignFactory;
    }
    
    /**
     * @dev Invia una richiesta per diventare creatore autorizzato
     * @param _description Descrizione del progetto/motivazione
     */
    function submitCreatorRequest(string memory _description) external noExistingRequest notAuthorizedYet {
        require(bytes(_description).length > 0, "La descrizione non puo' essere vuota");
        
        creatorRequests[msg.sender] = CreatorRequest({
            applicant: msg.sender,
            description: _description,
            timestamp: block.timestamp,
            processed: false,
            approved: false
        });
        
        pendingRequests.push(msg.sender);
        
        emit CreatorRequestSubmitted(msg.sender, _description);
    }
    
    /**
     * @dev Approva una richiesta di autorizzazione come creatore
     * @param _applicant Indirizzo del richiedente
     */
    function approveCreatorRequest(address _applicant) external onlyOwner {
        CreatorRequest storage request = creatorRequests[_applicant];
        
        require(request.applicant != address(0), "Richiesta non trovata");
        require(!request.processed, "Richiesta gia' processata");
        
        request.processed = true;
        request.approved = true;
        
        // Autorizza il creatore
        authorizedCreators[_applicant] = true;
        
        // Rimuovi dalla lista delle richieste pendenti
        _removePendingRequest(_applicant);
        
        emit CreatorRequestProcessed(_applicant, true);
        emit CreatorAuthorized(_applicant, true);
    }
    
    /**
     * @dev Rifiuta una richiesta di autorizzazione come creatore
     * @param _applicant Indirizzo del richiedente
     */
    function rejectCreatorRequest(address _applicant) external onlyOwner {
        CreatorRequest storage request = creatorRequests[_applicant];
        
        require(request.applicant != address(0), "Richiesta non trovata");
        require(!request.processed, "Richiesta gia' processata");
        
        request.processed = true;
        request.approved = false;
        
        // Rimuovi dalla lista delle richieste pendenti
        _removePendingRequest(_applicant);
        
        emit CreatorRequestProcessed(_applicant, false);
    }
    
    /**
     * @dev Funzione interna per rimuovere un indirizzo dalla lista delle richieste pendenti
     * @param _applicant Indirizzo del richiedente
     */
    function _removePendingRequest(address _applicant) internal {
        for (uint i = 0; i < pendingRequests.length; i++) {
            if (pendingRequests[i] == _applicant) {
                // Sposta l'ultimo elemento al posto di quello da rimuovere
                pendingRequests[i] = pendingRequests[pendingRequests.length - 1];
                // Rimuovi l'ultimo elemento
                pendingRequests.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Restituisce il numero di richieste pendenti
     */
    function getPendingRequestsCount() external view returns (uint256) {
        return pendingRequests.length;
    }
    
    /**
     * @dev Restituisce una richiesta pendente all'indice specificato
     * @param _index Indice della richiesta
     */
    function getPendingRequestAtIndex(uint256 _index) external view returns (
        address applicant,
        string memory description,
        uint256 timestamp
    ) {
        require(_index < pendingRequests.length, "Indice non valido");
        
        address requestAddress = pendingRequests[_index];
        CreatorRequest storage request = creatorRequests[requestAddress];
        
        return (
            request.applicant,
            request.description,
            request.timestamp
        );
    }
    
    /**
     * @dev Restituisce i dettagli di una richiesta per un indirizzo specifico
     * @param _applicant Indirizzo del richiedente
     */
    function getCreatorRequest(address _applicant) external view returns (
        address applicant,
        string memory description,
        uint256 timestamp,
        bool processed,
        bool approved
    ) {
        CreatorRequest storage request = creatorRequests[_applicant];
        
        return (
            request.applicant,
            request.description,
            request.timestamp,
            request.processed,
            request.approved
        );
    }
    
    /**
     * @dev Autorizza o revoca l'autorizzazione a un creatore
     * @param _creator Indirizzo del creatore
     * @param _status Nuovo stato di autorizzazione
     */
    function authorizeCreator(address _creator, bool _status) external onlyOwner {
        authorizedCreators[_creator] = _status;
        emit CreatorAuthorized(_creator, _status);
    }
    
    /**
     * @dev Verifica se un indirizzo è autorizzato a creare campagne
     * @param _address Indirizzo da verificare
     */
    function isAuthorizedCreator(address _address) external view returns (bool) {
        return authorizedCreators[_address] || _address == owner;
    }
}