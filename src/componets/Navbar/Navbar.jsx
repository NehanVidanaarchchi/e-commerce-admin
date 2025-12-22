import React from "react";
import "./Navbar.css";
import { FiGrid, FiBox, FiHome , FiShoppingBag} from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";

const menuItems = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: <FiGrid /> },
  { id: "products", label: "Products", path: "/products", icon: <FiBox /> },
  { id: "orders", label: "Orders", path: "/orders", icon: <FiShoppingBag /> },
  { id: "Salebaner", label: "Salebaner", path: "/Salebaner", icon: <FiShoppingBag /> },
  { id: "Sales", label: "Sales", path: "/sales", icon: <FiShoppingBag /> },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation(); 

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div className="brand">
          <div className="brand__icon">
            <FiHome />
          </div>
          <div className="brand__text">
            <div className="brand__title">Admin Panel</div>
          </div>
        </div>
      </div>

      <div className="sidebar__divider" />

      <nav className="sidebar__nav">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              className={`navItem ${isActive ? "is-active" : ""}`}
              onClick={() => navigate(item.path)}
              type="button"
            >
              <span className="navItem__icon">{item.icon}</span>
              <span className="navItem__label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar__divider sidebar__divider--bottom" />
    </aside>
  );
}
