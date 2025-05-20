const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CreatorRequestManager", function () {
  let requestManager;
  let owner;
  let applicant1;
  let applicant2;
  let campaignFactory;
  let otherAccount;

  // Fixture per il deployment del CreatorRequestManager
  async function deployRequestManagerFixture() {
    [owner, applicant1, applicant2, campaignFactory, otherAccount] = await ethers.getSigners();
    
    const CreatorRequestManager = await ethers.getContractFactory("CreatorRequestManager");
    requestManager = await CreatorRequestManager.deploy();
    await requestManager.deployed();
    
    return { requestManager, owner, applicant1, applicant2, campaignFactory, otherAccount };
  }

  describe("Deployment", function () {
    it("Dovrebbe impostare il proprietario correttamente", async function () {
      const { requestManager, owner } = await loadFixture(deployRequestManagerFixture);
      expect(await requestManager.owner()).to.equal(owner.address);
    });

    it("Dovrebbe impostare il proprietario come autorizzato per default", async function () {
      const { requestManager, owner } = await loadFixture(deployRequestManagerFixture);
      expect(await requestManager.isAuthorizedCreator(owner.address)).to.equal(true);
    });
  });

  describe("Campaign Factory", function () {
    it("Dovrebbe permettere all'owner di impostare la campaign factory", async function () {
      const { requestManager, owner, campaignFactory } = await loadFixture(deployRequestManagerFixture);
      await requestManager.connect(owner).setCampaignFactory(campaignFactory.address);
      expect(await requestManager.campaignFactory()).to.equal(campaignFactory.address);
    });

    it("Non dovrebbe permettere a non-owner di impostare la campaign factory", async function () {
      const { requestManager, applicant1, campaignFactory } = await loadFixture(deployRequestManagerFixture);
      await expect(
        requestManager.connect(applicant1).setCampaignFactory(campaignFactory.address)
      ).to.be.revertedWith("Solo l'owner puo' eseguire questa azione");
    });

    it("Non dovrebbe permettere di reimpostare la campaign factory", async function () {
      const { requestManager, owner, campaignFactory, otherAccount } = await loadFixture(deployRequestManagerFixture);
      
      await requestManager.connect(owner).setCampaignFactory(campaignFactory.address);
      
      await expect(
        requestManager.connect(owner).setCampaignFactory(otherAccount.address)
      ).to.be.revertedWith("L'indirizzo della factory e' gia' impostato");
    });
  });

  describe("Creator Requests", function () {
    it("Dovrebbe permettere agli utenti di inviare richieste di autorizzazione", async function () {
      const { requestManager, applicant1 } = await loadFixture(deployRequestManagerFixture);
      
      const description = "Voglio creare una campagna per un progetto ambientale";
      
      await expect(requestManager.connect(applicant1).submitCreatorRequest(description))
        .to.emit(requestManager, "CreatorRequestSubmitted")
        .withArgs(applicant1.address, description);
      
      // Verifica che la richiesta sia stata memorizzata correttamente
      const request = await requestManager.getCreatorRequest(applicant1.address);
      expect(request.applicant).to.equal(applicant1.address);
      expect(request.description).to.equal(description);
      expect(request.processed).to.equal(false);
      expect(request.approved).to.equal(false);
    });

    it("Non dovrebbe permettere all'utente di inviare richieste multiple", async function () {
      const { requestManager, applicant1 } = await loadFixture(deployRequestManagerFixture);
      
      await requestManager.connect(applicant1).submitCreatorRequest("Prima richiesta");
      
      await expect(
        requestManager.connect(applicant1).submitCreatorRequest("Seconda richiesta")
      ).to.be.revertedWith("Hai gia' una richiesta in attesa");
    });

    it("Dovrebbe permettere all'utente di inviare una nuova richiesta dopo che la precedente è stata processata", async function () {
      const { requestManager, owner, applicant1 } = await loadFixture(deployRequestManagerFixture);
      
      // Prima richiesta
      await requestManager.connect(applicant1).submitCreatorRequest("Prima richiesta");
      
      // L'owner rifiuta la richiesta
      await requestManager.connect(owner).rejectCreatorRequest(applicant1.address);
      
      // L'utente può inviare una nuova richiesta
      await expect(requestManager.connect(applicant1).submitCreatorRequest("Seconda richiesta"))
        .to.emit(requestManager, "CreatorRequestSubmitted");
    });

    it("Non dovrebbe permettere di inviare richiesta con descrizione vuota", async function () {
      const { requestManager, applicant1 } = await loadFixture(deployRequestManagerFixture);
      
      await expect(
        requestManager.connect(applicant1).submitCreatorRequest("")
      ).to.be.revertedWith("La descrizione non puo' essere vuota");
    });

    it("Non dovrebbe permettere a un creatore già autorizzato di inviare una richiesta", async function () {
      const { requestManager, owner, applicant1 } = await loadFixture(deployRequestManagerFixture);
      
      // Prima autorizza l'utente
      await requestManager.connect(owner).authorizeCreator(applicant1.address, true);
      
      // Poi verifica che non possa inviare una richiesta
      await expect(
        requestManager.connect(applicant1).submitCreatorRequest("Richiesta")
      ).to.be.revertedWith("Sei gia' autorizzato a creare campagne");
    });
  });

  describe("Request Approval and Rejection", function () {
    it("Dovrebbe permettere all'owner di approvare una richiesta", async function () {
      const { requestManager, owner, applicant1 } = await loadFixture(deployRequestManagerFixture);
      
      await requestManager.connect(applicant1).submitCreatorRequest("Richiesta di test");
      
      await expect(requestManager.connect(owner).approveCreatorRequest(applicant1.address))
        .to.emit(requestManager, "CreatorRequestProcessed").withArgs(applicant1.address, true)
        .to.emit(requestManager, "CreatorAuthorized").withArgs(applicant1.address, true);
      
      // Verifica che l'utente sia ora autorizzato
      expect(await requestManager.isAuthorizedCreator(applicant1.address)).to.equal(true);
      
      // Verifica che la richiesta sia stata marcata come processata e approvata
      const request = await requestManager.getCreatorRequest(applicant1.address);
      expect(request.processed).to.equal(true);
      expect(request.approved).to.equal(true);
    });

    it("Dovrebbe permettere all'owner di rifiutare una richiesta", async function () {
      const { requestManager, owner, applicant1 } = await loadFixture(deployRequestManagerFixture);
      
      await requestManager.connect(applicant1).submitCreatorRequest("Richiesta di test");
      
      await expect(requestManager.connect(owner).rejectCreatorRequest(applicant1.address))
        .to.emit(requestManager, "CreatorRequestProcessed").withArgs(applicant1.address, false);
      
      // Verifica che l'utente non sia autorizzato
      expect(await requestManager.isAuthorizedCreator(applicant1.address)).to.equal(false);
      
      // Verifica che la richiesta sia stata marcata come processata ma non approvata
      const request = await requestManager.getCreatorRequest(applicant1.address);
      expect(request.processed).to.equal(true);
      expect(request.approved).to.equal(false);
    });

    it("Non dovrebbe permettere a non-owner di approvare o rifiutare richieste", async function () {
      const { requestManager, applicant1, applicant2 } = await loadFixture(deployRequestManagerFixture);
      
      await requestManager.connect(applicant1).submitCreatorRequest("Richiesta di test");
      
      await expect(
        requestManager.connect(applicant2).approveCreatorRequest(applicant1.address)
      ).to.be.revertedWith("Solo l'owner puo' eseguire questa azione");
      
      await expect(
        requestManager.connect(applicant2).rejectCreatorRequest(applicant1.address)
      ).to.be.revertedWith("Solo l'owner puo' eseguire questa azione");
    });
  });

  describe("Managing Pending Requests", function () {
    it("Dovrebbe tenere traccia del numero di richieste pendenti", async function () {
      const { requestManager, applicant1, applicant2 } = await loadFixture(deployRequestManagerFixture);
      
      expect(await requestManager.getPendingRequestsCount()).to.equal(0);
      
      await requestManager.connect(applicant1).submitCreatorRequest("Richiesta 1");
      expect(await requestManager.getPendingRequestsCount()).to.equal(1);
      
      await requestManager.connect(applicant2).submitCreatorRequest("Richiesta 2");
      expect(await requestManager.getPendingRequestsCount()).to.equal(2);
    });

    it("Dovrebbe permettere di ottenere una richiesta pendente per indice", async function () {
      const { requestManager, applicant1, applicant2 } = await loadFixture(deployRequestManagerFixture);
      
      const description1 = "Richiesta 1";
      const description2 = "Richiesta 2";
      
      await requestManager.connect(applicant1).submitCreatorRequest(description1);
      await requestManager.connect(applicant2).submitCreatorRequest(description2);
      
      const request1 = await requestManager.getPendingRequestAtIndex(0);
      expect(request1.applicant).to.equal(applicant1.address);
      expect(request1.description).to.equal(description1);
      
      const request2 = await requestManager.getPendingRequestAtIndex(1);
      expect(request2.applicant).to.equal(applicant2.address);
      expect(request2.description).to.equal(description2);
    });

    it("Dovrebbe rimuovere le richieste dalla lista pendenti quando processate", async function () {
      const { requestManager, owner, applicant1, applicant2 } = await loadFixture(deployRequestManagerFixture);
      
      await requestManager.connect(applicant1).submitCreatorRequest("Richiesta 1");
      await requestManager.connect(applicant2).submitCreatorRequest("Richiesta 2");
      
      expect(await requestManager.getPendingRequestsCount()).to.equal(2);
      
      // Processa la prima richiesta
      await requestManager.connect(owner).approveCreatorRequest(applicant1.address);
      expect(await requestManager.getPendingRequestsCount()).to.equal(1);
      
      // Ora la seconda richiesta dovrebbe essere all'indice 0
      const remainingRequest = await requestManager.getPendingRequestAtIndex(0);
      expect(remainingRequest.applicant).to.equal(applicant2.address);
      
      // Processa anche la seconda richiesta
      await requestManager.connect(owner).rejectCreatorRequest(applicant2.address);
      expect(await requestManager.getPendingRequestsCount()).to.equal(0);
    });
  });

  describe("Direct Creator Authorization", function () {
    it("Dovrebbe permettere all'owner di autorizzare direttamente un creatore", async function () {
      const { requestManager, owner, applicant1 } = await loadFixture(deployRequestManagerFixture);
      
      expect(await requestManager.isAuthorizedCreator(applicant1.address)).to.equal(false);
      
      await expect(requestManager.connect(owner).authorizeCreator(applicant1.address, true))
        .to.emit(requestManager, "CreatorAuthorized").withArgs(applicant1.address, true);
      
      expect(await requestManager.isAuthorizedCreator(applicant1.address)).to.equal(true);
    });

    it("Dovrebbe permettere all'owner di revocare l'autorizzazione a un creatore", async function () {
      const { requestManager, owner, applicant1 } = await loadFixture(deployRequestManagerFixture);
      
      // Prima autorizza
      await requestManager.connect(owner).authorizeCreator(applicant1.address, true);
      expect(await requestManager.isAuthorizedCreator(applicant1.address)).to.equal(true);
      
      // Poi revoca
      await expect(requestManager.connect(owner).authorizeCreator(applicant1.address, false))
        .to.emit(requestManager, "CreatorAuthorized").withArgs(applicant1.address, false);
      
      expect(await requestManager.isAuthorizedCreator(applicant1.address)).to.equal(false);
    });

    it("Non dovrebbe permettere a non-owner di autorizzare o revocare", async function () {
      const { requestManager, applicant1, applicant2 } = await loadFixture(deployRequestManagerFixture);
      
      await expect(
        requestManager.connect(applicant1).authorizeCreator(applicant2.address, true)
      ).to.be.revertedWith("Solo l'owner puo' eseguire questa azione");
    });
  });
});