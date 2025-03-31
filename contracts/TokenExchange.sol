//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./Token.sol";
import "hardhat/console.sol";

contract TokenExchange {
    Token public token;
    address public owner;  // Il deployer/proprietario dei token
    uint256 public rate = 100; // 1 ETH = 100 DNT tokens

    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);

    constructor(address _tokenAddress) {
        token = Token(_tokenAddress);
        owner = msg.sender;  // Salva l'owner (deployer)
    }

    function buyTokens() public payable {
        require(msg.value > 0, "Invia ETH per comprare token");
        
        // Calcola l'importo dei token in base al tasso di cambio
        uint256 ethAmount = msg.value / 1e18;
        uint256 tokenAmount = ethAmount * rate;
        
        // Gestisci le frazioni di ETH
        uint256 remainder = msg.value % 1e18;
        if (remainder > 0) {
            uint256 additionalTokens = (remainder * rate) / 1e18;
            tokenAmount += additionalTokens;
        }

        console.log(
            "Tentativo di acquisto token. ETH inviati: %s wei, DNT richiesti: %s, DNT disponibili: %s", 
            msg.value,
            tokenAmount, 
            token.balanceOf(owner)  // Controlla il saldo del proprietario
        );
        
        // Verifica che l'owner abbia abbastanza token
        require(token.balanceOf(owner) >= tokenAmount, "L'owner non ha abbastanza token");
        
        // Richiedi al contratto token di trasferire i token dall'owner al compratore
        // Nota: richiede approvazione preventiva da parte dell'owner
        require(
            token.transferFrom(owner, msg.sender, tokenAmount), 
            "Trasferimento token fallito"
        );
        
        // Trasferisci immediatamente gli ETH all'owner
        (bool sent, ) = payable(owner).call{value: msg.value}("");
        require(sent, "Trasferimento ETH all'owner fallito");
        
        // Emetti evento
        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }
}