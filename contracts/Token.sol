//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.9;

import "hardhat/console.sol";

contract Token {
    string public name = "Donatio";
    string public symbol = "DNT";
    uint256 public totalSupply = 1000000000;
    address public owner;

    mapping(address => uint256) balances;
    // Nuova mapping per le approvazioni
    mapping(address => mapping(address => uint256)) allowances;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    // Nuovo evento per le approvazioni
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    constructor() {
        balances[msg.sender] = totalSupply;
        owner = msg.sender;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balances[msg.sender] >= amount, "Not enough tokens");

        console.log(
            "Transferring from %s to %s %s tokens",
            msg.sender,
            to,
            amount
        );

        balances[msg.sender] -= amount;
        balances[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true; // Aggiunto return per conformità ERC-20
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    // NUOVE FUNZIONI

    /**
     * @dev Imposta `amount` come approvazione di `spender` sul saldo del chiamante
     * Restituisce un valore booleano che indica se l'operazione è riuscita.
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev Restituisce l'ammontare di token che lo spender può spendere per conto dell'owner.
     */
    function allowance(address _owner, address spender) external view returns (uint256) {
        return allowances[_owner][spender];
    }

    /**
     * @dev Trasferisce `amount` token da `sender` a `recipient` utilizzando il meccanismo di allowance.
     * `amount` viene poi dedotto dall'allowance del chiamante.
     * Restituisce un valore booleano che indica se l'operazione è riuscita.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        require(balances[sender] >= amount, "Not enough tokens");
        require(allowances[sender][msg.sender] >= amount, "Not enough allowance");
        
        console.log(
            "Transferring from %s to %s %s tokens",
            sender,
            recipient,
            amount
        );

        balances[sender] -= amount;
        balances[recipient] += amount;
        allowances[sender][msg.sender] -= amount;
        
        emit Transfer(sender, recipient, amount);
        return true;
    }
}