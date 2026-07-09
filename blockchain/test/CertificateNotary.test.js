const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateNotary", function () {
  let contract;
  let owner, issuer2, stranger;

  beforeEach(async function () {
    [owner, issuer2, stranger] = await ethers.getSigners();
    const CertificateNotary = await ethers.getContractFactory("CertificateNotary");
    contract = await CertificateNotary.deploy();
    await contract.waitForDeployment();
  });

  it("menjadikan deployer sebagai owner dan authorized issuer pertama", async function () {
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.isAuthorizedIssuer(owner.address)).to.equal(true);
  });

  it("mengizinkan owner menambah & menghapus issuer", async function () {
    await contract.addIssuer(issuer2.address);
    expect(await contract.isAuthorizedIssuer(issuer2.address)).to.equal(true);

    await contract.removeIssuer(issuer2.address);
    expect(await contract.isAuthorizedIssuer(issuer2.address)).to.equal(false);
  });

  it("menolak non-owner yang mencoba menambah issuer", async function () {
    await expect(
      contract.connect(stranger).addIssuer(stranger.address)
    ).to.be.revertedWith("CertificateNotary: caller is not the owner");
  });

  it("berhasil menerbitkan sertifikat baru dan menyimpannya dengan benar", async function () {
    const certId = ethers.keccak256(ethers.toUtf8Bytes("CERT-001"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("dummy-json-data"));

    await expect(
      contract.issueCertificate(certId, "encrypted-blob", dataHash, "Elang Ian")
    ).to.emit(contract, "CertificateIssued");

    const cert = await contract.getCertificate(certId);
    expect(cert.exists).to.equal(true);
    expect(cert.isRevoked).to.equal(false);
    expect(cert.recipientName).to.equal("Elang Ian");
  });

  it("mencegah wallet bukan issuer menerbitkan sertifikat", async function () {
    const certId = ethers.keccak256(ethers.toUtf8Bytes("CERT-002"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));

    await expect(
      contract.connect(stranger).issueCertificate(certId, "blob", dataHash, "Stranger")
    ).to.be.revertedWith("CertificateNotary: caller is not an authorized issuer");
  });

  it("mengizinkan issuer mencabut (revoke) sertifikat", async function () {
    const certId = ethers.keccak256(ethers.toUtf8Bytes("CERT-003"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));
    await contract.issueCertificate(certId, "blob", dataHash, "Test User");

    await expect(contract.revokeCertificate(certId)).to.emit(contract, "CertificateRevoked");

    const [isValid, exists, isRevoked] = await contract.verifyCertificate(certId);
    expect(exists).to.equal(true);
    expect(isRevoked).to.equal(true);
    expect(isValid).to.equal(false);
  });

  it("mengembalikan status NOT FOUND untuk certId yang tidak pernah diterbitkan", async function () {
    const certId = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN"));
    const [isValid, exists] = await contract.verifyCertificate(certId);
    expect(exists).to.equal(false);
    expect(isValid).to.equal(false);
  });

  it("mencegah penerbitan ganda dengan certId yang sama", async function () {
    const certId = ethers.keccak256(ethers.toUtf8Bytes("CERT-DUPLICATE"));
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));
    await contract.issueCertificate(certId, "blob", dataHash, "User A");

    await expect(
      contract.issueCertificate(certId, "blob-lain", dataHash, "User B")
    ).to.be.revertedWith("CertificateNotary: certificate ID already exists");
  });
});
