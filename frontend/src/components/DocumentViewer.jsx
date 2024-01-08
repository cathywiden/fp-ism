// frontend/src/components/DocumentViewer.jsx

import React, { useState } from "react";

function DocumentViewer({ token }) {
  const [documentId, setDocId] = useState('');
  const [xmlData, setXmlData] = useState('');

  async function fetchDocument() {
    try {
      const response = await fetch(`http://localhost:3000/document/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Document not found or access denied');
      }

      const data = await response.text();
      setXmlData(data.substring(0, 500)); 
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
      <div>{xmlData}</div>
    </div>
  )
}

export default DocumentViewer;
