import "bootstrap/dist/css/bootstrap.css";
import "./styles/custom.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Dapp } from "./components/Dapp"; // Mantieni il riferimento a Dapp
import { Web3Provider } from "./contexts/Web3Context";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Web3Provider>
        <Dapp />
      </Web3Provider>
    </BrowserRouter>
  </React.StrictMode>
);