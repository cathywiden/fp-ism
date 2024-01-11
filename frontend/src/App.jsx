// frontend/src/App.jsx

import React, { useState, useEffect } from "react";
import { jwtDecode } from 'jwt-decode';
import DocumentViewer from './components/DocumentViewer';
import LoginForm from "./components/LoginForm";
import User1Dashboard from './components/Dashboard';
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      const decodedUser = jwtDecode(savedToken);
      setUser(decodedUser);
    }
  }, []);
  
  const login = async (credentials) => {
    const response = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();
    if (data.token) {
      localStorage.setItem("token", data.token);
      const decodedToken = jwtDecode(data.token);
      console.log(decodedToken);
      setUser(decodedToken);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };
  
  const renderViewer = user?.role === "Receiver"; 
  const renderDashboard = user?.role === "Sharer, Auditor";

  return (
    <div className="App">
      {user ? (
        <div>
          <div className="welcome">
          Welcome {user.username}!</div>
          {renderViewer && <DocumentViewer token={localStorage.getItem('token')} />}
          {renderDashboard && <User1Dashboard token={localStorage.getItem('token')} lastUpdated={lastUpdated} />}
          <div className="logout-container">
            <button onClick={logout}>Logout</button>
          </div>
        </div>
      ) : (
        <LoginForm onLogin={login} />
      )}
    </div>
  );
}

export default App;
