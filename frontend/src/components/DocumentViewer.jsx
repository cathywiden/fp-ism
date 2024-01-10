// frontend/src/components/DocumentViewer.jsx

import React, { useState, useEffect } from "react";

function DocumentViewer({ token }) {
  const [sharedDocs, setSharedDocs] = useState([]);
  const [documentId, setDocId] = useState("");
  const [xmlData, setXmlData] = useState("");
  const [tamperWarning, setTamperWarning] = useState("");
  const [requestStatus, setRequestStatus] = useState("");

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
        // errors
      }
    };

    fetchSharedDocs();
  }, [token]);

  async function fetchDocument() {
    setRequestStatus("");
    try {
      const response = await fetch(
        `http://localhost:3000/document/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`, // send JWT token in the Auth header
          },
        }
      );

      if (!response.ok) {
        throw new Error("Document not found or access denied");
      }

      const result = await response.json();
      setXmlData(result.document.substring(0, 500));
      setTamperWarning(
        result.isTampered
          ? "Warning: This document has been tampered with!"
          : ""
      );
    } catch (error) {
      setXmlData(error.message);
      setTamperWarning("");
    }
  }

  const requestDocument = async () => {
    setXmlData("");
    setTamperWarning("");
    console.log(`Submitting request for ${documentId}.`);
    try {
      const response = await fetch(`http://localhost:3000/request-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setRequestStatus(data.message);
    } catch (error) {
      setRequestStatus("Error requesting document: " + error.message);
    }
  };

  const handleInputClick = () => {
    setDocId("");
    setXmlData("");
    setTamperWarning("");
    setRequestStatus("");
  };

  return (
    <div>
      {/* combined input field &&dropdown list */}
      <input
        list="docList"
        value={documentId}
        onChange={(e) => setDocId(e.target.value)}
        onClick={handleInputClick}
        placeholder="Enter or select a document ID"
      />
      <datalist id="docList">
        {sharedDocs.map((doc) => (
          <option key={doc.DOC_ID} value={doc.DOC_ID} />
        ))}
      </datalist>

      <button onClick={fetchDocument}>Fetch Document</button>
      <button onClick={() => requestDocument()}>Request Document</button>
      {tamperWarning && (
        <div style={{ color: "red", marginTop: "10px", marginBottom: "10px" }}>
          {tamperWarning}
        </div>
      )}
      {requestStatus && (
        <div style={{ marginTop: "10px", marginBottom: "10px" }}>
          {requestStatus}
        </div>
      )}
      <div>{xmlData}</div>
    </div>
  );
}

export default DocumentViewer;
