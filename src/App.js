import React, { useEffect } from "react";
import { MemoryRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

import Login from "./componets/Login/Login";
import Dashboard from "./componets/Dashboard/Dashboard";
import Products from "./componets/Products/Products";
import Orders from "./componets/Orders/Orders";
import Salebanner from "./componets/Salebanner/Salebanner";
import Salereport from "./componets/Salereport/Salereport";

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

 
  useEffect(() => {
    const last = localStorage.getItem(":lastPage");
    if (last && location.pathname === "/") {
      navigate(last, { replace: true });
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    localStorage.setItem(":lastPage", location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/products" element={<Products />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/salebanner" element={<Salebanner />} />
      <Route path="/salereport" element={<Salereport />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AppRoutes />
    </MemoryRouter>
  );
}
