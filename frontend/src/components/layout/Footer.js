import React from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../../contexts/Web3Context";

export function Footer() {
  const { isOwner } = useWeb3();  // Aggiungi questa riga per accedere a isOwner

  return (
    <footer className="bg-light mt-auto py-4">
      <div className="container">
        <div className="row">
          <div className="col-md-6">
            <h5>Donatio</h5>
            <p className="text-muted">
              Piattaforma di donazioni basata su blockchain, trasparente e sicura.
            </p>
          </div>
          <div className="col-md-3">
            <h6>Collegamenti</h6>
            <ul className="list-unstyled">
              <li><Link to="/" className="text-decoration-none">Home</Link></li>
              <li><Link to="/campaigns" className="text-decoration-none">Campagne</Link></li>
              <li><Link to="/exchange" className="text-decoration-none">
                {isOwner ? "Deposito ETH" : "Exchange"}
              </Link></li>
            </ul>
          </div>
          <div className="col-md-3">
            <h6>Info</h6>
            <ul className="list-unstyled">
              <li><Link to="/about" className="text-decoration-none">Chi Siamo</Link></li>
              <li><Link to="/faq" className="text-decoration-none">FAQ</Link></li>
            </ul>
          </div>
        </div>
        <div className="row mt-3">
          <div className="col text-center">
            <p className="mb-0 text-muted">&copy; 2025 Donatio. Tutti i diritti riservati.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}