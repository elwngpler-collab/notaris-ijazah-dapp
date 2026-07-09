import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { generateAESKey, encryptAES } from "../utils/aes";
import { encryptAESKeyWithRSA, getOrCreateInstitutionKeyPair } from "../utils/rsa";
import { sha256Hash, generateCertId } from "../utils/hash";
import { getInstitutionSettings, fileToDataUrl } from "../utils/institutionSettings";
import { isIpfsConfigured, uploadCiphertextToIpfs } from "../utils/ipfs";
import IjazahTemplate from "./IjazahTemplate";

const STEPS = ["Enkripsi (AES + RSA)", "Hashing (SHA-256)", "Submit ke Blockchain"];
const MAX_PHOTO_SIZE = 3_000_000; // ~3MB, cukup longgar karena tidak disimpan permanen

/**
 * Form penerbitan sertifikat. Alur kriptografi:
 * 1. Serialize data ijazah ke JSON
 * 2. Generate AES key 256-bit -> enkripsi JSON (AES-256-CBC)
 * 3. Wrap AES key dengan RSA public key institusi (Hybrid Cryptography)
 * 4. SHA-256 hash data asli untuk integritas
 * 5. Submit ke smart contract
 * 6. Tampilkan QR Code + detail audit TX + tombol cetak Ijazah Resmi (PDF)
 *
 * Foto mahasiswa TIDAK pernah dikirim ke blockchain dalam bentuk mentah
 * (terlalu mahal gas-nya). Jika VITE_PINATA_JWT dikonfigurasi, foto
 * dienkripsi AES (key yang sama dengan data sertifikat) lalu ciphertext-nya
 * diupload ke IPFS — hanya CID (bukan fotonya) yang ikut masuk ke payload
 * terenkripsi utama. Jika IPFS tidak dikonfigurasi, foto tetap bisa dipakai
 * untuk PDF saat itu juga, hanya saja tidak persisten untuk sesi lain.
 */
