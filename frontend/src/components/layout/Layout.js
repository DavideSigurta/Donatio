import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { WaitingForTransactionMessage } from "../common/WaitingForTransactionMessage";
import { TransactionErrorMessage } from "../common/TransactionErrorMessage";

export function Layout() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      <main className="flex-grow-1">
        <div className="container py-4">
          <WaitingForTransactionMessage />
          <TransactionErrorMessage />
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}