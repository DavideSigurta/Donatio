// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import "./Campaign.sol";

/**
 * @title MilestoneManager
 * @dev Contratto per gestire le milestone delle campagne di raccolta fondi
 */
import "hardhat/console.sol";

contract MilestoneManager {
    // Strutture dati per milestone
    mapping(address => string[]) public milestoneTitles;
    mapping(address => string[]) public milestoneDescriptions;
    mapping(address => uint256[]) public milestoneTargets;
    mapping(address => uint256[]) public milestoneRaised;
    mapping(address => bool[]) public milestoneApproved;
    mapping(address => bool[]) public milestoneFundsReleased;
    mapping(address => uint256[]) public milestoneApprovedAt;
    mapping(address => uint256) public currentMilestoneIndex;
    mapping(address => bool) public milestonesInitialized;
    mapping(address => bool[]) public milestoneRejected;
    mapping(address => mapping(uint256 => string)) public rejectionReasons;
    mapping(address => uint256) private totalMilestoneTarget;
    mapping(address => mapping(address => bool)) public authorizedCampaigns;
    mapping(address => mapping(uint256 => string)) public milestoneReports;
    mapping(address => mapping(uint256 => uint256)) public reportSubmissionDeadlines;
    
    // Admin del contratto (CampaignFactory)
    address public admin;

    // Periodo di tempo per la scadenza della submission del report
    uint256 public reportSubmissionPeriod = 5 minutes;
    
    // Eventi
    event MilestoneAdded(address indexed campaignAddress, uint256 index, string title, uint256 targetAmount);
    event MilestoneApproved(address indexed campaignAddress, uint256 indexed milestoneIndex, string title, uint256 amount, uint256 timestamp);
    event MilestoneRejected(address indexed campaignAddress, uint256 indexed milestoneIndex, string title, uint256 amount, string reason, uint256 timestamp);
    event MilestoneReportSubmitted(address indexed campaignAddress, uint256 indexed milestoneIndex, string report, uint256 timestamp);

    constructor() {
        admin = msg.sender;
    }

    
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Solo l'admin puo' eseguire questa azione");
        _;
    }
    
    modifier onlyAuthorized(address campaignAddress) {
        require(
            authorizedCampaigns[campaignAddress][msg.sender] || msg.sender == admin,
            "Non autorizzato per questa campagna"
        );
        _;
    }

    /**
     * @dev Imposta un nuovo admin
     */
    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Indirizzo admin non valido");
        admin = newAdmin;
    }
    
    /**
     * @dev Imposta un indirizzo come autorizzato per una determinata campagna
     */
    function authorizeForCampaign(address campaignAddress, address authorizedAddress) external onlyAdmin {
        authorizedCampaigns[campaignAddress][authorizedAddress] = true;
    }
    
    /**
     * @dev Aggiunge una milestone a una campagna
     */
    function addMilestone(
        address campaignAddress,
        string memory title,
        string memory description,
        uint256 targetAmount
    ) external onlyAuthorized(campaignAddress) {
        require(!milestonesInitialized[campaignAddress], "Milestone gia' finalizzate");
        require(milestoneTitles[campaignAddress].length < 5, "Massimo 5 milestone consentite");
        
        milestoneTitles[campaignAddress].push(title);
        milestoneDescriptions[campaignAddress].push(description);
        milestoneTargets[campaignAddress].push(targetAmount);
        milestoneRaised[campaignAddress].push(0);
        milestoneApproved[campaignAddress].push(false);
        milestoneFundsReleased[campaignAddress].push(false);
        milestoneApprovedAt[campaignAddress].push(0);
        
        totalMilestoneTarget[campaignAddress] += targetAmount;
        
        emit MilestoneAdded(
            campaignAddress, 
            milestoneTitles[campaignAddress].length - 1, 
            title, 
            targetAmount
        );
    }
    
    /**
     * @dev Finalizza tutte le milestone per una campagna
     */
    function finalizeMilestones(address campaignAddress, uint256 campaignGoalAmount) external onlyAuthorized(campaignAddress) {
        require(!milestonesInitialized[campaignAddress], "Milestone gia' finalizzate");
        require(milestoneTitles[campaignAddress].length > 0, "Deve esserci almeno una milestone");
        require(
            totalMilestoneTarget[campaignAddress] == campaignGoalAmount, 
            "La somma degli importi non corrisponde all'obiettivo"
        );
        
        milestonesInitialized[campaignAddress] = true;
        currentMilestoneIndex[campaignAddress] = 0;

        for (uint256 i = 0; i < milestoneTitles[campaignAddress].length; i++) {
            milestoneRejected[campaignAddress].push(false);
        }
        
        milestonesInitialized[campaignAddress] = true;
        currentMilestoneIndex[campaignAddress] = 0;
    }
    
    /**
     * @dev Distribuisce fondi alle milestone di una campagna
     */
    function distributeFundsToMilestones(
    address campaignAddress, 
    uint256 amount
    ) external onlyAuthorized(campaignAddress) returns (bool) {
        require(milestonesInitialized[campaignAddress], "Milestone non finalizzate");
        
        uint256 remainingAmount = amount;
        uint256 i = currentMilestoneIndex[campaignAddress];
        
        while (remainingAmount > 0 && i < milestoneTitles[campaignAddress].length) {
            uint256 milestoneRemaining = milestoneTargets[campaignAddress][i] - milestoneRaised[campaignAddress][i];
            
            if (milestoneRemaining > 0) {
                uint256 amountToAdd = remainingAmount > milestoneRemaining ? 
                                    milestoneRemaining : remainingAmount;
                
                milestoneRaised[campaignAddress][i] += amountToAdd;
                remainingAmount -= amountToAdd;
                
                // Se questa milestone è stata completamente finanziata, passa alla successiva
                if (milestoneRaised[campaignAddress][i] >= milestoneTargets[campaignAddress][i] && 
                    i == currentMilestoneIndex[campaignAddress]) {
                    
                    // Se è la prima milestone (indice 0), approvala automaticamente
                    if (i == 0 && !milestoneApproved[campaignAddress][0]) {
                        milestoneApproved[campaignAddress][0] = true;
                        emit MilestoneApproved(
                            campaignAddress, 
                            0, 
                            milestoneTitles[campaignAddress][0],  // Titolo della milestone
                            milestoneTargets[campaignAddress][0], // Importo target
                            block.timestamp                      // Timestamp corrente
                        );
                    }
                    
                    // Avanza comunque alla milestone successiva
                    currentMilestoneIndex[campaignAddress] = i + 1;
                }
            } else {
                i++;
            }
        }
        
        return (remainingAmount == 0);
    }

    /**
     * @dev Approva una milestone e rilascia automaticamente i fondi 
     */
    function approveMilestone(address campaignAddress, uint256 milestoneIndex) public {
        // Verifica che il chiamante sia autorizzato: admin o governanceSystem
        console.log("=== APPROVE MILESTONE START ===");
        console.log("Campaign:", campaignAddress);
        console.log("Milestone index:", milestoneIndex);
        console.log("Caller:", msg.sender);
        
        // Verifica che il chiamante sia autorizzato
        address govSystem = Campaign(campaignAddress).governanceSystem();
        console.log("Expected governance system:", govSystem);
        console.log("Admin address:", admin);
        
        bool isGovSystem = msg.sender == govSystem;
        bool isAdmin = msg.sender == admin;
        console.log("Is governance system:", isGovSystem);
        console.log("Is admin:", isAdmin);
        
        require(isGovSystem || isAdmin, "Non autorizzato solo governance o admin possono approvare");
        
        console.log("Authorization passed, continuing with approval");
    
        require(milestoneIndex < milestoneTitles[campaignAddress].length, "Indice milestone non valido");
        require(!milestoneApproved[campaignAddress][milestoneIndex], "Milestone gia' approvata");
        
        // La milestone deve essere completamente finanziata
        require(
            milestoneRaised[campaignAddress][milestoneIndex] >= milestoneTargets[campaignAddress][milestoneIndex], 
            "La milestone non e' stata completamente finanziata"
        );
        
        if (milestoneIndex > 0) {
            require(
                milestoneApproved[campaignAddress][milestoneIndex - 1],
                "Devi prima approvare la milestone precedente"
            );
            
            require(
                bytes(milestoneReports[campaignAddress][milestoneIndex - 1]).length > 0,
                "E' richiesto un report per la milestone precedente"
            );
        }

        // Imposta lo stato di approvazione
        milestoneApproved[campaignAddress][milestoneIndex] = true;
        milestoneApprovedAt[campaignAddress][milestoneIndex] = block.timestamp;
        
        emit MilestoneApproved(
            campaignAddress,
            milestoneIndex, 
            milestoneTitles[campaignAddress][milestoneIndex], 
            milestoneTargets[campaignAddress][milestoneIndex],
            block.timestamp
        );
    }
    
    /**
     * @dev Segna una milestone come rilasciata e ritorna l'importo
     */
    function releaseMilestoneFunds(address campaignAddress, uint256 milestoneIndex) external onlyAuthorized(campaignAddress) returns (uint256) {
        require(milestoneIndex < milestoneTitles[campaignAddress].length, "Indice milestone non valido");
        require(milestoneApproved[campaignAddress][milestoneIndex], "Milestone non approvata");
        require(!milestoneFundsReleased[campaignAddress][milestoneIndex], "Fondi gia' rilasciati");
        
        uint256 amount = milestoneRaised[campaignAddress][milestoneIndex];
        milestoneFundsReleased[campaignAddress][milestoneIndex] = true;
        
        return amount;
    }
    
    /**
     * @dev Restituisce il numero totale di milestone per una campagna
     */
    function getMilestonesCount(address campaignAddress) external view returns (uint256) {
        return milestoneTitles[campaignAddress].length;
    }
    
    /**
     * @dev Ottiene dettagli di una milestone specifica
     */
    function getMilestone(address campaignAddress, uint256 index) external view returns (
        string memory title,
        string memory description,
        uint256 targetAmount,
        uint256 raisedAmount,
        bool approved,
        bool fundsReleased
    ) {
        require(index < milestoneTitles[campaignAddress].length, "Indice non valido");
        return (
            milestoneTitles[campaignAddress][index],
            milestoneDescriptions[campaignAddress][index],
            milestoneTargets[campaignAddress][index],
            milestoneRaised[campaignAddress][index],
            milestoneApproved[campaignAddress][index],
            milestoneFundsReleased[campaignAddress][index]
        );
    }
    
    /**
     * @dev Verifica se una milestone è pronta per il rilascio dei fondi
     */
    function isMilestoneReadyForRelease(address campaignAddress, uint256 index) external view returns (bool) {
        return milestoneApproved[campaignAddress][index] && !milestoneFundsReleased[campaignAddress][index];
    }
    
    /**
     * @dev Calcola il totale dei fondi disponibili per il rilascio
     */
    function getAvailableFundsToRelease(address campaignAddress) external view returns (uint256) {
        uint256 totalAvailable = 0;
        
        for (uint256 i = 0; i < milestoneTitles[campaignAddress].length; i++) {
            if (milestoneApproved[campaignAddress][i] && !milestoneFundsReleased[campaignAddress][i]) {
                totalAvailable += milestoneRaised[campaignAddress][i];
            }
        }
        
        return totalAvailable;
    }
    /**
     * @dev Rifiuta una milestone e avvia il rimborso dei fondi 
     */
    function rejectMilestone(address campaignAddress, uint256 milestoneIndex, string memory reason) public {
        // Verifica che il chiamante sia autorizzato: admin o governanceSystem
        console.log("=== REJECT MILESTONE START ===");
        console.log("Campaign:", campaignAddress);
        console.log("Milestone index:", milestoneIndex);
        console.log("Caller:", msg.sender);
        
        // Verifica che il chiamante sia autorizzato
        address govSystem = Campaign(campaignAddress).governanceSystem();
        console.log("Expected governance system:", govSystem);
        console.log("Admin address:", admin);
        
        bool isGovSystem = msg.sender == govSystem;
        bool isAdmin = msg.sender == admin;
        console.log("Is governance system:", isGovSystem);
        console.log("Is admin:", isAdmin);
        
        require(isGovSystem || isAdmin, "Non autorizzato solo governance o admin possono approvare");
        
        console.log("Authorization passed, continuing with rejecting");
        
        require(milestoneIndex < milestoneTitles[campaignAddress].length, "Indice milestone non valido");
        require(!milestoneApproved[campaignAddress][milestoneIndex], "Milestone gia' approvata");
        require(!milestoneRejected[campaignAddress][milestoneIndex], "Milestone gia' rifiutata");
        
        // La milestone deve essere almeno parzialmente finanziata
        require(
            milestoneRaised[campaignAddress][milestoneIndex] > 0, 
            "La milestone non ha fondi da rimborsare"
        );
        
        // Imposta lo stato di rifiuto
        milestoneRejected[campaignAddress][milestoneIndex] = true;
        rejectionReasons[campaignAddress][milestoneIndex] = reason;
        
        // Ottieni una reference al contratto Campaign
        Campaign campaign = Campaign(campaignAddress);
        
        // Disattiva la campagna
        try campaign.setActive(false) {
            // Campagna disattivata con successo
        } catch {
            // Se fallisce, continuiamo comunque con il rimborso
        }
        
        emit MilestoneRejected(
            campaignAddress,
            milestoneIndex, 
            milestoneTitles[campaignAddress][milestoneIndex],
            milestoneRaised[campaignAddress][milestoneIndex],
            reason,
            block.timestamp
        );
    }

    /**
    * @dev Esegue il rimborso per una milestone rifiutata (solo admin o governance)
    * @param campaignAddress Indirizzo della campagna
    * @param milestoneIndex Indice della milestone rifiutata
    */
    function adminRefundMilestone(address campaignAddress, uint256 milestoneIndex) external {
        // Solo l'admin o il sistema di governance possono chiamare questa funzione
        require(
            msg.sender == admin || msg.sender == Campaign(campaignAddress).governanceSystem(),
            "Solo admin o governance possono eseguire questa operazione"
        );
        
        // Verifica che la milestone sia stata effettivamente rifiutata
        require(milestoneRejected[campaignAddress][milestoneIndex], "La milestone non e' stata rifiutata");
        
        // Ottieni una reference al contratto Campaign
        Campaign campaign = Campaign(campaignAddress);
        
        // Esegui il rimborso
        campaign.refundDonors(milestoneIndex);
    }

    /**
     * @dev Sottomette un report per una milestone
     * @param campaignAddress Indirizzo della campagna
     * @param milestoneIndex Indice della milestone
     * @param report Testo del report
     */
    function submitMilestoneReport(address campaignAddress, uint256 milestoneIndex, string memory report) external {
        // Solo il beneficiario della campagna può inviare report
        Campaign campaign = Campaign(campaignAddress);
        require(msg.sender == campaign.beneficiary(), "Solo il beneficiario puo' inviare report");
        
        // Verifica che la milestone esista
        require(milestoneIndex < milestoneTitles[campaignAddress].length, "Indice milestone non valido");
        
        // Verifica che la milestone sia completamente finanziata
        uint256 raisedAmount = milestoneRaised[campaignAddress][milestoneIndex];
        uint256 targetAmount = milestoneTargets[campaignAddress][milestoneIndex];
        require(raisedAmount >= targetAmount, "La milestone non e' completamente finanziata");
        
        require(milestoneFundsReleased[campaignAddress][milestoneIndex], "I fondi devono essere rilasciati prima di inviare il report");
        
        // Verifica che la milestone non sia rifiutata
        require(!milestoneRejected[campaignAddress][milestoneIndex], "Milestone gia' rifiutata");
        
        // Verifica che il report non sia già stato inviato
        require(bytes(milestoneReports[campaignAddress][milestoneIndex]).length == 0, "Report gia' inviato");
        
        // Se non è la prima milestone, verifica che la precedente sia stata approvata
        if (milestoneIndex > 0) {
            require(milestoneApproved[campaignAddress][milestoneIndex - 1], "La milestone precedente deve essere approvata prima");
        }
        
        // Salva il report e imposta la deadline per la votazione
        milestoneReports[campaignAddress][milestoneIndex] = report;
        reportSubmissionDeadlines[campaignAddress][milestoneIndex] = block.timestamp + reportSubmissionPeriod;
        
        // Emetti un evento per il report inviato
        emit MilestoneReportSubmitted(campaignAddress, milestoneIndex, report, block.timestamp);
    }

    /**
     * @dev Ottiene il report di una milestone
     * @param campaignAddress Indirizzo della campagna
     * @param milestoneIndex Indice della milestone
     * @return Il report della milestone
     */
    function getMilestoneReport(address campaignAddress, uint256 milestoneIndex) external view returns (string memory) {
        require(milestoneIndex < milestoneTitles[campaignAddress].length, "Indice milestone non valido");
        return milestoneReports[campaignAddress][milestoneIndex];
    }

    /**
     * @dev Ottiene la deadline per la sottomissione del report di una milestone
     * @param campaignAddress Indirizzo della campagna
     * @param milestoneIndex Indice della milestone
     * @return La deadline per la sottomissione del report
     */
    function getReportSubmissionDeadline(address campaignAddress, uint256 milestoneIndex) external view returns (uint256) {
        require(milestoneIndex < milestoneTitles[campaignAddress].length, "Indice milestone non valido");
        return reportSubmissionDeadlines[campaignAddress][milestoneIndex];
    }

    /**
     * @dev Verifica se una milestone è pronta per la votazione
     * @param campaignAddress Indirizzo della campagna
     * @param milestoneIndex Indice della milestone
     * @return true se la milestone è pronta per la votazione
     */
    function isMilestoneReadyForVoting(address campaignAddress, uint256 milestoneIndex) external view returns (bool) {
        // La milestone deve esistere
        if (milestoneIndex >= milestoneTitles[campaignAddress].length) return false;
        
        // La milestone deve essere completamente finanziata
        uint256 raisedAmount = milestoneRaised[campaignAddress][milestoneIndex];
        uint256 targetAmount = milestoneTargets[campaignAddress][milestoneIndex];
        if (raisedAmount < targetAmount) return false;
        
        // La milestone non deve essere già approvata o rifiutata
        if (milestoneApproved[campaignAddress][milestoneIndex]) return false;
        if (milestoneRejected[campaignAddress][milestoneIndex]) return false;
        
        // Se è la milestone 0, è sempre pronta per il voto (anche se verrà approvata automaticamente)
        if (milestoneIndex == 0) return true;
        
        // Per le milestone successive alla prima:
        // 1. La milestone precedente deve essere approvata
        // 2. La milestone precedente deve avere un report
        bool previousApproved = milestoneIndex > 0 ? 
            milestoneApproved[campaignAddress][milestoneIndex - 1] : true;
        bool previousHasReport = milestoneIndex > 0 ? 
            bytes(milestoneReports[campaignAddress][milestoneIndex - 1]).length > 0 : true;
        
        return previousApproved && previousHasReport;
    }

    /**
     * @dev Verifica se una milestone è stata rifiutata
     */
    function isMilestoneRejected(address campaignAddress, uint256 index) external view returns (bool) {
        if (index >= milestoneTitles[campaignAddress].length) return false;
        return milestoneRejected[campaignAddress][index];
    }

    /**
     * @dev Ottiene la motivazione del rifiuto di una milestone
     */
    function getRejectionReason(address campaignAddress, uint256 index) external view returns (string memory) {
        require(index < milestoneTitles[campaignAddress].length, "Indice non valido");
        require(milestoneRejected[campaignAddress][index], "Milestone non rifiutata");
        return rejectionReasons[campaignAddress][index];
    }
}