export default function IssueCertificate({ isIssuer, issueCertificateOnChain, getTransactionDetail, checkDuplicateNim, pushToast }) {
  const [form, setForm] = useState({
    recipientName: "",
    nim: "",
    tanggalLahir: "",
    tempatLahir: "",
    fakultas: "",
    jurusan: "",
    gelar: "",
    tanggalLulus: "",
    ipk: "",
    predikat: "Memuaskan",
  });
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [auditDetail, setAuditDetail] = useState(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [showIjazah, setShowIjazah] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const resetForm = () => {
    setForm({
      recipientName: "", nim: "", tanggalLahir: "", tempatLahir: "",
      fakultas: "", jurusan: "", gelar: "",
      tanggalLulus: "", ipk: "", predikat: "Memuaskan",
    });
    setPhotoDataUrl(null);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast("error", "File harus berupa gambar.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      pushToast("error", "Ukuran foto terlalu besar. Gunakan gambar di bawah 3MB.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotoDataUrl(dataUrl);
    } catch {
      pushToast("error", "Gagal membaca file foto.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isIssuer) { pushToast("error", "Wallet ini bukan Authorized Issuer."); return; }

    if (!form.recipientName || !form.nim || !form.fakultas || !form.jurusan || !form.tanggalLulus || !form.ipk) {
      pushToast("warning", "Mohon lengkapi semua field wajib sebelum submit.");
      return;
    }
    setIsSubmitting(true);
    setAuditDetail(null);
    setShowQR(false);

    // Cek duplikasi NIM dulu (yang statusnya masih valid/belum dicabut)
    // sebelum lanjut proses enkripsi — supaya tidak ada 2 sertifikat aktif
    // untuk NIM yang sama.
    if (checkDuplicateNim) {
      setIsCheckingDuplicate(true);
      try {
        const { privateKeyPem } = getOrCreateInstitutionKeyPair();
        const dupCheck = await checkDuplicateNim(form.nim, privateKeyPem);
        if (dupCheck.isDuplicate) {
          pushToast(
            "error",
            `NIM ${form.nim} sudah punya sertifikat aktif atas nama "${dupCheck.recipientName}". Cabut dulu sertifikat lama (tab Cabut) sebelum menerbitkan yang baru.`
          );
          setIsSubmitting(false);
          setIsCheckingDuplicate(false);
          return;
        }
      } catch (err) {
        console.error("Cek duplikasi gagal, lanjut submit:", err);
        // Gagal cek (misal RPC error) tidak menghentikan proses — tidak fatal,
        // hanya berarti perlindungan duplikasi tidak aktif untuk kali ini.
      } finally {
        setIsCheckingDuplicate(false);
      }
    }

    try {
      // Step 1: Generate AES key (dipakai bareng untuk foto & data utama)
      setCurrentStep(0);
      const aesKey = generateAESKey();

      // Opsional: enkripsi & upload foto ke IPFS (Opsi 2 — persisten & terdesentralisasi)
      // memakai AES key YANG SAMA, supaya tetap satu kesatuan kripto yang konsisten.
      let photoIpfsCid = null;
      if (photoDataUrl && isIpfsConfigured()) {
        try {
          const photoCiphertext = encryptAES(photoDataUrl, aesKey);
          photoIpfsCid = await uploadCiphertextToIpfs(photoCiphertext);
        } catch (err) {
          console.error("Upload foto ke IPFS gagal:", err);
          pushToast("warning", "Foto gagal diupload ke IPFS — ijazah tetap diterbitkan, foto hanya berlaku untuk PDF saat ini.");
        }
      }

      const certificateData = { ...form, issuedAt: new Date().toISOString(), photoIpfsCid };
      const ciphertext = encryptAES(certificateData, aesKey);
      const { publicKeyPem } = getOrCreateInstitutionKeyPair();
      const encryptedKey = encryptAESKeyWithRSA(aesKey, publicKeyPem);
      const encryptedPayload = JSON.stringify({ ciphertext, encryptedKey });

      // Step 2: SHA-256 hash data asli untuk integritas
      setCurrentStep(1);
      const dataHash = sha256Hash(certificateData);
      const certId = generateCertId(`${form.nim}-${form.recipientName}-${Date.now()}`);

      // Step 3: Submit ke smart contract
      setCurrentStep(2);
      const receipt = await issueCertificateOnChain(certId, encryptedPayload, dataHash, form.recipientName);

      // Simpan SELURUH data (bukan cuma certId/hash) supaya tombol "Cetak Ijazah
      // Resmi" tetap punya data lengkap walau form sudah di-reset setelah ini.
      const result = {
        certId,
        dataHash,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        recipientName: form.recipientName,
        nim: form.nim,
        tanggalLahir: form.tanggalLahir,
        tempatLahir: form.tempatLahir,
        fakultas: form.fakultas,
        jurusan: form.jurusan,
        gelar: form.gelar,
        ipk: form.ipk,
        tanggalLulus: form.tanggalLulus,
        photoDataUrl,
      };
      setLastResult(result);
      pushToast("success", "Sertifikat berhasil diterbitkan ke blockchain!");
      resetForm();

      // Ambil detail audit TX di background
      if (getTransactionDetail) {
        setIsLoadingAudit(true);
        getTransactionDetail(receipt.hash).then((detail) => {
          setAuditDetail(detail);
          setIsLoadingAudit(false);
        });
      }
    } catch (err) {
      console.error(err);
      pushToast("error", err?.reason || err?.shortMessage || err?.message || "Gagal menerbitkan sertifikat.");
    } finally {
      setIsSubmitting(false);
      setCurrentStep(-1);
    }
  };

  const handleCopy = async (text, fieldKey, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      pushToast("info", `${label} disalin ke clipboard.`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      pushToast("error", "Gagal menyalin. Coba manual select+copy.");
    }
  };

  // URL yang di-encode ke QR Code: langsung ke halaman verifikasi dengan certId sudah terisi
  const verifyUrl = lastResult
    ? `${window.location.origin}?verify=${lastResult.certId}`
    : "";

  if (!isIssuer) {
    return (
      <div className="glass-card empty-state">
        <span className="empty-icon">//</span>
        <h3>Akses Terbatas</h3>
        <p className="empty-text">[ HANYA AUTHORIZED ISSUER YANG DAPAT MENERBITKAN SERTIFIKAT ]</p>
      </div>
    );
  }

  return (
    <div className="glass-card issue-card">
      <h2 className="card-title">Terbitkan Sertifikat Baru</h2>
      <p className="card-subtitle">// DATA DIENKRIPSI AES-256 + RSA SEBELUM DIKIRIM KE BLOCKCHAIN</p>

      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-field">
          <label>Nama Lengkap</label>
          <input name="recipientName" value={form.recipientName} onChange={handleChange} placeholder="cth. Elang Ian" />
        </div>
        <div className="form-field">
          <label>NIM</label>
          <input name="nim" value={form.nim} onChange={handleChange} placeholder="cth. 11230910000034" />
        </div>
        <div className="form-field">
          <label>Tanggal Lahir</label>
          <input
            type="date"
            name="tanggalLahir"
            value={form.tanggalLahir}
            onChange={handleChange}
            className="input-date"
          />
        </div>
        <div className="form-field">
          <label>Tempat Lahir</label>
          <input name="tempatLahir" value={form.tempatLahir} onChange={handleChange} placeholder="cth. Sukabumi" />
        </div>
        <div className="form-field">
          <label>Fakultas</label>
          <input name="fakultas" value={form.fakultas} onChange={handleChange} placeholder="cth. Sains dan Teknologi" />
        </div>
        <div className="form-field">
          <label>Jurusan / Program Studi</label>
          <input name="jurusan" value={form.jurusan} onChange={handleChange} placeholder="cth. Teknik Informatika" />
        </div>
        <div className="form-field">
          <label>Gelar (opsional)</label>
          <input name="gelar" value={form.gelar} onChange={handleChange} placeholder="cth. Sarjana Komputer (S.Kom)" />
        </div>
        <div className="form-field">
          <label>Tanggal Lulus</label>
          <input
            type="date"
            name="tanggalLulus"
            value={form.tanggalLulus}
            onChange={handleChange}
            className="input-date"
          />
        </div>
        <div className="form-field">
          <label>IPK</label>
          <input
            type="number" step="0.01" min="0" max="4"
            name="ipk" value={form.ipk}
            onChange={handleChange} placeholder="cth. 3.75"
          />
        </div>
        <div className="form-field">
          <label>Predikat Kelulusan</label>
          <select name="predikat" value={form.predikat} onChange={handleChange}>
            <option value="Memuaskan">Memuaskan</option>
            <option value="Sangat Memuaskan">Sangat Memuaskan</option>
            <option value="Pujian (Cum Laude)">Pujian (Cum Laude)</option>
          </select>
        </div>
        <div className="form-field">
          <label>Foto Mahasiswa (opsional)</label>
          <div className="photo-upload-row">
            {photoDataUrl && <img src={photoDataUrl} alt="Preview" className="photo-upload-preview" />}
            <input type="file" accept="image/*" onChange={handlePhotoChange} />
          </div>
          <p className={`ipfs-status ${isIpfsConfigured() ? "ipfs-status-ok" : "ipfs-status-warn"}`}>
            {isIpfsConfigured()
              ? "IPFS: Terkonfigurasi — foto akan tersimpan persisten"
              : "IPFS: Belum dikonfigurasi — foto hanya berlaku untuk PDF saat ini (lihat README soal VITE_PINATA_JWT)"}
          </p>
        </div>

        {isSubmitting && (
          <div className="step-indicator">
            {STEPS.map((step, idx) => (
              <div
                key={step}
                className={`step ${idx === currentStep ? "step-active" : ""} ${idx < currentStep ? "step-done" : ""}`}
              >
                <span className="step-number">{idx < currentStep ? "OK" : `0${idx + 1}`}</span>
                <span className="step-label">{step}</span>
              </div>
            ))}
          </div>
        )}

        <button type="submit" className="btn-primary-glow full-width" disabled={isSubmitting}>
          {isCheckingDuplicate ? "Memeriksa Duplikasi NIM..." : isSubmitting ? "Memproses..." : "Enkripsi & Terbitkan"}
        </button>
      </form>

      {/* ─── HASIL PENERBITAN ─── */}
      {lastResult && (
        <div className="result-box">
          <h4>// Sertifikat Berhasil Diterbitkan</h4>

          <div className="result-row">
            <span>Penerima</span>
            <span className="result-value">{lastResult.recipientName}</span>
          </div>

          {[
            { key: "certId", label: "Nomor Ijazah / Cert. ID", value: lastResult.certId },
            { key: "txHash", label: "Transaction Hash", value: lastResult.txHash },
            { key: "dataHash", label: "Data Hash (SHA-256)", value: lastResult.dataHash },
          ].map(({ key, label, value }) => (
            <div className="result-row" key={key}>
              <span>{label}</span>
              <div className="copy-row">
                <code className="hash-truncated" title={value}>
                  {value.slice(0, 14)}...{value.slice(-8)}
                </code>
                <button
                  className={`copy-btn ${copiedField === key ? "copy-btn-success" : ""}`}
                  onClick={() => handleCopy(value, key, label)}
                >
                  {copiedField === key ? "DISALIN" : "SALIN"}
                </button>
              </div>
            </div>
          ))}

          <p className="result-hint">
            SIMPAN CERTIFICATE ID — DIPAKAI UNTUK VERIFIKASI KAPAN SAJA.
          </p>

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
                  <p>Scan QR Code ini untuk langsung membuka halaman verifikasi sertifikat.</p>
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
          <div className="audit-section">
            <span className="qr-label">// AUDIT BLOCKCHAIN</span>
            {isLoadingAudit && <p className="audit-loading">Mengambil detail transaksi...</p>}
            {auditDetail && (
              <div className="audit-grid">
                <div className="audit-item">
                  <span>Block Number</span>
                  <a
                    href={auditDetail.blockUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="audit-link"
                  >
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
                  <code>
                    {new Date(Number(auditDetail.timestamp) * 1000).toLocaleString("id-ID")}
                  </code>
                </div>
                <div className="audit-item audit-item-full">
                  <span>Etherscan</span>
                  <a
                    href={auditDetail.etherscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="audit-link"
                  >
                    Lihat di Sepolia Etherscan ↗
                  </a>
                </div>
              </div>
            )}
            {!isLoadingAudit && !auditDetail && (
              <p className="audit-loading">Detail audit akan muncul setelah transaksi dikonfirmasi.</p>
            )}
          </div>

          {/* ─── CETAK IJAZAH RESMI ─── */}
          <div className="cert-export-trigger">
            <button className="btn-export" onClick={() => setShowIjazah(true)}>
              Lihat & Cetak Ijazah Resmi
            </button>
          </div>
        </div>
      )}

      {showIjazah && lastResult && (
        <IjazahTemplate
          recipientName={lastResult.recipientName}
          nim={lastResult.nim}
          tanggalLahir={lastResult.tanggalLahir}
          tempatLahir={lastResult.tempatLahir}
          fakultas={lastResult.fakultas}
          jurusan={lastResult.jurusan}
          gelar={lastResult.gelar}
          ipk={lastResult.ipk}
          tanggalLulus={lastResult.tanggalLulus}
          certId={lastResult.certId}
          verifyUrl={verifyUrl}
          photoDataUrl={lastResult.photoDataUrl}
          settings={getInstitutionSettings()}
          onClose={() => setShowIjazah(false)}
        />
      )}
    </div>
  );
}
