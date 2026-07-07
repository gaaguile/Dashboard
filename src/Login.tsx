import { useState } from "react";
import type { CSSProperties } from "react";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const VALID_USERNAME = "gaaguile";
  const VALID_PASSWORD = "Sofia26-";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate a brief loading delay
    setTimeout(() => {
      if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        localStorage.setItem("dashboardAuth", "true");
        onLogin();
      } else {
        setError("Invalid username or password");
      }
      setIsLoading(false);
    }, 300);
  };

  return (
    <div style={S.container}>
      <div style={S.loginBox}>
        <div style={S.header}>
          <h1 style={S.title}>Gabriel Tekken</h1>
          <p style={S.subtitle}>Dashboard for Trading Strategies</p>
        </div>

        <form onSubmit={handleSubmit} style={S.form}>
          <div style={S.formGroup}>
            <label htmlFor="username" style={S.label}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={S.input}
              disabled={isLoading}
            />
          </div>

          <div style={S.formGroup}>
            <label htmlFor="password" style={S.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={S.input}
              disabled={isLoading}
            />
          </div>

          {error && <div style={S.error}>{error}</div>}

          <button type="submit" style={S.submitBtn} disabled={isLoading}>
            {isLoading ? "Logging in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

const S = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    padding: "20px",
  } satisfies CSSProperties,

  loginBox: {
    background: "rgba(255, 255, 255, 0.95)",
    borderRadius: "12px",
    padding: "3rem",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
    width: "100%",
    maxWidth: "400px",
  } satisfies CSSProperties,

  header: {
    textAlign: "center" as const,
    marginBottom: "2rem",
  } satisfies CSSProperties,

  title: {
    fontSize: 32,
    fontWeight: 700,
    margin: "0 0 8px",
    background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  } satisfies CSSProperties,

  subtitle: {
    fontSize: 14,
    color: "#64748b",
    margin: 0,
    fontWeight: 500,
    letterSpacing: "0.05em",
  } satisfies CSSProperties,

  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.5rem",
  } satisfies CSSProperties,

  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  } satisfies CSSProperties,

  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } satisfies CSSProperties,

  input: {
    padding: "0.75rem 1rem",
    fontSize: 14,
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    fontFamily: "inherit",
    transition: "all 0.3s ease",
    outline: "none" as const,
    color: "#0f172a",
  } satisfies CSSProperties,

  submitBtn: {
    padding: "0.875rem 1rem",
    fontSize: 14,
    fontWeight: 600,
    background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    marginTop: "1rem",
  } satisfies CSSProperties,

  error: {
    padding: "0.75rem 1rem",
    fontSize: 13,
    color: "#dc2626",
    background: "#fee2e2",
    borderRadius: "6px",
    borderLeft: "4px solid #dc2626",
  } satisfies CSSProperties,
};
