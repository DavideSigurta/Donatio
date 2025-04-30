import React from "react";
import PropTypes from "prop-types";
import { shortenAddress, formatDate } from "../../utils/formatters";

/**
 * Componente che visualizza le transazioni di donazione relative a una campagna
 */
export function CampaignTransactions({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="alert alert-info">
        Nessuna donazione ricevuta finora.
      </div>
    );
  }
  
  return (
    <div className="campaign-transactions">
      <h4 className="mb-3">Donazioni ricevute</h4>
      
      <div className="list-group">
        {transactions.map((tx, index) => (
          <div key={index} className="list-group-item list-group-item-action">
            <div className="d-flex w-100 justify-content-between">
              <h6 className="mb-1">
                Donazione da {shortenAddress(tx.donor)}
              </h6>
              <small className="text-muted">{formatDate(tx.timestamp)}</small>
            </div>
            <p className="mb-1">
              <strong>{tx.amount} DNT</strong> donati
            </p>
            {tx.message && (
              <p className="text-muted mb-0">
                <small>"{tx.message}"</small>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

CampaignTransactions.propTypes = {
  transactions: PropTypes.arrayOf(
    PropTypes.shape({
      donor: PropTypes.string.isRequired,
      amount: PropTypes.string.isRequired,
      timestamp: PropTypes.number.isRequired,
      message: PropTypes.string
    })
  ).isRequired
};