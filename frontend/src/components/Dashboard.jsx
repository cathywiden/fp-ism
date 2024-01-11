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
        let data = await response.json();
        data = sortDocuments(data);
        setSharedDocs(data);
      } else {
        // errors?
      }
    };

    fetchSharedDocs();
  }, [token, lastUpdated]); // re-fetch whenever lastUpdated changes

  const sortDocuments = (docs) => {
    const statusOrder = { requested: 1, granted: 2, revoked: 3, expired: 4 };

    return docs.sort((a, b) => {
      const statusComparison = statusOrder[a.STATUS] - statusOrder[b.STATUS];
      if (statusComparison !== 0) return statusComparison;

      return a.TOKEN_ID - b.TOKEN_ID; // Assuming TOKEN_ID is numerical
    });
  };

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

  const handleGrant = async (docId, targetUser) => {

    const expiryInSeconds = prompt("Enter validity time in seconds:", "36000"); // default ten hours in seconds
  if (!expiryInSeconds) return; 
    try {
      const response = await fetch("http://localhost:3000/grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: docId,
          targetUser: targetUser,
          documentHash: "TESTHASH",
          expiryInSeconds: parseInt(expiryInSeconds, 10), // convert string to number
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Grant success:", result.message);
    } catch (error) {
      console.error("Error granting access:", error.message);
    }
  };

  // placeholders for now!
  const handleDeny = (docId) => console.log("Deny", docId);
  const handleRevoke = (docId) => console.log("Revoke", docId);
  const handleRenew = (docId) => console.log("Renew", docId);

  return (
    <div>
      <div className="doc-list">
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
                  {doc.STATUS === "granted"
                    ? calculateRemainingTime(doc.TOKEN_EXP_TS)
                    : "N/A"}
                </td>
                <td>
                  {/* conditional rendering of action buttons */}
                  {doc.STATUS === "requested" && (
                    <>
                      <button
                        onClick={() => handleGrant(doc.DOC_ID, doc.TARGET_USER)}
                        className="grant-button"
                      >
                        Grant
                      </button>
                      {/* other buttons */}
                    </>
                  )}
                  {doc.STATUS === "expired" && (
                    <button
                      onClick={() => handleRenew(doc.DOC_ID)}
                      className="renew-button"
                    >
                      Renew
                    </button>
                  )}
                  {doc.STATUS === "granted" && (
                    <button
                      onClick={() => handleRevoke(doc.DOC_ID)}
                      className="revoke-button"
                    >
                      Revoke
                    </button>
                  )}
                  {doc.STATUS === "revoked" && (
                    <button
                      onClick={() => handleGrant(doc.DOC_ID)}
                      className="grant-button"
                    >
                      Grant Again
                    </button>
                  )}
                  {/* no buttons for 'denied' status. according to contract logic, a new request can be placed */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default User1Dashboard;