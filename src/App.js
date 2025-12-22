import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./componets/Login/Login";
import Dashboard from "./componets/Dashboard/Dashboard";
import Products from "./componets/Products/Products";
import Orders from "./componets/Orders/Orders";
import Salebanner from "./componets/Salebanner/Salebanner";

export default function App() {
  return (
    <Router>
      <div className="appLayout">
        <main className="mainContent">
          <Routes>
            <Route path="/" element={<Login/>} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/Salebaner" element={<Salebanner />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

