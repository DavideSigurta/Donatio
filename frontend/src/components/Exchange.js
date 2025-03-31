    import React, { useState } from "react";
    import { ethers } from "ethers";

    export function Exchange({ buyTokens, ethBalance, dntBalance, exchangeRate }) {
    const [dntAmount, setDntAmount] = useState("");
    const [ethAmount, setEthAmount] = useState("");
    const [loading, setLoading] = useState(false);

    // Aggiorna ETH quando DNT cambia
    const updateEthFromDnt = (dntValue) => {
        if (!dntValue || isNaN(dntValue) || exchangeRate === 0) {
        setEthAmount("");
        return;
        }
        const calculatedEth = Number(dntValue) / exchangeRate;
        setEthAmount(calculatedEth.toFixed(6));
    };

    // Aggiorna DNT quando ETH cambia
    const updateDntFromEth = (ethValue) => {
        if (!ethValue || isNaN(ethValue)) {
        setDntAmount("");
        return;
        }
        const calculatedDnt = Number(ethValue) * exchangeRate;
        setDntAmount(calculatedDnt.toString());
    };

    // Gestori di input
    const handleDntChange = (e) => {
        const value = e.target.value;
        setDntAmount(value);
        updateEthFromDnt(value);
    };

    const handleEthChange = (e) => {
        const value = e.target.value;
        setEthAmount(value);
        updateDntFromEth(value);
    };

    // Esegui lo scambio
    const handleBuy = async (e) => {
        e.preventDefault();
        if (!ethAmount || isNaN(ethAmount) || Number(ethAmount) <= 0) return;
        
        setLoading(true);
        try {
        // Converti l'importo in wei
        const weiAmount = ethers.utils.parseEther(ethAmount);
        await buyTokens(weiAmount);
        
        // Pulisci i campi dopo lo scambio
        setDntAmount("");
        setEthAmount("");
        } catch (error) {
        console.error("Errore nell'acquisto dei token:", error);
        } finally {
        setLoading(false);
        }
    };

    return (
        <div className="exchange-container">
        <h3 className="mb-4">Exchange ETH/DNT</h3>
        
        <p className="mb-4">
            Il tuo saldo: <strong>{dntBalance.toString()} DNT</strong>
            <br />
            <small className="text-muted">Tasso di cambio: 1 ETH = {exchangeRate} DNT</small>
        </p>

        <form onSubmit={handleBuy} className="d-flex flex-column gap-3">
            <div className="form-group">
            <label>Quantità di DNT da ricevere:</label>
            <input
                className="form-control form-control-lg"
                type="number"
                step="any"
                min="0"
                value={dntAmount}
                onChange={handleDntChange}
                placeholder="100"
                disabled={loading}
            />
            </div>

            <div className="form-group">
            <label>Quantità di ETH da spendere:</label>
            <input
                className="form-control form-control-lg"
                type="number"
                step="0.000001"
                min="0"
                value={ethAmount}
                onChange={handleEthChange}
                placeholder="0.01"
                disabled={loading}
            />
            </div>

            <button 
            type="submit" 
            className="btn btn-primary btn-lg mt-3"
            disabled={loading || !ethAmount || Number(ethAmount) <= 0}
            >
            {loading ? "Transazione in corso..." : "Acquista Token"}
            </button>
        </form>
        </div>
    );
    }