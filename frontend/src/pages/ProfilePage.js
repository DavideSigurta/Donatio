import React from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { TransactionHistory } from "../components/transaction/TransactionHistory";
import { shortenAddress } from "../utils/formatters";

export function ProfilePage({ isOwner }) {
  const { selectedAddress, ethBalance, balance, tokenData } = useWeb3();
  const tokenSymbol = tokenData?.symbol || "DNT";

  return (
    <div>
      <h1 className="mb-4">Il Mio Profilo {isOwner && <span className="text-white badge bg-primary">Admin</span>}</h1>

      <div className="card shadow mb-4">
        <div className="card-header">
          <h5 className="mb-0">Informazioni Wallet</h5>
        </div>
        <div className="card-body">
          <p>
            <strong>Indirizzo:</strong> {selectedAddress}
          </p>
          <p>
            <strong>Saldo ETH:</strong> {ethBalance} ETH
          </p>
          <p>
            <strong>Saldo {tokenSymbol}:</strong> {balance} {tokenSymbol}
          </p>
          
          {isOwner && (
            <div className="mt-3 pt-3 border-top">
              <h6>Funzionalità Admin</h6>
              <div className="list-group mt-2">
                <Link to="/exchange" className="list-group-item list-group-item-action">
                  Deposito ETH nel Contratto
                </Link>
                <Link to="/admin/transactions" className="list-group-item list-group-item-action">
                  Visualizza Tutte le Transazioni
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

    {!isOwner && (
      <div className="mt-5 pt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="text-muted">Ultime transazioni</h4>
            <Link to="/profile/transactions" className="btn btn-outline-primary btn-sm">
              Vedi le mie transazioni
            </Link>
        </div>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <TransactionHistory />
        </div>
      </div>)}
    </div>
  );
}