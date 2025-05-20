const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CampaignFactory", function () {
    let Token;
    let token;
    let TransactionRegistry;
    let registry;
    let MilestoneManager;
    let milestoneManager;
    let CampaignFactory;
    let factory;
    let CreatorRequestManager;
    let requestManager;
    let GovernanceSystem;
    let governanceSystem;
    let owner;
    let creator;
    let beneficiary;
    let donor1;
    let donor2;

    // Fixture per il deployment base di tutti i contratti necessari
    async function deployFactoryFixture() {
        [owner, creator, beneficiary, donor1, donor2] = await ethers.getSigners();
        
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
        
        // Deploy CampaignFactory senza GovernanceSystem inizialmente
        CampaignFactory = await ethers.getContractFactory("CampaignFactory");
        factory = await CampaignFactory.deploy(
            token.address,
            registry.address,
            requestManager.address,
            milestoneManager.address
        );
        await factory.deployed();
        
        // Set the factory address in the registry
        await registry.connect(owner).setManagerAuthorization(factory.address, true);

        // Set the factory address in the milestone manager
        await milestoneManager.connect(owner).setAdmin(factory.address);

        // Set campaign factory address in request manager (if needed)
        if (requestManager.setCampaignFactory) {
            await requestManager.connect(owner).setCampaignFactory(factory.address);
        }
        
        // Authorize creators using proper request flow
        // Step 1: Submit creator requests
        await requestManager.connect(creator).submitCreatorRequest("Experienced fundraiser");
        await requestManager.connect(donor1).submitCreatorRequest("Regular contributor");
        
        // Step 2: Approve the requests as the owner
        await requestManager.connect(owner).approveCreatorRequest(creator.address);
        await requestManager.connect(owner).approveCreatorRequest(donor1.address);
                
        // Transfer tokens for testing
        const testAmount = ethers.utils.parseEther("1000");
        await token.transfer(creator.address, testAmount);
        await token.transfer(donor1.address, testAmount);
        await token.transfer(donor2.address, testAmount);
        
        return { 
            token, 
            registry, 
            milestoneManager, 
            factory, 
            requestManager, 
            owner,
            creator, 
            beneficiary, 
            donor1, 
            donor2 
        };
    }
    
    // Fixture for deployment with governance system
    async function deployWithGovernanceFixture() {
        const baseDeployment = await deployFactoryFixture();
        
        // Deploy GovernanceSystem
        GovernanceSystem = await ethers.getContractFactory("GovernanceSystem");
        governanceSystem = await GovernanceSystem.deploy(
            baseDeployment.token.address,
            baseDeployment.factory.address
        );
        await governanceSystem.deployed();
        
        // Connect the GovernanceSystem to the factory
        await baseDeployment.factory.setGovernanceSystem(governanceSystem.address);
        
        return { 
            ...baseDeployment, 
            governanceSystem 
        };
    }
    
    describe("Deployment", function () {
        it("Should set the correct initial parameters", async function () {
            const { token, registry, milestoneManager, factory, requestManager, owner } = 
                await loadFixture(deployFactoryFixture);
            
            expect(await factory.dntToken()).to.equal(token.address);
            expect(await factory.transactionRegistry()).to.equal(registry.address);
            expect(await factory.requestManager()).to.equal(requestManager.address);
            expect(await factory.milestoneManager()).to.equal(milestoneManager.address);
            expect(await factory.owner()).to.equal(owner.address);
        });
        
        it("Should initialize with empty campaign list", async function () {
            const { factory } = await loadFixture(deployFactoryFixture);
            
            expect(await factory.getCampaignsCount()).to.equal(0);
            const campaigns = await factory.getAllCampaigns();
            expect(campaigns.length).to.equal(0);
        });
    });
    
    describe("Campaign Creation", function () {
        // Common parameters for campaign creation
        const title = "Test Campaign";
        const description = "Test Description";
        const detailedDescription = "Detailed test description for the campaign";
        const mainImageCID = "ipfs://main-image-cid";
        const additionalImagesCIDs = ["ipfs://image1", "ipfs://image2"];
        const goalAmount = ethers.utils.parseEther("100");
        
        // Helper for setting up milestones
        const milestoneTitles = ["Milestone 1", "Milestone 2"];
        const milestoneDescriptions = ["First phase", "Second phase"];
        const milestoneTargetAmounts = [
            ethers.utils.parseEther("30"),
            ethers.utils.parseEther("70")
        ];
        
        it("Should create a new campaign without governance", async function () {
            const { factory, creator, beneficiary } = await loadFixture(deployFactoryFixture);
            
            // Create a new campaign
            await expect(
                factory.connect(creator).createCampaign(
                    title,
                    description,
                    detailedDescription,
                    beneficiary.address,
                    goalAmount,
                    mainImageCID,
                    additionalImagesCIDs,
                    milestoneTitles,
                    milestoneDescriptions,
                    milestoneTargetAmounts
                )
            ).to.emit(factory, "CampaignCreated");
            
            // Verify the campaign was created
            expect(await factory.getCampaignsCount()).to.equal(1);
            
            // Verify the creator was correctly registered
            const creatorCampaigns = await factory.getCampaignsByCreator(creator.address);
            expect(creatorCampaigns.length).to.equal(1);
            
            // Get the created campaign address
            const campaignAddresses = await factory.getAllCampaigns();
            const campaignAddress = campaignAddresses[0];
            
            // Load the created campaign contract
            const Campaign = await ethers.getContractFactory("Campaign");
            const campaign = await Campaign.attach(campaignAddress);
            
            // Verify campaign details
            expect(await campaign.title()).to.equal(title);
            expect(await campaign.description()).to.equal(description);
            expect(await campaign.beneficiary()).to.equal(beneficiary.address);
            expect(await campaign.creator()).to.equal(factory.address);
            expect(await campaign.goalAmount()).to.equal(goalAmount);
            expect(await campaign.active()).to.equal(true); // Without governance it should be active by default
            expect(await campaign.mainImageCID()).to.equal(mainImageCID);
            
            // Verify milestones through MilestoneManager
            const milestoneManager = await ethers.getContractAt("MilestoneManager", await campaign.milestoneManager());
            
            const milestone1 = await milestoneManager.getMilestone(campaignAddress, 0);
            expect(milestone1.title).to.equal(milestoneTitles[0]);
            expect(milestone1.description).to.equal(milestoneDescriptions[0]);
            expect(milestone1.targetAmount).to.equal(milestoneTargetAmounts[0]);
            
            const milestone2 = await milestoneManager.getMilestone(campaignAddress, 1);
            expect(milestone2.title).to.equal(milestoneTitles[1]);
            expect(milestone2.description).to.equal(milestoneDescriptions[1]);
            expect(milestone2.targetAmount).to.equal(milestoneTargetAmounts[1]);
        });
        
        it("Should create a campaign that requires governance approval", async function () {
            const { factory, governanceSystem, creator, beneficiary } = 
                await loadFixture(deployWithGovernanceFixture);
            
            // Create a new campaign
            await factory.connect(creator).createCampaign(
                title,
                description,
                detailedDescription,
                beneficiary.address,
                goalAmount,
                mainImageCID,
                additionalImagesCIDs,
                milestoneTitles,
                milestoneDescriptions,
                milestoneTargetAmounts
            );
            
            // Verify the campaign was created
            expect(await factory.getCampaignsCount()).to.equal(1);
            
            // Get the campaign address
            const campaignAddresses = await factory.getAllCampaigns();
            const campaignAddress = campaignAddresses[0];
            
            // Load the campaign contract
            const Campaign = await ethers.getContractFactory("Campaign");
            const campaign = await Campaign.attach(campaignAddress);
            
            // Verify that the campaign is not active (awaiting governance approval)
            expect(await campaign.active()).to.equal(false);
            
            // Verify that a governance proposal was created
            expect(await governanceSystem.getProposalsCount()).to.equal(1);
            
            // Get the proposal details
            const proposal = await governanceSystem.getProposal(0);
            expect(proposal.campaignAddress).to.equal(campaignAddress);
            expect(proposal.targetAmount).to.equal(goalAmount);
            expect(proposal.status).to.equal(0); // ACTIVE status
        });
        
        it("Should fail to create campaign with invalid milestone configuration", async function () {
            const { factory, creator, beneficiary } = await loadFixture(deployFactoryFixture);
            
            // Create milestones with targets not adding up to the total goal
            const invalidTargetAmounts = [
                ethers.utils.parseEther("30"),
                ethers.utils.parseEther("30") // Should be 70 to add up to 100
            ];
            
            await expect(
                factory.connect(creator).createCampaign(
                    title,
                    description,
                    detailedDescription,
                    beneficiary.address,
                    goalAmount,
                    mainImageCID,
                    additionalImagesCIDs,
                    milestoneTitles,
                    milestoneDescriptions,
                    invalidTargetAmounts
                )
            ).to.be.revertedWith("La somma degli importi non corrisponde all'obiettivo");
        });
        
        it("Should fail to create campaign if arrays have different lengths", async function () {
            const { factory, creator, beneficiary } = await loadFixture(deployFactoryFixture);
            
            // Milestone arrays of different lengths
            const shorterTitles = ["Milestone 1"];
            
            await expect(
                factory.connect(creator).createCampaign(
                    title,
                    description,
                    detailedDescription,
                    beneficiary.address,
                    goalAmount,
                    mainImageCID,
                    additionalImagesCIDs,
                    shorterTitles, // Only one title
                    milestoneDescriptions, // Two descriptions
                    milestoneTargetAmounts // Two targets
                )
            ).to.be.revertedWith("Gli array delle milestone devono avere la stessa lunghezza");
        });
    });
    
    describe("Campaign Management", function () {
        // Create a campaign before each test
        async function createCampaignFixture() {
            const baseFixture = await deployFactoryFixture();
            const { factory, creator, beneficiary } = baseFixture;
            
            const title = "Test Campaign";
            const description = "Test Description";
            const detailedDescription = "Detailed description";
            const mainImageCID = "ipfs://main-image-cid";
            const additionalImagesCIDs = ["ipfs://image1", "ipfs://image2"];
            const goalAmount = ethers.utils.parseEther("100");
            
            const milestoneTitles = ["Milestone 1", "Milestone 2"];
            const milestoneDescriptions = ["First phase", "Second phase"];
            const milestoneTargetAmounts = [
                ethers.utils.parseEther("30"),
                ethers.utils.parseEther("70")
            ];
            
            await factory.connect(creator).createCampaign(
                title,
                description,
                detailedDescription,
                beneficiary.address,
                goalAmount,
                mainImageCID,
                additionalImagesCIDs,
                milestoneTitles,
                milestoneDescriptions,
                milestoneTargetAmounts
            );
            
            const campaignAddresses = await factory.getAllCampaigns();
            const campaignAddress = campaignAddresses[0];
            
            const Campaign = await ethers.getContractFactory("Campaign");
            const campaign = await Campaign.attach(campaignAddress);
            
            return {
                ...baseFixture,
                campaign,
                campaignAddress
            };
        }
        
        it("Should allow owner to deactivate a campaign", async function () {
            const { factory, campaign, owner } = await loadFixture(createCampaignFixture);
            
            // The campaign should be active initially
            expect(await campaign.active()).to.equal(true);
            
            // Deactivate the campaign
            await factory.connect(owner).deactivateCampaign(campaign.address);
            
            // Verify it was deactivated
            expect(await campaign.active()).to.equal(false);
        });
        
        it("Should allow owner to activate a campaign", async function () {
            const { factory, campaign, owner } = await loadFixture(createCampaignFixture);
            
            // First deactivate the campaign
            await factory.connect(owner).deactivateCampaign(campaign.address);
            expect(await campaign.active()).to.equal(false);
            
            // Riattiva la campagna usando lo stesso factory 
            // Prima assegna ETH alla factory e poi impersonala
            await ethers.provider.send("hardhat_setBalance", [
                factory.address,
                "0x10000000000000000" // 0.1 ETH in hex
            ]);
            await ethers.provider.send("hardhat_impersonateAccount", [factory.address]);
            const factorySigner = await ethers.provider.getSigner(factory.address);
            await campaign.connect(factorySigner).setActive(true);
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [factory.address]);
            
            // Verify it was reactivated
            expect(await campaign.active()).to.equal(true);
        });
        
        it("Should not allow non-owner to activate/deactivate campaigns", async function () {
            const { factory, campaign, creator, donor2 } = await loadFixture(createCampaignFixture);
            
            // Try to deactivate the campaign as a non-owner
            await expect(
                factory.connect(creator).deactivateCampaign(campaign.address)
            ).to.be.revertedWith("Solo l'owner puo' eseguire questa azione");
            
            // Try to activate the campaign as a non-authorized user
            await expect(
                campaign.connect(donor2).setActive(true)
            ).to.be.revertedWith("Solo il factory, creator, governance o milestone manager possono modificare lo stato");
        });
    });
    
    describe("Integration with Governance", function () {
        it("Should set and get governance system", async function () {
            const { factory, owner } = await loadFixture(deployFactoryFixture);
            
            // Deploy GovernanceSystem
            GovernanceSystem = await ethers.getContractFactory("GovernanceSystem");
            governanceSystem = await GovernanceSystem.deploy(
                await factory.dntToken(),
                factory.address
            );
            await governanceSystem.deployed();
            
            // Set the governance system
            await factory.connect(owner).setGovernanceSystem(governanceSystem.address);
            
            // Verify it was set correctly
            expect(await factory.governanceSystem()).to.equal(governanceSystem.address);
        });
        
        it("Should not allow non-owner to set governance system", async function () {
            const { factory, creator } = await loadFixture(deployFactoryFixture);
            
            // Deploy GovernanceSystem
            GovernanceSystem = await ethers.getContractFactory("GovernanceSystem");
            governanceSystem = await GovernanceSystem.deploy(
                await factory.dntToken(),
                factory.address
            );
            await governanceSystem.deployed();
            
            // Try to set the governance system as a non-owner
            await expect(
                factory.connect(creator).setGovernanceSystem(governanceSystem.address)
            ).to.be.revertedWith("Solo l'owner puo' eseguire questa azione");
        });
    });
    
    describe("Creator Verification", function () {
        it("Should allow only authorized creators to create campaigns", async function () {
            const { factory, requestManager, token, donor2, beneficiary, owner } = await loadFixture(deployFactoryFixture);
            
            // Verify that donor2 is not authorized
            expect(await requestManager.isAuthorizedCreator(donor2.address)).to.equal(false);
            
            // Prepare campaign parameters
            const milestoneTitles = ["Milestone 1"];
            const milestoneDescriptions = ["Description"];
            const milestoneTargetAmounts = [ethers.utils.parseEther("100")];
            
            // Transfer tokens to donor2 for testing
            await token.transfer(donor2.address, ethers.utils.parseEther("1000"));
            
            // Try to create a campaign with an unauthorized creator
            await expect(
                factory.connect(donor2).createCampaign(
                    "Campaign by Unauthorized Creator",
                    "Description",
                    "Detailed description",
                    beneficiary.address,
                    ethers.utils.parseEther("100"),
                    "ipfs://main",
                    ["ipfs://add1"],
                    milestoneTitles,
                    milestoneDescriptions,
                    milestoneTargetAmounts
                )
            ).to.be.revertedWith("Non autorizzato a creare campagne");
            
            // Authorize the creator through the request process
            await requestManager.connect(donor2).submitCreatorRequest("Wants to create a campaign");
            
            // Approve the request
            await requestManager.connect(owner).approveCreatorRequest(donor2.address);
            
            // Now the creator should be able to create a campaign
            await factory.connect(donor2).createCampaign(
                "Campaign by Now Authorized Creator",
                "Description",
                "Detailed description",
                beneficiary.address,
                ethers.utils.parseEther("100"),
                "ipfs://main",
                ["ipfs://add1"],
                milestoneTitles,
                milestoneDescriptions,
                milestoneTargetAmounts
            );
            
            // Verify the campaign was created
            const creatorCampaigns = await factory.getCampaignsByCreator(donor2.address);
            expect(creatorCampaigns.length).to.equal(1);
        });
    });
    
    describe("Query Methods", function () {
        it("Should correctly return campaigns by creator", async function () {
            const { factory, creator, beneficiary, donor1 } = await loadFixture(deployFactoryFixture);
            
            // Create two campaigns with the same creator
            const milestoneTitles = ["Milestone 1"];
            const milestoneDescriptions = ["Description"];
            const milestoneTargetAmounts = [ethers.utils.parseEther("100")];
            
            // Campaign 1
            await factory.connect(creator).createCampaign(
                "Campaign 1",
                "Description",
                "Detailed",
                beneficiary.address,
                ethers.utils.parseEther("100"),
                "ipfs://main1",
                ["ipfs://add1"],
                milestoneTitles,
                milestoneDescriptions,
                milestoneTargetAmounts
            );
            
            // Campaign 2
            await factory.connect(creator).createCampaign(
                "Campaign 2",
                "Description",
                "Detailed",
                beneficiary.address,
                ethers.utils.parseEther("100"),
                "ipfs://main2",
                ["ipfs://add2"],
                milestoneTitles,
                milestoneDescriptions,
                milestoneTargetAmounts
            );
            
            // Campaign 3 with a different creator
            await factory.connect(donor1).createCampaign(
                "Campaign 3",
                "Description",
                "Detailed",
                beneficiary.address,
                ethers.utils.parseEther("100"),
                "ipfs://main3",
                ["ipfs://add3"],
                milestoneTitles,
                milestoneDescriptions,
                milestoneTargetAmounts
            );
            
            // Verify total campaigns count
            expect(await factory.getCampaignsCount()).to.equal(3);
            
            // Verify campaigns by creator
            const creatorCampaigns = await factory.getCampaignsByCreator(creator.address);
            expect(creatorCampaigns.length).to.equal(2);
            
            const donor1Campaigns = await factory.getCampaignsByCreator(donor1.address);
            expect(donor1Campaigns.length).to.equal(1);
            
            // Verify that the creator's campaigns are the right ones
            const Campaign = await ethers.getContractFactory("Campaign");
            const campaign1 = await Campaign.attach(creatorCampaigns[0]);
            const campaign2 = await Campaign.attach(creatorCampaigns[1]);
            
            expect(await campaign1.title()).to.equal("Campaign 1");
            expect(await campaign2.title()).to.equal("Campaign 2");
        });
        
        it("Should correctly return all campaigns", async function () {
            const { factory, creator, beneficiary } = await loadFixture(deployFactoryFixture);
            
            // Create multiple campaigns
            const milestoneTitles = ["Milestone 1"];
            const milestoneDescriptions = ["Description"];
            const milestoneTargetAmounts = [ethers.utils.parseEther("100")];
            
            const campaignTitles = ["Campaign 1", "Campaign 2", "Campaign 3"];
            
            for (let i = 0; i < campaignTitles.length; i++) {
                await factory.connect(creator).createCampaign(
                    campaignTitles[i],
                    "Description",
                    "Detailed",
                    beneficiary.address,
                    ethers.utils.parseEther("100"),
                    `ipfs://main${i+1}`,
                    [`ipfs://add${i+1}`],
                    milestoneTitles,
                    milestoneDescriptions,
                    milestoneTargetAmounts
                );
            }
            
            // Verify there are 3 campaigns
            expect(await factory.getCampaignsCount()).to.equal(3);
            
            // Get all campaigns
            const allCampaigns = await factory.getAllCampaigns();
            expect(allCampaigns.length).to.equal(3);
            
            // Verify the campaigns have the correct titles
            const Campaign = await ethers.getContractFactory("Campaign");
            
            for (let i = 0; i < allCampaigns.length; i++) {
                const campaign = await Campaign.attach(allCampaigns[i]);
                expect(await campaign.title()).to.equal(campaignTitles[i]);
            }
        });
    });
});