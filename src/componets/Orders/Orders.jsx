// src/components/Orders/Orders.jsx
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../Navbar/Navbar";
import { db } from "../../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { FiCheckCircle, FiSearch, FiRefreshCw } from "react-icons/fi";
import "./Orders.css";

const StatusPill = ({ status }) => {
  const s = String(status || "pending").toLowerCase();
  const label = s === "done" ? "Done" : "Pending";
  return <span className={`statusPill ${s}`}>{label}</span>;
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("all"); 
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);

    const q = query(
      collection(db, "orderReceipts"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("Orders listen error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return orders.filter((o) => {
      const status = String(o.status || "pending").toLowerCase();

      const tabOk =
        tab === "all"
          ? true
          : tab === "pending"
          ? status === "pending"
          : status === "done";

      const receiptId = String(o.receiptId || "").toLowerCase();
      const custName = String(o.customer?.name || "").toLowerCase();
      const custPhone = String(o.customer?.phone || "").toLowerCase();

      const searchOk =
        !q ||
        receiptId.includes(q) ||
        custName.includes(q) ||
        custPhone.includes(q);

      return tabOk && searchOk;
    });
  }, [orders, tab, search]);

  const counts = useMemo(() => {
    let pending = 0;
    let done = 0;
    orders.forEach((o) => {
      const s = String(o.status || "pending").toLowerCase();
      if (s === "done") done += 1;
      else pending += 1;
    });
    return { all: orders.length, pending, done };
  }, [orders]);

  const formatMoney = (n) =>
    new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(
      Number(n || 0)
    );

  const markDone = async (orderId) => {
    try {
      await updateDoc(doc(db, "orderReceipts", orderId), {
        status: "done",
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Update status error:", err);
      alert("Failed to update status. Check Firestore rules.");
    }
  };

  return (
    <div className="ordersLayout">
      <Navbar />

      <main className="ordersMain">
        <div className="ordersHeader">
          <div>
            <h1 className="ordersTitle">Orders</h1>
            <p className="ordersSubtitle">View receipts and mark orders as done.</p>
          </div>

          <button
            className="ordersBtn ghost"
            type="button"
            onClick={() => window.location.reload()}
            title="Refresh"
          >
            <FiRefreshCw />
            Refresh
          </button>
        </div>

        {/* Toolbar */}
        <section className="ordersToolbar">
          <div className="tabs">
            <button
              className={`tab ${tab === "all" ? "active" : ""}`}
              onClick={() => setTab("all")}
              type="button"
            >
              All <span className="badge">{counts.all}</span>
            </button>

            <button
              className={`tab ${tab === "pending" ? "active" : ""}`}
              onClick={() => setTab("pending")}
              type="button"
            >
              Pending <span className="badge orange">{counts.pending}</span>
            </button>

            <button
              className={`tab ${tab === "done" ? "active" : ""}`}
              onClick={() => setTab("done")}
              type="button"
            >
              Done <span className="badge green">{counts.done}</span>
            </button>
          </div>

          <div className="searchWrap">
            <FiSearch />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by receipt id / name / phone"
            />
          </div>
        </section>

        {/* Orders table */}
        <section className="ordersCard">
          <div className="ordersTableWrap">
            <table className="ordersTable">
              <thead>
                <tr>
                  <th style={{ width: 70, textAlign: "center" }}>#</th>
                  <th>Receipt ID</th>
                  <th>Customer</th>
                  <th style={{ width: 180 }}>Phone</th>
                  <th style={{ width: 160 }}>Total</th>
                  <th style={{ width: 140 }}>Status</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="ordersEmpty">
                      Loading orders…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="ordersEmpty">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o, idx) => {
                    const status = String(o.status || "pending").toLowerCase();
                    const isDone = status === "done";

                    return (
                      <tr key={o.id}>
                        <td style={{ textAlign: "center" }}>{idx + 1}</td>

                        <td className="rid">{o.receiptId || "—"}</td>

                        <td>
                          <div className="cust">
                            <div className="custName">{o.customer?.name || "—"}</div>
                            <div className="custAddr">{o.customer?.address || "—"}</div>
                          </div>
                        </td>

                        <td>{o.customer?.phone || "—"}</td>

                        <td className="money">{formatMoney(o.total)}</td>

                        <td>
                          <StatusPill status={status} />
                        </td>

                        <td>
                          <div className="rowActions">
                            {isDone ? (
                              <button className="actionBtn doneGhost" type="button" disabled>
                                <FiCheckCircle />
                                Done
                              </button>
                            ) : (
                              <button
                                className="actionBtn done"
                                type="button"
                                onClick={() => markDone(o.id)}
                                title="Mark as Done"
                              >
                                <FiCheckCircle />
                                Done
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
