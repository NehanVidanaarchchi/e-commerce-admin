import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../Navbar/Navbar";
import { db, storage } from "../../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { FiEdit2, FiTrash2, FiPlus, FiX, FiUpload, FiSearch } from "react-icons/fi";
import "./Products.css";

const COLLECTION_NAME = "Items";

const FALLBACK_IMG =
  "https://dummyimage.com/80x80/eef2ff/4f46e5.png&text=Item";

const CATEGORIES = [
  "Mobile Accessories",
  "Gems",
  "Jewelry",
  "Electronics",
  "Other",
];

export default function Products() {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState("add"); // add | edit
  const [activeItem, setActiveItem] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Mobile Accessories",
    price: "",
    stock: 0,
    imageUrl: "",
    imagePath: "",
  });

  // Local image file + preview
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, COLLECTION_NAME), (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    });
    return () => unsub();
  }, []);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const matchText =
        !q ||
        String(it.name || "").toLowerCase().includes(q) ||
        String(it.description || "").toLowerCase().includes(q);

      const matchCat =
        categoryFilter === "All Categories" ||
        String(it.category || "") === categoryFilter;

      return matchText && matchCat;
    });
  }, [items, search, categoryFilter]);

  const onChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const openAddModal = () => {
    setMode("add");
    setActiveItem(null);
    setForm({
      name: "",
      description: "",
      category: "Mobile Accessories",
      price: "",
      stock: 0,
      imageUrl: "",
      imagePath: "",
    });
    setImageFile(null);
    setImagePreview("");
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setMode("edit");
    setActiveItem(item);
    setForm({
      name: item.name || "",
      description: item.description || "",
      category: item.category || "Mobile Accessories",
      price: String(item.price ?? ""),
      stock: Number(item.stock ?? 0),
      imageUrl: item.imageUrl || "",
      imagePath: item.imagePath || "",
    });
    setImageFile(null);
    setImagePreview(item.imageUrl || "");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const onPickFile = (file) => {
    setImageFile(file || null);
    if (!file) {
      setImagePreview(form.imageUrl || "");
      return;
    }
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const uploadImageIfNeeded = async () => {
    if (form.imageUrl?.trim()) {
      return { imageUrl: form.imageUrl.trim(), imagePath: form.imagePath || "" };
    }

  
    if (!imageFile) {
      return { imageUrl: form.imageUrl || "", imagePath: form.imagePath || "" };
    }

    if (mode === "edit" && form.imagePath) {
      try {
        await deleteObject(ref(storage, form.imagePath));
      } catch {}
    }

    const safeName = imageFile.name.replace(/\s+/g, "_");
    const path = `Items/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, imageFile);
    const url = await getDownloadURL(storageRef);

    return { imageUrl: url, imagePath: path };
  };

  const submitModal = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return;
    if (form.price === "") return;

    const priceNum = Number(form.price);
    const stockNum = Number(form.stock);

    if (!Number.isFinite(priceNum) || priceNum < 0) return;
    if (!Number.isFinite(stockNum) || stockNum < 0) return;

    try {
      setSaving(true);

      const { imageUrl, imagePath } = await uploadImageIfNeeded();

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        price: priceNum,
        stock: stockNum,
        imageUrl: imageUrl || "",
        imagePath: imagePath || "",
      };

      if (mode === "add") {
        await addDoc(collection(db, COLLECTION_NAME), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, COLLECTION_NAME, activeItem.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      }

      setModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed. Check Firestore rules + Storage rules.");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item) => {
    const ok = window.confirm("Delete this product?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, COLLECTION_NAME, item.id));

      if (item.imagePath) {
        try {
          await deleteObject(ref(storage, item.imagePath));
        } catch {}
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete product.");
    }
  };

  return (
    <div className="pmLayout">
      <Navbar />

      <main className="pmMain">
        {/* Header like screenshot */}
        <div className="pmTopRow">
          <div>
            <h1 className="pmTitle">Products Management</h1>
            <p className="pmSub">Manage your product inventory</p>
          </div>

          <button className="pmAddBtn" type="button" onClick={openAddModal}>
            <FiPlus />
            Add Product
          </button>
        </div>

        
        <section className="pmFiltersCard">
          <div className="pmSearch">
            <FiSearch className="pmSearchIcon" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
            />
          </div>

          <select
            className="pmSelect"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option>All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </section>

        {/* Table like screenshot */}
        <section className="pmTableCard">
          <div className="pmTableWrap">
            <table className="pmTable">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Image</th>
                  <th>Name</th>
                  <th style={{ width: 220 }}>Category</th>
                  <th style={{ width: 140 }}>Price</th>
                  <th style={{ width: 120 }}>Stock</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="pmEmpty">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <img
                          className="pmImg"
                          src={p.imageUrl || FALLBACK_IMG}
                          alt={p.name || "product"}
                          onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
                        />
                      </td>

                      <td>
                        <div className="pmName">{p.name || "—"}</div>
                        <div className="pmDesc">{p.description || "—"}</div>
                      </td>

                      <td>
                        <span className="pmCatPill">{p.category || "—"}</span>
                      </td>

                      <td>
                        <span className="pmPrice">Rs:{Number(p.price ?? 0).toFixed(2)}</span>
                      </td>

                      <td>
                        <span className="pmStockPill">
                          {Number(p.stock ?? 0)}
                        </span>
                      </td>

                      <td>
                        <div className="pmActions">
                          <button
                            className="pmIconBtn pmEdit"
                            type="button"
                            title="Edit"
                            onClick={() => openEditModal(p)}
                          >
                            <FiEdit2 />
                          </button>

                          <button
                            className="pmIconBtn pmDelete"
                            type="button"
                            title="Delete"
                            onClick={() => deleteItem(p)}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal */}
        {modalOpen && (
          <div className="modalOverlay" onClick={closeModal} role="presentation">
            <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="modalHead">
                <div>
                  <div className="modalTitle">
                    {mode === "add" ? "Add New Product" : "Edit Product"}
                  </div>
                  <div className="modalHint">Fill in the product details</div>
                </div>

                <button className="iconBtn ghost" onClick={closeModal} type="button">
                  <FiX />
                </button>
              </div>

              <form className="modalBody" onSubmit={submitModal}>
                <div className="field">
                  <label>Product Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => onChange("name", e.target.value)}
                    placeholder="Enter product name"
                  />
                </div>

                <div className="field">
                  <label>Description *</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => onChange("description", e.target.value)}
                    placeholder="Product description"
                    rows={4}
                  />
                </div>

                <div className="grid2">
                  <div className="field">
                    <label>Category *</label>
                    <select
                      value={form.category}
                      onChange={(e) => onChange("category", e.target.value)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Price *</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => onChange("price", e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                </div>

                <div className="grid2">
                  <div className="field">
                    <label>Stock *</label>
                    <input
                      type="number"
                      value={form.stock}
                      onChange={(e) => onChange("stock", e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="field">
                    <label>Image URL</label>
                    <input
                      value={form.imageUrl}
                      onChange={(e) => onChange("imageUrl", e.target.value)}
                      placeholder="Leave empty for default"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Upload Image (optional)</label>
                  <div className="uploadRow">
                    <label className="uploadBtn">
                      Choose Image <FiUpload />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onPickFile(e.target.files?.[0])}
                        hidden
                      />
                    </label>
                    <div className="uploadNote">{imageFile ? imageFile.name : ""}</div>
                  </div>

                  <div className="previewBox">
                    <img
                      className="previewImg"
                      src={imagePreview || form.imageUrl || FALLBACK_IMG}
                      alt="preview"
                      onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
                    />
                  </div>
                </div>

                <div className="modalActions">
                  <button className="secondaryBtn" onClick={closeModal} type="button" disabled={saving}>
                    Cancel
                  </button>

                  <button className="primaryBtn" type="submit" disabled={saving}>
                    {saving ? "Saving..." : mode === "add" ? "Add Product" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
