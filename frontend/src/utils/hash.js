import CryptoJS from "crypto-js";

/**
 * Menghitung fingerprint SHA-256 dari data ASLI sertifikat (sebelum dienkripsi).
 * Hash ini disimpan dalam bentuk plain di blockchain (field dataHash) sehingga
 * siapa pun bisa memverifikasi integritas data—memastikan data asli tidak
 * pernah diubah—tanpa perlu mendekripsi ciphertext-nya sama sekali.
 *
 * @param {object|string} data
 * @returns {string} hash dalam format "0x" + 64 hex char (cocok untuk bytes32 Solidity)
 */
export function sha256Hash(data) {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  const hash = CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex);
  return `0x${hash}`;
}

/**
 * Mengecek apakah sebuah data masih cocok dengan hash yang tersimpan di blockchain.
 * Dipakai setelah proses dekripsi untuk membuktikan data tidak dipalsukan/diubah.
 */
export function verifyHash(data, expectedHash) {
  const computed = sha256Hash(data);
  return computed.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Membuat certId unik (bytes32) dari sebuah seed string (kombinasi NIM,
 * nama, dan timestamp). Dipakai sebagai primary key di smart contract,
 * sekaligus menjadi "nomor seri" publik dari sertifikat tersebut.
 */
export function generateCertId(seedString) {
  const hash = CryptoJS.SHA256(seedString).toString(CryptoJS.enc.Hex);
  return `0x${hash}`;
}
