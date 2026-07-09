import React, { useState, useEffect, useCallback } from "react";

/**
 * Menampilkan riwayat SEMUA sertifikat yang pernah diterbitkan oleh wallet
 * issuer yang sedang connect (bukan seluruh sertifikat di sistem — itu
 * ada di Blockchain Event Log). Data diambil langsung dari smart contract,
 * bukan dari database terpisah, sehingga selalu sinkron dengan on-chain state.
 *
 * Setiap baris bisa langsung diklik "Verifikasi →" untuk membuka certId
 * tersebut di tab Verifikasi tanpa perlu copy-paste manual.
 */
export default function CertificateHistory({ isIssuer, fetchIssuerHistory, onVerifyCert, pushToast }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchIssuerHistory();
    setHistory(data);
    setIsLoading(false);
    setHasLoaded(true);
  }, [fetchIssuerHistory]);

  useEffect(() => {
    if (isIssuer) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIssuer]);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      pushToast("info", "Certificate ID disalin.");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      pushToast("error", "Gagal menyalin.");
    }
  };

  const filtered = history.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.recipientName?.toLowerCase().includes(q) ||
      item.certId?.toLowerCase().includes(q)
    );
  });

  const totalValid = history.filter((h) => !h.isRevoked).length;
  const totalRevoked = history.filter((h) => h.isRevoked).length;

  if (!isIssuer) {
    return (
      <div className="glass-card empty-state">
        <span className="empty-icon">//</span>
        <h3>Akses Terbatas</h3>
        <p className="empty-text">[ RIWAYAT HANYA TERSEDIA UNTUK AUTHORIZED ISSUER ]</p>
      </div>
    );
  }

  return (
    <div className="glass-card history-card">
      <h2 className="card-title">Riwayat Sertifikat Saya</h2>
      <p className="card-subtitle">
        // SEMUA SERTIFIKAT YANG DITERBITKAN OLEH WALLET INI
        {hasLoaded && ` — ${totalValid} VALID / ${totalRevoked} REVOKED`}
      </p>

      <div className="history-toolbar">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama penerima atau Certificate ID..."
          className="verify-input"
        />
        <button className="btn-ghost-sm" onClick={loadHistory} disabled={isLoading}>
          {isLoading ? "Memuat..." : "Refresh"}
        </button>
      </div>

      {isLoading && (
        <p className="audit-loading">Mengambil riwayat dari blockchain...</p>
      )}

      {!isLoading && hasLoaded && filtered.length === 0 && history.length === 0 && (
        <p className="empty-text">[ WALLET INI BELUM PERNAH MENERBITKAN SERTIFIKAT ]</p>
      )}

      {!isLoading && hasLoaded && filtered.length === 0 && history.length > 0 && (
        <p className="empty-text">[ TIDAK ADA HASIL UNTUK PENCARIAN INI ]</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <ul className="history-list">
          {filtered.map((item) => (
            <li key={item.certId} className="history-item">
              <span className={`event-badge ${item.isRevoked ? "badge-revoked" : "badge-issued"}`}>
                {item.isRevoked ? "REVOKED" : "VALID"}
              </span>

              <div className="history-info">
                <span className="history-recipient">{item.recipientName || "—"}</span>
                <span className="history-date">
                  {new Date(Number(item.issuedAt) * 1000).toLocaleDateString("id-ID", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
                <div className="history-id-row">
                  <code className="event-hash-code" title={item.certId}>
                    {item.certId.slice(0, 10)}...{item.certId.slice(-6)}
                  </code>
                  <button
                    className={`copy-btn-sm ${copiedId === item.certId ? "copy-btn-success" : ""}`}
                    onClick={() => handleCopy(item.certId)}
                    title="Salin Certificate ID"
                  >
                    {copiedId === item.certId ? "OK" : "CP"}
                  </button>
                </div>
              </div>

              <div className="history-actions">
                <button
                  className="btn-ghost-sm"
                  onClick={() => onVerifyCert(item.certId)}
                >
                  Verifikasi →
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
