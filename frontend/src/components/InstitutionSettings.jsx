import React, { useState, useEffect, useRef } from "react";
import {
  getInstitutionSettings,
  saveInstitutionSettings,
  fileToDataUrl,
  MAX_INSTITUTION_FILE_SIZE,
} from "../utils/institutionSettings";
import uinLogo from "../assets/uin-logo.jpg";

/**
 * Halaman Pengaturan Institusi — khusus Owner. Semua data (nama universitas,
 * rektor, dekan, nomor SK, logo, tanda tangan, stempel) disimpan di
 * localStorage browser dan otomatis dipakai setiap kali menerbitkan Ijazah
 * Resmi (PDF), sehingga pergantian pejabat/logo/dsb di kemudian hari tidak
 * memerlukan perubahan apa pun pada data ijazah yang sudah terbit sebelumnya.
 *
 * Nama Rektor & Dekan SENGAJA kosong secara default — diisi sendiri oleh
 * admin yang menjalankan aplikasi ini, bukan hardcoded di kode.
 */
export default function InstitutionSettings({ isOwner, pushToast }) {
  const [settings, setSettings] = useState(getInstitutionSettings());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSettings(getInstitutionSettings());
  }, []);

  const handleTextChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (field, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast("error", "File harus berupa gambar.");
      return;
    }
    if (file.size > MAX_INSTITUTION_FILE_SIZE) {
      pushToast("error", "Ukuran file terlalu besar. Gunakan gambar di bawah 1.5MB.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSettings((prev) => ({ ...prev, [field]: dataUrl }));
    } catch {
      pushToast("error", "Gagal membaca file gambar.");
    }
  };

  const handleRemoveFile = (field) => {
    setSettings((prev) => ({ ...prev, [field]: null }));
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      saveInstitutionSettings(settings);
      pushToast("success", "Pengaturan institusi berhasil disimpan.");
    } catch (err) {
      console.error(err);
      pushToast("error", "Gagal menyimpan — kemungkinan data terlalu besar untuk penyimpanan browser.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="glass-card empty-state">
        <span className="empty-icon">//</span>
        <h3>Akses Terbatas</h3>
        <p className="empty-text">[ HANYA OWNER YANG DAPAT MENGUBAH PENGATURAN INSTITUSI ]</p>
      </div>
    );
  }

  return (
    <div className="glass-card settings-card">
      <h2 className="card-title">Pengaturan Institusi</h2>
      <p className="card-subtitle">
        // OTOMATIS DIPAKAI SETIAP MENERBITKAN IJAZAH RESMI — TERSIMPAN DI BROWSER INI
      </p>

      <div className="settings-section">
        <h4 className="settings-section-title">Informasi Institusi</h4>
        <div className="form-grid">
          <div className="form-field">
            <label>Nama Universitas</label>
            <input
              value={settings.universityName}
              onChange={(e) => handleTextChange("universityName", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Kota Penerbitan</label>
            <input
              value={settings.issuingCity}
              onChange={(e) => handleTextChange("issuingCity", e.target.value)}
              placeholder="cth. Jakarta"
            />
          </div>
          <div className="form-field">
            <label>Nama & Gelar Rektor</label>
            <input
              value={settings.rectorName}
              onChange={(e) => handleTextChange("rectorName", e.target.value)}
              placeholder="Kosongkan jika belum ingin dicantumkan"
            />
          </div>
          <div className="form-field">
            <label>Nama & Gelar Dekan</label>
            <input
              value={settings.deanName}
              onChange={(e) => handleTextChange("deanName", e.target.value)}
              placeholder="Kosongkan jika belum ingin dicantumkan"
            />
          </div>
          <div className="form-field">
            <label>Nomor SK</label>
            <input
              value={settings.skNumber}
              onChange={(e) => handleTextChange("skNumber", e.target.value)}
              placeholder="cth. 123/Un.01/DT.00.1/07/2026"
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h4 className="settings-section-title">File Institusi</h4>
        <div className="settings-file-grid">
          <FileUploadRow
            label="Logo Universitas"
            preview={settings.logoDataUrl || uinLogo}
            hasCustom={Boolean(settings.logoDataUrl)}
            onUpload={(file) => handleFileChange("logoDataUrl", file)}
            onRemove={() => handleRemoveFile("logoDataUrl")}
            removeLabel="Kembalikan ke default"
          />
          <FileUploadRow
            label="Tanda Tangan Rektor (opsional)"
            preview={settings.rectorSignatureDataUrl}
            hasCustom={Boolean(settings.rectorSignatureDataUrl)}
            onUpload={(file) => handleFileChange("rectorSignatureDataUrl", file)}
            onRemove={() => handleRemoveFile("rectorSignatureDataUrl")}
          />
          <FileUploadRow
            label="Tanda Tangan Dekan (opsional)"
            preview={settings.deanSignatureDataUrl}
            hasCustom={Boolean(settings.deanSignatureDataUrl)}
            onUpload={(file) => handleFileChange("deanSignatureDataUrl", file)}
            onRemove={() => handleRemoveFile("deanSignatureDataUrl")}
          />
          <FileUploadRow
            label="Stempel Universitas (opsional)"
            preview={settings.stampDataUrl}
            hasCustom={Boolean(settings.stampDataUrl)}
            onUpload={(file) => handleFileChange("stampDataUrl", file)}
            onRemove={() => handleRemoveFile("stampDataUrl")}
          />
        </div>
        <p className="settings-hint">
          Tanda tangan & stempel bersifat opsional — jika belum tersedia (misalnya untuk demo),
          Ijazah Resmi tetap bisa dibuat tanpa error, area tanda tangan akan tampil kosong.
        </p>
      </div>

      <button className="btn-primary-glow full-width" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
      </button>
    </div>
  );
}

/** Baris upload file kecil dengan preview thumbnail + tombol hapus. */
function FileUploadRow({ label, preview, hasCustom, onUpload, onRemove, removeLabel = "Hapus" }) {
  const inputRef = useRef(null);

  return (
    <div className="file-upload-row">
      <div className="file-upload-preview">
        {preview ? (
          <img src={preview} alt={label} />
        ) : (
          <span className="file-upload-empty">Belum ada</span>
        )}
      </div>
      <div className="file-upload-info">
        <span className="file-upload-label">{label}</span>
        <div className="file-upload-actions">
          <button className="btn-ghost-sm" onClick={() => inputRef.current?.click()}>
            Upload
          </button>
          {hasCustom && (
            <button className="btn-ghost-sm" onClick={onRemove}>
              {removeLabel}
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="file-upload-hidden-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
