import abiFile from "../abi/CertificateNotary.json";

/**
 * Alamat contract CertificateNotary yang sudah dideploy ke Sepolia Testnet.
 * Diisi lewat environment variable VITE_CONTRACT_ADDRESS (lihat .env.example),
 * supaya tidak perlu hardcode & memudahkan ganti contract address tanpa rebuild kode.
 */
export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

/**
 * ABI contract, diambil dari file hasil compile Hardhat (lihat utils/abi/CertificateNotary.json).
 * Mendukung dua bentuk file: { abi: [...] } (format artifact Hardhat asli)
 * atau langsung array ABI.
 */
export const CONTRACT_ABI = abiFile.abi || abiFile;

/** Chain ID Sepolia Testnet (desimal & hex), dipakai untuk deteksi & switch network di MetaMask. */
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

/**
 * RPC publik fallback untuk fitur Verifikasi Sertifikat — supaya publik
 * (tanpa wallet sekalipun) tetap bisa memverifikasi keaslian sertifikat,
 * sesuai requirement "siapa saja bisa memverifikasi secara publik".
 */
export const PUBLIC_RPC_URL =
  import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
