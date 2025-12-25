import React, { useEffect } from "react";
import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import Login from "./componets/Login/Login";
import Dashboard from "./componets/Dashboard/Dashboard";
import Products from "./componets/Products/Products";
import Orders from "./componets/Orders/Orders";
import Salebanner from "./componets/Salebanner/Salebanner";
import Salereport from "./componets/Salereport/Salereport";

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem("adminLoggedIn") === "true";
  return isAuth ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();


  useEffect(() => {
    const isAuth = localStorage.getItem("adminLoggedIn") === "true";
    const last = localStorage.getItem("admin:lastPage");

    if (isAuth && last && location.pathname === "/") {
      navigate(last, { replace: true });
    }
  }, [navigate, location.pathname]);


  useEffect(() => {
    const isAuth = localStorage.getItem("adminLoggedIn") === "true";
    if (isAuth) {
      localStorage.setItem("admin:lastPage", location.pathname);
    }
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        }
      />

      <Route
        path="/salebanner"
        element={
          <ProtectedRoute>
            <Salebanner />
          </ProtectedRoute>
        }
      />

      <Route
        path="/salereport"
        element={
          <ProtectedRoute>
            <Salereport />
          </ProtectedRoute>
        }
      />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


export default function App() {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <AppRoutes />
    </MemoryRouter>
  );
}
