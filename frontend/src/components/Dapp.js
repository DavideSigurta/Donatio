import React from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { Routes, Route, Navigate } from "react-router-dom";

// Layout
import { Layout } from "./layout/Layout";

// Pagine
import { Home } from "../pages/Home";
import { CampaignListPage } from "../pages/CampaignListPage";
import { CampaignDetailPage } from "../pages/CampaignDetailPage";
import { ExchangePage } from "../pages/ExchangePage";
import { ProfilePage } from "../pages/ProfilePage";
import { TransactionsPage } from "../pages/TransactionsPage";
import { AdminDepositPage } from "../pages/AdminDepositPage";
import { GlobalTransactionsPage } from "../pages/GlobalTransactionsPage";
import { CreateCampaignPage } from "../pages/CreateCampaignPage";
import { RequestCreatorPage } from "../pages/RequestCreatorPage";
import { CreatorRequestsPage } from "../pages/CreatorRequestsPage";
import { GovernanceDashboardPage } from "../pages/GovernanceDashboardPage"; // Aggiungi questo import

// Componenti comuni
import { NoWalletDetected } from "./common/NoWalletDetected";
import { Loading } from "./common/Loading";

export function Dapp() {
  const {
    selectedAddress,
    tokenData,
    isOwner,
    isAuthorizedCreator,
    isAdmin
  } = useWeb3();
  
  // Se MetaMask non è installato
  if (window.ethereum === undefined) {
    return <NoWalletDetected />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Rotte pubbliche accessibili a tutti */}
        <Route index element={<Home />} />
        <Route path="campaigns" element={<CampaignListPage />} />
        <Route path="campaigns/:id" element={<CampaignDetailPage />} />
        
        <Route 
          path="exchange" 
          element={
            selectedAddress ? 
              (tokenData ? (isOwner? <AdminDepositPage/> : <ExchangePage />) : <Loading />) : 
              <Navigate to="/" replace state={{ needsConnection: true }} />
          } 
        />

        <Route 
          path="campaigns/create" 
          element={
            selectedAddress ? 
              (tokenData ? ((isOwner || isAuthorizedCreator) ? <CreateCampaignPage /> : <Navigate to="/campaigns" replace />) : <Loading />) : 
              <Navigate to="/" replace state={{ needsConnection: true }} />
          } 
        />
        
        <Route 
          path="profile" 
          element={
            selectedAddress ? 
              (tokenData ? <ProfilePage isOwner={isOwner} /> : <Loading />) : 
              <Navigate to="/" replace state={{ needsConnection: true }} />
          } 
        />
        
        <Route 
          path="profile/transactions" 
          element={
            selectedAddress ? 
              (tokenData ? (isOwner ? <GlobalTransactionsPage/> : <TransactionsPage />) : <Loading />) : 
              <Navigate to="/" replace state={{ needsConnection: true }} />
          } 
        />
        
        {/* Nuova rotta per richiedere di diventare creatore */}
        <Route 
          path="request-creator" 
          element={
            selectedAddress ? 
              (tokenData ? <RequestCreatorPage /> : <Loading />) : 
              <Navigate to="/" replace state={{ needsConnection: true }} />
          } 
        />
        
        {/* Nuova rotta per gestire le richieste (solo admin) */}
        <Route 
          path="admin/creator-requests" 
          element={
            selectedAddress ? 
              (tokenData ? (isOwner ? <CreatorRequestsPage /> : <Navigate to="/profile" replace />) : <Loading />) : 
              <Navigate to="/" replace state={{ needsConnection: true }} />
          } 
        />
        
        {/* Nuova rotta per la dashboard di governance (solo admin) */}
        <Route 
          path="admin/governance" 
          element={
            selectedAddress ? 
              (tokenData ? (isAdmin ? <GovernanceDashboardPage /> : <Navigate to="/profile" replace />) : <Loading />) : 
              <Navigate to="/" replace state={{ needsConnection: true }} />
          } 
        />
        
        {/* Redirect per rotte non trovate */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}