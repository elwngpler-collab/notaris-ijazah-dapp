import forge from "node-forge";

const STORAGE_KEY = "certnotary_institution_rsa_keypair";

/**
 * Generate sepasang RSA key (2048-bit) baru.
 * Dalam skenario nyata, institusi pendidikan men-generate ini SEKALI saja,
 * lalu menyimpan private key dengan sangat aman (mis. di server/HSM) dan
 * membagikan public key ke siapa pun yang perlu mengenkripsi AES key
 * (proses "issue"). Verifier yang ingin membuka isi sertifikat butuh
 * private key ini.
 */
export function generateRSAKeyPair() {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  return {
    publicKeyPem: forge.pki.publicKeyToPem(keypair.publicKey),
    privateKeyPem: forge.pki.privateKeyToPem(keypair.privateKey),
  };
}

/**
 * Mengenkripsi AES key (hex string) menggunakan RSA public key (format PEM).
 * Memakai padding RSA-OAEP (lebih aman dibanding PKCS#1 v1.5 klasik) dengan
 * SHA-256 sebagai hash function pada proses OAEP.
 * Hasilnya di-encode base64 supaya aman disimpan sebagai teks biasa.
 *
 * Inilah langkah "Hybrid Cryptography": AES dipakai untuk data (cepat, cocok
 * untuk data besar), RSA dipakai untuk membungkus AES key (aman untuk
 * distribusi key tanpa pernah mengirim key dalam bentuk plain).
 */
export function encryptAESKeyWithRSA(hexAesKey, publicKeyPem) {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const encryptedBytes = publicKey.encrypt(hexAesKey, "RSA-OAEP", {
    md: forge.md.sha256.create(),
  });
  return forge.util.encode64(encryptedBytes);
}

/**
 * Mendekripsi AES key yang sudah dibungkus RSA, menggunakan RSA private key (PEM).
 * Dipakai saat verifier ingin membuka isi sertifikat secara lengkap.
 */
export function decryptAESKeyWithRSA(encryptedKeyBase64, privateKeyPem) {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const encryptedBytes = forge.util.decode64(encryptedKeyBase64);
  return privateKey.decrypt(encryptedBytes, "RSA-OAEP", {
    md: forge.md.sha256.create(),
  });
}

/**
 * Helper KHUSUS UNTUK DEMO/TUGAS: agar alur issue → verify bisa langsung
 * dicoba di browser yang sama tanpa perlu backend tambahan, key pair RSA
 * institusi disimpan di localStorage browser dan dipakai ulang.
 *
 * ⚠️ CATATAN KEAMANAN: Ini TIDAK aman untuk production. Private key tidak
 * boleh tersimpan di localStorage browser pengguna karena bisa dibaca oleh
 * script lain / extension yang berjalan di domain yang sama. Di sistem
 * production, RSA private key institusi harus disimpan di server/HSM yang
 * aman, dan proses dekripsi sebaiknya dilakukan lewat backend terotorisasi.
 */
export function getOrCreateInstitutionKeyPair() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // lanjut generate baru kalau data tersimpan korup
    }
  }
  const keypair = generateRSAKeyPair();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keypair));
  return keypair;
}

/** Mengambil ulang public key institusi (untuk ditampilkan/dibagikan ke verifier). */
export function getInstitutionPublicKey() {
  return getOrCreateInstitutionKeyPair().publicKeyPem;
}

/** Mengambil ulang private key institusi (untuk demo dekripsi di tab Verifikasi). */
export function getInstitutionPrivateKey() {
  return getOrCreateInstitutionKeyPair().privateKeyPem;
}

/**
 * Menimpa keypair institusi di BROWSER INI dengan keypair yang diberikan
 * (biasanya hasil export dari browser lain yang sudah dipakai menerbitkan
 * sertifikat lebih dulu). Ini KUNCI untuk kerja tim lintas device:
 *
 * - Cek duplikasi NIM, Certificate Card, Ijazah Resmi, dan foto dari IPFS
 *   semuanya butuh RSA private key yang SAMA dengan yang dipakai saat
 *   sertifikat pertama kali diterbitkan. Kalau tiap device generate
 *   keypair sendiri-sendiri, semua fitur itu cuma jalan di device yang
 *   menerbitkan — bukan soal hosting/lokal, murni soal localStorage yang
 *   tidak tersinkron antar device.
 * - Solusinya: satu orang generate/pakai keypair pertama kali, lalu
 *   EXPORT-kan (fungsi ini di sisi import), dan semua anggota tim
 *   IMPORT keypair yang sama persis ke browser masing-masing.
 *
 * ⚠️ Ini TIMPA TOTAL keypair yang ada di browser ini. Kalau sebelumnya
 * browser ini sudah dipakai menerbitkan sertifikat dengan keypair LAMA,
 * sertifikat lama itu tidak lagi bisa didekripsi dari browser ini setelah
 * import (kecuali keypair lama itu di-export dulu sebagai cadangan).
 */
export function importInstitutionKeyPair(publicKeyPem, privateKeyPem) {
  try {
    forge.pki.publicKeyFromPem(publicKeyPem.trim());
    forge.pki.privateKeyFromPem(privateKeyPem.trim());
  } catch (err) {
    throw new Error("Format RSA key tidak valid. Pastikan disalin lengkap termasuk baris -----BEGIN/END-----.");
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ publicKeyPem: publicKeyPem.trim(), privateKeyPem: privateKeyPem.trim() })
  );
}
