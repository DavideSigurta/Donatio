import React from "react";
import { Exchange } from "../components/exchange/Exchange";

export function ExchangePage() {
  return (
    <div>
      <h1 className="mb-4">Exchange</h1>
      <div className="card shadow">
          <Exchange />
      </div>
      <div className="mt-4">
        <p className="text-muted">
          In questa sezione puoi scambiare ETH per token DNT e viceversa. I token DNT possono essere utilizzati per fare donazioni alle campagne.
        </p>
      </div>
    </div>
  );
}