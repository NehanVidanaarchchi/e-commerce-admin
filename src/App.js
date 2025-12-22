import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Dashboard from "./componets/Dashboard/Dashboard";
import Products from "./componets/Products/Products";
import Orders from "./componets/Orders/Orders";

export default function App() {
  return (
    <Router>
      <div className="appLayout">
        <main className="mainContent">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/orders" element={<Orders />} />

          </Routes>
        </main>
      </div>
    </Router>
  );
}

