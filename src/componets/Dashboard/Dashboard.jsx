import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../Navbar/Navbar";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
  FiBox,
  FiShoppingBag,
  FiDollarSign,
  FiClock,
  FiRefreshCw,
} from "react-icons/fi";
import "./Dashboard.css";

const StatCard = ({ title, value, accent = "blue", icon }) => {
  return (
    <div className={`statCard accent-${accent}`}>
      <div className="statCardTop">
        <div className="statMeta">
          <div className="statTitle">{title}</div>
          <div className="statValue">{value}</div>
        </div>

        <div className="statIconWrap" aria-hidden="true">
          {icon}
        </div>
      </div>

      <div className="statHint">Live from database</div>
    </div>
  );
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
  });


  useEffect(() => {
  setLoading(true);

  const unsub = onSnapshot(
    collection(db, "Items"),
    (snap) => {
      let revenue = 0;

      snap.forEach((doc) => {
        const data = doc.data();
        revenue += Number(data.price || 0);
      });

      setStats((prev) => ({
        ...prev,
        totalProducts: snap.size,   
        totalRevenue: revenue,      
      }));

      setLoading(false);
    },
    (err) => {
      console.error("Dashboard stats error:", err);
      setLoading(false);
    }
  );

  return () => unsub();
}, []);


  const money = useMemo(() => {
    const n = Number(stats.totalRevenue || 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "LKR",
    }).format(n);
  }, [stats.totalRevenue]);

  return (
    <div className="dashLayout">
      <Navbar />

      <main className="dashMain">
        <div className="dashHeader">
          <div>
            <h1 className="dashTitle">Dashboard</h1>
            <p className="dashSubtitle">
              Overview of your store performance and inventory.
            </p>
          </div>

          <button
            className="dashBtn"
            onClick={() => window.location.reload()}
            type="button"
            title="Refresh"
          >
            <FiRefreshCw />
            Refresh
          </button>
        </div>

        <div className="statsGrid">
          <StatCard
            title="Total Products"
            value={loading ? "Loading..." : stats.totalProducts}
            accent="blue"
            icon={<FiBox />}
          />
          <StatCard
            title="Total Orders"
            value={loading ? "Loading..." : stats.totalOrders}
            accent="green"
            icon={<FiShoppingBag />}
          />
          <StatCard
            title="Total Revenue"
            value={loading ? "Loading..." : money}
            accent="purple"
            icon={<FiDollarSign />}
          />
          <StatCard
            title="Pending Orders"
            value={loading ? "Loading..." : stats.pendingOrders}
            accent="orange"
            icon={<FiClock />}
          />
        </div>
      </main>
    </div>
  );
}
