import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../state/AuthContext";
import rakscLogo from "../assets/raksc-logo.png";

const inputCls = [
  "w-full rounded-lg border px-3 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200",
  "border-[#b0d4dc] bg-white",
  "focus:border-[#2AABBA] focus:ring-2 focus:ring-[#2AABBA]/20",
  "placeholder:text-slate-400",
].join(" ");

const labelCls = "block text-xs font-semibold uppercase tracking-wide mb-1.5";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { i18n } = useTranslation();

  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !username || !password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(email, username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f0f8f8" }}>
      {/* Navbar */}
      <nav
        className="flex items-center justify-between px-10 py-4 border-b"
        style={{ backgroundColor: "#ffffff", borderColor: "#d0eaea" }}
      >
        <Link to="/">
          <img src={rakscLogo} alt="RAK Statistics Logo" className="h-14 w-auto object-contain" />
        </Link>

        <div className="flex items-center gap-2 text-sm font-semibold">
          <button
            onClick={() => i18n.changeLanguage("en")}
            className={`px-3 py-1 rounded-full ${
              i18n.language === "en" ? "bg-[#1B6B8A] text-white" : "text-[#1B6B8A]"
            }`}
          >
            English
          </button>
          <button
            onClick={() => i18n.changeLanguage("ar")}
            className={`px-3 py-1 rounded-full ${
              i18n.language === "ar" ? "bg-[#1B6B8A] text-white" : "text-[#1B6B8A]"
            }`}
          >
            العربية
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {/* Badge */}
          <div className="text-center mb-8">
            <span
              className="text-xs font-bold tracking-[0.2em] uppercase px-4 py-1.5 rounded-full"
              style={{ color: "#1B6B8A", backgroundColor: "#d0eaea" }}
            >
              Get Started
            </span>
            <h1
              className="text-4xl font-serif font-semibold mt-4 mb-2"
              style={{ color: "#1B6B8A" }}
            >
              Create Account
            </h1>
            <div
              className="w-14 h-1 rounded-full mx-auto"
              style={{ background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)" }}
            />
          </div>

          {/* Card */}
          <div
            className="rounded-2xl border p-8 shadow-sm"
            style={{ backgroundColor: "#ffffff", borderColor: "#d0eaea" }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Section header */}
              <p
                className="text-[11px] font-bold uppercase tracking-widest pb-1 border-b"
                style={{ color: "#2AABBA", borderColor: "#d0eaea" }}
              >
                Your Details
              </p>

              <div>
                <label className={labelCls} style={{ color: "#1B6B8A" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className={labelCls} style={{ color: "#1B6B8A" }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. jsmith"
                  autoComplete="username"
                />
              </div>

              {/* Section header */}
              <p
                className="text-[11px] font-bold uppercase tracking-widest pt-1 pb-1 border-b"
                style={{ color: "#2AABBA", borderColor: "#d0eaea" }}
              >
                Security
              </p>

              <div>
                <label className={labelCls} style={{ color: "#1B6B8A" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className={labelCls} style={{ color: "#1B6B8A" }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputCls}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="text-xs font-medium text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white text-sm font-semibold py-3 rounded-full transition-colors duration-200 shadow-md disabled:opacity-60"
                style={{ backgroundColor: "#1B6B8A" }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#2AABBA"; }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#1B6B8A"; }}
              >
                {loading ? "Creating account…" : "Create Account"}
              </button>
            </form>
          </div>

          {/* Footer link */}
          <p className="text-center text-sm mt-6" style={{ color: "#5a8a8a" }}>
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold transition-colors duration-150"
              style={{ color: "#1B6B8A" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#2AABBA")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#1B6B8A")}
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>

      {/* Footer gradient bar */}
      <div
        className="h-1 w-full"
        style={{ background: "linear-gradient(to right, #5BBF8E, #2AABBA, #1B6B8A)" }}
      />
    </div>
  );
}
