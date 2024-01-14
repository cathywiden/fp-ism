// frontend/src/components/Dashboard.js

import React, { useState, useEffect } from "react";
import "../Dashboard.css";

function Dashboard({ token, lastUpdated }) {
  const [sharedDocs, setSharedDocs] = useState([]);
  const [directDocId, setDirectDocId] = useState("");
  const [directTargetUser, setDirectTargetUser] = useState("");
  const [directExpiryInSeconds, setDirectExpiryInSeconds] = useState("");
  const [grantStatus, setGrantStatus] = useState("");
  const [actionStatus, setActionStatus] = useState({});
  const [lastAction, setLastAction] = useState({ action: "", timestamp: Date.now() });


  const handleInputDocIdClick = () => {
    setDirectDocId("");
  };

  const handleInputTargetUserClick = () => {
    setDirectTargetUser("");
  };
  // status indicator based on action status
  const renderStatusIndicator = (docId) => {
    const status = actionStatus[docId];
    switch (status) {
      case "in progress":
        return <span>...</span>;
      case "completed":
        return <span className="checkmark">✔</span>;
      case "error":
        return <span className="red-cross">❌</span>;
      default:
        return null; // no action taken yet!
    }
  };

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
  }, [token, lastUpdated, lastAction]);

  const sortDocuments = (docs) => {
    const statusOrder = {
      requested: 1,
      granted: 2,
      expired: 3,
      revoked: 4,
      denied: 5,
    };

    return docs.sort((a, b) => {
      const statusComparison = statusOrder[a.STATUS] - statusOrder[b.STATUS];
      if (statusComparison !== 0) return statusComparison;

      //  compare expiry times for "granted"
      const aExpiry =
        a.STATUS === "granted" ? a.TOKEN_EXP_TS : Number.MAX_VALUE; // to push the ones with no expiry time to the end of the list
      const bExpiry =
        b.STATUS === "granted" ? b.TOKEN_EXP_TS : Number.MAX_VALUE;

      return aExpiry - bExpiry; // sort by nearest expiry time first
    });
  };

  const calculateRemainingTime = (expiryTimestamp) => {
    const now = new Date();
    const expiryDate = new Date(expiryTimestamp * 1000); // convert UNIX timestamp
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
    setActionStatus((prevStatus) => ({
      ...prevStatus,
      [docId]: "in progress",
    }));

    // must pass in expiry in seconds
    const expiryInSeconds = prompt("Enter validity time in seconds:", "36000"); // default ten hours
    if (!expiryInSeconds) return;
    try {
      const response = await fetch("http://localhost:3000/grant-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: docId,
          targetUser: targetUser,
          documentHash: "",
          expiryInSeconds: parseInt(expiryInSeconds, 10), // convert string to number
        }),
      });

      if (!response.ok) {
        setGrantStatus(`Error granting access to ${docId}.`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setActionStatus((prevStatus) => ({
        ...prevStatus,
        [docId]: "completed",
      }));
         // wait for half a second to show the checkmark
    await new Promise(resolve => setTimeout(resolve, 500));

    // reset actionStatus and trigger re-fetch
    setActionStatus((prevStatus) => ({ ...prevStatus, [docId]: null }));
    setLastAction({ action: "grant", timestamp: Date.now() });
  
    } catch (error) {
      setActionStatus((prevStatus) => ({ ...prevStatus, [docId]: "error" }));
    }
  };

  const handleDirectGrant = () => {
    if (!directDocId.trim() || !directTargetUser.trim()) {
      alert("Please enter both Document ID and Target User.");
      return;
    }

    setGrantStatus("");
    setGrantStatus(`Granting access in progress...`);

    const expiryTime = directExpiryInSeconds.trim()
      ? parseInt(directExpiryInSeconds, 10)
      : 36000; // default ten hours

    handleGrant(directDocId, directTargetUser, expiryTime);
  };

  const handleDeny = async (docId, targetUser) => {
    setActionStatus((prevStatus) => ({
      ...prevStatus,
      [docId]: "in progress",
    }));

    const reason = prompt("Enter the reason for denial:");
    if (!reason) return; // must passs in reason

    try {
      const response = await fetch("http://localhost:3000/deny-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: docId,
          targetUser: targetUser,
          reason: reason,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setActionStatus((prevStatus) => ({
        ...prevStatus,
        [docId]: "completed",
      }));

               // wait for half a second to show the checkmark
    await new Promise(resolve => setTimeout(resolve, 500));

    // reset actionStatus and trigger re-fetch
      setActionStatus((prevStatus) => ({ ...prevStatus, [docId]: null }));
      setLastAction({ action: 'grant', timestamp: Date.now() });
    } catch (error) {
      setActionStatus((prevStatus) => ({ ...prevStatus, [docId]: "error" }));
    }
  };

  const handleRevoke = async (docId) => {
    setActionStatus((prevStatus) => ({
      ...prevStatus,
      [docId]: "in progress",
    }));
    const reason = prompt("Enter the reason for revocation:");
    if (!reason) return; // must passs in reason

    try {
      const response = await fetch("http://localhost:3000/revoke-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: docId,
          reason: reason,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setActionStatus((prevStatus) => ({
        ...prevStatus,
        [docId]: "completed",
      }));
               // wait for half a second to show the checkmark
    await new Promise(resolve => setTimeout(resolve, 500));

    // reset actionStatus and trigger re-fetch
      setActionStatus((prevStatus) => ({ ...prevStatus, [docId]: null }));
      setLastAction({ action: 'grant', timestamp: Date.now() });
    } catch (error) {
      setActionStatus((prevStatus) => ({ ...prevStatus, [docId]: "error" }));
    }
  };

  // placeholder for now!
  const handleRenew = (docId) => console.log("Renew", docId);

  return (
    <div>
      {/* direct sharing */}
      <div>
        <h2>Direct Sharing</h2>
        <input
          type="text"
          value={directDocId}
          onChange={(e) => setDirectDocId(e.target.value)}
          onClick={handleInputDocIdClick}
          placeholder="Document ID"
        />
        <input
          type="text"
          value={directTargetUser}
          onChange={(e) => setDirectTargetUser(e.target.value)}
          onClick={handleInputTargetUserClick}
          placeholder="Target User"
        />
        <button onClick={handleDirectGrant} className="grant-button">
          Grant Access
        </button>
        {grantStatus && <div>{grantStatus}</div>}{" "}
        {/* display grant status message */}
      </div>

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
              <th>Status</th> {/* status indicators column */}
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
                      <button
                        onClick={() => handleDeny(doc.DOC_ID, doc.TARGET_USER)}
                        className="deny-button"
                      >
                        Deny
                      </button>
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
                  {/* no buttons for "revoked" or "denied" status. according to contract logic, a new request can be placed */}
                </td>
                <td>{renderStatusIndicator(doc.DOC_ID)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default Dashboard;
