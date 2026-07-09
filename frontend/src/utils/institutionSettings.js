import { INSTITUTION_NAME } from "./institution";

/**
 * Pengaturan institusi disimpan di localStorage browser (pola yang sama
 * dengan RSA institution keypair di utils/rsa.js) — supaya admin bisa
 * ganti Rektor/Dekan/Nomor SK/logo/tanda tangan/stempel kapan saja tanpa
 * perlu redeploy smart contract atau mengubah data ijazah yang sudah terbit.
 *
 * ⚠️ CATATAN: ini tersimpan per-browser, bukan tersentralisasi di blockchain.
 * Untuk demo di satu laptop ini cukup; kalau tim pakai beberapa perangkat
 * berbeda untuk menerbitkan ijazah, tiap perangkat perlu diisi ulang.
 */
const STORAGE_KEY = "certnotary_institution_settings";

const DEFAULTS = {
  universityName: INSTITUTION_NAME,
  issuingCity: "",
  rectorName: "",
  deanName: "",
  skNumber: "",
  logoDataUrl: null, // null = pakai logo bawaan (uin-logo.jpg)
  rectorSignatureDataUrl: null,
  deanSignatureDataUrl: null,
  stampDataUrl: null,
};

export function getInstitutionSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveInstitutionSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Mengonversi File (dari <input type="file">) menjadi data URL base64. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

/** Batas ukuran file gambar institusi (logo/ttd/stempel) sebelum disimpan ke localStorage. */
export const MAX_INSTITUTION_FILE_SIZE = 1_500_000; // ~1.5MB
