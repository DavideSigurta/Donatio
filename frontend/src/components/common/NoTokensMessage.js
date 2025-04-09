import React from "react";
import { useWeb3 } from "../../contexts/Web3Context";

export function NoTokensMessage() {
  const { selectedAddress } = useWeb3();
  
  return (
    <>
      <p>You don't have tokens to transfer</p>
      <p>
        To get some tokens, open a terminal in the root of the repository and run: 
        <br />
        <br />
        <code>npx hardhat --network localhost faucet {selectedAddress}</code>
      </p>
    </>
  );
}