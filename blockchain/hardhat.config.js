require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

// Fallback ke .env di folder blockchain/ juga, supaya fleksibel kalau .env diletakkan di root atau di sini
require("dotenv").config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000001";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/**
 * Konfigurasi Hardhat:
 * - solidity: versi compiler 0.8.20 sesuai tech stack wajib, dengan optimizer aktif.
 * - networks.sepolia: jaringan testnet tujuan deploy (chainId 11155111).
 * - etherscan: untuk verifikasi source code contract setelah deploy (opsional).
 */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY.replace(/^0x/, "")}`] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};
