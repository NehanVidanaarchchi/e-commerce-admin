import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    const email = form.email.trim();
    const password = form.password;

    if (!email || !password) {
      setErr("Please enter email and password.");
      return;
    }

    // Example credentials:
    // email: admin@gmail.com
    // pass : admin123
    setLoading(true);
    try {
      const ok = email === "admin@gmail.com" && password === "admin123";
      if (!ok) {
        setErr("Invalid admin credentials.");
        return;
      }


      localStorage.setItem("admin_logged", "true");

      
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginPage">
      <div className="loginCard">
        <div className="loginHead">
          <div>
            <h1 className="loginTitle">Admin Login</h1>
            <p className="loginSub">Sign in to manage your store</p>
          </div>
        </div>

        <form className="loginForm" onSubmit={onSubmit}>
          {err && <div className="loginError">{err}</div>}

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="@gmail.com"
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label>Password</label>
            <div className="passRow">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => onChange("password", e.target.value)}
                
                autoComplete="current-password"
              />
              <button
                type="button"
                className="showBtn"
                onClick={() => setShowPass((s) => !s)}
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button className="loginBtn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
