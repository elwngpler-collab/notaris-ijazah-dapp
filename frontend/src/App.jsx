import React, { useState, useEffect, useCallback } from "react";
import { useContract } from "./hooks/useContract";
import ConnectWallet from "./components/ConnectWallet";
import IssueCertificate from "./components/IssueCertificate";
import VerifyCertificate from "./components/VerifyCertificate";
import RevokeCertificate from "./components/RevokeCertificate";
import CertificateHistory from "./components/CertificateHistory";
import AdminDashboard from "./components/AdminDashboard";
import InstitutionSettings from "./components/InstitutionSettings";

const TABS = [
  { id: "verify", label: "Verifikasi", index: "01" },
  { id: "issue", label: "Terbitkan", index: "02" },
  { id: "revoke", label: "Cabut", index: "03" },
  { id: "history", label: "Riwayat", index: "04" },
  { id: "admin", label: "Admin", index: "05", ownerOnly: true },
  { id: "settings", label: "Pengaturan", index: "06", ownerOnly: true },
];

export default function App() {
  const web3 = useContract();
  const [activeTab, setActiveTab] = useState("verify");
  const [toasts, setToasts] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [copiedTx, setCopiedTx] = useState(null);

  /** Ganti tab aktif lalu scroll smooth ke area konten tab */
  const switchTabAndScroll = useCallback((tabId) => {
    setActiveTab(tabId);
    // Tunggu satu frame supaya tab sudah ter-render sebelum scroll
    requestAnimationFrame(() => {
      const el = document.getElementById("tab-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  /**
   * Dipanggil dari tombol "Verifikasi →" di Riwayat: menyisipkan certId ke
   * URL (query param ?verify=), lalu pindah ke tab Verifikasi. VerifyCertificate
   * membaca ulang query param ini saat komponennya mount, sehingga certId
   * otomatis terisi dan langsung diverifikasi.
   */
  const goVerifyCert = useCallback((certId) => {
    window.history.replaceState(null, "", `?verify=${certId}`);
    switchTabAndScroll("verify");
  }, [switchTabAndScroll]);

  const pushToast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const loadEvents = useCallback(async () => {
    if (!web3.contract) return;
    setIsLoadingEvents(true);
    const recent = await web3.fetchRecentEvents(8);
    setEvents(recent);
    setIsLoadingEvents(false);
  }, [web3]);

  useEffect(() => {
    if (web3.isConnected && web3.isCorrectNetwork) loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web3.isConnected, web3.isCorrectNetwork]);

  const totalIssued = events.filter((e) => e.type === "CertificateIssued").length;
  const totalRevoked = events.filter((e) => e.type === "CertificateRevoked").length;

  const handleCopyEvent = async (text, key, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTx(key);
      pushToast("info", `${label} disalin ke clipboard.`);
      setTimeout(() => setCopiedTx(null), 2000);
    } catch {
      pushToast("error", "Gagal menyalin.");
    }
  };

  return (
    <div className="app-shell">
      <div className="bg-grid" />
      <div className="bg-frame" />
      <div className="bg-rail-left" />
      <div className="bg-rail-right" />
      <span className="bg-corner-label-tr">CERT-NOTARY v1.0</span>
      <span className="bg-corner-label-bl">SHA-256 // AES-256</span>

      <ConnectWallet
        account={web3.account}
        isConnecting={web3.isConnecting}
        isConnected={web3.isConnected}
        isCorrectNetwork={web3.isCorrectNetwork}
        isOwner={web3.isOwner}
        isIssuer={web3.isIssuer}
        onConnect={web3.connectWallet}
        onDisconnect={web3.disconnectWallet}
        onSwitchNetwork={web3.switchToSepolia}
      />

      <section className="hero">
          <div className="hero-main">
            <p className="hero-tag">SYSTEM ONLINE // ETHEREUM SEPOLIA</p>
            <h1 className="hero-title">
              Notaris Ijazah <span className="accent-word">Blockchain</span>
            </h1>
            <p className="hero-subtitle">
              Terbitkan dan verifikasi keaslian ijazah/sertifikat secara terdesentralisasi,
              terenkripsi end-to-end, dan tidak dapat dipalsukan — dicatat permanen di
              jaringan Ethereum.
            </p>
            <div className="hero-cta">
              <button className="btn-primary-glow" onClick={() => switchTabAndScroll("issue")}>
                Terbitkan Sertifikat
              </button>
              <button className="btn-ghost" onClick={() => switchTabAndScroll("verify")}>
                Verifikasi Sertifikat
              </button>
            </div>
          </div>

          <div className="hero-readout">
            <div className="readout-tile">
              <span className="readout-label">Network</span>
              <span className="readout-value ok">Sepolia Testnet</span>
            </div>
            <div className="readout-tile">
              <span className="readout-label">Cipher</span>
              <span className="readout-value">AES-256 / RSA-OAEP</span>
            </div>
            <div className="readout-tile">
              <span className="readout-label">Integrity</span>
              <span className="readout-value">SHA-256</span>
            </div>
            <div className="readout-tile">
              <span className="readout-label">Contract Status</span>
              <span className="readout-value ok">{web3.isConnected ? "Linked" : "Standby"}</span>
            </div>
          </div>
      </section>

      <main className="main-content">
        {/* ─── STATS BENTO (issuer only) ─── */}
        {web3.isConnected && web3.isIssuer && (
          <section className="stats-grid">
            <div className="glass-card stat-card">
              <span className="stat-label">Total Diterbitkan</span>
              <span className="stat-value cyan">{totalIssued}</span>
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Total Dicabut</span>
              <span className="stat-value gold">{totalRevoked}</span>
            </div>
            <div className="glass-card stat-card">
              <span className="stat-label">Role Anda</span>
              <span className="stat-value">{web3.isOwner ? "Owner" : "Issuer"}</span>
            </div>
          </section>
        )}

        {/* ─── TAB NAVIGATION (bracket-style) ─── */}
        <nav id="tab-section" className="tab-nav">
          {TABS.filter((tab) => !tab.ownerOnly || web3.isOwner).map((tab) => (
            <button
              key={tab.id}
              data-index={tab.index}
              className={`tab-btn ${activeTab === tab.id ? "tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="tab-content">
          <div className={`tab-panel ${activeTab === "verify" ? "" : "tab-panel-hidden"}`}>
            <VerifyCertificate verifyCertificateOnChain={web3.verifyCertificateOnChain} getTransactionDetail={web3.getTransactionDetail} pushToast={pushToast} />
          </div>

          <div className={`tab-panel ${activeTab === "issue" ? "" : "tab-panel-hidden"}`}>
            {web3.isConnected ? (
              <IssueCertificate
                isIssuer={web3.isIssuer}
                issueCertificateOnChain={web3.issueCertificateOnChain}
                getTransactionDetail={web3.getTransactionDetail}
                checkDuplicateNim={web3.checkDuplicateNim}
                pushToast={pushToast}
              />
            ) : (
              <div className="glass-card empty-state">
                <span className="empty-icon">//</span>
                <h3>Wallet Belum Terhubung</h3>
                <p className="empty-text">[ HUBUNGKAN METAMASK UNTUK MENGAKSES MODUL INI ]</p>
              </div>
            )}
          </div>

          <div className={`tab-panel ${activeTab === "revoke" ? "" : "tab-panel-hidden"}`}>
            {web3.isConnected ? (
              <RevokeCertificate isIssuer={web3.isIssuer} revokeCertificateOnChain={web3.revokeCertificateOnChain} pushToast={pushToast} />
            ) : (
              <div className="glass-card empty-state">
                <span className="empty-icon">//</span>
                <h3>Wallet Belum Terhubung</h3>
                <p className="empty-text">[ HUBUNGKAN METAMASK UNTUK MENGAKSES MODUL INI ]</p>
              </div>
            )}
          </div>

          <div className={`tab-panel ${activeTab === "history" ? "" : "tab-panel-hidden"}`}>
            {web3.isConnected ? (
              <CertificateHistory
                isIssuer={web3.isIssuer}
                fetchIssuerHistory={web3.fetchIssuerHistory}
                onVerifyCert={goVerifyCert}
                pushToast={pushToast}
              />
            ) : (
              <div className="glass-card empty-state">
                <span className="empty-icon">//</span>
                <h3>Wallet Belum Terhubung</h3>
                <p className="empty-text">[ HUBUNGKAN METAMASK UNTUK MENGAKSES MODUL INI ]</p>
              </div>
            )}
          </div>

          <div className={`tab-panel ${activeTab === "admin" ? "" : "tab-panel-hidden"}`}>
            {web3.isConnected ? (
              <AdminDashboard
                isOwner={web3.isOwner}
                account={web3.account}
                fetchIssuerList={web3.fetchIssuerList}
                addIssuerOnChain={web3.addIssuerOnChain}
                removeIssuerOnChain={web3.removeIssuerOnChain}
                pushToast={pushToast}
              />
            ) : (
              <div className="glass-card empty-state">
                <span className="empty-icon">//</span>
                <h3>Wallet Belum Terhubung</h3>
                <p className="empty-text">[ HUBUNGKAN METAMASK UNTUK MENGAKSES MODUL INI ]</p>
              </div>
            )}
          </div>

          <div className={`tab-panel ${activeTab === "settings" ? "" : "tab-panel-hidden"}`}>
            {web3.isConnected ? (
              <InstitutionSettings isOwner={web3.isOwner} pushToast={pushToast} />
            ) : (
              <div className="glass-card empty-state">
                <span className="empty-icon">//</span>
                <h3>Wallet Belum Terhubung</h3>
                <p className="empty-text">[ HUBUNGKAN METAMASK UNTUK MENGAKSES MODUL INI ]</p>
              </div>
            )}
          </div>
        </section>

        {/* ─── BLOCKCHAIN EVENT LOG ─── */}
        {web3.isConnected && web3.isCorrectNetwork && (
          <section className="event-log glass-card">
            <div className="event-log-header">
              <h3>// Event Log Terkini</h3>
              <button className="btn-ghost-sm" onClick={loadEvents}>
                {isLoadingEvents ? "Memuat..." : "Refresh"}
              </button>
            </div>
            {events.length === 0 ? (
              <p className="empty-text">[ BELUM ADA EVENT TERBARU ]</p>
            ) : (
              <ul className="event-list">
                {events.map((ev) => {
                  const txKey = `tx-${ev.txHash}`;
                  const certKey = `cert-${ev.certId}`;
                  return (
                    <li key={`${ev.txHash}-${ev.certId}`} className="event-item">
                      <span className={`event-badge ${ev.type === "CertificateIssued" ? "badge-issued" : "badge-revoked"}`}>
                        {ev.type === "CertificateIssued" ? "ISSUED" : "REVOKED"}
                      </span>

                      <div className="event-info">
                        <span className="event-recipient">{ev.recipientName || "—"}</span>
                        {ev.certId && (
                          <div className="event-hash-row">
                            <span className="event-hash-label">ID:</span>
                            <code className="event-hash-code" title={ev.certId}>
                              {ev.certId.slice(0, 10)}...{ev.certId.slice(-6)}
                            </code>
                            <button
                              className={`copy-btn-sm ${copiedTx === certKey ? "copy-btn-success" : ""}`}
                              onClick={() => handleCopyEvent(ev.certId, certKey, "Certificate ID")}
                              title="Salin Certificate ID"
                            >
                              {copiedTx === certKey ? "OK" : "CP"}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="event-hash-row">
                        <span className="event-hash-label">TX:</span>
                        <code className="event-hash-code" title={ev.txHash}>
                          {ev.txHash.slice(0, 8)}...{ev.txHash.slice(-6)}
                        </code>
                        <button
                          className={`copy-btn-sm ${copiedTx === txKey ? "copy-btn-success" : ""}`}
                          onClick={() => handleCopyEvent(ev.txHash, txKey, "Transaction hash")}
                          title="Salin Transaction Hash"
                        >
                          {copiedTx === txKey ? "OK" : "CP"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <footer className="app-footer">
          <p>SOLIDITY /// HARDHAT /// REACT /// ETHERS.JS V6 — UAS KRIPTOGRAFI</p>
        </footer>
      </main>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
