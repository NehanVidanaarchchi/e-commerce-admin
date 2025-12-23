import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../Navbar/Navbar";
import "./Salereport.css";

import { db } from "../../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

const COLLECTIONS = {
  ORDERS: "Orders", 
  ITEMS: "Items",   
};

// ---------------------------
// ✅ FIELD MAP (edit here if needed)
// ---------------------------
const FIELDS = {
  orderCreatedAt: "createdAt",
  orderStatus: "status",
  orderTotal: "totalAmount", // if missing -> we compute from items
  orderItems: "items",

  itemId: "id",
  itemName: "name",
  itemCategory: "category",
  itemPrice: "price",
  itemStock: "stock",
};

const STATUS_DONE = ["done", "completed", "paid"];
const STATUS_PENDING = ["pending", "processing"];
const STATUS_CANCEL = ["cancelled", "canceled"];

function toMillis(ts) {
  if (!ts) return 0;
  // Firestore Timestamp
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  // JS Date
  if (ts instanceof Date) return ts.getTime();
  // numeric
  if (typeof ts === "number") return ts;
  return 0;
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().trim();
  if (STATUS_DONE.includes(v)) return "done";
  if (STATUS_PENDING.includes(v)) return "pending";
  if (STATUS_CANCEL.includes(v)) return "cancelled";
  return v || "unknown";
}

function formatLKR(amount) {
  const n = safeNum(amount, 0);
  return `Rs. ${n.toLocaleString("en-LK")}`;
}

