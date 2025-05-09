// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import "./Campaign.sol";
import "./Token.sol";
import "./TransactionRegistry.sol";
import "./CreatorRequestManager.sol";
import "./MilestoneManager.sol";
import "./GovernanceSystem.sol";
import "hardhat/console.sol";

/**
 * @title CampaignFactory
 * @dev Contratto factory per creare e gestire campagne di raccolta fondi
 */
contract CampaignFactory {
    // Token DNT
    Token public dntToken;

    // Indirizzo del proprietario (admin)
    address public owner;

    // Array di tutte le campagne create
    address[] public campaigns;

    // Mappa per tenere traccia delle campagne create da ciascun indirizzo
    mapping(address => address[]) public creatorToCampaigns;

    // Registro delle transazioni
    TransactionRegistry public transactionRegistry;

    // Gestore delle richieste dei creatori
    CreatorRequestManager public requestManager;
    
    // Manager delle milestone
    MilestoneManager public milestoneManager;

    // Indirizzo del contratto di governance
    GovernanceSystem public governanceSystem;

    // Eventi
    event CampaignCreated(address indexed campaignAddress, address indexed creator, string title);

    // Modificatori
    modifier onlyOwner() {
        require(msg.sender == owner, "Solo l'owner puo' eseguire questa azione");
        _;
    }

    modifier onlyAuthorized() {
        require(requestManager.isAuthorizedCreator(msg.sender), "Non autorizzato a creare campagne");
        _;
    }

    /**
     * @dev Costruttore che inizializza la factory
     */
    constructor(
        address _dntTokenAddress, 
        address _registryAddress, 
        address _requestManagerAddress,
        address _milestoneManagerAddress
    ) {
        require(_dntTokenAddress != address(0), "Indirizzo token non valido");
        require(_registryAddress != address(0), "Indirizzo registro transazioni non valido");
        require(_requestManagerAddress != address(0), "Indirizzo gestore richieste non valido");
        require(_milestoneManagerAddress != address(0), "Indirizzo gestore milestone non valido");
        
        owner = msg.sender;
        dntToken = Token(_dntTokenAddress);
        transactionRegistry = TransactionRegistry(_registryAddress);
        requestManager = CreatorRequestManager(_requestManagerAddress);
        milestoneManager = MilestoneManager(_milestoneManagerAddress);
    }
    
    /**
     * @dev Crea una nuova campagna con milestone
     */
    function createCampaign(
        string memory _title,
        string memory _description,
        string memory _detailedDescription,
        address _beneficiary,
        uint256 _goalAmount,
        string memory _mainImageCID,
        string[] memory _additionalImagesCIDs,
        string[] memory _milestoneTitles,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneTargetAmounts
    ) external onlyAuthorized returns (address) {
        // Verifica che gli array delle milestone abbiano la stessa lunghezza
        require(_milestoneTitles.length == _milestoneDescriptions.length &&
                _milestoneTitles.length == _milestoneTargetAmounts.length, 
                "Gli array delle milestone devono avere la stessa lunghezza");
        
        // Crea una nuova campagna con costruttore più semplice
        Campaign newCampaign = new Campaign(
            _title,
            _description,
            _detailedDescription,
            _beneficiary,
            _goalAmount,
            address(dntToken),
            address(transactionRegistry),
            address(milestoneManager)
        );
        
        // Imposta la factory e autorizza il contratto
        newCampaign.setFactory(address(this));
        transactionRegistry.setContractAuthorization(address(newCampaign), true);
        
        // Imposta le immagini
        newCampaign.setImages(_mainImageCID, _additionalImagesCIDs);
        
        // Autorizza la campagna nel MilestoneManager
        milestoneManager.authorizeForCampaign(address(newCampaign), address(this));
        milestoneManager.authorizeForCampaign(address(newCampaign), address(newCampaign));
        
        // Aggiungi ogni milestone nel MilestoneManager
        for (uint256 i = 0; i < _milestoneTitles.length; i++) {
            milestoneManager.addMilestone(
                address(newCampaign),
                _milestoneTitles[i],
                _milestoneDescriptions[i],
                _milestoneTargetAmounts[i]
            );
        }
        
        // Finalizza le milestone
        milestoneManager.finalizeMilestones(address(newCampaign), _goalAmount);
        
        // Segna le milestone come configurate nella campagna
        newCampaign.setMilestonesConfigured();

        // Imposta il sistema di governance se configurato
        if (address(governanceSystem) != address(0)) {
            newCampaign.setGovernanceSystem(address(governanceSystem));
        } else {
            // Se non c'è sistema di governance, attiva direttamente la campagna
            newCampaign.setActive(true);
        }
        
        // Registra la campagna
        address campaignAddress = address(newCampaign);
        campaigns.push(campaignAddress);
        creatorToCampaigns[msg.sender].push(campaignAddress);
        
        emit CampaignCreated(campaignAddress, msg.sender, _title);

        // Se il sistema di governance è configurato, crea una proposta di voto
        if (address(governanceSystem) != address(0)) {
            governanceSystem.createProposal(campaignAddress, _goalAmount);
        }
        
        return campaignAddress;
    }
    
    /**
     * @dev Approva una milestone (solo admin)
     */
    function approveMilestone(address campaignAddress, uint256 milestoneIndex) external onlyOwner {
        milestoneManager.approveMilestone(campaignAddress, milestoneIndex);
    }

    /**
     * @dev Rifiuta una milestone (solo admin)
     */
    function rejectMilestone(address campaignAddress, uint256 milestoneIndex, string memory reason) external onlyOwner {
        milestoneManager.rejectMilestone(campaignAddress, milestoneIndex, reason);
    }

    /**
     * @dev Restituisce il numero totale di campagne
     */
    function getCampaignsCount() external view returns (uint256) {
        return campaigns.length;
    }

    /**
     * @dev Restituisce un elenco di tutte le campagne
     */
    function getAllCampaigns() external view returns (address[] memory) {
        return campaigns;
    }

    /**
     * @dev Restituisce le campagne create da un indirizzo specifico
     */
    function getCampaignsByCreator(address _creator) external view returns (address[] memory) {
        return creatorToCampaigns[_creator];
    }

    /**
     * @dev Disattiva una campagna (solo owner)
     */
    function deactivateCampaign(address _campaignAddress) external onlyOwner {
        Campaign campaign = Campaign(_campaignAddress);
        campaign.setActive(false);
    }

    /**
     * @dev Verifica se un indirizzo è autorizzato a creare campagne
     */
    function isAuthorizedCreator(address _address) external view returns (bool) {
        return requestManager.isAuthorizedCreator(_address);
    }

    /**
     * @dev Imposta il contratto di governance
     */
    function setGovernanceSystem(address _governanceAddress) external onlyOwner {
        require(_governanceAddress != address(0), "Indirizzo di governance non valido");
        governanceSystem = GovernanceSystem(_governanceAddress);
    }
}