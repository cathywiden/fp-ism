// frontend/src/components/Dashboard.js

import React, { useState, useEffect } from "react";
import "../Dashboard.css";

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


  const calculateRemainingTime = (expiryTimestamp) => {
    const now = new Date();
    const expiryDate = new Date(expiryTimestamp * 1000); // convert UNIX timestamp to JavaScript Date
    const diffInHours = (expiryDate - now) / 1000 / 3600;

    if (diffInHours < 1) {
      return "<1h";
    } else if (diffInHours < 24) {
      return `${Math.round(diffInHours)}h`;
    } else {
      return `${Math.round(diffInHours / 24)}d`;
    }
  };

    // placeholders for now!
    const handleGrant = (docId) => console.log('Grant', docId);
    const handleDeny = (docId) => console.log('Deny', docId);
    const handleRevoke = (docId) => console.log('Revoke', docId);
    const handleRenew = (docId) => console.log('Renew', docId);
  
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
          {sharedDocs.map((doc) => (
            <tr key={doc.DOC_ID} className="row-hover-effect">
                <td>{doc.DOC_ID}</td>
                <td>{doc.TARGET_USER}</td>
                <td>{doc.STATUS}</td>
                <td>{doc.TOKEN_ID}</td>
                <td>
                  {doc.STATUS === "granted" ? calculateRemainingTime(doc.TOKEN_EXP_TS) : "N/A"}
                </td>
                <td>
                  {/* conditional rendering of action buttons */}
                  {doc.STATUS === "requested" && (
                    <>
                      <button onClick={() => handleGrant(doc.DOC_ID)} className="grant-button">Grant</button>
<button onClick={() => handleDeny(doc.DOC_ID)} className="deny-button">Deny</button>

                    </>
                  )}
                  {doc.STATUS === "expired" && (
                    <button onClick={() => handleRenew(doc.DOC_ID)}>Renew</button>
                  )}
                  {doc.STATUS === "granted" && (
                    <button onClick={() => handleRevoke(doc.DOC_ID)}>Revoke</button>
                  )}
                  {doc.STATUS === "revoked" && (
                    <button onClick={() => handleGrant(doc.DOC_ID)}>Grant Again</button>
                  )}
                  {/* no buttons for 'denied' status. according to contract logoc, a new request can be placed */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  
  export default User1Dashboard;