/**
 * Konfigurasi identitas institusi untuk ditampilkan di Certificate Card.
 * Sengaja dibuat sebagai environment variable (bukan hardcoded), supaya
 * pihak yang men-deploy aplikasi ini yang menentukan sendiri identitas
 * dan pejabat penandatangan — bukan ditentukan otomatis oleh kode.
 *
 * Jika VITE_SIGNING_OFFICIAL_NAME tidak diisi, bagian tanda tangan tidak
 * akan ditampilkan sama sekali di Certificate Card (lihat VerifyCertificate.jsx).
 */
export const INSTITUTION_NAME =
  import.meta.env.VITE_INSTITUTION_NAME || "Universitas Islam Negeri Syarif Hidayatullah Jakarta";

export const SIGNING_OFFICIAL_NAME = import.meta.env.VITE_SIGNING_OFFICIAL_NAME || "";
export const SIGNING_OFFICIAL_TITLE = import.meta.env.VITE_SIGNING_OFFICIAL_TITLE || "Pejabat Berwenang";
