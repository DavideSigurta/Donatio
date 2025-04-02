    //SPDX-License-Identifier: UNLICENSED
    pragma solidity ^0.8.9;

    import "./Token.sol";
    import "hardhat/console.sol";

    /**
     * @title TokenExchange
     * @dev Contratto per lo scambio tra ETH e token DNT
     * Consente acquisto di token con ETH e vendita di token per ricevere ETH
     */
    contract TokenExchange {
        // Contratto del token DNT
        Token public token;
        
        // Indirizzo del proprietario del contratto (deployer)
        address public owner;
        
        // Tasso di cambio: 1 ETH = 100 DNT
        uint256 public rate = 100;

        // EVENTI
        // Emesso quando un utente acquista token con ETH
        event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
        
        // Emesso quando un utente vende token per ETH
        event TokensSold(address indexed seller, uint256 tokenAmount, uint256 ethAmount);
        
        // Emesso quando viene depositato ETH nel contratto
        event ETHDeposited(address indexed depositor, uint256 amount);

        /**
         * @dev Costruttore che imposta il token e il proprietario
         * @param _tokenAddress Indirizzo del contratto token DNT
         */
        constructor(address _tokenAddress) {
            token = Token(_tokenAddress);
            owner = msg.sender;
        }

        /**
         * @dev Funzione per acquistare token DNT con ETH
         * Gli ETH inviati vengono trasferiti all'owner, i token vengono presi dal wallet dell'owner
         */
        function buyTokens() public payable {
            require(msg.value > 0, "Invia ETH per comprare token");
            
            // Calcola quanti token dare in base agli ETH inviati
            uint256 tokenAmount = (msg.value * rate) / 1e18;
            
            console.log(
                "Tentativo di acquisto token. ETH inviati: %s wei, DNT richiesti: %s, DNT disponibili: %s", 
                msg.value,
                tokenAmount, 
                token.balanceOf(owner)
            );
            
            // Verifica disponibilità token
            require(token.balanceOf(owner) >= tokenAmount, "L'owner non ha abbastanza token");
            require(token.allowance(owner, address(this)) >= tokenAmount, "Approvazione insufficiente");
            
            // Trasferisci token dall'owner all'acquirente
            require(token.transferFrom(owner, msg.sender, tokenAmount), "Trasferimento token fallito");
            
            // Trasferisci ETH all'owner
            (bool sent, ) = payable(owner).call{value: msg.value}("");
            require(sent, "Trasferimento ETH all'owner fallito");
            
            // Emetti evento di acquisto completato
            emit TokensPurchased(msg.sender, msg.value, tokenAmount);
        }

        /**
         * @dev Funzione per vendere token DNT e ricevere ETH in cambio
         * I token DNT vengono trasferiti all'owner, gli ETH vengono presi dal contratto
         * @param tokenAmount La quantità di token da vendere
         */
        function sellTokens(uint256 tokenAmount) public {
            require(tokenAmount > 0, "Specifica la quantita di token da vendere");
            
            // Calcola quanti ETH dare in cambio
            uint256 ethAmount = (tokenAmount * 1e18) / rate;
            
            console.log(
                "Vendita token. DNT offerti: %s, ETH richiesti: %s", 
                tokenAmount,
                ethAmount
            );
            
            // Verifica che ci sia abbastanza ETH nel contratto
            require(address(this).balance >= ethAmount, "Non c'e abbastanza ETH nel contratto");
            
            // Trasferisci token dall'utente al contratto
            require(token.transferFrom(msg.sender, address(this), tokenAmount), "Trasferimento token fallito");
            
            // Trasferisci i token ricevuti all'owner
            require(token.transfer(owner, tokenAmount), "Trasferimento token all'owner fallito");
            
            // Invia ETH all'utente immediatamente
            (bool sent, ) = payable(msg.sender).call{value: ethAmount}("");
            require(sent, "Trasferimento ETH all'utente fallito");
            
            // Emetti evento di vendita completata
            emit TokensSold(msg.sender, tokenAmount, ethAmount);
        }
        
        /**
         * @dev Funzione esplicita per l'owner per depositare ETH nel contratto
         * Utile per avere fondi disponibili per acquistare token dagli utenti
         */
        function depositETH() public payable {
            require(msg.sender == owner, "Solo l'owner puo' depositare ETH");
            require(msg.value > 0, "Importo deve essere maggiore di zero");
            
            // Emetti evento per tracciare il deposito
            emit ETHDeposited(msg.sender, msg.value);
        }
        
        /**
         * @dev Funzione fallback per accettare ETH inviati direttamente al contratto
         */
        receive() external payable {
            // Se il deposito è fatto dall'owner, emetti l'evento
                if (msg.sender == owner) {
                emit ETHDeposited(msg.sender, msg.value);
            }
        }
        
        /**
         * @dev Permette all'owner di ritirare tutto l'ETH dal contratto
         * Utile in caso di emergenza o per recuperare fondi inutilizzati
         */
        function withdrawETH() public {
            require(msg.sender == owner, "Solo l'owner puo ritirare ETH");
            
            uint256 amount = address(this).balance;
            (bool sent, ) = payable(owner).call{value: amount}("");
            require(sent, "Trasferimento ETH fallito");
        }
        
        /**
         * @dev Permette all'owner di ritirare tutti i token dal contratto
         * Utile per recuperare token ricevuti dagli utenti durante le vendite
         */
        function withdrawTokens() public {
            require(msg.sender == owner, "Solo l'owner puo ritirare token");
            
            uint256 tokenBalance = token.balanceOf(address(this));
            require(tokenBalance > 0, "Nessun token da ritirare");
            require(token.transfer(owner, tokenBalance), "Trasferimento token fallito");
        }
    }