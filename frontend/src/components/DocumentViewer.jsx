import React, { useState } from "react";

function DocumentViewer({ token }) {
  const [documentId, setDocId] = useState("");
  const [xmlData, setXmlData] = useState("");
  const [tamperWarning, setTamperWarning] = useState("");
  const TAMPER_WARNING = "Warning: This dicument has been tampered with!";

  async function fetchDocument() {
    try {
      const response = await fetch(`http://localhost:3000/document/${documentId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Document not found or access denied");
      }

      const result = await response.json();
      console.log(result.isTampered);

      setXmlData(result.document.substring(0, 500));

      setTamperWarning(prevWarning => (result.isTampered ? TAMPER_WARNING : ""));
    } catch (error) {
      setXmlData(error.message);
    }
  }

  return (
    <div>
      <input 
        value={documentId}
        onChange={e => setDocId(e.target.value)} 
        placeholder="Enter document ID"
      />
      <button onClick={fetchDocument}>Fetch Document</button>
      {tamperWarning && <div style={{ color: "red", marginTop: "10px", marginBottom: "10px" }}>{tamperWarning}</div>}
      <div>{xmlData}</div>
    </div>
  );
}

export default DocumentViewer;
