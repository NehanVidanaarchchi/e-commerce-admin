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
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiX,
  FiUpload,
  FiSearch,
  FiImage,
} from "react-icons/fi";
import "./Products.css";

const COLLECTION_NAME = "Items";

const FALLBACK_IMG =
  "https://dummyimage.com/80x80/eef2ff/4f46e5.png&text=Item";

const CATEGORIES = ["Mobile Accessories", "Gems", "Jewelry", "Electronics", "Other"];

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

  // Form state (2 images)
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Mobile Accessories",
    price: "",
    stock: 0,

    // main image
    imageUrl: "",
    imagePath: "",

    // second image
    imageUrl2: "",
    imagePath2: "",
  });

  // Local files + previews
  const [mainFile, setMainFile] = useState(null);
  const [secondFile, setSecondFile] = useState(null);

  const [mainPreview, setMainPreview] = useState("");
  const [secondPreview, setSecondPreview] = useState("");

  // simple validation state
  const [errors, setErrors] = useState({});

  // prevent background scroll when modal open
  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

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

  const onChange = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" })); // clear field error on edit
  };

  const resetModalState = () => {
    setMainFile(null);
    setSecondFile(null);
    setMainPreview("");
    setSecondPreview("");
    setErrors({});
  };

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
      imageUrl2: "",
      imagePath2: "",
    });
    resetModalState();
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

      imageUrl2: item.imageUrl2 || "",
      imagePath2: item.imagePath2 || "",
    });

    setMainFile(null);
    setSecondFile(null);

    setMainPreview(item.imageUrl || "");
    setSecondPreview(item.imageUrl2 || "");
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const pickMainFile = (file) => {
    setMainFile(file || null);
    if (!file) {
      setMainPreview(form.imageUrl || "");
      return;
    }
    const url = URL.createObjectURL(file);
    setMainPreview(url);
    setErrors((e) => ({ ...e, imageUrl: "" }));
  };

  const pickSecondFile = (file) => {
    setSecondFile(file || null);
    if (!file) {
      setSecondPreview(form.imageUrl2 || "");
      return;
    }
    const url = URL.createObjectURL(file);
    setSecondPreview(url);
    setErrors((e) => ({ ...e, imageUrl2: "" }));
  };

  const uploadOneImage = async ({ file, urlValue, oldPath, folder = "Items" }) => {
    // If URL provided, use it (no upload)
    if (String(urlValue || "").trim()) {
      return { imageUrl: String(urlValue).trim(), imagePath: oldPath || "" };
    }

    // If no file, keep old
    if (!file) {
      return { imageUrl: "", imagePath: oldPath || "" };
    }

    // delete old storage file if exists
    if (oldPath) {
      try {
        await deleteObject(ref(storage, oldPath));
      } catch {}
    }

    const safeName = file.name.replace(/\s+/g, "_");
    const path = `${folder}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);
    const uploadedUrl = await getDownloadURL(storageRef);

    return { imageUrl: uploadedUrl, imagePath: path };
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Product name is required";
    if (!String(form.description || "").trim()) next.description = "Description is required";

    const priceNum = Number(form.price);
    const stockNum = Number(form.stock);

    if (form.price === "" || !Number.isFinite(priceNum) || priceNum < 0) {
      next.price = "Enter a valid price (0 or more)";
    }
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      next.stock = "Enter a valid stock (0 or more)";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitModal = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const priceNum = Number(form.price);
    const stockNum = Number(form.stock);

    try {
      setSaving(true);

      // MAIN
      const main = await uploadOneImage({
        file: mainFile,
        urlValue: form.imageUrl,
        oldPath: form.imagePath,
      });

      // SECOND
      const second = await uploadOneImage({
        file: secondFile,
        urlValue: form.imageUrl2,
        oldPath: form.imagePath2,
      });

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        price: priceNum,
        stock: stockNum,

        imageUrl: main.imageUrl || form.imageUrl || "",
        imagePath: main.imagePath || form.imagePath || "",

        imageUrl2: second.imageUrl || form.imageUrl2 || "",
        imagePath2: second.imagePath || form.imagePath2 || "",
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
      if (item.imagePath2) {
        try {
          await deleteObject(ref(storage, item.imagePath2));
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
        <div className="pmTopRow">
          <div>
            <h1 className="pmTitle">Products Management</h1>
            <p className="pmSub">Manage your product inventory</p>
          </div>

          <button className="pmAddBtn" type="button" onClick={openAddModal}>
            <FiPlus /> Add Product
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

        <section className="pmTableCard">
          <div className="pmTableWrap">
            <table className="pmTable">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>Images</th>
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
                        <div className="pmImgs">
                          <img
                            className="pmImg"
                            src={p.imageUrl || FALLBACK_IMG}
                            alt="main"
                            onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
                          />
                          <img
                            className="pmImg"
                            src={p.imageUrl2 || FALLBACK_IMG}
                            alt="second"
                            onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
                          />
                        </div>
                      </td>

                      <td>
                        <div className="pmName">{p.name || "—"}</div>
                        <div className="pmDesc">{p.description || "—"}</div>
                      </td>

                      <td>
                        <span className="pmCatPill">{p.category || "—"}</span>
                      </td>

                      <td>
                        <span className="pmPrice">
                          Rs:{Number(p.price ?? 0).toFixed(2)}
                        </span>
                      </td>

                      <td>
                        <span className="pmStockPill">{Number(p.stock ?? 0)}</span>
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

        {/* ✅ User friendly, scrollable modal */}
        {modalOpen && (
          <div className="pmModalOverlay" onClick={closeModal} role="presentation">
            <div
              className="pmModal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {/* Sticky header */}
              <div className="pmModalHead">
                <div>
                  <div className="pmModalTitle">
                    {mode === "add" ? "Add Product" : "Edit Product"}
                  </div>
                  <div className="pmModalHint">
                    Fields marked * are required
                  </div>
                </div>

                <button className="pmCloseBtn" type="button" onClick={closeModal}>
                  <FiX />
                </button>
              </div>

              {/* Scroll area */}
              <form className="pmModalBody" onSubmit={submitModal}>
                {/* Section: Basic */}
                <div className="pmSection">
                  <div className="pmSectionTitle">Basic Info</div>

                  <div className="pmField">
                    <label>Product Name *</label>
                    <input
                      value={form.name}
                      onChange={(e) => onChange("name", e.target.value)}
                      placeholder="e.g. iPhone Charger"
                    />
                    {errors.name && <div className="pmError">{errors.name}</div>}
                  </div>

                  <div className="pmField">
                    <label>Description *</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => onChange("description", e.target.value)}
                      placeholder="Write a short description..."
                      rows={4}
                    />
                    {errors.description && (
                      <div className="pmError">{errors.description}</div>
                    )}
                  </div>

                  <div className="pmGrid2">
                    <div className="pmField">
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

                    <div className="pmField">
                      <label>Stock *</label>
                      <input
                        type="number"
                        value={form.stock}
                        onChange={(e) => onChange("stock", e.target.value)}
                        placeholder="0"
                      />
                      {errors.stock && <div className="pmError">{errors.stock}</div>}
                    </div>
                  </div>

                  <div className="pmField">
                    <label>Price (LKR) *</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => onChange("price", e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                    />
                    {errors.price && <div className="pmError">{errors.price}</div>}
                  </div>
                </div>

                {/* Section: Images */}
                <div className="pmSection">
                  <div className="pmSectionTitle">Images</div>

                  <div className="pmImgGrid">
                    {/* Main */}
                    <div className="pmImgCard">
                      <div className="pmImgCardTop">
                        <div className="pmImgCardTitle">
                          <FiImage /> Main Image
                        </div>
                        <span className="pmChip">Primary</span>
                      </div>

                      <div className="pmField">
                        <label>Main Image URL (optional)</label>
                        <input
                          value={form.imageUrl}
                          onChange={(e) => onChange("imageUrl", e.target.value)}
                          placeholder="Paste URL or upload below"
                        />
                      </div>

                      <div className="pmUploadRow">
                        <label className="pmUploadBtn">
                          <FiUpload /> Upload Main
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => pickMainFile(e.target.files?.[0])}
                          />
                        </label>
                        <div className="pmFileName">
                          {mainFile ? mainFile.name : "No file selected"}
                        </div>
                      </div>

                      <div className="pmPreviewBox">
                        <img
                          src={mainPreview || form.imageUrl || FALLBACK_IMG}
                          alt="main preview"
                          onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
                        />
                      </div>
                    </div>

                    {/* Second */}
                    <div className="pmImgCard">
                      <div className="pmImgCardTop">
                        <div className="pmImgCardTitle">
                          <FiImage /> Second Image
                        </div>
                        <span className="pmChip ghost">Optional</span>
                      </div>

                      <div className="pmField">
                        <label>Second Image URL (optional)</label>
                        <input
                          value={form.imageUrl2}
                          onChange={(e) => onChange("imageUrl2", e.target.value)}
                          placeholder="Paste URL or upload below"
                        />
                      </div>

                      <div className="pmUploadRow">
                        <label className="pmUploadBtn">
                          <FiUpload /> Upload Second
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => pickSecondFile(e.target.files?.[0])}
                          />
                        </label>
                        <div className="pmFileName">
                          {secondFile ? secondFile.name : "No file selected"}
                        </div>
                      </div>

                      <div className="pmPreviewBox">
                        <img
                          src={secondPreview || form.imageUrl2 || FALLBACK_IMG}
                          alt="second preview"
                          onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sticky footer */}
                <div className="pmModalFooter">
                  <button
                    className="pmBtnGhost"
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button className="pmBtnPrimary" type="submit" disabled={saving}>
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
