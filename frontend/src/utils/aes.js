import CryptoJS from "crypto-js";

/**
 * Generate AES key 256-bit secara acak, direpresentasikan sebagai hex string.
 * Key inilah yang dipakai untuk mengenkripsi seluruh data sertifikat,
 * dan nantinya key ini sendiri akan dibungkus (wrap) memakai RSA
 * (lihat utils/rsa.js) sebelum disimpan — ini yang disebut "Hybrid Cryptography".
 */
export function generateAESKey() {
  // 32 byte = 256 bit, sesuai standar AES-256
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
}

/**
 * Mengenkripsi data (object atau string) menggunakan AES-256 mode CBC.
 * IV (Initialization Vector) dibuat acak setiap kali enkripsi agar ciphertext
 * selalu berbeda walau plaintext & key sama (semantic security), lalu
 * IV digabung di depan ciphertext (dipisah ":") supaya bisa dipakai lagi saat dekripsi.
 *
 * @param {object|string} data - data ijazah (nama, NIM, jurusan, tanggal lulus, IPK, dst)
 * @param {string} hexKey - AES key 256-bit dalam format hex
 * @returns {string} "ivHex:ciphertextHex"
 */
export function encryptAES(data, hexKey) {
  const key = CryptoJS.enc.Hex.parse(hexKey);
  const iv = CryptoJS.lib.WordArray.random(16); // 16 byte IV untuk AES-CBC
  const plaintext = typeof data === "string" ? data : JSON.stringify(data);

  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return `${iv.toString(CryptoJS.enc.Hex)}:${encrypted.ciphertext.toString(CryptoJS.enc.Hex)}`;
}

/**
 * Mendekripsi string hasil encryptAES() kembali menjadi object/JSON asli.
 * Dipakai saat verifier memasukkan RSA private key untuk membuka detail sertifikat.
 *
 * @param {string} payload - hasil dari encryptAES(), format "ivHex:ciphertextHex"
 * @param {string} hexKey - AES key 256-bit hex (didapat dari decryptAESKeyWithRSA)
 * @returns {object|string} data asli sertifikat
 */
export function decryptAES(payload, hexKey) {
  const [ivHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !ciphertextHex) {
    throw new Error("Format ciphertext AES tidak valid.");
  }

  const key = CryptoJS.enc.Hex.parse(hexKey);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const ciphertext = CryptoJS.enc.Hex.parse(ciphertextHex);

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext },
    key,
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );

  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plaintext) {
    throw new Error("Dekripsi AES gagal — kemungkinan key salah.");
  }

  try {
    return JSON.parse(plaintext);
  } catch {
    return plaintext;
  }
}
