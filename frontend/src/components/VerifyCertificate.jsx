import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { decryptAES } from "../utils/aes";
import { decryptAESKeyWithRSA } from "../utils/rsa";
import { INSTITUTION_NAME, SIGNING_OFFICIAL_NAME, SIGNING_OFFICIAL_TITLE } from "../utils/institution";
import { getInstitutionSettings } from "../utils/institutionSettings";
import { fetchCiphertextFromIpfs } from "../utils/ipfs";
import IjazahTemplate from "./IjazahTemplate";
import uinLogo from "../assets/uin-logo.jpg";

/**
 * Komponen verifikasi publik:
 * - Verifikasi bisa dilakukan siapa saja, tanpa wallet
 * - Auto-fill certId dari URL param ?verify= (dari QR Code)
 * - Opsional: dekripsi isi sertifikat jika punya RSA private key
 * - QR Code verifikasi bisa di-generate ulang dari sini
 * - Panel Audit TX: block number, gas, timestamp, link Etherscan
 * - Export Certificate Card siap screenshot / print PDF
 */
export default function VerifyCertificate({ verifyCertificateOnChain, getTransactionDetail, pushToast }) {
  const [certId, setCertId] = useState("");
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [showDecryptInput, setShowDecryptInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [decryptedData, setDecryptedData] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [auditDetail, setAuditDetail] = useState(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [decryptedPhotoUrl, setDecryptedPhotoUrl] = useState(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [showIjazah, setShowIjazah] = useState(false);

  // Auto-fill certId dari URL param ?verify= (misalnya dari scan QR Code)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyParam = params.get("verify");
    if (verifyParam) {
      setCertId(verifyParam);
      pushToast("info", "Certificate ID otomatis diisi dari QR Code.");
    }
  }, []);

  const handleVerify = async (e) => {
    e?.preventDefault();
    const id = certId.trim();
    if (!id) { pushToast("warning", "Masukkan Certificate ID terlebih dahulu."); return; }
    setIsLoading(true);
    setResult(null);
    setDecryptedData(null);
    setShowDecryptInput(false);
    setShowExportModal(false);
    setAuditDetail(null);
    setShowQR(false);
    setDecryptedPhotoUrl(null);
    setShowIjazah(false);
    try {
      const data = await verifyCertificateOnChain(id);
      setResult(data);
      if (!data.exists) {
        pushToast("warning", "Certificate ID tidak ditemukan di blockchain.");
      } else if (data.isRevoked) {
        pushToast("error", "Sertifikat ini sudah DICABUT (revoked).");
      } else {
        pushToast("success", "Sertifikat VALID dan terverifikasi on-chain.");
        // Ambil audit detail dari TX hash yang tersimpan di event
        if (data.txHash && getTransactionDetail) {
          setIsLoadingAudit(true);
          getTransactionDetail(data.txHash).then((detail) => {
            setAuditDetail(detail);
            setIsLoadingAudit(false);
          });
        }
      }
    } catch (err) {
      console.error(err);
      pushToast("error", "Gagal memverifikasi. Periksa format Certificate ID dan koneksi network.");
    } finally {
      setIsLoading(false);
    }
  };

  // Jika certId sudah terisi dari URL param, auto-verifikasi
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verify")) {
      setTimeout(() => handleVerify(), 300);
    }
  }, []);

  const handleDecrypt = () => {
    try {
      const { ciphertext, encryptedKey } = JSON.parse(result.encryptedData);
      const aesKey = decryptAESKeyWithRSA(encryptedKey, privateKeyPem.trim());
      const original = decryptAES(ciphertext, aesKey);
      setDecryptedData(original);
      pushToast("success", "Data sertifikat berhasil didekripsi.");

      // Jika ada foto tersimpan di IPFS, ambil & dekripsi juga (Opsi 2 — persisten)
      if (original.photoIpfsCid) {
        setIsLoadingPhoto(true);
        fetchCiphertextFromIpfs(original.photoIpfsCid)
          .then((photoCiphertext) => {
            const photoUrl = decryptAES(photoCiphertext, aesKey);
            setDecryptedPhotoUrl(typeof photoUrl === "string" ? photoUrl : null);
          })
          .catch((err) => {
            console.error("Gagal mengambil foto dari IPFS:", err);
            pushToast("warning", "Data terdekripsi, tapi foto gagal diambil dari IPFS.");
          })
          .finally(() => setIsLoadingPhoto(false));
      }
    } catch (err) {
      console.error(err);
      pushToast("error", "Gagal mendekripsi. Pastikan RSA private key yang dimasukkan benar.");
    }
  };

  const handleCopy = async (text, fieldKey, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      pushToast("info", `${label} disalin.`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      pushToast("error", "Gagal menyalin.");
    }
  };

  const handlePrint = () => window.print();

  const formattedDate = result?.issuedAt
    ? new Date(Number(result.issuedAt) * 1000).toLocaleString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  const verifyUrl = certId.trim()
    ? `${window.location.origin}?verify=${certId.trim()}`
    : "";

  return (
    <div className="glass-card verify-card">
      <h2 className="card-title">Verifikasi Sertifikat</h2>
      <p className="card-subtitle">// TERBUKA UNTUK PUBLIK — TIDAK PERLU CONNECT WALLET</p>

      <form onSubmit={handleVerify} className="verify-form">
        <input
          value={certId}
          onChange={(e) => setCertId(e.target.value)}
          placeholder="Masukkan Nomor Ijazah / Certificate ID (0x...)"
          className="verify-input"
        />
        <button type="submit" className="btn-primary-glow" disabled={isLoading}>
          {isLoading ? "Memeriksa..." : "Verifikasi"}
        </button>
      </form>

      {/* ── HASIL: VALID atau REVOKED ── */}
      {result && result.exists && (
        <div className={`cert-card ${result.isRevoked ? "cert-revoked" : "cert-valid"}`}>
          <div className="cert-ribbon">{result.isRevoked ? "REVOKED" : "VALID"}</div>
          <div className="cert-icon">{result.isRevoked ? "✕" : "✓"}</div>
          <h3>{result.recipientName || "—"}</h3>

          {/* Info on-chain */}
          {[
            { key: "issuedBy", label: "Diterbitkan Oleh", value: result.issuedBy },
            { key: "certId", label: "Nomor Ijazah / Cert. ID", value: certId.trim() },
            { key: "dataHash", label: "Data Hash (SHA-256)", value: result.dataHash },
          ].map(({ key, label, value }) => (
            <div className="cert-row" key={key}>
              <span>{label}</span>
              <div className="copy-row">
                <code className="hash-truncated" title={value}>
                  {value?.slice(0, 10)}...{value?.slice(-6)}
                </code>
                <button
                  className={`copy-btn ${copiedField === key ? "copy-btn-success" : ""}`}
                  onClick={() => handleCopy(value, key, label)}
                >
                  {copiedField === key ? "OK" : "CP"}
                </button>
              </div>
            </div>
          ))}

          <div className="cert-row">
            <span>Tanggal Terbit</span>
            <span>{formattedDate}</span>
          </div>

          {/* Dekripsi opsional */}
          {!decryptedData && (
            <button className="btn-ghost-sm" onClick={() => setShowDecryptInput((v) => !v)}>
              {showDecryptInput ? "Tutup" : "Punya Private Key? Lihat Detail"}
            </button>
          )}
          {showDecryptInput && !decryptedData && (
            <div className="decrypt-box">
              <textarea
                value={privateKeyPem}
                onChange={(e) => setPrivateKeyPem(e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----"
                rows={4}
              />
              <button className="btn-primary-glow" onClick={handleDecrypt}>Dekripsi Data</button>
            </div>
          )}
          {decryptedData && (
            <div className="decrypted-detail">
              <h4>// Detail Sertifikat (Terdekripsi)</h4>
              {isLoadingPhoto && <p className="audit-loading">Mengambil foto dari IPFS...</p>}
              {decryptedPhotoUrl && (
                <img src={decryptedPhotoUrl} alt="Foto Mahasiswa" className="decrypted-photo-preview" />
              )}
              <div className="cert-row"><span>NIM</span><span>{decryptedData.nim}</span></div>
              <div className="cert-row"><span>Jurusan</span><span>{decryptedData.jurusan}</span></div>
              <div className="cert-row"><span>Tanggal Lulus</span><span>{decryptedData.tanggalLulus}</span></div>
              <div className="cert-row"><span>IPK</span><span>{decryptedData.ipk}</span></div>
              {decryptedData.predikat && (
                <div className="cert-row"><span>Predikat</span><span>{decryptedData.predikat}</span></div>
              )}
              <div className="cert-export-trigger">
                <button className="btn-export" onClick={() => setShowIjazah(true)}>
                  Lihat & Cetak Ijazah Resmi
                </button>
              </div>
            </div>
          )}

          {/* ─── QR CODE ─── */}
          <div className="qr-section">
            <div className="qr-header">
              <span className="qr-label">// QR CODE VERIFIKASI</span>
              <button className="btn-ghost-sm" onClick={() => setShowQR((v) => !v)}>
                {showQR ? "Sembunyikan" : "Tampilkan QR"}
              </button>
            </div>
            {showQR && (
              <div className="qr-body">
                <div className="qr-wrapper">
                  <QRCodeSVG
                    value={verifyUrl}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    level="H"
                  />
                </div>
                <div className="qr-meta">
                  <p>Scan QR Code ini untuk membuka langsung halaman verifikasi.</p>
                  <button
                    className={`copy-btn ${copiedField === "qrUrl" ? "copy-btn-success" : ""}`}
                    onClick={() => handleCopy(verifyUrl, "qrUrl", "Link verifikasi")}
                  >
                    {copiedField === "qrUrl" ? "DISALIN" : "SALIN LINK"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── AUDIT TX ─── */}
          {!result.isRevoked && (
            <div className="audit-section">
              <span className="qr-label">// AUDIT BLOCKCHAIN</span>
              {isLoadingAudit && <p className="audit-loading">Mengambil detail transaksi...</p>}
              {auditDetail && (
                <div className="audit-grid">
                  <div className="audit-item">
                    <span>Block Number</span>
                    <a href={auditDetail.blockUrl} target="_blank" rel="noopener noreferrer" className="audit-link">
                      #{auditDetail.blockNumber}
                    </a>
                  </div>
                  <div className="audit-item">
                    <span>Gas Used</span>
                    <code>{Number(auditDetail.gasUsed).toLocaleString()} units</code>
                  </div>
                  <div className="audit-item">
                    <span>Gas Price</span>
                    <code>{parseFloat(auditDetail.gasPrice).toFixed(4)} Gwei</code>
                  </div>
                  <div className="audit-item">
                    <span>Timestamp</span>
                    <code>{new Date(Number(auditDetail.timestamp) * 1000).toLocaleString("id-ID")}</code>
                  </div>
                  <div className="audit-item audit-item-full">
                    <span>Etherscan</span>
                    <a href={auditDetail.etherscanUrl} target="_blank" rel="noopener noreferrer" className="audit-link">
                      Lihat di Sepolia Etherscan ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="cert-export-trigger">
            <button className="btn-export" onClick={() => setShowExportModal(true)}>
              Export Certificate Card
            </button>
          </div>
        </div>
      )}

      {/* ── HASIL: NOT FOUND ── */}
      {result && !result.exists && (
        <div className="cert-card cert-notfound">
          <div className="cert-icon">?</div>
          <h3>Certificate Not Found</h3>
          <p>[ CERTIFICATE ID TERSEBUT TIDAK DITEMUKAN DI BLOCKCHAIN ]</p>
        </div>
      )}

      {/* ── EXPORT MODAL — bergaya ijazah akademik ── */}
      {showExportModal && result && (
        <div className="export-overlay" onClick={() => setShowExportModal(false)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()} id="cert-to-print">
            <span className="cert-corner cert-corner-tl" />
            <span className="cert-corner cert-corner-tr" />
            <span className="cert-corner cert-corner-bl" />
            <span className="cert-corner cert-corner-br" />

            <div className={`cert-ribbon-badge ${result.isRevoked ? "ribbon-revoked" : "ribbon-valid"}`}>
              {result.isRevoked ? "DICABUT" : "TERVERIFIKASI"}
            </div>

            <div className="cert-header">
              <img src={uinLogo} alt="Logo Institusi" className="export-logo-img" />
              <p className="cert-institution-name">{INSTITUTION_NAME}</p>
              <div className="cert-ornament-line">◆</div>
            </div>

            <h1 className="cert-main-title">Sertifikat</h1>
            <p className="cert-main-subtitle">Notaris Ijazah Terdesentralisasi</p>

            <p className="cert-given-to">dengan bangga diberikan kepada</p>
            {decryptedPhotoUrl && (
              <img src={decryptedPhotoUrl} alt="Foto Mahasiswa" className="cert-photo-round" />
            )}
            <h2 className="cert-recipient-name">{result.recipientName || "—"}</h2>

            {decryptedData ? (
              <p className="cert-achievement">
                atas kelulusannya dari Program Studi <strong>{decryptedData.jurusan}</strong>
                {decryptedData.ipk && <> dengan IPK <strong>{decryptedData.ipk}</strong></>}
                {decryptedData.predikat && <> dan predikat <strong>{decryptedData.predikat}</strong></>}
              </p>
            ) : (
              <p className="cert-achievement cert-achievement-generic">
                telah tercatat sebagai lulusan yang sah dan terverifikasi secara kriptografis
                di blockchain Ethereum
              </p>
            )}

            <p className="cert-date-line">Diterbitkan pada {formattedDate}</p>

            {SIGNING_OFFICIAL_NAME && (
              <div className="export-signature-section">
                <div className="export-signature-line">
                  <span className="export-signature-script">{SIGNING_OFFICIAL_NAME}</span>
                </div>
                <p className="export-signature-name">{SIGNING_OFFICIAL_NAME}</p>
                <p className="export-signature-title">{SIGNING_OFFICIAL_TITLE}</p>
              </div>
            )}

            {/* Footer teknis — kecil & senyap, bukan konten utama */}
            <div className="cert-verify-footer">
              <div className="cert-verify-details">
                <div className="cert-verify-row">
                  <span>Nomor Ijazah</span>
                  <code>{certId.trim().slice(0, 18)}...{certId.trim().slice(-8)}</code>
                </div>
                <div className="cert-verify-row">
                  <span>Diterbitkan Oleh</span>
                  <code>{result.issuedBy.slice(0, 10)}...{result.issuedBy.slice(-6)}</code>
                </div>
                <div className="cert-verify-row">
                  <span>Hash SHA-256</span>
                  <code>{result.dataHash.slice(0, 14)}...{result.dataHash.slice(-8)}</code>
                </div>
                {decryptedData?.nim && (
                  <div className="cert-verify-row">
                    <span>NIM</span>
                    <code>{decryptedData.nim}</code>
                  </div>
                )}
              </div>
              <div className="cert-verify-qr">
                <QRCodeSVG
                  value={verifyUrl}
                  size={72}
                  bgColor="#ffffff"
                  fgColor="#0a0a0a"
                  level="H"
                />
                <p>Scan verifikasi</p>
              </div>
            </div>

            <p className="cert-crypto-footnote">
              AES-256-CBC + RSA-OAEP 2048-bit &nbsp;·&nbsp; SHA-256 &nbsp;·&nbsp; Ethereum Sepolia Testnet
            </p>

            <div className="export-actions no-print">
              <button className="btn-primary-glow" onClick={handlePrint}>Print / Simpan PDF</button>
              <button className="btn-ghost" onClick={() => setShowExportModal(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {showIjazah && decryptedData && result && (
        <IjazahTemplate
          recipientName={result.recipientName}
          nim={decryptedData.nim}
          tanggalLahir={decryptedData.tanggalLahir}
          tempatLahir={decryptedData.tempatLahir}
          fakultas={decryptedData.fakultas}
          jurusan={decryptedData.jurusan}
          gelar={decryptedData.gelar}
          ipk={decryptedData.ipk}
          tanggalLulus={decryptedData.tanggalLulus}
          certId={certId.trim()}
          verifyUrl={verifyUrl}
          photoDataUrl={decryptedPhotoUrl}
          settings={getInstitutionSettings()}
          onClose={() => setShowIjazah(false)}
        />
      )}
    </div>
  );
}
