import React, { useState, useEffect } from "react";
import "../Dashboard.css";

function Dashboard({ token, lastUpdated }) {
  const [sharedDocs, setSharedDocs] = useState([]);
  const [directDocId, setDirectDocId] = useState("");
  const [directTargetUser, setDirectTargetUser] = useState("");
  const [directExpiryInSeconds, setDirectExpiryInSeconds] = useState("");
  const [grantStatus, setGrantStatus] = useState("");
  const [actionStatus, setActionStatus] = useState({});
  const [lastAction, setLastAction] = useState({
    action: "",
    timestamp: Date.now(),
  });

  const handleInputDocIdClick = () => {
    setDirectDocId("");
  };

  const handleInputTargetUserClick = () => {
    setDirectTargetUser("");
  };

  const getActionStatusKey = (docId, tokenId) => {
    return tokenId ? `${docId}-${tokenId}` : `${docId}-request`;
  };

  // status indicator based on action status
  const renderStatusIndicator = (docId, tokenId) => {
    const actionKey = getActionStatusKey(docId, tokenId);
    const status = actionStatus[actionKey];
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

  // highlight revoked entries to warn user1 before granting access again
  const hasRevokedHistory = (docId) => {
    return sharedDocs.some(
      (doc) => doc.DOC_ID === docId && doc.STATUS === "revoked"
    );
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

  const handleGrant = async (docId, targetUser, tokenId) => {
    const actionKey = getActionStatusKey(docId, tokenId);

    setActionStatus((prevStatus) => ({
      ...prevStatus,
      [actionKey]: "in progress",
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
        [actionKey]: "completed",
      }));

      // wait for half a second to show the checkmark
      await new Promise((resolve) => setTimeout(resolve, 500));

      // reset actionStatus and trigger re-fetch
      setActionStatus((prevStatus) => ({ ...prevStatus, [docId]: null }));
      setLastAction({ action: "grant", timestamp: Date.now() });
    } catch (error) {
      setActionStatus((prevStatus) => ({ ...prevStatus, [docId]: "error" }));
    }
  };

  const handleDirectGrant = async () => {
    if (!directDocId.trim() || !directTargetUser.trim()) {
      alert("Please enter both Document ID and Target User.");
      return;
    }

    setGrantStatus("Granting access in progress...");

    const expiryTime = directExpiryInSeconds.trim()
      ? parseInt(directExpiryInSeconds, 10)
      : 36000; // default ten hours

    try {
      await handleGrant(directDocId, directTargetUser, expiryTime); // wait for handleGrant to complete!
      setGrantStatus("Access has been granted");
    } catch (error) {
      setGrantStatus(`Error granting access: ${error.message}`);
    }

    setTimeout(() => {
      setGrantStatus("");
    }, 2000); // clear success msg
  };

  const handleDeny = async (docId, targetUser, tokenId) => {
    const actionKey = getActionStatusKey(docId, tokenId);

    setActionStatus((prevStatus) => ({
      ...prevStatus,
      [actionKey]: "in progress",
    }));

    const reason = prompt("Enter the reason for denial:");
    if (!reason) return;

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
        [actionKey]: "completed",
      }));

      // wait for half a second to show the checkmark
      await new Promise((resolve) => setTimeout(resolve, 500));

      // reset actionStatus and trigger re-fetch
      setActionStatus((prevStatus) => ({ ...prevStatus, [actionKey]: null }));
      setLastAction({ action: "deny", timestamp: Date.now() });
    } catch (error) {
      setActionStatus((prevStatus) => ({
        ...prevStatus,
        [actionKey]: "error",
      }));
    }
  };

  const handleRevoke = async (docId, tokenId) => {
    const actionKey = getActionStatusKey(docId, tokenId);

    setActionStatus((prevStatus) => ({
      ...prevStatus,
      [actionKey]: "in progress",
    }));
    const reason = prompt("Enter the reason for revocation:");
    if (!reason) return;

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
        [actionKey]: "completed",
      }));
      // checkmark for half a sec
      await new Promise((resolve) => setTimeout(resolve, 500));

      // reset actionStatus and trigger re-fetch
      setActionStatus((prevStatus) => ({ ...prevStatus, [actionKey]: null }));
      setLastAction({ action: "revoke", timestamp: Date.now() });
    } catch (error) {
      setActionStatus((prevStatus) => ({
        ...prevStatus,
        [actionKey]: "error",
      }));
    }
  };

  const handleRenew = async (docId, tokenId) => {
    const actionKey = getActionStatusKey(docId, tokenId);

    setActionStatus((prevStatus) => ({
      ...prevStatus,
      [actionKey]: "in progress",
    }));

    console.log("Document ID to renew:");
    console.log(docId);

    setActionStatus((prevStatus) => ({
      ...prevStatus,
      [actionKey]: "in progress",
    }));

    try {
      // additional time for renewal
      const additionalTimeInSeconds = prompt(
        "Enter additional time in seconds for document renewal:",
        "7200" // default to 2 hours
      );

      if (!additionalTimeInSeconds) return;

      // request payload
      console.log("Request Payload:");
      console.log({
        documentId: docId,
        additionalTimeInSeconds: parseInt(additionalTimeInSeconds, 10),
      });

      const response = await fetch("http://localhost:3000/renew-access/:id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: docId,
          additionalTimeInSeconds: parseInt(additionalTimeInSeconds, 10),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setActionStatus((prevStatus) => ({
        ...prevStatus,
        [actionKey]: "completed",
      }));

      await new Promise((resolve) => setTimeout(resolve, 500));

      setActionStatus((prevStatus) => ({ ...prevStatus, [actionKey]: null }));
      setLastAction({ action: "renew", timestamp: Date.now() });
    } catch (error) {
      setActionStatus((prevStatus) => ({
        ...prevStatus,
        [actionKey]: "error",
      }));
    }
  };

  return (
    <div>
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
        {grantStatus && <div>{grantStatus}</div>}
        {""}
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
              <th>Action Status</th>
            </tr>
          </thead>
          <tbody>
            {sharedDocs.map((doc) => (
              <tr
                key={doc.DOC_ID + "-" + doc.TOKEN_ID}
                className={`row-hover-effect ${
                  doc.STATUS === "requested" && hasRevokedHistory(doc.DOC_ID)
                    ? "highlight-row"
                    : null
                }`}
              >
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
                  {doc.STATUS === "requested" && (
                    <>
                      <button
                        onClick={() =>
                          handleGrant(doc.DOC_ID, doc.TARGET_USER, doc.TOKEN_ID)
                        }
                        className="grant-button"
                      >
                        Grant
                      </button>
                      <button
                        onClick={() =>
                          handleDeny(doc.DOC_ID, doc.TARGET_USER, doc.TOKEN_ID)
                        }
                        className="deny-button"
                      >
                        Deny
                      </button>
                    </>
                  )}
                  {doc.STATUS === "expired" && (
                    <button
                      onClick={() => handleRenew(doc.DOC_ID, doc.TOKEN_ID)}
                      className="renew-button"
                    >
                      Renew
                    </button>
                  )}
                  {doc.STATUS === "granted" && (
                    <button
                      onClick={() => handleRevoke(doc.DOC_ID, doc.TOKEN_ID)}
                      className="revoke-button"
                    >
                      Revoke
                    </button>
                  )}
                </td>
                <td>{renderStatusIndicator(doc.DOC_ID, doc.TOKEN_ID)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default Dashboard;
