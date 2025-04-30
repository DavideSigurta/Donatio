// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import "./Campaign.sol";

/**
 * @title MilestoneManager
 * @dev Contratto per gestire le milestone delle campagne di raccolta fondi
 */
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
    
    // Totale del target milestone aggiunto per campagna
    mapping(address => uint256) private totalMilestoneTarget;
    
    // Mappa delle autorizzazioni ad interagire con una campagna
    mapping(address => mapping(address => bool)) public authorizedCampaigns;
    
    // Admin del contratto (CampaignFactory)
    address public admin;
    
    // Eventi
    event MilestoneAdded(address indexed campaignAddress, uint256 index, string title, uint256 targetAmount);
    event MilestoneApproved(address indexed campaignAddress, uint256 indexed milestoneIndex, string title, uint256 amount, uint256 timestamp);
    
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
                    currentMilestoneIndex[campaignAddress] = i + 1;
                }
            } else {
                i++;
            }
        }
        
        return true;
    }

    /**
     * @dev Approva una milestone e rilascia automaticamente i fondi (solo admin)
     */
    function approveMilestone(address campaignAddress, uint256 milestoneIndex) external onlyAdmin {
        require(milestoneIndex < milestoneTitles[campaignAddress].length, "Indice milestone non valido");
        require(!milestoneApproved[campaignAddress][milestoneIndex], "Milestone gia' approvata");
        
        // La milestone deve essere completamente finanziata
        require(
            milestoneRaised[campaignAddress][milestoneIndex] >= milestoneTargets[campaignAddress][milestoneIndex], 
            "La milestone non e' stata completamente finanziata"
        );
        
        // Imposta lo stato di approvazione
        milestoneApproved[campaignAddress][milestoneIndex] = true;
        milestoneApprovedAt[campaignAddress][milestoneIndex] = block.timestamp;
        
        // IMPORTANTE: NON segniamo la milestone come fundsReleased qui
        // milestoneFundsReleased[campaignAddress][milestoneIndex] = true; <-- RIMUOVI QUESTA LINEA
        
        // Ottieni una reference al contratto Campaign
        Campaign campaign = Campaign(campaignAddress);
        
        // Chiama withdraw() sulla campaign
        try campaign.withdraw() {
            // Withdraw eseguito con successo
        } catch {
            // Se la chiamata fallisce, l'approvazione rimane valida
            // Il beneficiario potrà sempre chiamare withdraw() manualmente in seguito
        }
        
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
}