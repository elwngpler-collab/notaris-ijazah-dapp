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

> ⚠️ **Catatan keamanan untuk laporan:** demo ini menyimpan RSA key pair institusi di `localStorage` browser agar alur issue → verify bisa langsung dicoba di satu sesi browser yang sama tanpa backend tambahan. Pada implementasi production, RSA **private key** institusi wajib disimpan di server/HSM yang aman dan tidak pernah menyentuh browser pengguna.

---

## ⚙️ Setup — Blockchain (Smart Contract)

```bash
cd blockchain
npm install
cp ../.env.example .env
# isi SEPOLIA_RPC_URL dan PRIVATE_KEY di file .env
```

Compile & test:
```bash
npx hardhat compile
npx hardhat test
```

Deploy ke Sepolia:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Setelah deploy sukses, salin:
1. **Contract address** dari output terminal → ke `frontend/.env` sebagai `VITE_CONTRACT_ADDRESS`.
2. **ABI** dari `blockchain/artifacts/contracts/CertificateNotary.sol/CertificateNotary.json` (field `"abi"`) → tempel ke `frontend/src/abi/CertificateNotary.json` (timpa isi field `"abi"` di file tersebut).

### 🚰 Cara mendapatkan Sepolia ETH gratis (faucet)

Wallet deployer butuh sedikit Sepolia ETH untuk membayar gas saat deploy. Faucet yang masih aktif & cukup andal:

- **Google Cloud Web3 Faucet** — https://cloud.google.com/application/web3/faucet/ethereum/sepolia (login Google, tanpa syarat saldo mainnet)
- **Alchemy Sepolia Faucet** — https://www.alchemy.com/faucets/ethereum-sepolia (cepat, perlu akun Alchemy)
- **Chainlink Faucet** — https://faucets.chain.link/sepolia (sekaligus dapat testnet LINK)
- **QuickNode Faucet** — https://faucet.quicknode.com/ethereum/sepolia (kadang minta share post di X)

Tips: faucet sering punya limit harian/butuh saldo kecil di Ethereum Mainnet sebagai anti-bot. Jika satu faucet gagal, coba faucet lain di atas.

---

## ⚙️ Setup — Frontend

```bash
cd frontend
npm install
cp ../.env.example .env
# isi VITE_CONTRACT_ADDRESS (dari hasil deploy)
npm run dev
```

Buka `http://localhost:5173`, install ekstensi **MetaMask** di browser jika belum, lalu tambahkan/pilih network **Sepolia Test Network**.

---

## 🚀 Deploy Frontend ke Vercel (Gratis)

1. Push folder `notaris-ijazah-dapp` ke repository GitHub.
2. Buka [vercel.com](https://vercel.com) → **Add New Project** → import repo tersebut.
3. Saat konfigurasi:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Tambahkan Environment Variables di dashboard Vercel:
   - `VITE_CONTRACT_ADDRESS` = alamat contract Sepolia kamu
   - `VITE_SEPOLIA_RPC_URL` = (opsional, boleh dikosongkan)
5. Klik **Deploy**. Vercel otomatis memberi domain HTTPS gratis (`*.vercel.app`).

*(Alternatif: Netlify — caranya serupa, set **Base directory** = `frontend`, **Build command** = `npm run build`, **Publish directory** = `frontend/dist`.)*

---

## 👤 Role & Akses

| Role | Bisa Apa |
|---|---|
| **Owner** (deployer contract) | Semua hak Issuer + tambah/hapus Authorized Issuer |
| **Authorized Issuer** | Terbitkan & cabut (revoke) sertifikat |
| **Public User** (wallet apa pun / tanpa wallet) | Verifikasi sertifikat |

Untuk menambah issuer baru, panggil fungsi `addIssuer(address)` di contract (lewat Hardhat console atau Etherscan "Write Contract" setelah verifikasi) menggunakan wallet Owner.

---

## 🧪 Testing

```bash
cd blockchain
npx hardhat test
```

Mencakup pengujian: role owner/issuer, penerbitan sertifikat, penolakan akses non-issuer, pencabutan sertifikat, dan status `NOT FOUND` untuk certId yang tidak pernah diterbitkan.

---

## 📝 Catatan untuk Laporan Jurnal

Setiap file kode disertai komentar yang menjelaskan **apa** dan **mengapa** setiap fungsi penting dilakukan — terutama di `utils/aes.js`, `utils/rsa.js`, dan `utils/hash.js` — sehingga bagian metodologi/implementasi pada laporan bisa langsung merujuk ke alur step-by-step di komentar tersebut (generate key → enkripsi → wrap key → hash → submit on-chain).
