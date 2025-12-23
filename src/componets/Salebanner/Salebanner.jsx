import React, { useEffect, useMemo, useState } from "react";
import { FiTrash2, FiPlus, FiChevronLeft, FiChevronRight, FiUpload } from "react-icons/fi";
import Navbar from "../Navbar/Navbar";
import "./Salebanner.css";

import { db, storage } from "../../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const COLLECTION_NAME = "Banners";
const FALLBACK_IMG =
  "https://dummyimage.com/1200x400/111827/ffffff.png&text=Banner+Image";

export default function BannerMaker() {
  const [banners, setBanners] = useState([]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // form
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    imageUrl: "", // optional if uploading file
    discount: "",
  });

  // image file upload
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");

  const max = useMemo(() => banners.length, [banners.length]);

  // ✅ READ banners from Firestore
  useEffect(() => {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBanners(rows);

      // keep index safe
      setIndex((p) => (rows.length === 0 ? 0 : Math.min(p, rows.length - 1)));
    });
    return () => unsub();
  }, []);

  // ✅ autoplay slider
  useEffect(() => {
    if (banners.length === 0) return;
    const t = setInterval(() => {
      setIndex((p) => (p + 1) % banners.length);
    }, 4000);
    return () => clearInterval(t);
  }, [banners]);

  const prev = () => setIndex((p) => (p - 1 + max) % max);
  const next = () => setIndex((p) => (p + 1) % max);

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onPickFile = (file) => {
    setImageFile(file || null);
    if (!file) {
      setPreview("");
      return;
    }
    setPreview(URL.createObjectURL(file));
  };

  // ✅ upload image if file picked
  const uploadImageIfNeeded = async () => {
    // If user pasted URL, use it (skip upload)
    if (form.imageUrl.trim()) {
      return { imageUrl: form.imageUrl.trim(), imagePath: "" };
    }

    // If no file selected, no image
    if (!imageFile) {
      return { imageUrl: "", imagePath: "" };
    }

    const safeName = imageFile.name.replace(/\s+/g, "_");
    const path = `Banners/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, imageFile);
    const url = await getDownloadURL(storageRef);

    return { imageUrl: url, imagePath: path };
  };

  // ✅ ADD banner
  const addBanner = async () => {
    if (!form.title.trim()) return alert("Title required");
    if (!form.subtitle.trim()) return alert("Subtitle required");
    if (!form.imageUrl.trim() && !imageFile) return alert("Image URL or File required");

    try {
      setSaving(true);

      const { imageUrl, imagePath } = await uploadImageIfNeeded();

      await addDoc(collection(db, COLLECTION_NAME), {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        discount: form.discount.trim(),
        imageUrl: imageUrl || "",
        imagePath: imagePath || "",
        createdAt: serverTimestamp(),
      });

      // reset
      setForm({ title: "", subtitle: "", imageUrl: "", discount: "" });
      setImageFile(null);
      setPreview("");
    } catch (e) {
      console.error(e);
      alert("Failed to add banner. Check Firestore/Storage rules.");
    } finally {
      setSaving(false);
    }
  };

  // ✅ DELETE banner (and Storage image if uploaded)
  const deleteBanner = async (banner) => {
    const ok = window.confirm("Delete this banner?");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, COLLECTION_NAME, banner.id));

      if (banner.imagePath) {
        try {
          await deleteObject(ref(storage, banner.imagePath));
        } catch {}
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete banner.");
    }
  };

  const active = banners[index];

  return (
    <div className="bmLayout">
      <Navbar />
      <main className="bmMain">
        <div className="bmHeader">
          <div>
            <h1 className="bmTitle">Slide Banner Maker</h1>
            <p className="bmSub">Create & save sale banners to Firestore ({COLLECTION_NAME})</p>
          </div>
        </div>

        {/* FORM */}
        <section className="bmCard">
          <div className="bmForm">
            <div className="bmField">
              <label>Title *</label>
              <input
                placeholder="Mega Sale 🎉"
                value={form.title}
                onChange={(e) => onChange("title", e.target.value)}
              />
            </div>

            <div className="bmField">
              <label>Subtitle *</label>
              <input
                placeholder="Up to 40% OFF"
                value={form.subtitle}
                onChange={(e) => onChange("subtitle", e.target.value)}
              />
            </div>

            <div className="bmField">
              <label>Discount Badge</label>
              <input
                placeholder="40% OFF"
                value={form.discount}
                onChange={(e) => onChange("discount", e.target.value)}
              />
            </div>

            <div className="bmField">
              <label>Image URL (optional)</label>
              <input
                placeholder="https://..."
                value={form.imageUrl}
                onChange={(e) => onChange("imageUrl", e.target.value)}
              />
              <div className="bmTiny">If you paste URL, upload file is optional.</div>
            </div>

            <div className="bmUpload">
              <label className="bmUploadBtn">
                <FiUpload />
                Upload Image File
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                />
              </label>
              <div className="bmUploadNote">{imageFile ? imageFile.name : "PNG/JPG recommended"}</div>
            </div>

            <div className="bmPreviewBox">
              <img
                className="bmPreview"
                src={preview || form.imageUrl || FALLBACK_IMG}
                alt="preview"
                onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
              />
            </div>

            <button className="bmAddBtn" onClick={addBanner} disabled={saving}>
              <FiPlus />
              {saving ? "Saving..." : "Save Banner"}
            </button>
          </div>
        </section>

        {/* SLIDER PREVIEW */}
        <section className="bmSliderWrap">
          <div className="bmSlider">
            {banners.length === 0 ? (
              <div className="bmEmpty">No banners saved yet</div>
            ) : (
              <>
                <div
                  className="bmTrack"
                  style={{ transform: `translateX(-${index * 100}%)` }}
                >
                  {banners.map((b) => (
                    <div className="bmSlide" key={b.id}>
                      <img src={b.imageUrl || FALLBACK_IMG} alt="" />
                      <div className="bmOverlay" />
                      <div className="bmContent">
                        {b.discount && <span className="bmBadge">{b.discount}</span>}
                        <h2>{b.title}</h2>
                        <h1>{b.subtitle}</h1>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="bmNav left" onClick={prev} type="button">
                  <FiChevronLeft />
                </button>
                <button className="bmNav right" onClick={next} type="button">
                  <FiChevronRight />
                </button>

                <div className="bmDots">
                  {banners.map((_, i) => (
                    <button
                      key={i}
                      className={`bmDot ${i === index ? "active" : ""}`}
                      onClick={() => setIndex(i)}
                      type="button"
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* active meta */}
          {active && (
            <div className="bmMeta">
              <div><b>Showing:</b> {active.title}</div>
              <div className="bmMetaSmall">Total banners: {banners.length}</div>
            </div>
          )}
        </section>

        {/* LIST */}
        <section className="bmList">
          {banners.map((b) => (
            <div className="bmRow" key={b.id}>
              <img src={b.imageUrl || FALLBACK_IMG} alt="" />
              <div className="bmRowText">
                <b>{b.title}</b>
                <p>{b.subtitle}</p>
              </div>
              <button className="bmTrash" onClick={() => deleteBanner(b)} type="button">
                <FiTrash2 />
              </button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
