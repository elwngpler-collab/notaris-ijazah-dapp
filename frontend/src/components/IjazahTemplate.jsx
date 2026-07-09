import React from "react";
import { QRCodeSVG } from "qrcode.react";
import uinLogoDefault from "../assets/uin-logo.jpg";

/**
 * Template Ijazah Resmi — meniru tata letak ijazah universitas konvensional
 * (bukan gaya Certificate Card modern di tab Verifikasi). PDF ini HANYA
 * representasi visual dari data yang sudah diproses & disimpan sistem;
 * tidak mengubah mekanisme hashing/verifikasi yang sudah berjalan sama
 * sekali — semua data di sini sudah lebih dulu di-hash & dikirim ke
 * blockchain sebelum komponen ini dirender.
 *
 * Foto mahasiswa: disimpan terenkripsi di IPFS (jika VITE_PINATA_JWT
 * dikonfigurasi) memakai AES key yang sama dengan data sertifikat lainnya,
 * sehingga tetap privat dan bisa dipulihkan kembali di sesi/perangkat lain
 * selama verifier memiliki RSA private key institusi. Jika IPFS tidak
 * dikonfigurasi, foto hanya berlaku sesaat untuk PDF yang sedang dibuat.
 */
function formatTanggal(dateString) {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export default function IjazahTemplate({
  recipientName,
  nim,
  fakultas,
  jurusan,
  gelar,
  ipk,
  tanggalLulus,
  tanggalLahir,
  tempatLahir,
  certId,
  verifyUrl,
  photoDataUrl,
  settings,
  onClose,
}) {
  const logoSrc = settings.logoDataUrl || uinLogoDefault;
  const serialNumber = `ER-${certId.slice(-6).toUpperCase()}`;
  const issueDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
  const placeDate = settings.issuingCity ? `${settings.issuingCity}, ${issueDate}` : issueDate;

  const handlePrint = () => window.print();

  return (
    <div className="export-overlay" onClick={onClose}>
      <div className="ijazah-modal" onClick={(e) => e.stopPropagation()} id="ijazah-to-print">
        <span className="ijz-serial">{serialNumber}</span>

        <div className="ijz-top-row">
          <div className="ijz-logo-lockup">
            <img src={logoSrc} alt="Logo Institusi" className="ijz-logo" />
            <p className="ijz-institution-name">{settings.universityName}</p>
          </div>
          <div className="ijz-given-block">
            <p className="ijz-given-label">Memberikan kepada :</p>
            <h2 className="ijz-student-name">{recipientName}</h2>
            {(tanggalLahir || tempatLahir) && (
              <p className="ijz-birth-line">
                Lahir pada tanggal {formatTanggal(tanggalLahir)}
                {tempatLahir && <> di {tempatLahir}</>}
              </p>
            )}
          </div>
        </div>

        <div className="ijz-title-block">
          <h1 className="ijz-main-title">I J A Z A H</h1>
          {gelar && <p className="ijz-degree">{gelar}</p>}
        </div>

        <div className="ijz-details-table">
          <div className="ijz-detail-row"><span>Fakultas</span><span>:</span><span>{fakultas}</span></div>
          <div className="ijz-detail-row"><span>Jurusan</span><span>:</span><span>{jurusan}</span></div>
          <div className="ijz-detail-row"><span>Program Studi</span><span>:</span><span>{jurusan}</span></div>
          <div className="ijz-detail-row"><span>Nomor Induk Mahasiswa</span><span>:</span><span>{nim}</span></div>
          <div className="ijz-detail-row"><span>IPK</span><span>:</span><span>{ipk}</span></div>
          <div className="ijz-detail-row"><span>Tanggal Kelulusan</span><span>:</span><span>{formatTanggal(tanggalLulus)}</span></div>
          {settings.skNumber && (
            <div className="ijz-detail-row"><span>Nomor SK</span><span>:</span><span>{settings.skNumber}</span></div>
          )}
        </div>

        <p className="ijz-clause">
          Dengan segala hak dan kewajiban yang berhubungan dengan gelar akademik ini.
        </p>

        <div className="ijz-bottom-row">
          <div className="ijz-photo-box">
            {photoDataUrl ? (
              <img src={photoDataUrl} alt="Foto Mahasiswa" />
            ) : (
              <span className="ijz-photo-placeholder">Foto 3x4</span>
            )}
          </div>

          <div className="ijz-signature-block">
            <p className="ijz-place-date">{placeDate}</p>
            <div className="ijz-dual-signature">
              <div className="ijz-signature-col">
                <p className="ijz-signature-role">Rektor,</p>
                <div className="ijz-signature-area">
                  {settings.rectorSignatureDataUrl && (
                    <img src={settings.rectorSignatureDataUrl} className="ijz-sign-img" alt="TTD Rektor" />
                  )}
                  {settings.stampDataUrl && (
                    <img src={settings.stampDataUrl} className="ijz-stamp-img" alt="Stempel" />
                  )}
                </div>
                <p className="ijz-signature-name">{settings.rectorName || "________________________"}</p>
              </div>
              <div className="ijz-signature-col">
                <p className="ijz-signature-role">Dekan,</p>
                <div className="ijz-signature-area">
                  {settings.deanSignatureDataUrl && (
                    <img src={settings.deanSignatureDataUrl} className="ijz-sign-img" alt="TTD Dekan" />
                  )}
                </div>
                <p className="ijz-signature-name">{settings.deanName || "________________________"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="ijz-verify-footer">
          <div className="ijz-verify-text">
            <p>Nomor Ijazah: {certId.slice(0, 14)}...{certId.slice(-8)}</p>
            <p>Verifikasi online di blockchain Ethereum Sepolia Testnet</p>
          </div>
          <div className="ijz-qr">
            <QRCodeSVG value={verifyUrl} size={64} bgColor="#ffffff" fgColor="#0a0a0a" level="H" />
          </div>
        </div>

        <div className="export-actions no-print">
          <button className="btn-primary-glow" onClick={handlePrint}>Print / Simpan PDF</button>
          <button className="btn-ghost" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
