# Donatio: Decentralized Fundraising Platform

Donatio is a decentralized fundraising platform built on Ethereum blockchain that implements a transparent and traceable donation system. The project uses smart contracts to manage campaigns, donations, and milestones, offering a fully decentralized alternative to traditional crowdfunding platforms.

## Key Features

- **Smart Contract System**: Complete set of contracts to manage campaigns, donations, and milestones
- **Custom Token**: Implementation of an ERC20 token (DNT) for donations
- **Milestone System**: Progressive release of funds based on verifiable objectives
- **Decentralized Governance**: Voting system for campaign and milestone approvals
- **IPFS Integration**: Using Pinata for decentralized storage of images and metadata

## Prerequisites

- [Node.js](https://nodejs.org/) (v14.x or higher)
- [npm](https://www.npmjs.com/) (v6.x or higher)
- [MetaMask](https://metamask.io/) or other Ethereum wallet
- [Pinata](https://www.pinata.cloud/) account for IPFS storage

## Quick Start

1. Clone the repository:

```sh
git clone https://github.com/DavideSigurta/Donatio.git
cd Donatio
```

2. Install project dependencies:

```sh
npm install
```

3. Start a local blockchain with Hardhat:

```sh
npx hardhat node
```

4. In a new terminal, deploy the contracts:

```sh
npx hardhat run scripts/deploy.js --network localhost
```

5. Configure the frontend environment (see next section)

6. Start the frontend application:

```sh
cd frontend
npm install
npm start
```

7. Open [http://localhost:3000/](http://localhost:3000/) to view the application

## Environment Configuration

### IPFS Configuration with Pinata

To properly use the decentralized storage features:

1. Create an account on [Pinata](https://www.pinata.cloud/) to get IPFS API keys
2. Copy the `.env.example` file to a new `.env` file in the `frontend` folder
3. Replace the placeholder values in the `.env` file with your Pinata credentials
4. Make sure the `.env` file is included in `.gitignore` to avoid exposing your credentials


## Project Structure

- `contracts/`: Solidity smart contracts
  - `Campaign.sol`: Fundraising campaign management
  - `CampaignFactory.sol`: Factory for creating new campaigns
  - `Token.sol`: ERC20 token implementation
  - `MilestoneManager.sol`: Milestone management and fund release
  - `GovernanceSystem.sol`: Voting and governance functionality
  
- `frontend/`: React user interface
  - `/src/components`: UI components
  - `/src/services`: Services (blockchain, IPFS)
  - `/src/contexts`: Context API for state management
  
- `scripts/`: Deployment and initialization scripts
- `test/`: Automated contract tests
- `documents/`: Documentation and diagrams (excluded from repository)

## Main Functionality

### Campaign Creation

Users can create fundraising campaigns by specifying:
- Title and description
- Images (uploaded to IPFS)
- Fundraising goal
- Milestones and requirements for fund release

### Donations

Users can:
- Donate DNT tokens to existing campaigns
- Track the status of their donations
- Vote for fund release when milestones are reached

### Milestone Management

Funds are released progressively based on milestone completion:
- Donors vote to confirm milestone achievements
- Funds are unlocked only after reaching the quorum

## Testing and Development

To run contract tests:

```sh
npx hardhat test
```

To compile contracts:

```sh
npx hardhat compile
```

## Troubleshooting

- **Invalid nonce errors**: If you see this error on the `npx hardhat node` console, try resetting your MetaMask account. Open MetaMask, click on your account, then go to `Settings > Advanced > Clear activity tab data`.

- **IPFS connection issues**: Verify that your Pinata API keys are correct and that the gateway is accessible.

- **Transaction errors**: Make sure you have enough ETH in your wallet to pay for transactions.

## Resources and References

- [Hardhat Documentation](https://hardhat.org/docs/)
- [Pinata IPFS Guide](https://docs.pinata.cloud/)
- [ERC20 Standard](https://eips.ethereum.org/EIPS/eip-20)
- [React Documentation](https://reactjs.org/docs/getting-started.html)

## Setting up your editor

[Hardhat for Visual Studio Code](https://hardhat.org/hardhat-vscode) is the official Hardhat extension that adds advanced support for Solidity to VSCode. If you use Visual Studio Code, give it a try!

## License

This project is released under the MIT License.

---

**Note**: This project was developed for educational and demonstrative purposes. Use with caution in production environments.