function yyyyMmDd(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayMs(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDayMs(ms) {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export default function SaleReport() {
  // range presets
  const [preset, setPreset] = useState("7d"); // 7d | 30d | custom
  const [from, setFrom] = useState(() => {
    const now = Date.now();
    return yyyyMmDd(now - 6 * 24 * 60 * 60 * 1000);
  });
  const [to, setTo] = useState(() => yyyyMmDd(Date.now()));

  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);

  // ✅ calculate time range
  const range = useMemo(() => {
    const now = Date.now();
    if (preset === "7d") {
      const f = startOfDayMs(now - 6 * 24 * 60 * 60 * 1000);
      const t = endOfDayMs(now);
      return { fromMs: f, toMs: t };
    }
    if (preset === "30d") {
      const f = startOfDayMs(now - 29 * 24 * 60 * 60 * 1000);
      const t = endOfDayMs(now);
      return { fromMs: f, toMs: t };
    }
    // custom
    const f = startOfDayMs(new Date(from).getTime());
    const t = endOfDayMs(new Date(to).getTime());
    return { fromMs: f, toMs: t };
  }, [preset, from, to]);

  // ✅ READ Items (product catalog)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, COLLECTIONS.ITEMS), (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    });
    return () => unsub();
  }, []);

  // ✅ READ Orders in date range
  useEffect(() => {
    setLoading(true);

    const fromTS = Timestamp.fromMillis(range.fromMs);
    const toTS = Timestamp.fromMillis(range.toMs);

    // createdAt between range
    const q = query(
      collection(db, COLLECTIONS.ORDERS),
      where(FIELDS.orderCreatedAt, ">=", fromTS),
      where(FIELDS.orderCreatedAt, "<=", toTS)
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
        console.error(err);
        setOrders([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [range.fromMs, range.toMs]);

  // ✅ build item lookup for names/categories if order item missing them
  const itemLookup = useMemo(() => {
    const m = new Map();
    items.forEach((it) => m.set(it.id, it));
    return m;
  }, [items]);

  // ✅ flatten all order items (only DONE orders for revenue analytics)
  const doneOrders = useMemo(() => {
    return orders.filter((o) => normalizeStatus(o[FIELDS.orderStatus]) === "done");
  }, [orders]);

  const orderStatusCounts = useMemo(() => {
    const c = { done: 0, pending: 0, cancelled: 0, unknown: 0 };
    for (const o of orders) {
      const s = normalizeStatus(o[FIELDS.orderStatus]);
      if (c[s] === undefined) c.unknown += 1;
      else c[s] += 1;
    }
    return c;
  }, [orders]);

  const flatItems = useMemo(() => {
    const out = [];
    for (const o of doneOrders) {
      const arr = Array.isArray(o[FIELDS.orderItems]) ? o[FIELDS.orderItems] : [];
      for (const it of arr) {
        const pid = it.productId || it.itemId || it.id || "";
        const catalog = pid ? itemLookup.get(pid) : null;

        const name = it.name || catalog?.[FIELDS.itemName] || "Unknown";
        const category = it.category || catalog?.[FIELDS.itemCategory] || "Other";
        const price = safeNum(it.price ?? catalog?.[FIELDS.itemPrice] ?? 0);
        const qty = safeNum(it.qty ?? it.quantity ?? 0);

        out.push({
          orderId: o.id,
          productId: pid,
          name,
          category,
          price,
          qty,
          lineTotal: price * qty,
        });
      }
    }
    return out;
  }, [doneOrders, itemLookup]);

  // ✅ totals
  const totals = useMemo(() => {
    // revenue: prefer orderTotal if exists, else sum of line totals
    let revenue = 0;
    let orderCount = doneOrders.length;
    let itemsSold = 0;

    for (const o of doneOrders) {
      const orderTotal = o[FIELDS.orderTotal];
      if (orderTotal !== undefined && orderTotal !== null && orderTotal !== "") {
        revenue += safeNum(orderTotal, 0);
      } else {
        const arr = Array.isArray(o[FIELDS.orderItems]) ? o[FIELDS.orderItems] : [];
        let sum = 0;
        for (const it of arr) {
          const price = safeNum(it.price, 0);
          const qty = safeNum(it.qty ?? it.quantity, 0);
          sum += price * qty;
        }
        revenue += sum;
      }
    }

    for (const li of flatItems) itemsSold += li.qty;

    const aov = orderCount > 0 ? revenue / orderCount : 0;

    return {
      revenue,
      orderCount,
      itemsSold,
      aov,
    };
  }, [doneOrders, flatItems]);

  // ✅ sales by day (trend)
  const salesByDay = useMemo(() => {
    const map = new Map(); // date -> { revenue, orders }
    for (const o of doneOrders) {
      const ms = toMillis(o[FIELDS.orderCreatedAt]);
      if (!ms) continue;
      const day = yyyyMmDd(ms);
      if (!map.has(day)) map.set(day, { day, revenue: 0, orders: 0 });
      const row = map.get(day);

      const orderTotal = o[FIELDS.orderTotal];
      let add = 0;
      if (orderTotal !== undefined && orderTotal !== null && orderTotal !== "") {
        add = safeNum(orderTotal, 0);
      } else {
        const arr = Array.isArray(o[FIELDS.orderItems]) ? o[FIELDS.orderItems] : [];
        for (const it of arr) add += safeNum(it.price, 0) * safeNum(it.qty ?? it.quantity, 0);
      }

      row.revenue += add;
      row.orders += 1;
    }

    // fill missing days in range
    const days = [];
    for (let t = range.fromMs; t <= range.toMs; t += 24 * 60 * 60 * 1000) {
      const d = yyyyMmDd(t);
      const row = map.get(d) || { day: d, revenue: 0, orders: 0 };
      days.push(row);
    }
    return days;
  }, [doneOrders, range.fromMs, range.toMs]);

  // ✅ category sales
  const categorySales = useMemo(() => {
    const map = new Map(); // cat -> revenue
    for (const li of flatItems) {
      const k = li.category || "Other";
      map.set(k, (map.get(k) || 0) + li.lineTotal);
    }
    const rows = Array.from(map.entries())
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    return rows;
  }, [flatItems]);

  // ✅ top products
  const topProducts = useMemo(() => {
    const map = new Map(); // productId or name -> {name, qty, revenue, category}
    for (const li of flatItems) {
      const key = li.productId || li.name;
      const cur = map.get(key) || {
        key,
        name: li.name,
        category: li.category,
        qty: 0,
        revenue: 0,
      };
      cur.qty += li.qty;
      cur.revenue += li.lineTotal;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [flatItems]);

  // ✅ low performing products (by sold qty in period)
  const lowProducts = useMemo(() => {
    // include items catalog so we can show items with 0 sales too (nice!)
    const soldMap = new Map();
    for (const li of flatItems) {
      const key = li.productId || li.name;
      soldMap.set(key, (soldMap.get(key) || 0) + li.qty);
    }

    const rows = items.map((it) => {
      const qtySold = soldMap.get(it.id) || 0;
      return {
        id: it.id,
        name: it[FIELDS.itemName] || "Unknown",
        category: it[FIELDS.itemCategory] || "Other",
        stock: safeNum(it[FIELDS.itemStock], 0),
        qtySold,
      };
    });

    return rows
      .sort((a, b) => a.qtySold - b.qtySold)
      .slice(0, 8);
  }, [items, flatItems]);

  // ✅ discount impact
  const discountReport = useMemo(() => {
    // group by discount label/value
    const map = new Map(); // discount -> {orders, revenue}
    for (const o of doneOrders) {
      const d = String(o.discount || o.discountCode || o.bannerDiscount || "").trim();
      if (!d) continue;

      const orderTotal = o[FIELDS.orderTotal];
      let add = 0;
      if (orderTotal !== undefined && orderTotal !== null && orderTotal !== "") {
        add = safeNum(orderTotal, 0);
      } else {
        const arr = Array.isArray(o[FIELDS.orderItems]) ? o[FIELDS.orderItems] : [];
        for (const it of arr) add += safeNum(it.price, 0) * safeNum(it.qty ?? it.quantity, 0);
      }

      const cur = map.get(d) || { discount: d, orders: 0, revenue: 0 };
      cur.orders += 1;
      cur.revenue += add;
      map.set(d, cur);
    }

    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const discountedOrders = rows.reduce((s, r) => s + r.orders, 0);
    const discountedRevenue = rows.reduce((s, r) => s + r.revenue, 0);

    return { rows, discountedOrders, discountedRevenue };
  }, [doneOrders]);

  // ✅ customer insights
  const customers = useMemo(() => {
    // keys we try: customerId, customerEmail, customerPhone
    const map = new Map(); // customerKey -> {orders, revenue, firstSeen, lastSeen}
    for (const o of doneOrders) {
      const key =
        o.customerId ||
        o.customerEmail ||
        o.customerPhone ||
        o.userId ||
        "unknown";

      const ms = toMillis(o[FIELDS.orderCreatedAt]) || 0;

      const orderTotal = o[FIELDS.orderTotal];
      let add = 0;
      if (orderTotal !== undefined && orderTotal !== null && orderTotal !== "") {
        add = safeNum(orderTotal, 0);
      } else {
        const arr = Array.isArray(o[FIELDS.orderItems]) ? o[FIELDS.orderItems] : [];
        for (const it of arr) add += safeNum(it.price, 0) * safeNum(it.qty ?? it.quantity, 0);
      }

      const cur = map.get(key) || {
        key,
        orders: 0,
        revenue: 0,
        firstSeen: ms || Date.now(),
        lastSeen: ms || Date.now(),
      };

      cur.orders += 1;
      cur.revenue += add;
      cur.firstSeen = Math.min(cur.firstSeen, ms || cur.firstSeen);
      cur.lastSeen = Math.max(cur.lastSeen, ms || cur.lastSeen);
      map.set(key, cur);
    }

    const list = Array.from(map.values()).filter((c) => c.key !== "unknown");

    const repeatCustomers = list.filter((c) => c.orders >= 2).length;
    const totalCustomers = list.length;

    // new customers in period = firstSeen inside range
    const newCustomers = list.filter(
      (c) => c.firstSeen >= range.fromMs && c.firstSeen <= range.toMs
    ).length;

    const topCustomers = list.sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return { totalCustomers, repeatCustomers, newCustomers, topCustomers };
  }, [doneOrders, range.fromMs, range.toMs]);

  // simple bar helpers (no extra chart libs)
  const maxDayRevenue = useMemo(() => {
    return Math.max(1, ...salesByDay.map((d) => d.revenue));
  }, [salesByDay]);

  const maxCatRevenue = useMemo(() => {
    return Math.max(1, ...categorySales.map((c) => c.revenue));
  }, [categorySales]);

  return (
    <div className="srLayout">
      <Navbar />

      <main className="srMain">
        <div className="srHeader">
          <div>
            <h1 className="srTitle">Sales Report</h1>
            <p className="srSub">
              Analytics for {preset === "custom" ? `${from} → ${to}` : preset === "7d" ? "Last 7 days" : "Last 30 days"}
            </p>
          </div>

          <div className="srFilters">
            <div className="srPills">
              <button className={`srPill ${preset === "7d" ? "active" : ""}`} onClick={() => setPreset("7d")} type="button">
                Last 7 Days
              </button>
              <button className={`srPill ${preset === "30d" ? "active" : ""}`} onClick={() => setPreset("30d")} type="button">
                Last 30 Days
              </button>
              <button className={`srPill ${preset === "custom" ? "active" : ""}`} onClick={() => setPreset("custom")} type="button">
                Custom
              </button>
            </div>

            {preset === "custom" && (
              <div className="srDates">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span>to</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* 1) OVERVIEW CARDS */}
        <section className="srGrid4">
          <div className="srStat accentPurple">
            <div className="srStatLabel">Total Revenue</div>
            <div className="srStatValue">{formatLKR(totals.revenue)}</div>
            <div className="srStatHint">Completed orders only</div>
          </div>

          <div className="srStat accentBlue">
            <div className="srStatLabel">Total Orders</div>
            <div className="srStatValue">{totals.orderCount}</div>
            <div className="srStatHint">Status: done</div>
          </div>

          <div className="srStat accentGreen">
            <div className="srStatLabel">Items Sold</div>
            <div className="srStatValue">{totals.itemsSold}</div>
            <div className="srStatHint">Sum of quantities</div>
          </div>

          <div className="srStat accentOrange">
            <div className="srStatLabel">Average Order Value</div>
            <div className="srStatValue">{formatLKR(totals.aov)}</div>
            <div className="srStatHint">Revenue / Orders</div>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <div className="srLoading">Loading report…</div>
        )}

        {/* 2) SALES BY TIME (TREND) */}
        <section className="srCard">
          <div className="srCardHead">
            <div>
              <div className="srCardTitle">Sales Trend</div>
              <div className="srCardSub">Revenue per day</div>
            </div>
          </div>

          <div className="srBars">
            {salesByDay.map((d) => (
              <div className="srBarRow" key={d.day}>
                <div className="srBarLabel">{d.day.slice(5)}</div>
                <div className="srBarTrack">
                  <div
                    className="srBarFill"
                    style={{ width: `${(d.revenue / maxDayRevenue) * 100}%` }}
                    title={`${d.day} • ${formatLKR(d.revenue)} • ${d.orders} orders`}
                  />
                </div>
                <div className="srBarValue">{formatLKR(d.revenue)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 3 + 4 + 5 */}
        <section className="srGrid2">
          {/* 3) TOP SELLING PRODUCTS */}
          <div className="srCard">
            <div className="srCardHead">
              <div>
                <div className="srCardTitle">Top Selling Products</div>
                <div className="srCardSub">By revenue (done orders)</div>
              </div>
            </div>

            <div className="srTableWrap">
              <table className="srTable">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.length === 0 ? (
                    <tr><td colSpan="4" className="srEmpty">No data</td></tr>
                  ) : (
                    topProducts.map((p) => (
                      <tr key={p.key}>
                        <td className="srBold">{p.name}</td>
                        <td>{p.category}</td>
                        <td style={{ textAlign: "right" }}>{p.qty}</td>
                        <td style={{ textAlign: "right" }}>{formatLKR(p.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4) LOW PERFORMING PRODUCTS */}
          <div className="srCard">
            <div className="srCardHead">
              <div>
                <div className="srCardTitle">Low Performing Products</div>
                <div className="srCardSub">Lowest sold qty in selected period</div>
              </div>
            </div>

            <div className="srTableWrap">
              <table className="srTable">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Sold</th>
                    <th style={{ textAlign: "right" }}>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {lowProducts.length === 0 ? (
                    <tr><td colSpan="4" className="srEmpty">No data</td></tr>
                  ) : (
                    lowProducts.map((p) => (
                      <tr key={p.id}>
                        <td className="srBold">{p.name}</td>
                        <td>{p.category}</td>
                        <td style={{ textAlign: "right" }}>{p.qtySold}</td>
                        <td style={{ textAlign: "right" }}>{p.stock}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 5) SALES BY CATEGORY */}
        <section className="srCard">
          <div className="srCardHead">
            <div>
              <div className="srCardTitle">Sales by Category</div>
              <div className="srCardSub">Revenue distribution</div>
            </div>
          </div>

          <div className="srBars">
            {categorySales.length === 0 ? (
              <div className="srEmpty">No category data</div>
            ) : (
              categorySales.map((c) => (
                <div className="srBarRow" key={c.category}>
                  <div className="srBarLabel">{c.category}</div>
                  <div className="srBarTrack">
                    <div
                      className="srBarFill alt"
                      style={{ width: `${(c.revenue / maxCatRevenue) * 100}%` }}
                      title={`${c.category} • ${formatLKR(c.revenue)}`}
                    />
                  </div>
                  <div className="srBarValue">{formatLKR(c.revenue)}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 6 + 7 + 8 */}
        <section className="srGrid3">
          {/* 6) DISCOUNT IMPACT */}
          <div className="srCard">
            <div className="srCardHead">
              <div>
                <div className="srCardTitle">Discount Impact</div>
                <div className="srCardSub">
                  Discounted orders: <b>{discountReport.discountedOrders}</b> • Revenue: <b>{formatLKR(discountReport.discountedRevenue)}</b>
                </div>
              </div>
            </div>

            <div className="srTableWrap">
              <table className="srTable">
                <thead>
                  <tr>
                    <th>Discount</th>
                    <th style={{ textAlign: "right" }}>Orders</th>
                    <th style={{ textAlign: "right" }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {discountReport.rows.length === 0 ? (
                    <tr><td colSpan="3" className="srEmpty">No discounts used</td></tr>
                  ) : (
                    discountReport.rows.slice(0, 6).map((r) => (
                      <tr key={r.discount}>
                        <td className="srBold">{r.discount}</td>
                        <td style={{ textAlign: "right" }}>{r.orders}</td>
                        <td style={{ textAlign: "right" }}>{formatLKR(r.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 7) ORDER STATUS */}
          <div className="srCard">
            <div className="srCardHead">
              <div>
                <div className="srCardTitle">Order Status</div>
                <div className="srCardSub">All orders in selected range</div>
              </div>
            </div>

            <div className="srStatusGrid">
              <div className="srStatus done">
                <div className="srStatusLabel">Done</div>
                <div className="srStatusValue">{orderStatusCounts.done}</div>
              </div>
              <div className="srStatus pending">
                <div className="srStatusLabel">Pending</div>
                <div className="srStatusValue">{orderStatusCounts.pending}</div>
              </div>
              <div className="srStatus cancelled">
                <div className="srStatusLabel">Cancelled</div>
                <div className="srStatusValue">{orderStatusCounts.cancelled}</div>
              </div>
              <div className="srStatus unknown">
                <div className="srStatusLabel">Other</div>
                <div className="srStatusValue">{orderStatusCounts.unknown}</div>
              </div>
            </div>
          </div>

          {/* 8) CUSTOMER INSIGHTS */}
          <div className="srCard">
            <div className="srCardHead">
              <div>
                <div className="srCardTitle">Customer Insights</div>
                <div className="srCardSub">Based on done orders (if customer fields exist)</div>
              </div>
            </div>

            <div className="srCustomerCards">
              <div className="srMini">
                <div className="srMiniLabel">Total Customers</div>
                <div className="srMiniValue">{customers.totalCustomers}</div>
              </div>
              <div className="srMini">
                <div className="srMiniLabel">New Customers</div>
                <div className="srMiniValue">{customers.newCustomers}</div>
              </div>
              <div className="srMini">
                <div className="srMiniLabel">Repeat Customers</div>
                <div className="srMiniValue">{customers.repeatCustomers}</div>
              </div>
            </div>

            <div className="srTopCustomers">
              <div className="srTopTitle">Top Customers</div>
              {customers.topCustomers.length === 0 ? (
                <div className="srEmpty">No customer info in orders</div>
              ) : (
                customers.topCustomers.map((c) => (
                  <div className="srCustRow" key={c.key}>
                    <div className="srCustKey">{c.key}</div>
                    <div className="srCustMeta">
                      <span>{c.orders} orders</span>
                      <b>{formatLKR(c.revenue)}</b>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="srNote">
          Tip: If your Orders don’t have <b>customerId/email</b>, customer insights will show “No customer info”.
        </div>
      </main>
    </div>
  );
}
