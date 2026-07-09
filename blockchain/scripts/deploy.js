const hre = require("hardhat");

/**
 * Script untuk mendeploy CertificateNotary ke jaringan yang dipilih
 * (default: Sepolia, lihat hardhat.config.js).
 * Jalankan dengan: npx hardhat run scripts/deploy.js --network sepolia
 */
async function main() {
  console.log(`\n🚀 Deploying CertificateNotary ke network: ${hre.network.name}...\n`);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");

  const CertificateNotary = await hre.ethers.getContractFactory("CertificateNotary");
  const contract = await CertificateNotary.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ CertificateNotary berhasil dideploy!");
  console.log("Contract address:", address);
  console.log("Owner / Issuer pertama:", deployer.address);

  console.log("\n📋 Langkah selanjutnya:");
  console.log(`1. Salin alamat di atas ke frontend/.env sebagai VITE_CONTRACT_ADDRESS=${address}`);
  console.log("2. Salin ABI dari blockchain/artifacts/contracts/CertificateNotary.sol/CertificateNotary.json");
  console.log("   ke frontend/src/abi/CertificateNotary.json");
  console.log(`3. (Opsional) Verifikasi di Etherscan:`);
  console.log(`   npx hardhat verify --network sepolia ${address}`);
}

main().catch((error) => {
  console.error("❌ Deploy gagal:", error);
  process.exitCode = 1;
});
