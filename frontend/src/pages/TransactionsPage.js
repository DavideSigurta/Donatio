import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { TransactionHistory } from "../components/transaction/TransactionHistory";
import { useWeb3 } from "../contexts/Web3Context";

export function TransactionsPage() {
  const { transactions, transactionsLoading } = useWeb3();
  
  // Stato per i filtri
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'buy', 'sell', 'donation'
  const [periodFilter, setPeriodFilter] = useState('all'); // 'all', 'today', 'yesterday', 'week', 'month', 'lastMonth'

  // Funzione per filtrare le transazioni per periodo
  const filterByPeriod = (tx, period) => {
    if (period === 'all') return true;

    const txDate = new Date(tx.timestamp * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    // Primo giorno del mese scorso
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    // Ultimo giorno del mese scorso
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    
    switch (period) {
      case 'today':
        return txDate >= today;
      case 'yesterday':
        return txDate >= yesterday && txDate < today;
      case 'week':
        return txDate >= weekAgo;
      case 'month':
        return txDate >= monthAgo;
      case 'lastMonth':
        return txDate >= firstDayLastMonth && txDate <= lastDayLastMonth;
      default:
        return true;
    }
  };

  // Filtrare le transazioni in base ai filtri attivi
  const filteredTransactions = useMemo(() => {
    if (!transactions || transactionsLoading) return [];
    
    return transactions.filter(tx => {
      // Filtra per tipo
      const typeMatch = typeFilter === 'all' || tx.type === typeFilter;
      
      // Filtra per periodo
      const periodMatch = filterByPeriod(tx, periodFilter);
      
      return typeMatch && periodMatch;
    });
  }, [transactions, typeFilter, periodFilter, transactionsLoading]);

  return (
    <div>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/profile">Profilo</Link></li>
          <li className="breadcrumb-item active" aria-current="page">Le Mie Transazioni</li>
        </ol>
      </nav>

      <h1 className="mb-4">Le Mie Transazioni</h1>
      <p className="text-muted mb-4">
        Qui puoi vedere tutte le transazioni che hai effettuato sulla piattaforma Donatio.
      </p>
      
      {/* Sezione filtri */}
      <div className="mb-4">
        <div className="row align-items-center">
          <div className="col-md-6 mb-3 mb-md-0">
            <div className="d-flex align-items-center">
              <label htmlFor="typeFilter" className="form-label me-3 mb-0 mr-2">Tipo di transazione:</label>
              <select 
                id="typeFilter" 
                className="form-select" 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Tutte le transazioni</option>
                <option value="buy">Acquisti</option>
                <option value="sell">Vendite</option>
                <option value="donation">Donazioni</option>
                <option value="milestone-release">Rilasci Milestone</option>
                <option value="milestone-refund">Rimborsi Milestone</option>
              </select>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="d-flex align-items-center">
              <label htmlFor="periodFilter" className="form-label me-3 mb-0 mr-2">Periodo:</label>
              <select 
                id="periodFilter" 
                className="form-select" 
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
              >
                <option value="all">Tutto il periodo</option>
                <option value="today">Oggi</option>
                <option value="yesterday">Ieri</option>
                <option value="week">Ultimi 7 giorni</option>
                <option value="month">Ultimi 30 giorni</option>
                <option value="lastMonth">Mese scorso</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Passiamo le transazioni filtrate al componente sovrascrivendo la proprietà dal context */}
      <TransactionHistory 
        customTransactions={filteredTransactions} 
        customIsLoading={transactionsLoading} 
      />
    </div>
  );
}