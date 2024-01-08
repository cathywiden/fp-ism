import React, { useState, useEffect } from "react";
import { jwtDecode } from 'jwt-decode';
import DocumentViewer from './components/DocumentViewer';
import LoginForm from "./components/LoginForm";

function App() {
  const [user, setUser] = useState(null);

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

  return (
    <div className="App">
      {user ? (
        <div>
          Welcome {user.username}!
          {renderViewer && <DocumentViewer />}
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <LoginForm onLogin={login} />
      )}
    </div>
  );
}

export default App;
