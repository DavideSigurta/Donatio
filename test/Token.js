// Questo è un file di test di esempio. Hardhat eseguirà ogni file *.js nella cartella `test/`,
// quindi sentiti libero di aggiungerne altri.

// I test di Hardhat sono normalmente scritti con Mocha e Chai.

// Importiamo Chai per utilizzare le sue funzioni di asserzione qui.
const { expect } = require("chai");

// Utilizziamo `loadFixture` per condividere configurazioni comuni (o fixture) tra i test.
// Questo semplifica i test e li rende più veloci, sfruttando
// la funzionalità di snapshot della rete Hardhat Network.
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// `describe` è una funzione di Mocha che permette di organizzare i test.
// Avere i test organizzati rende più facile il debug. Tutte le funzioni di Mocha
// sono disponibili nello scope globale.
//
// `describe` riceve il nome di una sezione della tua suite di test, e una
// callback. La callback deve definire i test di quella sezione. Questa callback
// non può essere una funzione asincrona.
describe("Token contract", function () {
  // Definiamo una fixture per riutilizzare la stessa configurazione in ogni test.
  // Utilizziamo loadFixture per eseguire questa configurazione una volta sola, creare uno snapshot
  // di quello stato e ripristinare Hardhat Network a quello snapshot in ogni test.
  async function deployTokenFixture() {
    // Otteniamo qui la ContractFactory e i Signers.
    const Token = await ethers.getContractFactory("Token");
    const [owner, addr1, addr2] = await ethers.getSigners();

    // Per deployare il nostro contratto, dobbiamo solo chiamare Token.deploy() e attendere
    // che venga deployato(), cosa che avviene una volta che la sua transazione è stata
    // minata.
    const hardhatToken = await Token.deploy();

    await hardhatToken.deployed();

    // Le fixture possono restituire qualsiasi cosa ritieni utile per i tuoi test
    return { Token, hardhatToken, owner, addr1, addr2 };
  }

  // Puoi annidare chiamate describe per creare sottosezioni.
  describe("Deployment", function () {
    // `it` è un'altra funzione di Mocha. Questa è quella che usi per definire i
    // tuoi test. Riceve il nome del test e una funzione di callback.
    // Se la funzione di callback è asincrona, Mocha la attenderà con `await`.
    it("Should set the right owner", async function () {
      // Utilizziamo loadFixture per configurare il nostro ambiente, e poi verifichiamo che
      // tutto sia andato bene
      const { hardhatToken, owner } = await loadFixture(deployTokenFixture);

      // Expect riceve un valore e lo avvolge in un oggetto di asserzione. Questi
      // oggetti hanno molti metodi utili per fare asserzioni sui valori.

      // Questo test si aspetta che la variabile owner memorizzata nel contratto sia
      // uguale all'owner del nostro Signer.
      expect(await hardhatToken.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const { hardhatToken, owner } = await loadFixture(deployTokenFixture);
      const ownerBalance = await hardhatToken.balanceOf(owner.address);
      expect(await hardhatToken.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      const { hardhatToken, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      // Trasferisce 50 token da owner a addr1
      await expect(hardhatToken.transfer(addr1.address, 50))
        .to.changeTokenBalances(hardhatToken, [owner, addr1], [-50, 50]);

      // Trasferisce 50 token da addr1 a addr2
      // Utilizziamo .connect(signer) per inviare una transazione da un altro account
      await expect(hardhatToken.connect(addr1).transfer(addr2.address, 50))
        .to.changeTokenBalances(hardhatToken, [addr1, addr2], [-50, 50]);
    });

    it("should emit Transfer events", async function () {
      const { hardhatToken, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);

      // Trasferisce 50 token da owner a addr1
      await expect(hardhatToken.transfer(addr1.address, 50))
        .to.emit(hardhatToken, "Transfer").withArgs(owner.address, addr1.address, 50)

      // Trasferisce 50 token da addr1 a addr2
      // Utilizziamo .connect(signer) per inviare una transazione da un altro account
      await expect(hardhatToken.connect(addr1).transfer(addr2.address, 50))
        .to.emit(hardhatToken, "Transfer").withArgs(addr1.address, addr2.address, 50)
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const { hardhatToken, owner, addr1 } = await loadFixture(deployTokenFixture);
      const initialOwnerBalance = await hardhatToken.balanceOf(
        owner.address
      );

      // Prova a inviare 1 token da addr1 (0 token) all'owner (1000 token).
      // `require` valuterà false e annullerà la transazione.
      await expect(
        hardhatToken.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWith("Not enough tokens");

      // Il saldo dell'owner non dovrebbe essere cambiato.
      expect(await hardhatToken.balanceOf(owner.address)).to.equal(
        initialOwnerBalance
      );
    });
  });

  describe("Allowances", function () {
    it("Should update allowances when approve is called", async function () {
      const { hardhatToken, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      await hardhatToken.approve(addr1.address, 100);
      expect(await hardhatToken.allowance(owner.address, addr1.address)).to.equal(100);
    });

    it("Should emit Approval event when approve is called", async function () {
      const { hardhatToken, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      await expect(hardhatToken.approve(addr1.address, 100))
        .to.emit(hardhatToken, "Approval")
        .withArgs(owner.address, addr1.address, 100);
    });

    it("Should allow transferFrom when sender has enough allowance", async function () {
      const { hardhatToken, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // L'owner approva addr1 a spendere 100 token
      await hardhatToken.approve(addr1.address, 100);
      
      // addr1 trasferisce 50 token dall'owner a addr2
      await expect(hardhatToken.connect(addr1).transferFrom(owner.address, addr2.address, 50))
        .to.changeTokenBalances(hardhatToken, [owner, addr2], [-50, 50]);
        
      // Verifica che l'allowance sia stata ridotta
      expect(await hardhatToken.allowance(owner.address, addr1.address)).to.equal(50);
    });

    it("Should fail transferFrom when sender has insufficient allowance", async function () {
      const { hardhatToken, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // L'owner approva addr1 a spendere 50 token
      await hardhatToken.approve(addr1.address, 50);
      
      // addr1 tenta di trasferire 100 token dall'owner a addr2
      await expect(
        hardhatToken.connect(addr1).transferFrom(owner.address, addr2.address, 100)
      ).to.be.revertedWith("Not enough allowance");
    });

    it("Should fail transferFrom when token owner has insufficient balance", async function () {
      const { hardhatToken, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      // Trasferisce tutti i token dall'owner a addr1
      const totalSupply = await hardhatToken.totalSupply();
      await hardhatToken.transfer(addr1.address, totalSupply);
      
      // L'owner ora ha 0 token ma approva addr2 a spendere 100 token
      await hardhatToken.approve(addr2.address, 100);
      
      // addr2 tenta di trasferire dall'owner (che ha 0 token)
      await expect(
        hardhatToken.connect(addr2).transferFrom(owner.address, addr2.address, 100)
      ).to.be.revertedWith("Not enough tokens");
    });
  });

  describe("Token Properties", function () {
    it("Should have correct name and symbol", async function () {
      const { hardhatToken } = await loadFixture(deployTokenFixture);
      
      expect(await hardhatToken.name()).to.equal("Donatio");
      expect(await hardhatToken.symbol()).to.equal("DNT");
    });
    
    it("Should have correct total supply", async function () {
      const { hardhatToken } = await loadFixture(deployTokenFixture);
      
      const expectedTotalSupply = 1000000000; // 1 miliardo di token come specificato nel contratto
      expect(await hardhatToken.totalSupply()).to.equal(expectedTotalSupply);
    });
  });
});

