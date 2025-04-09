import React from "react";
import { useWeb3 } from "../../contexts/Web3Context";

export function WaitingForTransactionMessage() {
  const { txBeingSent } = useWeb3();
  
  if (!txBeingSent) return null;
  
  return (
    <div className="alert alert-info" role="alert">
      Waiting for transaction <strong>{txBeingSent}</strong> to be mined
    </div>
  );
}