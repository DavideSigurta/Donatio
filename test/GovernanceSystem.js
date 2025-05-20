const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("GovernanceSystem", function() {
  let Token;
  let token;
  let CampaignFactory;
  let factory;
  let GovernanceSystem;
  let governanceSystem;
  let Campaign;
  let campaignAddress;
  let MilestoneManager;
  let milestoneManager;
  let TransactionRegistry;
  let registry;
  let CreatorRequestManager;
  let requestManager;
  let owner;
  let creator;
  let beneficiary;
  let voter1;
  let voter2;
  let voter3;

  // Fixture per il deployment dei contratti necessari
  async function deployGovernanceFixture() {
    [owner, creator, beneficiary, voter1, voter2, voter3] = await ethers.getSigners();
    
    // Deploy Token
    Token = await ethers.getContractFactory("Token");
    token = await Token.deploy();
    await token.deployed();
    
    // Deploy TransactionRegistry
    TransactionRegistry = await ethers.getContractFactory("TransactionRegistry");
    registry = await TransactionRegistry.deploy();
    await registry.deployed();
    
    // Deploy MilestoneManager
    MilestoneManager = await ethers.getContractFactory("MilestoneManager");
    milestoneManager = await MilestoneManager.deploy();
    await milestoneManager.deployed();
    
    // Deploy CreatorRequestManager
    CreatorRequestManager = await ethers.getContractFactory("CreatorRequestManager");
    requestManager = await CreatorRequestManager.deploy();
    await requestManager.deployed();
    
    // Deploy CampaignFactory
    CampaignFactory = await ethers.getContractFactory("CampaignFactory");
    factory = await CampaignFactory.deploy(
      token.address,
      registry.address,
      requestManager.address,
      milestoneManager.address
    );
    await factory.deployed();
    
    // Configura il sistema
    await registry.connect(owner).setManagerAuthorization(factory.address, true);
    await milestoneManager.connect(owner).setAdmin(owner.address);
    await requestManager.connect(owner).setCampaignFactory(factory.address);
    await requestManager.connect(owner).authorizeCreator(creator.address, true);
    
    // Deploy GovernanceSystem
    GovernanceSystem = await ethers.getContractFactory("GovernanceSystem");
    governanceSystem = await GovernanceSystem.deploy(token.address, factory.address);
    await governanceSystem.deployed();
    
    // Connetti il Governance System alla factory
    await factory.connect(owner).setGovernanceSystem(governanceSystem.address);
    
    // Distribuisci token per il voto
    // Dai token ai votanti per permettere loro di votare
    await token.transfer(voter1.address, ethers.utils.parseEther("10000"));
    await token.transfer(voter2.address, ethers.utils.parseEther("20000"));
    await token.transfer(voter3.address, ethers.utils.parseEther("30000"));
    
    return { 
      token, 
      factory, 
      governanceSystem, 
      milestoneManager, 
      registry, 
      requestManager,
      owner, 
      creator, 
      beneficiary, 
      voter1, 
      voter2, 
      voter3 
    };
  }

  describe("Deployment", function() {
    it("Dovrebbe impostare correttamente il token e la factory", async function() {
      const { token, factory, governanceSystem } = await loadFixture(deployGovernanceFixture);
      
      expect(await governanceSystem.token()).to.equal(token.address);
      expect(await governanceSystem.campaignFactory()).to.equal(factory.address);
    });
    
    it("Dovrebbe impostare l'owner come admin", async function() {
      const { governanceSystem, owner } = await loadFixture(deployGovernanceFixture);
      
      expect(await governanceSystem.admin()).to.equal(owner.address);
    });
    
    it("Dovrebbe avere un periodo di voto iniziale di 5 minuti", async function() {
      const { governanceSystem } = await loadFixture(deployGovernanceFixture);
      
      const votingPeriod = await governanceSystem.votingPeriod();
      expect(votingPeriod).to.equal(5 * 60); // 5 minuti in secondi
    });
  });

  describe("Gestione delle proposte", function() {
    it("Dovrebbe permettere all'admin di creare una proposta", async function() {
      const { governanceSystem, owner } = await loadFixture(deployGovernanceFixture);
      
      // Crea una campagna mock per la proposta
      const mockCampaignAddress = owner.address; // Usiamo l'indirizzo owner come mock
      const targetAmount = ethers.utils.parseEther("1000");
      
      // Crea la proposta
      await expect(governanceSystem.connect(owner).createProposal(mockCampaignAddress, targetAmount))
        .to.emit(governanceSystem, "ProposalCreated");
      
      // Verifica che la proposta sia stata creata correttamente
      const proposalId = 0; // Prima proposta
      const proposal = await governanceSystem.getProposal(proposalId);
      
      expect(proposal.campaignAddress).to.equal(mockCampaignAddress);
      expect(proposal.targetAmount).to.equal(targetAmount);
      expect(proposal.approvalQuota).to.equal(targetAmount.div(10));
      expect(proposal.proposalType).to.equal(0); // ProposalType.CAMPAIGN
    });
    
    it("Non dovrebbe permettere a utenti non autorizzati di creare proposte", async function() {
      const { governanceSystem, voter1 } = await loadFixture(deployGovernanceFixture);
      
      const mockCampaignAddress = voter1.address;
      const targetAmount = ethers.utils.parseEther("1000");
      
      await expect(
        governanceSystem.connect(voter1).createProposal(mockCampaignAddress, targetAmount)
      ).to.be.revertedWith("Solo la factory o l'admin possono creare proposte");
    });
  });

  describe("Sistema di votazione", function() {
    it("Dovrebbe permettere agli utenti di votare su una proposta", async function() {
        const { governanceSystem, owner, voter1 } = await loadFixture(deployGovernanceFixture);
        
        // Crea una proposta
        const mockCampaignAddress = owner.address;
        const targetAmount = ethers.utils.parseEther("1000");
        await governanceSystem.connect(owner).createProposal(mockCampaignAddress, targetAmount);
        
        // Vota sulla proposta
        await expect(governanceSystem.connect(voter1).vote(0, true))
            .to.emit(governanceSystem, "VoteCast")
            // CORREZIONE: Il potere di voto è limitato dal cap (20% della quota di approvazione)
            // La quota è targetAmount/10 = 100 ETH, e il cap è 20% di 100 ETH = 20 ETH
            .withArgs(0, voter1.address, true, ethers.utils.parseEther("20"));
        
        // Verifica che il voto sia stato registrato
        expect(await governanceSystem.hasUserVoted(0, voter1.address)).to.equal(true);
        });
    
    it("Non dovrebbe permettere di votare due volte sulla stessa proposta", async function() {
      const { governanceSystem, owner, voter1 } = await loadFixture(deployGovernanceFixture);
      
      // Crea una proposta
      const mockCampaignAddress = owner.address;
      const targetAmount = ethers.utils.parseEther("1000");
      await governanceSystem.connect(owner).createProposal(mockCampaignAddress, targetAmount);
      
      // Vota la prima volta
      await governanceSystem.connect(voter1).vote(0, true);
      
      // Tenta di votare una seconda volta
      await expect(
        governanceSystem.connect(voter1).vote(0, false)
      ).to.be.revertedWith("Hai gia' votato per questa proposta");
    });
    
    it("Dovrebbe limitare il potere di voto in base al cap configurato", async function() {
      const { governanceSystem, token, owner, voter1, voter2, voter3 } = await loadFixture(deployGovernanceFixture);
      
      // Crea una proposta con targetAmount = 1000 ETH
      const mockCampaignAddress = owner.address;
      const targetAmount = ethers.utils.parseEther("1000");
      await governanceSystem.connect(owner).createProposal(mockCampaignAddress, targetAmount);
      
      // La quota di approvazione è 100 ETH (targetAmount / 10)
      // Il cap è 20 ETH (20% della quota)
      const approvalQuota = targetAmount.div(10);
      const cap = approvalQuota.mul(20).div(100);
      
      // Calcola il potere di voto per voter3 che ha 30.000 token
      const votingPower = await governanceSystem.calculateVotingPower(voter3.address, 0);
      
      // Verifica che il potere di voto sia limitato dal cap
      expect(votingPower).to.equal(cap);
    });
  });

  describe("Esecuzione delle proposte", function() {
    it("Dovrebbe impostare lo stato della proposta a READY_FOR_EXECUTION quando raggiunge la soglia positiva", async function() {
        const { governanceSystem, token, owner, voter1, voter2, voter3 } = await loadFixture(deployGovernanceFixture);
        
        // Crea una proposta con un target amount molto basso per facilitare l'approvazione
        const mockCampaignAddress = owner.address;
        // CORREZIONE: Riduciamo l'importo target per rendere più facile raggiungere la soglia
        const targetAmount = ethers.utils.parseEther("5");
        await governanceSystem.connect(owner).createProposal(mockCampaignAddress, targetAmount);
        
        // La quota di approvazione è 0.5 ETH (targetAmount/10)
        // Servono 0.25 ETH di voti positivi per l'approvazione (50% della quota)
        // Il cap per ogni votante è 0.1 ETH (20% della quota)
        
        // CORREZIONE: Facciamo votare tutti e 3 i votanti per superare la soglia di approvazione
        await governanceSystem.connect(voter1).vote(0, true); // 0.1 ETH
        await governanceSystem.connect(voter2).vote(0, true); // 0.1 ETH 
        await governanceSystem.connect(voter3).vote(0, true); // 0.1 ETH
        // Totale: 0.3 ETH > soglia di 0.25 ETH
        
        // Verifica che la proposta sia pronta per l'esecuzione
        const proposal = await governanceSystem.getProposal(0);
        expect(proposal.status).to.equal(4); // ProposalStatus.READY_FOR_EXECUTION
        });
    
    it("Dovrebbe permettere all'admin di finalizzare una proposta scaduta", async function() {
      const { governanceSystem, owner } = await loadFixture(deployGovernanceFixture);
      
      // Crea una proposta
      const mockCampaignAddress = owner.address;
      const targetAmount = ethers.utils.parseEther("100");
      await governanceSystem.connect(owner).createProposal(mockCampaignAddress, targetAmount);
      
      // Avanza il tempo oltre il periodo di votazione
      const votingPeriod = await governanceSystem.votingPeriod();
      await ethers.provider.send("evm_increaseTime", [votingPeriod.toNumber() + 1]);
      await ethers.provider.send("evm_mine", []);
      
      // Finalizza la proposta scaduta
      await expect(governanceSystem.connect(owner).finalizeExpiredProposal(0))
        .to.emit(governanceSystem, "ProposalExecuted");
      
      // Verifica che la proposta sia stata finalizzata come scaduta
      const proposal = await governanceSystem.getProposal(0);
      expect(proposal.status).to.equal(3); // ProposalStatus.EXPIRED
      expect(proposal.executed).to.equal(true);
    });
  });

  describe("Funzioni amministrative", function() {
    it("Dovrebbe permettere all'admin di cambiare il periodo di votazione", async function() {
      const { governanceSystem, owner } = await loadFixture(deployGovernanceFixture);
      
      // Imposta un nuovo periodo di 10 minuti
      const newPeriodInMinutes = 10;
      await expect(governanceSystem.connect(owner).setVotingPeriod(newPeriodInMinutes))
        .to.emit(governanceSystem, "VotingPeriodChanged");
      
      // Verifica che il periodo sia stato aggiornato
      const newPeriodInSeconds = newPeriodInMinutes * 60;
      expect(await governanceSystem.votingPeriod()).to.equal(newPeriodInSeconds);
    });
    
    it("Non dovrebbe permettere a non-admin di cambiare il periodo di votazione", async function() {
      const { governanceSystem, voter1 } = await loadFixture(deployGovernanceFixture);
      
      // Tenta di cambiare il periodo come utente non autorizzato
      await expect(
        governanceSystem.connect(voter1).setVotingPeriod(10)
      ).to.be.revertedWith("Solo l'admin puo' eseguire questa operazione");
    });
  });
});