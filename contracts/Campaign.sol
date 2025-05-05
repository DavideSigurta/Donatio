// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import "./Token.sol";
import "./TransactionRegistry.sol";
import "./MilestoneManager.sol";
import "hardhat/console.sol";

/**
 * @title Campaign
 * @dev Contratto per gestire una singola campagna di raccolta fondi con token DNT
 */
contract Campaign {
    // Struttura per rappresentare una donazione
    struct Donation {
        address donor;      // Indirizzo del donatore
        uint256 amount;     // Importo in token DNT
        string message;     // Messaggio opzionale
        uint256 timestamp;  // Timestamp della donazione
    }

    struct MilestoneDonation {
        uint256 donationIndex;       // Indice della donazione nell'array donations
        uint256 amountContributed;   // Importo contribuito a questa milestone
    }
    
    // Dati della campagna
    string public title;                // Titolo della campagna
    string public description;          // Descrizione breve
    string public detailedDescription;  // Descrizione estesa
    address public beneficiary;         // Indirizzo che riceverà i fondi raccolti
    address public creator;             // Creatore della campagna
    uint256 public goalAmount;          // Obiettivo in token DNT
    uint256 public raisedAmount;        // Totale raccolto finora
    uint256 public createdAt;           // Timestamp di creazione
    bool public active;                 // Stato attivo/inattivo

    // Immagini IPFS
    string public mainImageCID;         // CID dell'immagine principale
    string[] public additionalImagesCIDs;  // CIDs di immagini aggiuntive
    
    // Token DNT
    Token public dntToken;             // Riferimento al contratto Token DNT
    
    // Array di tutte le donazioni ricevute
    Donation[] public donations;
    
    // Conteggio donatori unici
    mapping(address => bool) private donors;
    uint256 public donorsCount;
    
    // Factory che ha creato questa campagna
    address public factory;

    // Registro delle transazioni
    TransactionRegistry public transactionRegistry;
    
    // Milestone Manager
    MilestoneManager public milestoneManager;
    
    // Flag per indicare che le milestone sono state impostate
    bool public milestonesConfigured;

    // Mappa per tenere traccia delle donazioni per ogni milestone
    mapping(uint256 => MilestoneDonation[]) public milestoneDonations;

    // Traccia quanti fondi non sono stati ancora rimborsati per milestone
    mapping(uint256 => uint256) public milestoneAvailableFunds;

    // Eventi
    event DonationReceived(address indexed donor, uint256 amount, string message, uint256 timestamp);
    event FundsWithdrawn(address indexed beneficiary, uint256 amount);
    event CampaignUpdated(string title, string description, bool active);
    event ImagesUpdated(string mainImageCID, uint256 additionalImagesCount);
    
    // Modificatori per controllare gli accessi
    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary, "Solo il beneficiario puo' eseguire questa azione");
        _;
    }
    
    modifier onlyCreator() {
        require(msg.sender == creator, "Solo il creatore puo' eseguire questa azione");
        _;
    }
    
    modifier onlyFactoryOrCreator() {
        require(msg.sender == factory || msg.sender == creator, "Autorizzazione negata");
        _;
    }
    
    modifier isActive() {
        require(active, "La campagna non e' attiva");
        _;
    }

    modifier onlyBeneficiaryOrMilestoneManager() {
    require(
        msg.sender == beneficiary || msg.sender == address(milestoneManager),
        "Solo il beneficiario o il MilestoneManager possono eseguire questa azione"
    );
    _;
}
    
    /**
     * @dev Costruttore che inizializza la campagna
     */
    constructor(
        string memory _title,
        string memory _description,
        string memory _detailedDescription,
        address _beneficiary,
        uint256 _goalAmount,
        address _dntToken,
        address _registryAddress,
        address _milestoneManager
    ) {
        require(_beneficiary != address(0), "Indirizzo beneficiario non valido");
        require(_goalAmount > 0, "L'obiettivo deve essere maggiore di zero");
        require(_dntToken != address(0), "Indirizzo token non valido");
        require(_milestoneManager != address(0), "Indirizzo milestone manager non valido");
        
        title = _title;
        description = _description;
        detailedDescription = _detailedDescription;
        beneficiary = _beneficiary;
        goalAmount = _goalAmount;
        creator = msg.sender;
        factory = msg.sender; // La factory è il deployer iniziale
        active = true;
        createdAt = block.timestamp;
        dntToken = Token(_dntToken);
        transactionRegistry = TransactionRegistry(_registryAddress);
        milestoneManager = MilestoneManager(_milestoneManager);
        
        milestonesConfigured = false;
    }
    
    /**
     * @dev Imposta l'immagine principale e le immagini aggiuntive
     */
    function setImages(string memory _mainImageCID, string[] memory _additionalImagesCIDs) external {
        require(msg.sender == factory, "Solo la factory puo' impostare le immagini");
        
        mainImageCID = _mainImageCID;
        
        for (uint256 i = 0; i < _additionalImagesCIDs.length; i++) {
            additionalImagesCIDs.push(_additionalImagesCIDs[i]);
        }
    }

    /**
     * @dev Segna le milestone come configurate
     */
    function setMilestonesConfigured() external {
        require(msg.sender == factory, "Solo la factory puo' configurare le milestone");
        milestonesConfigured = true;
    }
    
    /**
     * @dev Riceve una donazione in token DNT
     */
    function donate(uint256 _amount, string memory _message) external isActive {
        require(_amount > 0, "L'importo deve essere maggiore di zero");
        require(raisedAmount + _amount <= goalAmount, "La donazione supererebbe l'obiettivo della campagna");
        require(milestonesConfigured, "Le milestone non sono ancora state configurate");
        
        // Trasferisci i token
        _transferTokens(_amount);

        uint256 donationIndex = donations.length;

        // Distribuisci la donazione alle milestone attraverso il MilestoneManager
        uint256 remainingAmount = _amount;
        uint256 i = milestoneManager.currentMilestoneIndex(address(this));

        while (remainingAmount > 0 && i < milestoneManager.getMilestonesCount(address(this))) {
        // Ottieni i dettagli della milestone
            (,, uint256 targetAmount, uint256 raisedMilestoneAmount,,) = milestoneManager.getMilestone(address(this), i);
            uint256 milestoneRemaining = targetAmount - raisedMilestoneAmount;
            
            if (milestoneRemaining > 0) {
                uint256 amountToAdd = remainingAmount > milestoneRemaining ? 
                                    milestoneRemaining : remainingAmount;
                
                // Registra questa parte della donazione per la milestone
                milestoneDonations[i].push(MilestoneDonation({
                    donationIndex: donationIndex,
                    amountContributed: amountToAdd
                }));
                
                // Aggiorna il totale disponibile per la milestone
                milestoneAvailableFunds[i] += amountToAdd;
                
                remainingAmount -= amountToAdd;
            }
            
            i++;
        }
        
        // Distribuisci la donazione alle milestone attraverso il MilestoneManager
        bool success = milestoneManager.distributeFundsToMilestones(address(this), _amount);
        require(success, "Distribuzione fondi alle milestone fallita");
        
        // Aggiorna i contatori dei donatori
        _updateDonorStats();
        
        // Registra la donazione
        _recordDonation(_amount, _message);
    }

    /**
     * @dev Rimborsa i donatori di una milestone rifiutata e tutte le milestone successive
     * @param rejectedMilestoneIndex Indice della milestone rifiutata
     */
    function refundDonors(uint256 rejectedMilestoneIndex) external {
        // Solo il MilestoneManager può chiamare questa funzione
        require(
            msg.sender == address(milestoneManager),
            "Solo il MilestoneManager puo' chiamare questa funzione"
        );
        
        // Verifica che la milestone sia stata effettivamente rifiutata
        require(
            milestoneManager.isMilestoneRejected(address(this), rejectedMilestoneIndex),
            "La milestone non e' stata rifiutata"
        );
        
        // Conta il numero totale di milestone
        uint256 milestonesCount = milestoneManager.getMilestonesCount(address(this));
        
        // Per ogni milestone a partire da quella rifiutata fino all'ultima
        for (uint256 i = rejectedMilestoneIndex; i < milestonesCount; i++) {
            // Ottieni l'importo totale da rimborsare per questa milestone
            uint256 totalToRefund = milestoneAvailableFunds[i];
            
            if (totalToRefund > 0) {
                // Reset dei fondi disponibili
                milestoneAvailableFunds[i] = 0;
                
                // Processa ogni donazione associata a questa milestone
                for (uint256 j = 0; j < milestoneDonations[i].length; j++) {
                    MilestoneDonation memory donation = milestoneDonations[i][j];
                    
                    address donor = donations[donation.donationIndex].donor;
                    uint256 refundAmount = donation.amountContributed;
                    
                    if (refundAmount > 0) {
                        // Trasferisci i token al donatore
                        bool success = dntToken.transfer(donor, refundAmount);
                        require(success, "Rimborso fallito");
                        
                        // Registra la transazione di rimborso
                        transactionRegistry.recordTransaction(
                            donor,
                            TransactionRegistry.TransactionType.MILESTONE_REFUND,
                            refundAmount,
                            0
                        );
                    }
                }
            }
        }
    }
    
    function _transferTokens(uint256 _amount) private {
        require(
            dntToken.allowance(msg.sender, address(this)) >= _amount,
            "Autorizzazione token insufficiente"
        );
        
        bool success = dntToken.transferFrom(msg.sender, address(this), _amount);
        require(success, "Trasferimento token fallito");
        
        raisedAmount += _amount;
    }
    
    function _updateDonorStats() private {
        if (!donors[msg.sender]) {
            donors[msg.sender] = true;
            donorsCount++;
        }
    }
    
    function _recordDonation(uint256 _amount, string memory _message) private {
        donations.push(Donation({
            donor: msg.sender,
            amount: _amount,
            message: _message,
            timestamp: block.timestamp
        }));
        
        transactionRegistry.recordTransaction(
            msg.sender,
            TransactionRegistry.TransactionType.DONATION,
            _amount,
            0
        );
        
        emit DonationReceived(msg.sender, _amount, _message, block.timestamp);
    }
        
    /**
     * @dev Permette al beneficiario di prelevare i fondi dalle milestone approvate
     */
    function withdraw() external onlyBeneficiaryOrMilestoneManager {
        uint256 totalAvailable = milestoneManager.getAvailableFundsToRelease(address(this));
        require(totalAvailable > 0, "Nessun fondo disponibile da milestone approvate");
        
        // Rilascia ciascuna milestone pronta
        uint256 milestonesCount = milestoneManager.getMilestonesCount(address(this));
        for (uint256 i = 0; i < milestonesCount; i++) {
            if (milestoneManager.isMilestoneReadyForRelease(address(this), i)) {
                milestoneManager.releaseMilestoneFunds(address(this), i);
            }
        }
        
        // Trasferisci i token al beneficiario
        bool success = dntToken.transfer(beneficiary, totalAvailable);
        require(success, "Trasferimento token fallito");
        
        // Registra la transazione per il beneficiario
        transactionRegistry.recordTransaction(
            beneficiary,
            TransactionRegistry.TransactionType.MILESTONE_RELEASE,
            totalAvailable,
            0
        );
        
        emit FundsWithdrawn(beneficiary, totalAvailable);
    }
    
    /**
     * @dev Aggiorna i dettagli della campagna
     */
    function updateDetails(
        string memory _title,
        string memory _description,
        string memory _detailedDescription
    ) external onlyCreator {
        title = _title;
        description = _description;
        detailedDescription = _detailedDescription;
        
        emit CampaignUpdated(title, description, active);
    }
    
    /**
     * @dev Cambia lo stato attivo/inattivo della campagna
     */
    function setActive(bool _active) external {
        require(
            msg.sender == factory || 
            msg.sender == creator || 
            msg.sender == address(milestoneManager),
            "Solo il factory, creator o milestone manager possono modificare lo stato"
        );
        active = _active;
        emit CampaignUpdated(title, description, active);
    }
    /**
     * @dev Restituisce il numero totale di donazioni
     */
    function getDonationsCount() external view returns (uint256) {
        return donations.length;
    }
    
    /**
     * @dev Ottiene una donazione specifica per indice
     */
    function getDonation(uint256 _index) external view returns (
        address donor,
        uint256 amount,
        string memory message,
        uint256 timestamp
    ) {
        require(_index < donations.length, "Indice non valido");
        Donation memory donation = donations[_index];
        return (donation.donor, donation.amount, donation.message, donation.timestamp);
    }
    
    /**
     * @dev Permette alla factory di impostare se stessa dopo il deployment
     */
    function setFactory(address _factory) external {
        require(
            factory == msg.sender || factory == address(0),
            "Factory gia' impostata"
        );
        factory = _factory;
    }

    /**
     * @dev Aggiorna le immagini della campagna
     */
    function updateImages(
        string memory _mainImageCID,
        string[] memory _additionalImagesCIDs
    ) external onlyCreator {
        mainImageCID = _mainImageCID;
        
        // Cancella l'array esistente
        delete additionalImagesCIDs;
        
        // Copia il nuovo array
        for (uint256 i = 0; i < _additionalImagesCIDs.length; i++) {
            additionalImagesCIDs.push(_additionalImagesCIDs[i]);
        }
        
        emit ImagesUpdated(mainImageCID, _additionalImagesCIDs.length);
    }

    /**
     * @dev Restituisce il numero di immagini aggiuntive
     */
    function getAdditionalImagesCount() external view returns (uint256) {
        return additionalImagesCIDs.length;
    }
    
    /**
     * @dev Restituisce l'elenco completo dei CID delle immagini aggiuntive
     */
    function getAllAdditionalImagesCIDs() external view returns (string[] memory) {
        return additionalImagesCIDs;
    }
}