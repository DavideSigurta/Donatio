import React from "react";
import { useWeb3 } from "../../contexts/Web3Context";
import { NetworkErrorMessage } from "./NetworkErrorMessage";

export function ConnectWallet() {
  const { connectWallet, networkError, dismissNetworkError } = useWeb3();
  
  const handleConnectClick = async () => {
    console.log("Tentativo di connessione wallet...");
    try {
      await connectWallet();
    } catch (error) {
      console.error("Errore durante la connessione:", error);
    }
  };
  
  return (
    <div className="container">
      <div className="row justify-content-md-center">
        <div className="col-12 text-center">
          {networkError && (
            <NetworkErrorMessage 
              message={networkError} 
              dismiss={dismissNetworkError} 
            />
          )}
        </div>
        <div className="col-6 p-4 text-center">
          <p>Please connect to your wallet.</p>
          <button
            className="btn btn-warning"
            type="button"
            onClick={handleConnectClick}  // Utilizziamo la nostra funzione wrapper
          >
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
}