const hre = require("hardhat");

/**
 * Script untuk menambahkan sebuah wallet sebagai Authorized Issuer.
 * Dipakai supaya TEMAN SEKELOMPOK bisa ikut mencoba fitur Terbitkan & Cabut
 * Sertifikat dari wallet MetaMask mereka sendiri — TANPA perlu memegang
 * PRIVATE_KEY milik deployer/owner. Hanya wallet Owner yang boleh & bisa
 * menjalankan script ini (sesuai modifier onlyOwner di smart contract).
 *
 * Cara pakai (jalankan oleh wallet Owner/deployer saja):
 *
 *   CONTRACT_ADDRESS=0xAlamatContract ISSUER_ADDRESS=0xAlamatWalletTeman \
 *     npx hardhat run scripts/addIssuer.js --network sepolia
 *
 * Di Windows PowerShell, jalankan tiap variabel di baris terpisah:
 *   $env:CONTRACT_ADDRESS="0xAlamatContract"
 *   $env:ISSUER_ADDRESS="0xAlamatWalletTeman"
 *   npx hardhat run scripts/addIssuer.js --network sepolia
 */
async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const issuerAddress = process.env.ISSUER_ADDRESS;

  if (!contractAddress) {
    console.error("❌ Mohon set environment variable CONTRACT_ADDRESS (alamat contract yang sudah dideploy).");
    process.exit(1);
  }
  if (!issuerAddress) {
    console.error("❌ Mohon set environment variable ISSUER_ADDRESS (alamat wallet teman yang mau dijadikan issuer).");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  console.log("Menjalankan script sebagai wallet:", signer.address);

  const contract = await hre.ethers.getContractAt("CertificateNotary", contractAddress, signer);

  const currentOwner = await contract.owner();
  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(`❌ Wallet ini (${signer.address}) bukan Owner contract (Owner: ${currentOwner}).`);
    console.error("   Hanya Owner yang bisa menambahkan Authorized Issuer.");
    process.exit(1);
  }

  const alreadyIssuer = await contract.isAuthorizedIssuer(issuerAddress);
  if (alreadyIssuer) {
    console.log(`ℹ️  ${issuerAddress} sudah menjadi Authorized Issuer sebelumnya. Tidak ada yang perlu dilakukan.`);
    return;
  }

  console.log(`Menambahkan ${issuerAddress} sebagai Authorized Issuer...`);
  const tx = await contract.addIssuer(issuerAddress);
  await tx.wait();

  console.log(`✅ Berhasil! ${issuerAddress} sekarang adalah Authorized Issuer dan bisa Terbitkan/Cabut sertifikat.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
