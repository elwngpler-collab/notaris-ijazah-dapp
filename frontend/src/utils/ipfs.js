/**
 * Helper untuk menyimpan foto mahasiswa secara PERSISTEN & TERDESENTRALISASI
 * lewat IPFS (via Pinata), supaya foto tetap bisa dipulihkan di sesi/
 * perangkat lain — bukan cuma sesaat di browser yang menerbitkan.
 *
 * PENTING soal privasi: yang diupload ke IPFS BUKAN foto asli, melainkan
 * ciphertext hasil AES-256 (memakai AES key yang SAMA dengan yang dipakai
 * mengenkripsi data sertifikat lain). IPFS itu publik & permanen, tapi
 * karena isinya ciphertext, siapa pun yang mengambilnya dari IPFS tetap
 * tidak bisa melihat foto asli tanpa RSA private key institusi untuk
 * membuka AES key tersebut lebih dulu.
 *
 * Kalau VITE_PINATA_JWT tidak diisi di .env, fitur ini otomatis dilewati
 * (graceful degradation) — foto tetap bisa dipakai untuk PDF saat itu juga,
 * hanya saja tidak akan persisten untuk verifikasi di sesi lain.
 */
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || "";
const PINATA_UPLOAD_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

// Beberapa gateway publik dicoba berurutan saat mengambil data, supaya
// tidak bergantung pada satu gateway saja kalau salah satu sedang lambat/down.
const PUBLIC_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
];

export function isIpfsConfigured() {
  return Boolean(PINATA_JWT);
}

/**
 * Upload ciphertext (string hasil encryptAES) sebagai JSON ke IPFS.
 * Mengembalikan CID (Content Identifier) — disimpan di payload terenkripsi
 * utama (bersama nim/jurusan/dll) sebagai `photoIpfsCid`.
 */
export async function uploadCiphertextToIpfs(ciphertext) {
  if (!PINATA_JWT) {
    throw new Error("VITE_PINATA_JWT belum diisi di frontend/.env — lihat README untuk cara mendapatkannya.");
  }

  const response = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: { ciphertext },
      pinataMetadata: { name: `certnotary-photo-${Date.now()}` },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Upload ke IPFS gagal (HTTP ${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.IpfsHash;
}

/**
 * Mengambil ciphertext dari IPFS berdasarkan CID, mencoba beberapa
 * gateway publik secara berurutan sampai salah satu berhasil.
 */
export async function fetchCiphertextFromIpfs(cid) {
  let lastError = null;
  for (const gateway of PUBLIC_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}${cid}`);
      if (!response.ok) throw new Error(`Gateway ${gateway} merespons HTTP ${response.status}`);
      const data = await response.json();
      if (!data.ciphertext) throw new Error("Format data IPFS tidak sesuai.");
      return data.ciphertext;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Gagal mengambil data foto dari IPFS.");
}
