import React, { useState } from "react";

/**
 * Form pencabutan sertifikat — hanya bisa diakses oleh wallet dengan role
 * Authorized Issuer. Setelah revoke, status sertifikat berubah permanen
 * menjadi REVOKED di blockchain (tidak bisa dibatalkan/undo).
 */
export default function RevokeCertificate({ isIssuer, revokeCertificateOnChain, pushToast }) {
  const [certId, setCertId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRevoke = async () => {
    setIsSubmitting(true);
    try {
      await revokeCertificateOnChain(certId.trim());
      pushToast("success", "Sertifikat berhasil dicabut (revoked).");
      setCertId("");
      setConfirmOpen(false);
    } catch (err) {
      console.error(err);
      pushToast("error", err?.reason || err?.shortMessage || err?.message || "Gagal mencabut sertifikat.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isIssuer) {
    return (
      <div className="glass-card empty-state">
        <span className="empty-icon">//</span>
        <h3>Akses Terbatas</h3>
        <p className="empty-text">[ HANYA AUTHORIZED ISSUER YANG DAPAT MENCABUT SERTIFIKAT ]</p>
      </div>
    );
  }

  return (
    <div className="glass-card revoke-card">
      <h2 className="card-title">Cabut Sertifikat</h2>
      <p className="card-subtitle">// TINDAKAN INI PERMANEN DAN TERCATAT DI BLOCKCHAIN</p>

      <input
        value={certId}
        onChange={(e) => setCertId(e.target.value)}
        placeholder="Masukkan Certificate ID (0x...)"
        className="verify-input"
      />

      {!confirmOpen ? (
        <button className="btn-danger-glow" disabled={!certId.trim()} onClick={() => setConfirmOpen(true)}>
          Cabut Sertifikat
        </button>
      ) : (
        <div className="confirm-box">
          <p>[ KONFIRMASI: AKSI INI TIDAK BISA DIBATALKAN. YAKIN MENCABUT SERTIFIKAT INI? ]</p>
          <div className="confirm-actions">
            <button className="btn-ghost-sm" onClick={() => setConfirmOpen(false)}>
              Batal
            </button>
            <button className="btn-danger-glow" onClick={handleRevoke} disabled={isSubmitting}>
              {isSubmitting ? "Memproses..." : "Ya, Cabut Sekarang"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
