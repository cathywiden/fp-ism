import React, { useState } from "react";

function DocumentViewer({ token }) {
  const [documentId, setDocId] = useState("");
  const [xmlData, setXmlData] = useState("");
  const [tamperWarning, setTamperWarning] = useState("");
  const [requestStatus, setRequestStatus] = useState(""); 

  async function fetchDocument() {
    setRequestStatus(""); 
    try {
      const response = await fetch(`http://localhost:3000/document/${documentId}`, {
        headers: {
          "Authorization": `Bearer ${token}` // send JWT token in the Auth header
        }
      });

      if (!response.ok) {
        throw new Error("Document not found or access denied");
      }

      const result = await response.json();
      setXmlData(result.document.substring(0, 500));
      setTamperWarning(result.isTampered ? "Warning: This document has been tampered with!" : "");
    } catch (error) {
      setXmlData(error.message);
      setTamperWarning(""); 
    }
  }

  const requestDocument = async () => {
    setXmlData(""); 
    setTamperWarning(""); 
    console.log(`Submitting request for ${documentId}`);
    try {
      const response = await fetch(`http://localhost:3000/request-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ documentId })
      });

      
      console.log(response);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setRequestStatus(data.message); 
    } catch (error) {
      setRequestStatus("Error requesting document: " + error.message); 
    }
  };

  return (
    <div>
      <input 
        value={documentId}
        onChange={e => setDocId(e.target.value)} 
        placeholder="Enter document ID"
      />
      <button onClick={fetchDocument}>Fetch Document</button>
      <button onClick={() => requestDocument()}>Request Document</button>
      {tamperWarning && <div style={{ color: "red", marginTop: "10px", marginBottom: "10px" }}>{tamperWarning}</div>}
      {requestStatus && <div style={{ marginTop: "10px", marginBottom: "10px" }}>{requestStatus}</div>} {/* display request status */}
      <div>{xmlData}</div>
    </div>
  );
}

export default DocumentViewer;
