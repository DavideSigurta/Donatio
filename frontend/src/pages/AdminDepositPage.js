import React from "react";
import { Link } from "react-router-dom";
import { AdminDashboard } from "../components/admin/AdminDashboard";

export function AdminDepositPage() {
  return (
    <div>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/">Home</Link></li>
          <li className="breadcrumb-item active" aria-current="page">Deposito ETH</li>
        </ol>
      </nav>

      <h1 className="mb-4">Deposito di ETH nel Contratto</h1>
      <p className="text-muted mb-4">
        In questa sezione puoi depositare ETH nel contratto di scambio per garantire la liquidità necessaria per le operazioni di vendita di DNT.
      </p>
      
      <AdminDashboard />
    </div>
  );
}