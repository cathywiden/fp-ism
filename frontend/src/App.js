import React, { useState } from 'react';
import './App.css';

function App() {
  const [documentId, setDocumentId] = useState('');
  const [xmlSnippet, setXmlSnippet] = useState('');

  const fetchDocument = async () => {
    try {
      const response = await fetch(`http://localhost:3000/document/${encodeURIComponent(documentId)}`);
      if (!response.ok) {
        throw new Error('Document not found');
      }
      const data = await response.text();
      setXmlSnippet(data);
    } catch (error) {
      setXmlSnippet('Error: ' + error.message);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <input 
          type="text" 
          value={documentId} 
          onChange={(e) => setDocumentId(e.target.value)}
          placeholder="Enter Document ID"
        />
        <button onClick={fetchDocument}>Fetch Document</button>
        <div className="xml-display">
          {xmlSnippet}
        </div>
      </header>
    </div>
  );
}

export default App;
