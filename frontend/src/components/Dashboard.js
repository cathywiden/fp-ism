import React, { useState, useEffect } from "react";

function User1Dashboard({ token }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const response = await fetch("/api/user1/documents", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await response.json();
        setDocuments(data);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocuments();
  }, [token]);

  if (isLoading) return <p>Loading...</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Document ID</th>
          <th>Status</th>
          <th>Target User</th>
          <th>Token ID</th>
          <th>Token Expiry</th>
        </tr>
      </thead>
      <tbody>
        {documents.map(doc => (
          <tr key={doc.DOC_ID}>
            <td>{doc.DOC_ID}</td>
            <td>{doc.STATUS}</td>
            <td>{doc.TARGET_USER}</td>
            <td>{doc.TOKEN_ID}</td>
            <td>{new Date(doc.TOKEN_EXP_TS).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default User1Dashboard;
