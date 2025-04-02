    //SPDX-License-Identifier: UNLICENSED

    pragma solidity ^0.8.9;

    import "hardhat/console.sol";

    /**
     * @title Donatio Token (DNT)
     * @dev Implementazione semplificata di un token ERC-20 per il progetto Donatio
     * Consente trasferimenti di token, approvazioni e trasferimenti tramite terzi
     */
    contract Token {
        // Nome completo del token
        string public name = "Donatio";
        // Simbolo del token (ticker)
        string public symbol = "DNT";
        // Offerta totale di token (1 miliardo)
        uint256 public totalSupply = 1000000000;
        // Indirizzo del proprietario del contratto (deployer)
        address public owner;

        // Mappatura che associa ogni indirizzo al proprio saldo di token
        mapping(address => uint256) balances;
        // Mappatura che associa il proprietario a un'ulteriore mappatura che traccia le approvazioni per ogni indirizzo
        mapping(address => mapping(address => uint256)) allowances;

        // EVENTI
        // Emesso quando i token vengono trasferiti da un indirizzo a un altro
        event Transfer(address indexed _from, address indexed _to, uint256 _value);
        // Emesso quando un proprietario di token approva un altro indirizzo a spendere i suoi token
        event Approval(address indexed _owner, address indexed _spender, uint256 _value);

        /**
         * @dev Costruttore che inizializza il token
         * Assegna l'intera offerta totale al deployer e imposta il proprietario
         */
        constructor() {
            balances[msg.sender] = totalSupply;
            owner = msg.sender;
        }

        /**
         * @dev Trasferisce token dal mittente a un destinatario specificato
         * @param to L'indirizzo del destinatario
         * @param amount La quantità di token da trasferire
         * @return true se il trasferimento ha successo
         */
        function transfer(address to, uint256 amount) external returns (bool) {
            // Verifica che il mittente abbia token sufficienti
            require(balances[msg.sender] >= amount, "Not enough tokens");

            console.log(
                "Transferring from %s to %s %s tokens",
                msg.sender,
                to,
                amount
            );

            // Esegue il trasferimento aggiornando i saldi
            balances[msg.sender] -= amount;
            balances[to] += amount;

            // Emette l'evento di trasferimento
            emit Transfer(msg.sender, to, amount);
            return true;
        }

        /**
         * @dev Restituisce il saldo di token per un indirizzo specifico
         * @param account L'indirizzo del quale si vuole controllare il saldo
         * @return Il saldo attuale dell'account
         */
        function balanceOf(address account) external view returns (uint256) {
            return balances[account];
        }

        /**
         * @dev Approva un altro indirizzo (spender) a spendere token per conto del mittente
         * @param spender L'indirizzo autorizzato a spendere
         * @param amount La quantità massima di token che può essere spesa
         * @return true se l'approvazione ha successo
         */
        function approve(address spender, uint256 amount) external returns (bool) {
            allowances[msg.sender][spender] = amount;
            emit Approval(msg.sender, spender, amount);
            return true;
        }

        /**
         * @dev Verifica quanti token uno spender è autorizzato a spendere per conto di un proprietario
         * @param _owner Il proprietario dei token
         * @param spender L'indirizzo autorizzato a spendere
         * @return La quantità di token ancora spendibili
         */
        function allowance(address _owner, address spender) external view returns (uint256) {
            return allowances[_owner][spender];
        }

        /**
         * @dev Trasferisce token da un mittente a un destinatario tramite un intermediario autorizzato
         * @param sender L'indirizzo dal quale prelevare i token
         * @param recipient L'indirizzo del destinatario
         * @param amount La quantità di token da trasferire
         * @return true se il trasferimento ha successo
         */
        function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
            // Verifica che il mittente abbia token sufficienti
            require(balances[sender] >= amount, "Not enough tokens");
            // Verifica che l'intermediario sia autorizzato a spendere la quantità richiesta
            require(allowances[sender][msg.sender] >= amount, "Not enough allowance");
            
            console.log(
                "Transferring from %s to %s %s tokens",
                sender,
                recipient,
                amount
            );

            // Esegue il trasferimento aggiornando i saldi
            balances[sender] -= amount;
            balances[recipient] += amount;
            // Riduce l'allowance dell'intermediario
            allowances[sender][msg.sender] -= amount;
            
            // Emette l'evento di trasferimento
            emit Transfer(sender, recipient, amount);
            return true;
        }
    }