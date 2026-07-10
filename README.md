# 🔐 Sistem Notaris Ijazah/Sertifikat Terdesentralisasi (DApp)

Tugas UAS Mata Kuliah Kriptografi — DApp berbasis Ethereum yang memungkinkan
institusi pendidikan menerbitkan ijazah/sertifikat ke blockchain secara
**terenkripsi (AES-256 + RSA / Hybrid Cryptography)**, dan memungkinkan
siapa saja memverifikasi keasliannya secara publik tanpa perlu wallet.

---

## 📦 Tech Stack

| Layer | Teknologi |
|---|---|
| Smart Contract | Solidity ^0.8.20, Ethereum Sepolia Testnet |
| Dev Framework | Hardhat |
| Frontend | React + Vite (JSX) |
| Web3 Library | ethers.js v6 |
| Enkripsi Data | AES-256 (CryptoJS) |
| Enkripsi Kunci | RSA-OAEP 2048-bit (node-forge) — Hybrid Cryptography |
| Hashing Integritas | SHA-256 |
| Wallet | MetaMask |
| Hosting | Vercel / Netlify |

---

## 🗂️ Struktur Folder

```
notaris-ijazah-dapp/
├── blockchain/              # Smart contract + Hardhat
│   ├── contracts/CertificateNotary.sol
│   ├── scripts/deploy.js
│   ├── test/CertificateNotary.test.js
│   └── hardhat.config.js
├── frontend/                # React + Vite
│   └── src/
│       ├── components/      # ConnectWallet, IssueCertificate, VerifyCertificate, RevokeCertificate
│       ├── hooks/useContract.js
│       ├── utils/           # aes.js, rsa.js, hash.js, contract.js
│       └── abi/CertificateNotary.json
├── .env.example
└── README.md
```

---

## 🔄 Alur Kriptografi

**Saat Menerbitkan (Issue):**
1. Data ijazah (nama, NIM, jurusan, tanggal lulus, IPK) dikumpulkan dari form lalu di-serialize ke JSON.
2. Generate AES key 256-bit acak.
3. Enkripsi JSON dengan AES key tersebut → `ciphertext`.
4. Enkripsi AES key dengan **RSA public key** institusi (RSA-OAEP) → `encryptedKey`. Inilah inti **Hybrid Cryptography**: AES cepat untuk data besar, RSA aman untuk distribusi kunci.
5. Hash data JSON **asli** (sebelum dienkripsi) dengan SHA-256 → `dataHash`.
6. Kirim `{ciphertext + encryptedKey, dataHash}` ke smart contract via transaksi `issueCertificate`.

**Saat Verifikasi:**
1. Siapa pun input `certId` → query `verifyCertificate` & `getCertificate` di blockchain (gratis, tanpa wallet, lewat RPC publik).
2. Status VALID / REVOKED / NOT FOUND langsung tampil dari hasil query on-chain.
3. *(Opsional)* Jika verifier memiliki RSA private key institusi, ia bisa men-dekripsi `encryptedKey` → dapat AES key → dekripsi `ciphertext` → data asli sertifikat tampil penuh di Certificate Card.

