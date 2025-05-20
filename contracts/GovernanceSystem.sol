//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import "./Token.sol";
import "./Campaign.sol";
import "./CampaignFactory.sol";
import "./MilestoneManager.sol";
import "hardhat/console.sol";

/**
 * @title Sistema di Governance per Donatio
 * @dev Gestisce il processo di votazione per l'approvazione delle campagne e milestone
 * Gli utenti possono votare con potere proporzionale ai token DNT posseduti (con cap)
 * Le campagne e milestone vengono approvate o rifiutate in base ai risultati della votazione
 */
contract GovernanceSystem {
    // Riferimento al contratto del token DNT
    Token public token;
    // Riferimento al factory delle campagne
    CampaignFactory public campaignFactory;
    // Indirizzo dell'admin
    address public admin;
    
    // Durata predefinita per le votazioni (in secondi)
    // 5 minuti per testing, in produzione sarebbe 3-7 giorni
    uint256 public votingPeriod = 5 minutes;
    
    // Enumerazione per lo stato delle proposte
    enum ProposalStatus { ACTIVE, APPROVED, REJECTED, EXPIRED, READY_FOR_EXECUTION }
    
    // Tipo di proposta: campagna o milestone
    enum ProposalType { CAMPAIGN, MILESTONE }

    // Struttura per le proposte di voto
    struct Proposal {
        uint256 id;
        address campaignAddress;
        uint256 targetAmount;
        uint256 approvalQuota;     // Target/10
        uint256 positiveVotes;
        uint256 negativeVotes;
        uint256 startTime;
        uint256 endTime;
        ProposalStatus status;
        bool executed;
        ProposalType proposalType;    // Tipo di proposta (campagna o milestone)
        uint256 milestoneIndex;       // Indice della milestone (solo per proposte di tipo MILESTONE)
    }
    
    // Mappatura degli indirizzi votanti per ogni proposta
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    // Array delle proposte
    Proposal[] public proposals;
    
    // EVENTI
    event ProposalCreated(uint256 indexed proposalId, address indexed campaignAddress, uint256 endTime, ProposalType proposalType);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votingPower);
    event ProposalExecuted(uint256 indexed proposalId, ProposalStatus status);
    event VotingPeriodChanged(uint256 newPeriod);
    event ProposalReadyForExecution(uint256 indexed proposalId, bool isApproval);

    /**
     * @dev Modifier che limita l'esecuzione di funzioni all'admin
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Solo l'admin puo' eseguire questa operazione");
        _;
    }

    /**
     * @dev Costruttore che inizializza il contratto GovernanceSystem
     * @param _tokenAddress Indirizzo del contratto Token
     * @param _campaignFactory Indirizzo del contratto CampaignFactory
     */
    constructor(address _tokenAddress, address _campaignFactory) {
        token = Token(_tokenAddress);
        campaignFactory = CampaignFactory(_campaignFactory);
        admin = msg.sender;
    }
    
    /**
     * @dev Crea una proposta per l'approvazione di una campagna
     * @param _campaignAddress Indirizzo del contratto della campagna
     * @param _targetAmount Obiettivo di finanziamento della campagna
     * @return proposalId ID della proposta creata
     */
    function createProposal(address _campaignAddress, uint256 _targetAmount) external returns (uint256) {
        // Solo il contract factory o l'admin possono creare proposte
        require(
            msg.sender == address(campaignFactory) || msg.sender == admin,
            "Solo la factory o l'admin possono creare proposte"
        );
        
        // Calcola la quota di approvazione
        uint256 approvalQuota = _targetAmount / 10;
        
        // Crea e memorizza la nuova proposta
        Proposal memory newProposal = Proposal({
            id: proposals.length,
            campaignAddress: _campaignAddress,
            targetAmount: _targetAmount,
            approvalQuota: approvalQuota,
            positiveVotes: 0,
            negativeVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + votingPeriod,
            status: ProposalStatus.ACTIVE,
            executed: false,
            proposalType: ProposalType.CAMPAIGN,   // Imposta il tipo di proposta come CAMPAIGN
            milestoneIndex: 0                      // Non rilevante per proposte di tipo CAMPAIGN
        });
        
        proposals.push(newProposal);
        uint256 proposalId = proposals.length - 1;
        
        emit ProposalCreated(proposalId, _campaignAddress, newProposal.endTime, ProposalType.CAMPAIGN);
        
        return proposalId;
    }
    
    /**
     * @dev Crea una proposta per l'approvazione di una milestone
     * @param _campaignAddress Indirizzo del contratto della campagna
     * @param _milestoneIndex Indice della milestone da approvare
     * @return proposalId ID della proposta creata
     */
    function createMilestoneProposal(address _campaignAddress, uint256 _milestoneIndex) external returns (uint256) {
        // Solo il contract factory, la campagna stessa o l'admin possono creare proposte per milestone
        require(
            msg.sender == address(campaignFactory) || 
            msg.sender == admin || 
            msg.sender == _campaignAddress || 
            msg.sender == Campaign(_campaignAddress).beneficiary(),
            "Solo la factory, l'admin o la campagna possono creare proposte per milestone"
        );
        
        // Ottieni riferimento alla campagna e al milestone manager
        Campaign campaign = Campaign(_campaignAddress);
        MilestoneManager milestoneManager = MilestoneManager(campaign.milestoneManager());
        
        // Verifica che la milestone esista e sia completamente finanziata
        (string memory title, , uint256 targetAmount, uint256 raisedAmount, bool approved, ) = 
            milestoneManager.getMilestone(_campaignAddress, _milestoneIndex);
        
        require(bytes(title).length > 0, "Milestone non esistente");
        require(raisedAmount >= targetAmount, "La milestone deve essere completamente finanziata");
        require(!approved, "La milestone e' gia' stata approvata");
        
        // Se non è la prima milestone (indice 0), verifica che la precedente sia stata approvata
        if (_milestoneIndex > 0) {
            (, , , , bool previousApproved, ) = milestoneManager.getMilestone(_campaignAddress, _milestoneIndex - 1);
            require(previousApproved, "La milestone precedente deve essere approvata prima");
        }
        
        // Calcola la quota di approvazione (come per le campagne)
        uint256 approvalQuota = targetAmount / 10;
        
        // Crea e memorizza la nuova proposta
        Proposal memory newProposal = Proposal({
            id: proposals.length,
            campaignAddress: _campaignAddress,
            targetAmount: targetAmount,
            approvalQuota: approvalQuota,
            positiveVotes: 0,
            negativeVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + votingPeriod,
            status: ProposalStatus.ACTIVE,
            executed: false,
            proposalType: ProposalType.MILESTONE,
            milestoneIndex: _milestoneIndex
        });
        
        proposals.push(newProposal);
        uint256 proposalId = proposals.length - 1;
        
        emit ProposalCreated(proposalId, _campaignAddress, newProposal.endTime, ProposalType.MILESTONE);
        
        return proposalId;
    }
    
    /**
     * @dev Registra un voto per una proposta
     * @param _proposalId ID della proposta
     * @param _support true se il voto è favorevole, false se è contrario
     */
    function vote(uint256 _proposalId, bool _support) external {
        console.log("=== VOTE START ===");
        console.log("Proposal ID:", _proposalId);
        console.log("Support:", _support);
        console.log("Sender:", msg.sender);

        Proposal storage proposal = proposals[_proposalId];
        
        // Verifiche di validità
        console.log("Status check - status:", uint256(proposal.status));
        require(proposal.status == ProposalStatus.ACTIVE, "La proposta non e' attiva");
        
        console.log("Time check - current:", block.timestamp, "end:", proposal.endTime);
        require(block.timestamp <= proposal.endTime, "Votazione terminata");
        
        console.log("Already voted check:", hasVoted[_proposalId][msg.sender]);
        require(!hasVoted[_proposalId][msg.sender], "Hai gia' votato per questa proposta");
        
        // Calcola il potere di voto
        uint256 votingPower = calculateVotingPower(msg.sender, _proposalId);
        console.log("Voting power calculated:", votingPower);
        require(votingPower > 0, "Non hai potere di voto");
        
        // Registra il voto
        if (_support) {
            proposal.positiveVotes += votingPower;
            console.log("Added positive votes, total now:", proposal.positiveVotes);
        } else {
            proposal.negativeVotes += votingPower;
            console.log("Added negative votes, total now:", proposal.negativeVotes);
        }
        
        hasVoted[_proposalId][msg.sender] = true;
        
        emit VoteCast(_proposalId, msg.sender, _support, votingPower);
        
        console.log("Before checkProposalOutcome");
        // Verifica se la proposta può essere risolta immediatamente
        bool executed = checkProposalOutcome(_proposalId);
        console.log("After checkProposalOutcome, executed:", executed);
        console.log("=== VOTE END ===");
    }
    
    /**
     * @dev Verifica se un utente ha già votato per una proposta specifica
     * @param _proposalId ID della proposta
     * @param _voter Indirizzo del votante
     * @return true se l'utente ha già votato
     */
    function hasUserVoted(uint256 _proposalId, address _voter) external view returns (bool) {
        return hasVoted[_proposalId][_voter];
    }
    
    /**
     * @dev Calcola il potere di voto di un utente con limite massimo
     * @param _voter Indirizzo del votante
     * @param _proposalId ID della proposta
     * @return Potere di voto calcolato
     */
    function calculateVotingPower(address _voter, uint256 _proposalId) public view returns (uint256) {
        Proposal storage proposal = proposals[_proposalId];
        uint256 tokenBalance = token.balanceOf(_voter);
        uint256 maxVotingPower;
        
        if (proposal.proposalType == ProposalType.MILESTONE) {
            // Per le proposte di milestone: 
            // - 20% della quota per i donatori
            // - 15% della quota per i non donatori
            Campaign campaign = Campaign(proposal.campaignAddress);
            
            // Il contratto Campaign deve avere una funzione isDonator
            bool isDonator = campaign.isDonator(_voter);
            
            if (isDonator) {
                // 20% per i donatori
                maxVotingPower = proposal.approvalQuota * 20 / 100;
            } else {
                // 15% per i non donatori
                maxVotingPower = proposal.approvalQuota * 15 / 100;
            }
        } else {
            // Per le proposte di campagna, usa il cap standard del 20%
            maxVotingPower = proposal.approvalQuota * 20 / 100;
        }
        
        // Restituisce il minore tra il saldo token e il cap
        return tokenBalance < maxVotingPower ? tokenBalance : maxVotingPower;
    }
    
    /**
     * @dev Verifica e aggiorna lo stato di una proposta in base ai voti
     * @param _proposalId ID della proposta
     * @return bool true se la proposta è stata eseguita
     */
    function checkProposalOutcome(uint256 _proposalId) public returns (bool) {
        Proposal storage proposal = proposals[_proposalId];
        
        // Salta se già eseguita o non attiva
        if (proposal.executed || proposal.status != ProposalStatus.ACTIVE) {
            return false;
        }
        
        // Approva se ha raggiunto la soglia positiva (50% della quota)
        if (proposal.positiveVotes >= proposal.approvalQuota / 2) {
            // Imposta come READY_FOR_EXECUTION invece di eseguire immediatamente
            proposal.status = ProposalStatus.READY_FOR_EXECUTION;
            proposal.executed = false; // Resta false finché non verrà effettivamente eseguita
            
            // Emetti un evento per notificare che la proposta è pronta per essere finalizzata
            emit ProposalReadyForExecution(_proposalId, true); // true = approvazione
            return true;
        }
        
        // Rifiuta se ha raggiunto la soglia negativa (30% della quota)
        if (proposal.negativeVotes >= proposal.approvalQuota * 3 / 10) {
            // Imposta come READY_FOR_EXECUTION invece di eseguire immediatamente
            proposal.status = ProposalStatus.READY_FOR_EXECUTION;
            proposal.executed = false; // Resta false finché non verrà effettivamente eseguita
            
            // Emetti un evento per notificare che la proposta è pronta per essere finalizzata
            emit ProposalReadyForExecution(_proposalId, false); // false = rifiuto
            return true;
        }
        
        return false;
    }

    /**
     * @dev Esegue una proposta approvata o rifiutata
     * @param _proposalId ID della proposta
     */
    function executeProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        
        // Verifica che la proposta sia pronta per l'esecuzione
        require(proposal.status == ProposalStatus.READY_FOR_EXECUTION, "La proposta non e' pronta per l'esecuzione");
        
        // Impedisci che qualsiasi utente possa eseguire la proposta
        Campaign campaign = Campaign(proposal.campaignAddress);
        require(
            msg.sender == campaign.beneficiary() || msg.sender == campaign.creator() || msg.sender == admin,
            "Solo il beneficiario, il creatore o l'admin possono eseguire questa proposta"
        );
        
        // Verifica quale azione deve essere eseguita in base ai voti
        bool isApproval = proposal.positiveVotes >= proposal.approvalQuota / 2;
        
        if (isApproval) {
            proposal.status = ProposalStatus.APPROVED;
            
            if (proposal.proposalType == ProposalType.CAMPAIGN) {
                // Attiva la campagna
                campaign.setActive(true);
            } else if (proposal.proposalType == ProposalType.MILESTONE) {
                // Approva la milestone
                MilestoneManager milestoneManager = MilestoneManager(campaign.milestoneManager());
                milestoneManager.approveMilestone(proposal.campaignAddress, proposal.milestoneIndex);
            }
        } else {
            proposal.status = ProposalStatus.REJECTED;
            
            if (proposal.proposalType == ProposalType.MILESTONE) {
                // Rifiuta la milestone
                MilestoneManager milestoneManager = MilestoneManager(campaign.milestoneManager());
                milestoneManager.rejectMilestone(proposal.campaignAddress, proposal.milestoneIndex, "Rifiutata tramite votazione");
                
                // Esegui il rimborso
                milestoneManager.adminRefundMilestone(proposal.campaignAddress, proposal.milestoneIndex);
            }
        }
        
        proposal.executed = true;
        emit ProposalExecuted(_proposalId, proposal.status);
    }
    
    /**
     * @dev Finalizza una proposta scaduta (può essere chiamata dall'admin)
     * @param _proposalId ID della proposta
     */
    function finalizeExpiredProposal(uint256 _proposalId) external onlyAdmin {
        Proposal storage proposal = proposals[_proposalId];
        
        require(!proposal.executed, "Proposta gia' eseguita");
        require(proposal.status == ProposalStatus.ACTIVE, "Proposta non attiva");
        require(block.timestamp > proposal.endTime, "Votazione ancora in corso");
        
        // Se la proposta è scaduta senza raggiungere le soglie, viene rifiutata
        proposal.status = ProposalStatus.EXPIRED;
        proposal.executed = true;
        
        if (proposal.proposalType == ProposalType.CAMPAIGN) {
            // La campagna rimane inattiva (comportamento esistente)
        } else if (proposal.proposalType == ProposalType.MILESTONE) {
            // Per le milestone scadute, considerale come rifiutate
            Campaign campaign = Campaign(proposal.campaignAddress);
            MilestoneManager milestoneManager = MilestoneManager(campaign.milestoneManager());
            
            // Prima rifiuta la milestone
            milestoneManager.rejectMilestone(proposal.campaignAddress, proposal.milestoneIndex, "Votazione scaduta senza raggiungere il quorum");
            
            // Poi esegui il rimborso - AGGIUNGI QUESTA RIGA
            milestoneManager.adminRefundMilestone(proposal.campaignAddress, proposal.milestoneIndex);
        }
        
        emit ProposalExecuted(_proposalId, ProposalStatus.EXPIRED);
    }
    
    /**
     * @dev Cambia la durata del periodo di votazione
     * @param _minutes Nuova durata in minuti
     */
    function setVotingPeriod(uint256 _minutes) external onlyAdmin {
        votingPeriod = _minutes * 1 minutes;
        emit VotingPeriodChanged(votingPeriod);
    }
    
    /**
     * @dev Ottiene il numero totale di proposte
     * @return Numero di proposte
     */
    function getProposalsCount() external view returns (uint256) {
        return proposals.length;
    }
    
    /**
     * @dev Ottiene una proposta completa
     * @param _proposalId ID della proposta
     * @return campaignAddress Indirizzo della campagna
     * @return targetAmount Obiettivo di finanziamento
     * @return approvalQuota Quota di approvazione
     * @return positiveVotes Voti positivi ricevuti
     * @return negativeVotes Voti negativi ricevuti
     * @return startTime Timestamp di inizio votazione
     * @return endTime Timestamp di fine votazione
     * @return status Stato attuale della proposta
     * @return executed Indica se la proposta è stata eseguita
     */
    function getProposal(uint256 _proposalId) external view returns (
        address campaignAddress,
        uint256 targetAmount,
        uint256 approvalQuota,
        uint256 positiveVotes,
        uint256 negativeVotes,
        uint256 startTime,
        uint256 endTime,
        ProposalStatus status,
        bool executed,
        ProposalType proposalType,
        uint256 milestoneIndex
    ) {
        require(_proposalId < proposals.length, "Proposal does not exist");
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.campaignAddress,
            proposal.targetAmount,
            proposal.approvalQuota,
            proposal.positiveVotes,
            proposal.negativeVotes,
            proposal.startTime,
            proposal.endTime,
            proposal.status,
            proposal.executed,
            proposal.proposalType,
            proposal.milestoneIndex
        );
    }
}