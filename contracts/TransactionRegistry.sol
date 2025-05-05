// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

/**
 * @title TransactionRegistry
 * @dev Contratto per il tracciamento centralizzato delle transazioni
 */
contract TransactionRegistry {
    address public owner;
    
    // Tipi di transazione supportati
    enum TransactionType {
        EXCHANGE_BUY,     // Acquisto di token con ETH
        EXCHANGE_SELL,    // Vendita di token per ETH
        ETH_DEPOSIT,      // Deposito di ETH nel sistema
        DONATION,         // Donazione
        MILESTONE_RELEASE,// Pagamento di una milestone
        MILESTONE_REFUND  // Rimborso di una milestone
    }
    
    // Struttura per le transazioni
    struct Transaction {
        address user;
        TransactionType transactionType;
        uint256 tokenAmount;
        uint256 etherAmount;
        uint256 timestamp;
    }
    
    // Array per memorizzare tutte le transazioni
    Transaction[] public allTransactions;
    
    // Mapping per tracciare le transazioni di ogni utente
    mapping(address => uint256[]) private userTransactionIndexes;
    
    // Mapping per autorizzare contratti esterni
    mapping(address => bool) public authorizedContracts;

    //mappa degli indirizzi autorizzati a registrare transazioni
    mapping(address => bool) public authorizedManagers;
    
    // EVENTI
    event TransactionRecorded(
        address indexed user,
        uint256 indexed transactionIndex,
        TransactionType indexed transactionType,
        uint256 tokenAmount,
        uint256 etherAmount,
        uint256 timestamp
    );
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyAuthorized() {
        require(
            authorizedContracts[msg.sender] || msg.sender == owner,
            "Non autorizzato"
        );
        _;
    }
    
    /**
     * @dev Autorizza o revoca un contratto a registrare transazioni
     */
    function setContractAuthorization(address contractAddress, bool isAuthorized) public {
        require(
            msg.sender == owner || authorizedManagers[msg.sender],
            "Solo l'owner o i manager autorizzati possono autorizzare contratti"
        );
        authorizedContracts[contractAddress] = isAuthorized;
    }

    function setManagerAuthorization(address manager, bool isAuthorized) public {
        require(msg.sender == owner, "Solo l'owner puo' autorizzare manager");
        authorizedManagers[manager] = isAuthorized;
    }
    
    /**
     * @dev Registra una nuova transazione
     */
    function recordTransaction(
        address user,
        TransactionType transactionType,
        uint256 tokenAmount,
        uint256 etherAmount
    ) 
        public 
        onlyAuthorized 
        returns (uint256) 
    {
        uint256 transactionIndex = allTransactions.length;
        
        allTransactions.push(Transaction({
            user: user,
            transactionType: transactionType,
            tokenAmount: tokenAmount,
            etherAmount: etherAmount,
            timestamp: block.timestamp
        }));
        
        userTransactionIndexes[user].push(transactionIndex);
        
        emit TransactionRecorded(
            user,
            transactionIndex,
            transactionType,
            tokenAmount,
            etherAmount,
            block.timestamp
        );
        
        return transactionIndex;
    }
    
    /**
     * @dev Restituisce il numero totale di transazioni
     */
    function getTransactionCount() public view returns (uint256) {
        return allTransactions.length;
    }
    
    /**
     * @dev Restituisce il numero di transazioni di un utente
     */
    function getUserTransactionCount(address user) public view returns (uint256) {
        return userTransactionIndexes[user].length;
    }
    
    /**
     * @dev Restituisce una transazione specifica
     */
    function getTransaction(uint256 index) public view returns (
        address user,
        TransactionType transactionType,
        uint256 tokenAmount,
        uint256 etherAmount,
        uint256 timestamp
    ) {
        require(index < allTransactions.length, "Indice non valido");
        
        Transaction storage transaction = allTransactions[index];
        return (
            transaction.user,
            transaction.transactionType,
            transaction.tokenAmount,
            transaction.etherAmount,
            transaction.timestamp
        );
    }
    
    /**
     * @dev Restituisce un batch di transazioni
     */
    function getTransactionBatch(uint256 start, uint256 count) public view returns (
        address[] memory users,
        TransactionType[] memory transactionTypes,
        uint256[] memory tokenAmounts,
        uint256[] memory etherAmounts,
        uint256[] memory timestamps
    ) {
        require(start < allTransactions.length, "Indice di partenza non valido");
        
        if (start + count > allTransactions.length) {
            count = allTransactions.length - start;
        }
        
        users = new address[](count);
        transactionTypes = new TransactionType[](count);
        tokenAmounts = new uint256[](count);
        etherAmounts = new uint256[](count);
        timestamps = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            Transaction storage transaction = allTransactions[start + i];
            users[i] = transaction.user;
            transactionTypes[i] = transaction.transactionType;
            tokenAmounts[i] = transaction.tokenAmount;
            etherAmounts[i] = transaction.etherAmount;
            timestamps[i] = transaction.timestamp;
        }
        
        return (users, transactionTypes, tokenAmounts, etherAmounts, timestamps);
    }
    
    /**
     * @dev Restituisce le transazioni di un utente specifico
     */
    function getUserTransactions(address user, uint256 start, uint256 count) public view returns (
        uint256[] memory transactionIndexes,
        TransactionType[] memory transactionTypes,
        uint256[] memory tokenAmounts,
        uint256[] memory etherAmounts,
        uint256[] memory timestamps
    ) {
        uint256[] storage userIndexes = userTransactionIndexes[user];
        
        require(start < userIndexes.length, "Indice di partenza non valido");
        
        if (start + count > userIndexes.length) {
            count = userIndexes.length - start;
        }
        
        transactionIndexes = new uint256[](count);
        transactionTypes = new TransactionType[](count);
        tokenAmounts = new uint256[](count);
        etherAmounts = new uint256[](count);
        timestamps = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 txIndex = userIndexes[start + i];
            transactionIndexes[i] = txIndex;
            
            Transaction storage transaction = allTransactions[txIndex];
            transactionTypes[i] = transaction.transactionType;
            tokenAmounts[i] = transaction.tokenAmount;
            etherAmounts[i] = transaction.etherAmount;
            timestamps[i] = transaction.timestamp;
        }
        
        return (transactionIndexes, transactionTypes, tokenAmounts, etherAmounts, timestamps);
    }
}