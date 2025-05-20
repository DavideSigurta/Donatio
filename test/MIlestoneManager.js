const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MilestoneManager", function () {
  let MilestoneManager;
  let milestoneManager;
  let Token;
  let token;
  let Campaign;
  let campaign;
  let campaignAddress;
  let owner;
  let beneficiary;
  let donor;
  let otherAccount;

  // Fixture per il deployment base del MilestoneManager
  async function deployMilestoneManagerFixture() {
    [owner, beneficiary, donor, otherAccount] = await ethers.getSigners();
    
    // Deploy Token per usarlo nei test
    Token = await ethers.getContractFactory("Token");
    token = await Token.deploy();
    await token.deployed();
    
    // Deploy MilestoneManager
    MilestoneManager = await ethers.getContractFactory("MilestoneManager");
    milestoneManager = await MilestoneManager.deploy();
    await milestoneManager.deployed();

    // Deploy TransactionRegistry (necessario per Campaign)
    const TransactionRegistry = await ethers.getContractFactory("TransactionRegistry");
    const registry = await TransactionRegistry.deploy();
    await registry.deployed();
    
    // Deploy Campaign direttamente (senza usare la factory)
    Campaign = await ethers.getContractFactory("Campaign");
    campaign = await Campaign.deploy(
      "Test Campaign",
      "Test Description",
      "Detailed test description",
      beneficiary.address,
      ethers.utils.parseEther("300"),  // goalAmount
      token.address,
      registry.address,
      milestoneManager.address
    );
    await campaign.deployed();
    campaignAddress = campaign.address;
    
    // Imposta owner come admin del MilestoneManager
    await milestoneManager.connect(owner).setAdmin(owner.address);
    
    // Autorizza il MilestoneManager per la campagna
    await milestoneManager.connect(owner).authorizeForCampaign(campaignAddress, owner.address);
    
    return { 
      milestoneManager, 
      token, 
      campaign, 
      campaignAddress, 
      owner, 
      beneficiary, 
      donor, 
      otherAccount,
      registry 
    };
  }

  describe("Funzionalità di base", function () {
    it("Dovrebbe permettere all'admin di configurare le milestone", async function () {
      const { milestoneManager, campaignAddress, owner } = await loadFixture(deployMilestoneManagerFixture);
      
      // Aggiungi alcune milestone
      await milestoneManager.connect(owner).addMilestone(
        campaignAddress,
        "Milestone 1: Pianificazione",
        "Fase di pianificazione del progetto",
        ethers.utils.parseEther("50")
      );
      
      await milestoneManager.connect(owner).addMilestone(
        campaignAddress,
        "Milestone 2: Esecuzione",
        "Implementazione delle attività",
        ethers.utils.parseEther("100")
      );
      
      await milestoneManager.connect(owner).addMilestone(
        campaignAddress,
        "Milestone 3: Completamento",
        "Conclusione e consegna",
        ethers.utils.parseEther("150")
      );
      
      // Finalizza le milestone
      await milestoneManager.connect(owner).finalizeMilestones(
        campaignAddress, 
        ethers.utils.parseEther("300") // Deve corrispondere alla somma delle milestone
      );
      
      // Verifica che le milestone siano state configurate correttamente
      expect(await milestoneManager.getMilestonesCount(campaignAddress)).to.equal(3);
      
      const milestone1 = await milestoneManager.getMilestone(campaignAddress, 0);
      expect(milestone1.title).to.equal("Milestone 1: Pianificazione");
      expect(milestone1.targetAmount).to.equal(ethers.utils.parseEther("50"));
      
      const milestone2 = await milestoneManager.getMilestone(campaignAddress, 1);
      expect(milestone2.title).to.equal("Milestone 2: Esecuzione");
      expect(milestone2.targetAmount).to.equal(ethers.utils.parseEther("100"));
      
      const milestone3 = await milestoneManager.getMilestone(campaignAddress, 2);
      expect(milestone3.title).to.equal("Milestone 3: Completamento");
      expect(milestone3.targetAmount).to.equal(ethers.utils.parseEther("150"));
    });

    it("Dovrebbe permettere all'admin di approvare una milestone", async function () {
      const { milestoneManager, campaignAddress, owner, beneficiary, token, campaign, registry } = await loadFixture(deployMilestoneManagerFixture);
      
      // Configurare due milestone
      await milestoneManager.connect(owner).addMilestone(
        campaignAddress,
        "Milestone 1",
        "Descrizione 1",
        ethers.utils.parseEther("100")
      );
      
      await milestoneManager.connect(owner).addMilestone(
        campaignAddress,
        "Milestone 2",
        "Descrizione 2",
        ethers.utils.parseEther("100")
      );
      
      await milestoneManager.connect(owner).finalizeMilestones(
        campaignAddress, 
        ethers.utils.parseEther("200")
      );

      // Imposta che le milestone sono configurate nella campagna
      await campaign.connect(owner).setMilestonesConfigured();
      
      // Simulare il finanziamento delle milestone
      await milestoneManager.connect(owner).distributeFundsToMilestones(
        campaignAddress,
        ethers.utils.parseEther("200")
      );
      
      // Verificare che la milestone 0 sia stata approvata automaticamente
      const milestone0 = await milestoneManager.getMilestone(campaignAddress, 0);
      expect(milestone0.approved).to.equal(true);

      // Impostare che la campagna è attiva
      await campaign.connect(owner).setActive(true);

      // Assegnare token alla campagna per simulare le donazioni
      await token.transfer(campaign.address, ethers.utils.parseEther("200"));

      // Autorizzare il contratto registry per registrare transazioni
      await registry.connect(owner).setContractAuthorization(campaign.address, true);
      
      // Simulare il ritiro dei fondi per la milestone 0
      await milestoneManager.connect(owner).releaseMilestoneFunds(campaignAddress, 0);
      
      // Inviare un report per la milestone 0
      await milestoneManager.connect(beneficiary).submitMilestoneReport(
        campaignAddress,
        0,
        "Report per la milestone 1: Pianificazione completata con successo."
      );
      
      // Ora approviamo la milestone 1
      await milestoneManager.connect(owner).approveMilestone(campaignAddress, 1);
      
      // Verifica che la milestone 1 sia stata approvata
      const milestone1 = await milestoneManager.getMilestone(campaignAddress, 1);
      expect(milestone1.approved).to.equal(true);
    });

    it("Dovrebbe permettere all'admin di rifiutare una milestone", async function () {
      const { milestoneManager, campaignAddress, owner, beneficiary } = await loadFixture(deployMilestoneManagerFixture);
      
      // Configurare due milestone
      await milestoneManager.connect(owner).addMilestone(
        campaignAddress,
        "Milestone 1",
        "Descrizione 1",
        ethers.utils.parseEther("100")
      );
      
      await milestoneManager.connect(owner).addMilestone(
        campaignAddress,
        "Milestone 2",
        "Descrizione 2",
        ethers.utils.parseEther("100")
      );
      
      await milestoneManager.connect(owner).finalizeMilestones(
        campaignAddress, 
        ethers.utils.parseEther("200")
      );
      
      // Finanziare solo parzialmente la milestone 1
      await milestoneManager.connect(owner).distributeFundsToMilestones(
        campaignAddress,
        ethers.utils.parseEther("150") // 100 per la prima milestone e 50 per la seconda
      );

      // La milestone 0 è approvata automaticamente, quindi inviamo il report per essa
      await milestoneManager.connect(owner).releaseMilestoneFunds(campaignAddress, 0);
      await milestoneManager.connect(beneficiary).submitMilestoneReport(
        campaignAddress,
        0,
        "Report per la milestone 1: Pianificazione completata con successo."
      );
      
      // Rifiutare la milestone 1
      await milestoneManager.connect(owner).rejectMilestone(
        campaignAddress,
        1,
        "Budget insufficiente per completare questa fase"
      );
      
      // Verificare che la milestone sia stata rifiutata
      expect(await milestoneManager.isMilestoneRejected(campaignAddress, 1)).to.equal(true);
      expect(await milestoneManager.getRejectionReason(campaignAddress, 1)).to.equal("Budget insufficiente per completare questa fase");
    });

    it("Dovrebbe permettere di inviare report per una milestone", async function () {
      const { milestoneManager, campaignAddress, owner, beneficiary } = await loadFixture(deployMilestoneManagerFixture);
      
      // Configurare due milestone
      await milestoneManager.connect(owner).addMilestone(
        campaignAddress,
        "Milestone 1",
        "Descrizione 1",
        ethers.utils.parseEther("100")
      );
      
      await milestoneManager.connect(owner).addMilestone(
        campaignAddress,
        "Milestone 2",
        "Descrizione 2",
        ethers.utils.parseEther("100")
      );
      
      await milestoneManager.connect(owner).finalizeMilestones(
        campaignAddress, 
        ethers.utils.parseEther("200")
      );
      
      // Simulare il finanziamento completo della milestone 0
      await milestoneManager.connect(owner).distributeFundsToMilestones(
        campaignAddress,
        ethers.utils.parseEther("100")
      );
      
      // La milestone 0 è approvata automaticamente
      // Marcare la milestone come rilasciata
      await milestoneManager.connect(owner).releaseMilestoneFunds(campaignAddress, 0);
      
      // Inviare un report per la milestone 0
      await milestoneManager.connect(beneficiary).submitMilestoneReport(
        campaignAddress,
        0,
        "Abbiamo completato la fase di pianificazione con successo."
      );
      
      // Verificare che il report sia stato salvato
      const report = await milestoneManager.getMilestoneReport(campaignAddress, 0);
      expect(report).to.equal("Abbiamo completato la fase di pianificazione con successo.");
    });
  });
});