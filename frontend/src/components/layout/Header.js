import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useWeb3 } from "../../contexts/Web3Context";
import { shortenAddress } from "../../utils/formatters";

export function Header() {
  // Aggiunto isAdmin nella destructuring del useWeb3
  const { selectedAddress, connectWallet, isOwner, isAuthorizedCreator, isAdmin } = useWeb3();
  const [showDropdown, setShowDropdown] = useState(false);
  
  const toggleDropdown = () => setShowDropdown(!showDropdown);
  
  return (
    <header className="bg-white shadow-sm">
      <div className="container-fluid py-2">
        {/* Usiamo il sistema a griglia di Bootstrap invece della navbar standard */}
        <div className="row align-items-center">
          {/* Colonna di sinistra per il logo */}
          <div className="col-md-4 d-flex justify-content-start">
            <Link to="/" className="navbar-brand">
              <img 
                src="/Donatio_logo_no_bg.png" 
                alt="Donatio Logo" 
                height="100"
                className="d-inline-block align-top"
              />
            </Link>
          </div>
          
          {/* Colonna centrale per la navigazione - SEMPRE centrata */}
          <div className="col-md-4 d-flex justify-content-center">
            <ul className="nav nav-pills d-flex w-100 justify-content-between">
              <li className="nav-item" style={{ width: "150px" }}>
                <NavLink to="/" className="nav-link text-center w-100" end>Home</NavLink>
              </li>
              <li className="nav-item" style={{ width: "150px" }}>
                <NavLink to="/campaigns" className="nav-link text-center w-100">Campagne</NavLink>
              </li>
              <li className="nav-item" style={{ width: "150px" }}>
                <NavLink to="/exchange" className="nav-link text-center w-100">
                  {isOwner ? "Deposita ETH" : "Exchange"}
                </NavLink>
              </li>
            </ul>
          </div>

          
          {/* Colonna di destra per il wallet */}
          <div className="col-md-4 d-flex justify-content-end">
            {!selectedAddress ? (
              <button 
                className="btn btn-primary" 
                onClick={connectWallet}
              >
                Connect Wallet
              </button>
            ) : (
              <div className="dropdown">
                <button 
                  className="btn btn-outline-primary dropdown-toggle" 
                  onClick={toggleDropdown}
                >
                  {shortenAddress(selectedAddress)}
                </button>
                {showDropdown && (
                  <div className="dropdown-menu show dropdown-menu-right">
                    <Link to="/profile" className="dropdown-item" onClick={toggleDropdown}>
                      Il Mio Profilo
                    </Link>
                    <div className="dropdown-divider"></div>
                    <Link to="/profile/transactions" className="dropdown-item" onClick={toggleDropdown}>
                      {isOwner ? "Transazioni Globali" : "Le mie Transazioni"}
                    </Link>
                    
                    <div className="dropdown-divider"></div>
                    
                    {/* Sezione con funzionalità amministrative */}
                    {isOwner && (
                      <>
                        <Link to="/admin/creator-requests" className="dropdown-item" onClick={toggleDropdown}>
                          Richieste Creatori
                        </Link>
                        
                        {/* Aggiungi il link alla dashboard di governance solo per gli admin */}
                        {isAdmin && (
                          <Link to="/admin/governance" className="dropdown-item" onClick={toggleDropdown}>
                            <i className="bi bi-clipboard-data me-2"></i>
                            Dashboard Governance
                          </Link>
                        )}
                      </>
                    )}
                    
                    {/* Link per richiedere di diventare creatore */}
                    {!isOwner && !isAuthorizedCreator && (
                      <Link to="/request-creator" className="dropdown-item" onClick={toggleDropdown}>
                        Diventa Creatore
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}