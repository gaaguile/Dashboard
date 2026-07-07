import { useState, useEffect } from "react";
import MetricGrid from "./MetricGrid";
import Login from "./Login";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in on mount
  useEffect(() => {
    try {
      const authToken = localStorage.getItem("dashboardAuth");
      if (authToken === "true") {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error("Storage unavailable:", error);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("dashboardAuth");
    } catch (error) {
      console.error("Storage unavailable:", error);
    }
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div>
      <MetricGrid onLogout={handleLogout} />
    </div>
  );
}
