import React, { useState, useEffect, useCallback } from "react";
import { getInstitutionPrivateKey, getInstitutionPublicKey, importInstitutionKeyPair } from "../utils/rsa";

/**
 * Dashboard khusus Owner: tambah issuer, hapus issuer, lihat daftar issuer aktif,
 * dan kelola RSA keypair institusi (lihat, export untuk dibagikan ke tim, atau
 * import keypair dari anggota tim lain supaya semua orang pakai keypair yang
 * SAMA — kunci supaya cek duplikasi NIM & dekripsi sertifikat bisa jalan
 * lintas device, bukan cuma di browser yang menerbitkan).
 */
export default function AdminDashboard({
  isOwner,
  account,
  fetchIssuerList,
  addIssuerOnChain,
  removeIssuerOnChain,
  pushToast,
}) {
  const [issuers, setIssuers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);

  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [importText, setImportText] = useState("");
  const [confirmImport, setConfirmImport] = useState(false);

  const loadIssuers = useCallback(async () => {
    setIsLoading(true);
    const list = await fetchIssuerList();
    setIssuers(list);
    setIsLoading(false);
    setHasLoaded(true);
  }, [fetchIssuerList]);

  useEffect(() => {
    if (isOwner) loadIssuers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const addr = newAddress.trim();
    if (!addr) { pushToast("warning", "Masukkan alamat wallet terlebih dahulu."); return; }
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      pushToast("error", "Format alamat wallet tidak valid.");
      return;
    }
    setIsSubmitting(true);
    try {
      await addIssuerOnChain(addr);
      pushToast("success", "Issuer baru berhasil ditambahkan.");
      setNewAddress("");
      loadIssuers();
    } catch (err) {
      console.error(err);
      pushToast("error", err?.reason || err?.shortMessage || err?.message || "Gagal menambahkan issuer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (address) => {
    setIsSubmitting(true);
    try {
      await removeIssuerOnChain(address);
      pushToast("success", "Issuer berhasil dihapus.");
      setPendingRemove(null);
      loadIssuers();
    } catch (err) {
      console.error(err);
      pushToast("error", err?.reason || err?.shortMessage || err?.message || "Gagal menghapus issuer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (text, label = "Teks") => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast("info", `${label} disalin ke clipboard.`);
    } catch {
      pushToast("error", "Gagal menyalin.");
    }
  };

  const exportedKeypairJson = JSON.stringify(
    { publicKeyPem: getInstitutionPublicKey(), privateKeyPem: getInstitutionPrivateKey() },
    null,
    2
  );

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText.trim());
      if (!parsed.publicKeyPem || !parsed.privateKeyPem) {
        throw new Error("JSON harus berisi publicKeyPem dan privateKeyPem.");
      }
      importInstitutionKeyPair(parsed.publicKeyPem, parsed.privateKeyPem);
      pushToast("success", "Keypair institusi berhasil diimpor. Browser ini sekarang memakai keypair yang sama dengan yang dibagikan tim.");
      setImportText("");
      setConfirmImport(false);
      setShowPrivateKey(false); // paksa refresh tampilan kalau sedang terbuka
    } catch (err) {
      console.error(err);
      pushToast("error", err?.message || "Gagal mengimpor. Pastikan format JSON benar (hasil dari tombol Export).");
    }
  };

  if (!isOwner) {
    return (
      <div className="glass-card empty-state">
        <span className="empty-icon">//</span>
        <h3>Akses Terbatas</h3>
        <p className="empty-text">[ HANYA OWNER YANG DAPAT MENGELOLA AUTHORIZED ISSUER ]</p>
      </div>
    );
  }

  return (
    <>
    <div className="glass-card admin-card">
      <h2 className="card-title">Kelola Authorized Issuer</h2>
      <p className="card-subtitle">// TAMBAH / HAPUS WALLET YANG BERWENANG MENERBITKAN SERTIFIKAT</p>

      <form onSubmit={handleAdd} className="verify-form">
        <input
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          placeholder="Alamat wallet baru (0x...)"
          className="verify-input"
        />
        <button type="submit" className="btn-primary-glow" disabled={isSubmitting}>
          {isSubmitting ? "Memproses..." : "Tambah Issuer"}
        </button>
      </form>

      <div className="admin-list-header">
        <span className="qr-label">// DAFTAR ISSUER AKTIF {hasLoaded && `(${issuers.length})`}</span>
        <button className="btn-ghost-sm" onClick={loadIssuers} disabled={isLoading}>
          {isLoading ? "Memuat..." : "Refresh"}
        </button>
      </div>

      {isLoading && <p className="audit-loading">Mengambil daftar issuer dari blockchain...</p>}

      {!isLoading && hasLoaded && issuers.length === 0 && (
        <p className="empty-text">[ BELUM ADA ISSUER TERDAFTAR ]</p>
      )}

      {!isLoading && issuers.length > 0 && (
        <ul className="history-list">
          {issuers.map((item) => {
            const isSelf = item.address.toLowerCase() === account?.toLowerCase();
            return (
              <li key={item.address} className="history-item">
                <span className={`event-badge ${item.isOwner ? "badge-owner" : "badge-issued"}`}>
                  {item.isOwner ? "OWNER" : "ISSUER"}
                </span>

                <div className="history-info">
                  <div className="history-id-row">
                    <code className="event-hash-code" title={item.address}>
                      {item.address.slice(0, 10)}...{item.address.slice(-6)}
                    </code>
                    <button className="copy-btn-sm" onClick={() => handleCopy(item.address, "Alamat")} title="Salin alamat">
                      CP
                    </button>
                    {isSelf && <span className="self-tag">(wallet Anda)</span>}
                  </div>
                </div>

                <div className="history-actions">
                  {item.isOwner ? (
                    <span className="admin-locked-note">tidak bisa dihapus</span>
                  ) : pendingRemove === item.address ? (
                    <div className="confirm-inline">
                      <button className="btn-ghost-sm" onClick={() => setPendingRemove(null)}>Batal</button>
                      <button
                        className="btn-danger-glow btn-danger-sm"
                        onClick={() => handleRemove(item.address)}
                        disabled={isSubmitting}
                      >
                        Yakin?
                      </button>
                    </div>
                  ) : (
                    <button className="btn-ghost-sm" onClick={() => setPendingRemove(item.address)}>
                      Hapus
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>

    <div className="glass-card admin-card">
      <h2 className="card-title">RSA Keypair Institusi</h2>
      <p className="card-subtitle">// DIPAKAI UNTUK ENKRIPSI SAAT TERBITKAN & DEKRIPSI SAAT VERIFIKASI</p>

      <p className="settings-hint">
        Keypair ini otomatis dibuat & tersimpan di BROWSER INI saja. Kalau anggota tim lain
        menerbitkan/memverifikasi dari browser/device berbeda TANPA keypair yang sama, fitur
        cek duplikasi NIM dan dekripsi (Certificate Card, Ijazah Resmi, foto) tidak akan
        "melihat" data yang dienkripsi dari browser lain. Ini bukan soal hosting/lokal — murni
        soal localStorage yang tidak otomatis tersinkron antar device.
      </p>

      {/* ── LIHAT PRIVATE KEY BROWSER INI ── */}
      <div className="keypair-subsection">
        <span className="qr-label">// PRIVATE KEY DI BROWSER INI</span>
        {!showPrivateKey ? (
          <button className="btn-ghost-sm" onClick={() => setShowPrivateKey(true)}>
            Tampilkan Private Key
          </button>
        ) : (
          <>
            <textarea
              readOnly
              value={getInstitutionPrivateKey()}
              rows={6}
              className="key-display-textarea"
              onFocus={(e) => e.target.select()}
            />
            <div className="key-display-actions">
              <button className="copy-btn" onClick={() => handleCopy(getInstitutionPrivateKey(), "Private key")}>Salin</button>
              <button className="btn-ghost-sm" onClick={() => setShowPrivateKey(false)}>Sembunyikan</button>
            </div>
          </>
        )}
      </div>

      {/* ── EXPORT KEYPAIR UNTUK DIBAGIKAN KE TIM ── */}
      <div className="keypair-subsection">
        <span className="qr-label">// EXPORT KEYPAIR UNTUK TIM</span>
        <p className="settings-hint">
          Bagikan hasil export ini ke anggota tim lain lewat kanal yang aman (bukan grup publik) —
          mereka paste ke bagian "Import" di bawah supaya keypair-nya sama persis dengan browser ini.
        </p>
        {!showExport ? (
          <button className="btn-ghost-sm" onClick={() => setShowExport(true)}>
            Tampilkan Data Export
          </button>
        ) : (
          <>
            <textarea
              readOnly
              value={exportedKeypairJson}
              rows={10}
              className="key-display-textarea"
              onFocus={(e) => e.target.select()}
            />
            <div className="key-display-actions">
              <button className="copy-btn" onClick={() => handleCopy(exportedKeypairJson, "Data keypair")}>Salin Semua</button>
              <button className="btn-ghost-sm" onClick={() => setShowExport(false)}>Sembunyikan</button>
            </div>
          </>
        )}
      </div>

      {/* ── IMPORT KEYPAIR DARI TIM ── */}
      <div className="keypair-subsection">
        <span className="qr-label">// IMPORT KEYPAIR DARI TIM</span>
        <p className="settings-hint">
          ⚠️ Ini akan MENIMPA keypair yang ada di browser ini. Sertifikat yang sebelumnya
          diterbitkan dari browser ini (kalau ada) tidak akan bisa didekripsi lagi setelah
          import, kecuali keypair lamanya sudah di-export dulu sebagai cadangan.
        </p>
        <textarea
          value={importText}
          onChange={(e) => { setImportText(e.target.value); setConfirmImport(false); }}
          placeholder='{"publicKeyPem": "-----BEGIN PUBLIC KEY-----...", "privateKeyPem": "-----BEGIN RSA PRIVATE KEY-----..."}'
          rows={4}
          className="key-display-textarea"
        />
        {!confirmImport ? (
          <button
            className="btn-danger-glow btn-danger-sm"
            disabled={!importText.trim()}
            onClick={() => setConfirmImport(true)}
          >
            Import Keypair
          </button>
        ) : (
          <div className="confirm-box">
            <p>Yakin timpa keypair browser ini dengan yang di-paste? Tindakan ini tidak bisa dibatalkan.</p>
            <div className="confirm-actions">
              <button className="btn-ghost-sm" onClick={() => setConfirmImport(false)}>Batal</button>
              <button className="btn-danger-glow" onClick={handleImport}>Ya, Timpa Sekarang</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
