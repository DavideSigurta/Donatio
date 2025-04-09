import React from "react";
import { useWeb3 } from "../../contexts/Web3Context";

export function TransactionErrorMessage() {
  const { transactionError, dismissTransactionError, getRpcErrorMessage } = useWeb3();
  
  if (!transactionError) return null;
  
  // Estrai un messaggio di errore leggibile
  const errorMessage = getRpcErrorMessage ? 
    getRpcErrorMessage(transactionError) : 
    transactionError.message || "Unknown error";
  
  return (
    <div className="alert alert-danger" role="alert">
      Error sending transaction: {errorMessage.substring(0, 100)}
      <button
        type="button"
        className="close"
        data-dismiss="alert"
        aria-label="Close"
        onClick={dismissTransactionError}
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}