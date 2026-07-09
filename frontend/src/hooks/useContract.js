import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID_HEX,
  PUBLIC_RPC_URL,
} from "../utils/contract";
import { decryptAESKeyWithRSA } from "../utils/rsa";
import { decryptAES } from "../utils/aes";

/**
 * Hook utama yang memisahkan SELURUH logika Web3 dari komponen UI
 * (separation of concerns): koneksi MetaMask, deteksi network, deteksi
 * role wallet (Owner / Authorized Issuer / Public User), serta fungsi-fungsi
 * untuk issue, verify, dan revoke sertifikat di smart contract.
 */
export function useContract() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isIssuer, setIsIssuer] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID;

  /**
   * Mengecek ulang role wallet yang sedang aktif (Owner & Authorized Issuer)
   * langsung dari smart contract, supaya UI selalu sinkron dengan kondisi on-chain terbaru.
   */
  const refreshRole = useCallback(async (contractInstance, address) => {
    if (!contractInstance || !address) {
      setIsOwner(false);
      setIsIssuer(false);
      return;
    }
    try {
      const [ownerAddr, issuerFlag] = await Promise.all([
        contractInstance.owner(),
        contractInstance.isAuthorizedIssuer(address),
      ]);
      setIsOwner(ownerAddr.toLowerCase() === address.toLowerCase());
      setIsIssuer(issuerFlag);
    } catch (err) {
      console.error("Gagal memeriksa role wallet:", err);
      setIsOwner(false);
      setIsIssuer(false);
    }
  }, []);

  /** Membuka popup MetaMask, membuat provider/signer/contract instance ethers.js v6. */
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask tidak terdeteksi. Silakan install ekstensi MetaMask terlebih dahulu.");
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      const network = await browserProvider.getNetwork();
      const activeSigner = await browserProvider.getSigner();
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);

      setProvider(browserProvider);
      setSigner(activeSigner);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setContract(contractInstance);

      await refreshRole(contractInstance, accounts[0]);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Gagal menghubungkan wallet.");
    } finally {
      setIsConnecting(false);
    }
  }, [refreshRole]);

  /** Memutus koneksi secara lokal (MetaMask tidak menyediakan API disconnect bawaan). */
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setContract(null);
    setChainId(null);
    setIsOwner(false);
    setIsIssuer(false);
  }, []);

  /** Meminta MetaMask berpindah ke jaringan Sepolia Testnet. */
  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (switchError) {
      console.error(switchError);
      setError("Gagal beralih ke jaringan Sepolia. Silakan ganti manual di MetaMask.");
    }
  }, []);

  /** Mendeteksi koneksi wallet yang sudah ada sebelumnya saat halaman pertama dimuat (tanpa popup). */
  useEffect(() => {
    const detectExistingConnection = async () => {
      if (!window.ethereum) return;
      try {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await browserProvider.send("eth_accounts", []);
        if (accounts.length > 0) {
          const network = await browserProvider.getNetwork();
          const activeSigner = await browserProvider.getSigner();
          const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeSigner);

          setProvider(browserProvider);
          setSigner(activeSigner);
          setAccount(accounts[0]);
          setChainId(Number(network.chainId));
          setContract(contractInstance);
          await refreshRole(contractInstance, accounts[0]);
        }
      } catch (err) {
        console.error("Gagal mendeteksi koneksi wallet sebelumnya:", err);
      }
    };
    detectExistingConnection();
  }, [refreshRole]);

  /** Listener perubahan akun/network langsung dari ekstensi MetaMask. */
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        window.location.reload();
      }
    };
    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [disconnectWallet]);

  /** Mengirim transaksi issueCertificate ke smart contract (hanya Authorized Issuer). */
  const issueCertificateOnChain = useCallback(
    async (certId, encryptedData, dataHash, recipientName) => {
      if (!contract) throw new Error("Contract belum terhubung. Silakan connect wallet terlebih dahulu.");
      const tx = await contract.issueCertificate(certId, encryptedData, dataHash, recipientName);
      const receipt = await tx.wait();
      return receipt;
    },
    [contract]
  );

  /**
   * Membaca data sertifikat & status validasi dari blockchain.
   * Sengaja TIDAK mewajibkan wallet terhubung — memakai RPC publik sebagai
   * fallback — supaya siapa pun bisa memverifikasi keaslian sertifikat secara publik.
   */
  const verifyCertificateOnChain = useCallback(
    async (certId) => {
      const readProvider = provider || new ethers.JsonRpcProvider(PUBLIC_RPC_URL);
      const readContract = contract || new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);

      const [isValid, exists, isRevoked] = await readContract.verifyCertificate(certId);
      if (!exists) {
        return { exists: false };
      }

      const cert = await readContract.getCertificate(certId);

      // Ambil txHash dari event CertificateIssued untuk keperluan audit
      let txHash = null;
      try {
        const issuedFilter = readContract.filters.CertificateIssued(certId);
        const logs = await readContract.queryFilter(issuedFilter, 0, "latest");
        if (logs.length > 0) txHash = logs[0].transactionHash;
      } catch (_) { /* optional, tidak bloking */ }

      return {
        exists: true,
        isValid,
        isRevoked,
        encryptedData: cert.encryptedData,
        dataHash: cert.dataHash,
        issuedBy: cert.issuedBy,
        issuedAt: cert.issuedAt,
        recipientName: cert.recipientName,
        txHash,
      };
    },
    [contract, provider]
  );

  /** Mengirim transaksi revokeCertificate ke smart contract (hanya Authorized Issuer). */
  const revokeCertificateOnChain = useCallback(
    async (certId) => {
      if (!contract) throw new Error("Contract belum terhubung. Silakan connect wallet terlebih dahulu.");
      const tx = await contract.revokeCertificate(certId);
      const receipt = await tx.wait();
      return receipt;
    },
    [contract]
  );

  /** Mengambil event log terbaru (Issued & Revoked) untuk ditampilkan di dashboard. */
  const fetchRecentEvents = useCallback(
    async (maxResults = 10) => {
      if (!contract || !provider) return [];
      try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(currentBlock - 5000, 0);

        const issuedFilter = contract.filters.CertificateIssued();
        const revokedFilter = contract.filters.CertificateRevoked();

        const [issuedLogs, revokedLogs] = await Promise.all([
          contract.queryFilter(issuedFilter, fromBlock, currentBlock),
          contract.queryFilter(revokedFilter, fromBlock, currentBlock),
        ]);

        const combined = [...issuedLogs, ...revokedLogs]
          .map((log) => ({
            type: log.fragment?.name || "Unknown",
            certId: log.args?.certId,
            address: log.args?.issuedBy || log.args?.revokedBy,
            recipientName: log.args?.recipientName,
            timestamp: log.args?.issuedAt ?? log.args?.revokedAt,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          }))
          .sort((a, b) => b.blockNumber - a.blockNumber)
          .slice(0, maxResults);

        return combined;
      } catch (err) {
        console.error("Gagal mengambil event log:", err);
        return [];
      }
    },
    [contract, provider]
  );

  /**
   * Mengambil detail teknis sebuah transaksi: block number, gas used,
   * timestamp blok, dan etherscan URL — untuk ditampilkan di panel Audit.
   */
  const getTransactionDetail = useCallback(
    async (txHash) => {
      const readProvider = provider || new ethers.JsonRpcProvider(PUBLIC_RPC_URL);
      try {
        const [receipt, tx] = await Promise.all([
          readProvider.getTransactionReceipt(txHash),
          readProvider.getTransaction(txHash),
        ]);
        const block = await readProvider.getBlock(receipt.blockNumber);
        return {
          txHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, "gwei") : "—",
          timestamp: block.timestamp,
          etherscanUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
          blockUrl: `https://sepolia.etherscan.io/block/${receipt.blockNumber}`,
        };
      } catch (err) {
        console.error("Gagal mengambil detail transaksi:", err);
        return null;
      }
    },
    [provider]
  );

  /**
   * Mengambil riwayat SEMUA sertifikat yang diterbitkan oleh wallet issuer
   * yang sedang connect (bukan seluruh sertifikat di sistem). Menelusuri
   * index 0..getTotalCertificates()-1 di contract, dari yang TERBARU dulu,
   * lalu memfilter yang issuedBy-nya cocok dengan wallet aktif.
   *
   * Dibatasi (cap) 300 sertifikat terbaru sebagai pengaman supaya tidak
   * membebani RPC pada dataset yang sangat besar — cukup untuk skala tugas.
   */
  const fetchIssuerHistory = useCallback(async () => {
    if (!contract || !account) return [];
    try {
      const total = Number(await contract.getTotalCertificates());
      if (total === 0) return [];

      const cap = Math.min(total, 300);
      const indices = Array.from({ length: cap }, (_, i) => total - 1 - i); // terbaru -> terlama

      const certIds = await Promise.all(indices.map((i) => contract.getCertificateIdAt(i)));
      const certs = await Promise.all(certIds.map((id) => contract.getCertificate(id)));

      return certs
        .map((cert, idx) => ({
          certId: certIds[idx],
          recipientName: cert.recipientName,
          issuedAt: cert.issuedAt,
          isRevoked: cert.isRevoked,
          issuedBy: cert.issuedBy,
        }))
        .filter((c) => c.issuedBy.toLowerCase() === account.toLowerCase());
    } catch (err) {
      console.error("Gagal mengambil riwayat sertifikat:", err);
      return [];
    }
  }, [contract, account]);

  /** Mengirim transaksi addIssuer ke smart contract (hanya Owner). */
  const addIssuerOnChain = useCallback(
    async (issuerAddress) => {
      if (!contract) throw new Error("Contract belum terhubung.");
      const tx = await contract.addIssuer(issuerAddress);
      const receipt = await tx.wait();
      return receipt;
    },
    [contract]
  );

  /** Mengirim transaksi removeIssuer ke smart contract (hanya Owner). */
  const removeIssuerOnChain = useCallback(
    async (issuerAddress) => {
      if (!contract) throw new Error("Contract belum terhubung.");
      const tx = await contract.removeIssuer(issuerAddress);
      const receipt = await tx.wait();
      return receipt;
    },
    [contract]
  );

  /**
   * Menyusun daftar Authorized Issuer yang AKTIF saat ini dengan menelusuri
   * event IssuerAdded & IssuerRemoved sejak contract di-deploy. Contract
   * tidak menyimpan array daftar issuer secara langsung (hanya mapping
   * address->bool), jadi daftar ini direkonstruksi dari histori event —
   * event terakhir untuk tiap address yang menentukan status aktif/tidaknya.
   */
  const fetchIssuerList = useCallback(async () => {
    if (!contract || !provider) return [];
    try {
      const currentBlock = await provider.getBlockNumber();
      const [addedLogs, removedLogs] = await Promise.all([
        contract.queryFilter(contract.filters.IssuerAdded(), 0, currentBlock),
        contract.queryFilter(contract.filters.IssuerRemoved(), 0, currentBlock),
      ]);

      const events = [
        ...addedLogs.map((log) => ({ address: log.args.issuer, isActive: true, blockNumber: log.blockNumber })),
        ...removedLogs.map((log) => ({ address: log.args.issuer, isActive: false, blockNumber: log.blockNumber })),
      ].sort((a, b) => a.blockNumber - b.blockNumber);

      const statusMap = new Map();
      for (const ev of events) {
        statusMap.set(ev.address.toLowerCase(), { address: ev.address, isActive: ev.isActive });
      }

      const ownerAddr = await contract.owner();
      return Array.from(statusMap.values())
        .filter((entry) => entry.isActive)
        .map((entry) => ({
          address: entry.address,
          isOwner: entry.address.toLowerCase() === ownerAddr.toLowerCase(),
        }));
    } catch (err) {
      console.error("Gagal mengambil daftar issuer:", err);
      return [];
    }
  }, [contract, provider]);

  /**
   * Mengecek apakah sebuah NIM sudah pernah dipakai di sertifikat yang MASIH
   * VALID (belum dicabut). Sertifikat yang sudah di-revoke TIDAK dihitung
   * sebagai duplikat — karena revoke berarti sertifikat lama sudah resmi
   * tidak berlaku, sehingga NIM yang sama boleh diterbitkan ulang.
   *
   * KETERBATASAN PENTING: NIM tersimpan di dalam data yang terenkripsi
   * (bukan field on-chain biasa), jadi pengecekan ini hanya bisa membaca
   * sertifikat yang dienkripsi memakai RSA keypair YANG SAMA dengan
   * private key di browser ini. Sertifikat yang diterbitkan dari
   * browser/perangkat lain (dengan keypair institusi berbeda) akan
   * otomatis dilewati (gagal didekripsi), bukan dianggap "tidak ada".
   */
  const checkDuplicateNim = useCallback(
    async (nimToCheck, privateKeyPem) => {
      if (!contract || !nimToCheck) return { isDuplicate: false };
      try {
        const total = Number(await contract.getTotalCertificates());
        if (total === 0) return { isDuplicate: false };

        const cap = Math.min(total, 300);
        const indices = Array.from({ length: cap }, (_, i) => i);
        const certIds = await Promise.all(indices.map((i) => contract.getCertificateIdAt(i)));
        const certs = await Promise.all(certIds.map((id) => contract.getCertificate(id)));

        for (let i = 0; i < certs.length; i++) {
          const cert = certs[i];
          if (cert.isRevoked) continue; // sudah dicabut -> tidak dihitung duplikat

          try {
            const { ciphertext, encryptedKey } = JSON.parse(cert.encryptedData);
            const aesKey = decryptAESKeyWithRSA(encryptedKey, privateKeyPem);
            const decrypted = decryptAES(ciphertext, aesKey);
            if (decrypted && decrypted.nim === nimToCheck) {
              return { isDuplicate: true, certId: certIds[i], recipientName: cert.recipientName };
            }
          } catch {
            // Terenkripsi dengan keypair lain / format tidak cocok -> lewati
            continue;
          }
        }
        return { isDuplicate: false };
      } catch (err) {
        console.error("Gagal mengecek duplikasi NIM:", err);
        return { isDuplicate: false, checkFailed: true };
      }
    },
    [contract]
  );

  return {
    account,
    provider,
    signer,
    contract,
    chainId,
    isOwner,
    isIssuer,
    isConnecting,
    isConnected: Boolean(account),
    isCorrectNetwork,
    error,
    connectWallet,
    disconnectWallet,
    switchToSepolia,
    issueCertificateOnChain,
    verifyCertificateOnChain,
    revokeCertificateOnChain,
    fetchRecentEvents,
    getTransactionDetail,
    fetchIssuerHistory,
    addIssuerOnChain,
    removeIssuerOnChain,
    fetchIssuerList,
    checkDuplicateNim,
  };
}
