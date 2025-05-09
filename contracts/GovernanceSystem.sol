//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import "./Token.sol";
import "./Campaign.sol";
import "./CampaignFactory.sol";
import "hardhat/console.sol";

/**
 * @title Sistema di Governance per Donatio
 * @dev Gestisce il processo di votazione per l'approvazione delle campagne
 * Gli utenti possono votare con potere proporzionale ai token DNT posseduti (con cap)
 * Le campagne vengono approvate o rifiutate in base ai risultati della votazione
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
    enum ProposalStatus { ACTIVE, APPROVED, REJECTED, EXPIRED }

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
    }
    
    // Mappatura degli indirizzi votanti per ogni proposta
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    // Array delle proposte
    Proposal[] public proposals;
    
    // EVENTI
    event ProposalCreated(uint256 indexed proposalId, address indexed campaignAddress, uint256 endTime);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votingPower);
    event ProposalExecuted(uint256 indexed proposalId, ProposalStatus status);
    event VotingPeriodChanged(uint256 newPeriod);

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
            executed: false
        });
        
        proposals.push(newProposal);
        uint256 proposalId = proposals.length - 1;
        
        emit ProposalCreated(proposalId, _campaignAddress, newProposal.endTime);
        
        return proposalId;
    }
    
    /**
     * @dev Registra un voto per una proposta
     * @param _proposalId ID della proposta
     * @param _support true se il voto è favorevole, false se è contrario
     */
    function vote(uint256 _proposalId, bool _support) external {
        Proposal storage proposal = proposals[_proposalId];
        
        // Verifiche di validità
        require(proposal.status == ProposalStatus.ACTIVE, "La proposta non e' attiva");
        require(block.timestamp <= proposal.endTime, "Votazione terminata");
        require(!hasVoted[_proposalId][msg.sender], "Hai gia' votato per questa proposta");
        
        // Calcola il potere di voto
        uint256 votingPower = calculateVotingPower(msg.sender, proposal.approvalQuota);
        require(votingPower > 0, "Non hai potere di voto");
        
        // Registra il voto
        if (_support) {
            proposal.positiveVotes += votingPower;
        } else {
            proposal.negativeVotes += votingPower;
        }
        
        hasVoted[_proposalId][msg.sender] = true;
        
        emit VoteCast(_proposalId, msg.sender, _support, votingPower);
        
        // Verifica se la proposta può essere risolta immediatamente
        checkProposalOutcome(_proposalId);
    }
    
    /**
     * @dev Calcola il potere di voto di un utente con limite massimo
     * @param _voter Indirizzo del votante
     * @param _approvalQuota Quota di approvazione per la proposta
     * @return Potere di voto calcolato
     */
    function calculateVotingPower(address _voter, uint256 _approvalQuota) public view returns (uint256) {
        uint256 tokenBalance = token.balanceOf(_voter);
        
        // Cap massimo al 20% della quota di approvazione
        uint256 maxVotingPower = _approvalQuota * 20 / 100;
        
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
            proposal.status = ProposalStatus.APPROVED;
            proposal.executed = true;
            
            // Attiva la campagna
            Campaign(proposal.campaignAddress).setActive(true);
            
            emit ProposalExecuted(_proposalId, ProposalStatus.APPROVED);
            return true;
        }
        
        // Rifiuta se ha raggiunto la soglia negativa (30% della quota)
        if (proposal.negativeVotes >= proposal.approvalQuota * 3 / 10) {
            proposal.status = ProposalStatus.REJECTED;
            proposal.executed = true;
            
            // La campagna rimane inattiva
            
            emit ProposalExecuted(_proposalId, ProposalStatus.REJECTED);
            return true;
        }
        
        return false;
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
        
        // La campagna rimane inattiva
        
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
        bool executed
    ) {
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
            proposal.executed
        );
    }
}