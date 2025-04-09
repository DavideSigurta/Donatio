//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./Token.sol";
import "./TransactionRegistry.sol";
import "hardhat/console.sol";

/**
 * @title TokenExchange
 * @dev Contratto per lo scambio tra ETH e token DNT
 * Consente acquisto di token con ETH e vendita di token per ricevere ETH
 */
contract TokenExchange {
    // Contratto del token DNT
    Token public token;
    
    // Registro delle transazioni
    TransactionRegistry public transactionRegistry;
    
    // Indirizzo del proprietario del contratto (deployer)
    address public owner;
    
    // Tasso di cambio: 1 ETH = 100 DNT (ora con 18 decimali come ETH)
    uint256 public rate = 100;

    // EVENTI
    // Emesso quando un utente acquista token con ETH
    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    
    // Emesso quando un utente vende token per ETH
    event TokensSold(address indexed seller, uint256 tokenAmount, uint256 ethAmount);
    
    // Emesso quando viene depositato ETH nel contratto
    event ETHDeposited(address indexed depositor, uint256 amount);
    
    // Evento dettagliato per le transazioni
    event TransactionExecuted(
        address indexed user,
        bool indexed isBuy,
        uint256 tokenAmount,
        uint256 etherAmount,
        uint256 timestamp
    );

    /**
     * @dev Costruttore che imposta il token, il registro transazioni e il proprietario
     * @param _tokenAddress Indirizzo del contratto token DNT
     * @param _registryAddress Indirizzo del registro transazioni
     */
    constructor(address _tokenAddress, address _registryAddress) {
        token = Token(_tokenAddress);
        transactionRegistry = TransactionRegistry(_registryAddress);
        owner = msg.sender;
    }

    /**
     * @dev Funzione per acquistare token DNT con ETH
     */
    function buyTokens() public payable {
        require(msg.value > 0, "Invia ETH per comprare token");
        
        // Calcola quanti token dare in base agli ETH inviati
        // MODIFICATO: non divide più per 1e18 perché ora i token hanno 18 decimali come ETH
        uint256 tokenAmount = msg.value * rate;
        
        // Verifica disponibilità token
        require(token.balanceOf(owner) >= tokenAmount, "L'owner non ha abbastanza token");
        require(token.allowance(owner, address(this)) >= tokenAmount, "Approvazione insufficiente");
        
        // Trasferisci token dall'owner all'acquirente
        require(token.transferFrom(owner, msg.sender, tokenAmount), "Trasferimento token fallito");
        
        // Trasferisci ETH all'owner
        (bool sent, ) = payable(owner).call{value: msg.value}("");
        require(sent, "Trasferimento ETH all'owner fallito");
        
        // Registra la transazione nel registro
        transactionRegistry.recordTransaction(
            msg.sender,
            TransactionRegistry.TransactionType.EXCHANGE_BUY,
            tokenAmount,
            msg.value
        );
        
        // Emetti eventi di acquisto completato
        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
        emit TransactionExecuted(msg.sender, true, tokenAmount, msg.value, block.timestamp);
    }

    /**
     * @dev Funzione per vendere token DNT e ricevere ETH in cambio
     * @param tokenAmount La quantità di token da vendere
     */
    function sellTokens(uint256 tokenAmount) public {
        require(tokenAmount > 0, "Specifica la quantita di token da vendere");
        
        // Calcola quanti ETH dare in cambio
        // MODIFICATO: non moltiplica più per 1e18 perché ora i token hanno 18 decimali come ETH
        uint256 ethAmount = tokenAmount / rate;
        
        // Verifica che ci sia abbastanza ETH nel contratto
        require(address(this).balance >= ethAmount, "Non c'e abbastanza ETH nel contratto");
        
        // 1. CHECKS - Verifiche completate sopra
        
        // 2. EFFECTS - Registra la transazione e emetti eventi
        transactionRegistry.recordTransaction(
            msg.sender,
            TransactionRegistry.TransactionType.EXCHANGE_SELL,
            tokenAmount,
            ethAmount
        );
        
        emit TokensSold(msg.sender, tokenAmount, ethAmount);
        emit TransactionExecuted(msg.sender, false, tokenAmount, ethAmount, block.timestamp);
        
        // 3. INTERACTIONS - Trasferimenti esterni
        require(token.transferFrom(msg.sender, address(this), tokenAmount), "Trasferimento token fallito");
        require(token.transfer(owner, tokenAmount), "Trasferimento token all'owner fallito");
        
        (bool sent, ) = payable(msg.sender).call{value: ethAmount}("");
        require(sent, "Trasferimento ETH all'utente fallito");
    }
        
    /**
     * @dev Funzione per l'owner per depositare ETH nel contratto
     */
    function depositETH() public payable {
        require(msg.sender == owner, "Solo l'owner puo' depositare ETH");
        require(msg.value > 0, "Importo deve essere maggiore di zero");
        
        // Registra la transazione
        transactionRegistry.recordTransaction(
            msg.sender,
            TransactionRegistry.TransactionType.ETH_DEPOSIT,
            0,
            msg.value
        );
        
        // Emetti eventi
        emit ETHDeposited(msg.sender, msg.value);
        emit TransactionExecuted(msg.sender, true, 0, msg.value, block.timestamp);
    }
    
    /**
     * @dev Funzione fallback per ETH inviati direttamente
     */
    receive() external payable {
        if (msg.sender == owner) {
            transactionRegistry.recordTransaction(
                msg.sender,
                TransactionRegistry.TransactionType.ETH_DEPOSIT,
                0,
                msg.value
            );
            
            emit ETHDeposited(msg.sender, msg.value);
            emit TransactionExecuted(msg.sender, true, 0, msg.value, block.timestamp);
        }
    }
    
    /**
     * @dev Permette all'owner di ritirare ETH dal contratto
     */
    function withdrawETH() public {
        require(msg.sender == owner, "Solo l'owner puo ritirare ETH");
        
        uint256 amount = address(this).balance;
        require(amount > 0, "Nessun ETH da ritirare");
        
        // Registra la transazione
        transactionRegistry.recordTransaction(
            msg.sender,
            TransactionRegistry.TransactionType.ETH_WITHDRAW,
            0,
            amount
        );
        
        emit TransactionExecuted(msg.sender, false, 0, amount, block.timestamp);
        
        (bool sent, ) = payable(owner).call{value: amount}("");
        require(sent, "Trasferimento ETH fallito");
    }
    
    /**
     * @dev Permette all'owner di ritirare token dal contratto
     */
    function withdrawTokens() public {
        require(msg.sender == owner, "Solo l'owner puo ritirare token");
        
        uint256 tokenBalance = token.balanceOf(address(this));
        require(tokenBalance > 0, "Nessun token da ritirare");
        
        // Registra la transazione
        transactionRegistry.recordTransaction(
            msg.sender,
            TransactionRegistry.TransactionType.TOKEN_WITHDRAW,
            tokenBalance,
            0
        );
        
        emit TransactionExecuted(msg.sender, false, tokenBalance, 0, block.timestamp);
        
        require(token.transfer(owner, tokenBalance), "Trasferimento token fallito");
    }
    
    /**
     * @dev Funzioni di compatibilità per il frontend esistente
     */
    
    function getTransactionCount() public view returns (uint256) {
        return transactionRegistry.getTransactionCount();
    }
    
    function getTransaction(uint256 index) public view returns (
        address user,
        bool isBuy,
        uint256 tokenAmount,
        uint256 etherAmount,
        uint256 timestamp
    ) {
        (
            address _user,
            TransactionRegistry.TransactionType transactionType,
            uint256 _tokenAmount,
            uint256 _etherAmount,
            uint256 _timestamp
        ) = transactionRegistry.getTransaction(index);
        
        // Converti il tipo di transazione in bool isBuy per retrocompatibilità
        bool _isBuy = (
            transactionType == TransactionRegistry.TransactionType.EXCHANGE_BUY || 
            transactionType == TransactionRegistry.TransactionType.ETH_DEPOSIT
        );
        
        return (_user, _isBuy, _tokenAmount, _etherAmount, _timestamp);
    }
    
    function getTransactionBatch(uint256 start, uint256 count) public view returns (
        address[] memory users,
        bool[] memory isBuys,
        uint256[] memory tokenAmounts,
        uint256[] memory etherAmounts,
        uint256[] memory timestamps
    ) {
        (
            address[] memory _users,
            TransactionRegistry.TransactionType[] memory transactionTypes,
            uint256[] memory _tokenAmounts,
            uint256[] memory _etherAmounts,
            uint256[] memory _timestamps
        ) = transactionRegistry.getTransactionBatch(start, count);
        
        users = _users;
        tokenAmounts = _tokenAmounts;
        etherAmounts = _etherAmounts;
        timestamps = _timestamps;
        
        isBuys = new bool[](transactionTypes.length);
        for (uint256 i = 0; i < transactionTypes.length; i++) {
            isBuys[i] = (
                transactionTypes[i] == TransactionRegistry.TransactionType.EXCHANGE_BUY || 
                transactionTypes[i] == TransactionRegistry.TransactionType.ETH_DEPOSIT
            );
        }
        
        return (users, isBuys, tokenAmounts, etherAmounts, timestamps);
    }
}