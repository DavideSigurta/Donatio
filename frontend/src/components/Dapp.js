import React from "react";
import { useWeb3 } from "../contexts/Web3Context";

// Importazione dei componenti
import { NoWalletDetected } from "./common/NoWalletDetected";
import { ConnectWallet } from "./common/ConnectWallet";
import { Loading } from "./common/Loading";
import { Exchange } from "./exchange/Exchange";
import { AdminDashboard } from "./admin/AdminDashboard";
import { WaitingForTransactionMessage } from "./common/WaitingForTransactionMessage";
import { TransactionErrorMessage } from "./common/TransactionErrorMessage";

export function Dapp() {
  const {
    selectedAddress,
    tokenData,
    isOwner,
    txBeingSent,
    transactionError
  } = useWeb3();
  
  // Se MetaMask non è installato
  if (window.ethereum === undefined) {
    return <NoWalletDetected />;
  }
  
  // Se non abbiamo l'indirizzo dell'utente = non connesso
  if (!selectedAddress) {
    return <ConnectWallet />;
  }
  
  // Se non abbiamo inizializzato i dati del token, mostra loading
  if (!tokenData) {
    return <Loading />;
  }
  
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          {/* Il componente WaitingForTransactionMessage ora accede direttamente al context */}
          <WaitingForTransactionMessage />
          
          {/* Il componente TransactionErrorMessage ora accede direttamente al context */}
          <TransactionErrorMessage />
          
          {/* Mostra AdminDashboard o Exchange in base al ruolo dell'utente */}
          {isOwner ? (
            <AdminDashboard />
          ) : (
            <div className="card shadow">
              <div className="card-body p-4">
                <Exchange />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}