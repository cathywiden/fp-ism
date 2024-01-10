// frontend/src/components/Dashboard.js

import React, { useState, useEffect } from "react";

function User1Dashboard({ token, lastUpdated }) {
  const [sharedDocs, setSharedDocs] = useState([]);

  useEffect(() => {
    const fetchSharedDocs = async () => {
      const response = await fetch("http://localhost:3000/shared-docs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSharedDocs(data);
        
      } else {
        // errors?
      }
    };

    fetchSharedDocs();
  }, [token, lastUpdated]); // re-fetch whenever lastUpdated changes
  return (
    <div>
      <h2>Shared Documents</h2>
      <table>
        <thead>
          <tr>
            <th>Document ID</th>
            <th>Target User</th>
            <th>Status</th>
            <th>Token ID</th>
            <th>Expiry</th>
          </tr>
        </thead>
        <tbody>
          {sharedDocs.map((doc) => (
            <tr key={doc.DOC_ID}>
              <td>{doc.DOC_ID}</td>
              <td>{doc.TARGET_USER}</td>
              <td>{doc.STATUS}</td>
              <td>{doc.TOKEN_ID}</td>
              <td>{doc.EXPIRY}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default User1Dashboard;
