// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertificateNotary
 * @notice Smart contract "notaris" untuk menerbitkan, memverifikasi, dan
 * mencabut ijazah/sertifikat secara terdesentralisasi di Ethereum.
 *
 * Alur kriptografi (dijelaskan lebih detail di README & utils/ frontend):
 * - Data asli ijazah dienkripsi AES-256 di sisi client SEBELUM dikirim ke
 *   sini. Kontrak ini hanya menyimpan ciphertext (encryptedData), bukan
 *   data asli. Privasi data tetap terjaga walau tersimpan di blockchain publik.
 * - Kunci AES dibungkus (di-wrap) dengan RSA public key institusi, sehingga
 *   hanya pemegang RSA private key yang bisa mendekripsi kembali data asli.
 * - dataHash adalah SHA-256 dari data ASLI (sebelum dienkripsi), disimpan
 *   dalam bentuk plain di blockchain agar integritas data bisa dicek tanpa
 *   perlu mendekripsi terlebih dahulu.
 */
contract CertificateNotary {
    struct Certificate {
        string encryptedData;   // Ciphertext AES + kunci AES yang sudah dibungkus RSA (JSON string)
        bytes32 dataHash;       // SHA-256 dari data asli, untuk cek integritas
        address issuedBy;       // Wallet issuer yang menerbitkan
        uint256 issuedAt;       // Timestamp blok saat diterbitkan
        bool isRevoked;         // Status pencabutan
        string recipientName;   // Nama penerima (disimpan plain hanya untuk keperluan display ringkas)
        bool exists;            // Flag untuk membedakan "belum pernah diisi" vs "memang kosong"
    }

    address public owner;

    // certId (bytes32) => data sertifikat
    mapping(bytes32 => Certificate) private certificates;

    // alamat wallet => apakah berstatus Authorized Issuer
    mapping(address => bool) public authorizedIssuers;

    // Menyimpan urutan certId yang pernah diterbitkan, untuk keperluan listing/statistik
    bytes32[] private certificateIds;

    event CertificateIssued(
        bytes32 indexed certId,
        address indexed issuedBy,
        string recipientName,
        uint256 issuedAt
    );
    event CertificateRevoked(bytes32 indexed certId, address indexed revokedBy, uint256 revokedAt);
    event IssuerAdded(address indexed issuer, address indexed addedBy);
    event IssuerRemoved(address indexed issuer, address indexed removedBy);

    modifier onlyOwner() {
        require(msg.sender == owner, "CertificateNotary: caller is not the owner");
        _;
    }

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "CertificateNotary: caller is not an authorized issuer");
        _;
    }

    /// @dev Deployer otomatis menjadi owner sekaligus issuer pertama (institusi utama).
    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerAdded(msg.sender, msg.sender);
    }

    /// @notice Menambahkan wallet baru sebagai Authorized Issuer. Hanya owner yang bisa melakukan ini.
    function addIssuer(address _issuer) external onlyOwner {
        require(_issuer != address(0), "CertificateNotary: invalid address");
        authorizedIssuers[_issuer] = true;
        emit IssuerAdded(_issuer, msg.sender);
    }

    /// @notice Mencabut status Authorized Issuer dari sebuah wallet. Hanya owner.
    function removeIssuer(address _issuer) external onlyOwner {
        authorizedIssuers[_issuer] = false;
        emit IssuerRemoved(_issuer, msg.sender);
    }

    /**
     * @notice Menerbitkan sertifikat baru ke blockchain.
     * @param _certId ID unik sertifikat (bytes32), idealnya hasil hash dari data unik (NIM + nama + timestamp).
     * @param _encryptedData Ciphertext AES + AES key yang sudah dienkripsi RSA, dalam format JSON string.
     * @param _dataHash SHA-256 dari data asli (sebelum enkripsi), untuk verifikasi integritas.
     * @param _recipientName Nama penerima, disimpan plain agar bisa ditampilkan tanpa dekripsi.
     */
    function issueCertificate(
        bytes32 _certId,
        string calldata _encryptedData,
        bytes32 _dataHash,
        string calldata _recipientName
    ) external onlyIssuer {
        require(!certificates[_certId].exists, "CertificateNotary: certificate ID already exists");

        certificates[_certId] = Certificate({
            encryptedData: _encryptedData,
            dataHash: _dataHash,
            issuedBy: msg.sender,
            issuedAt: block.timestamp,
            isRevoked: false,
            recipientName: _recipientName,
            exists: true
        });

        certificateIds.push(_certId);

        emit CertificateIssued(_certId, msg.sender, _recipientName, block.timestamp);
    }

    /// @notice Mencabut (revoke) sebuah sertifikat. Hanya bisa dilakukan oleh Authorized Issuer.
    function revokeCertificate(bytes32 _certId) external onlyIssuer {
        require(certificates[_certId].exists, "CertificateNotary: certificate does not exist");
        require(!certificates[_certId].isRevoked, "CertificateNotary: certificate already revoked");

        certificates[_certId].isRevoked = true;

        emit CertificateRevoked(_certId, msg.sender, block.timestamp);
    }

    /// @notice Mengambil seluruh detail sertifikat berdasarkan certId.
    function getCertificate(bytes32 _certId)
        external
        view
        returns (
            string memory encryptedData,
            bytes32 dataHash,
            address issuedBy,
            uint256 issuedAt,
            bool isRevoked,
            string memory recipientName,
            bool exists
        )
    {
        Certificate memory cert = certificates[_certId];
        return (
            cert.encryptedData,
            cert.dataHash,
            cert.issuedBy,
            cert.issuedAt,
            cert.isRevoked,
            cert.recipientName,
            cert.exists
        );
    }

    /// @notice Verifikasi cepat status sertifikat tanpa perlu menarik seluruh data. Bisa dipanggil siapa saja, gratis (view).
    function verifyCertificate(bytes32 _certId)
        external
        view
        returns (bool isValid, bool exists, bool isRevoked)
    {
        Certificate memory cert = certificates[_certId];
        return (cert.exists && !cert.isRevoked, cert.exists, cert.isRevoked);
    }

    /// @notice Mengecek apakah sebuah alamat adalah Authorized Issuer.
    function isAuthorizedIssuer(address _addr) external view returns (bool) {
        return authorizedIssuers[_addr];
    }

    /// @notice Jumlah total sertifikat yang pernah diterbitkan (termasuk yang sudah direvoke).
    function getTotalCertificates() external view returns (uint256) {
        return certificateIds.length;
    }

    /// @notice Mengambil certId berdasarkan index urutan penerbitan, untuk keperluan listing/paginasi di frontend.
    function getCertificateIdAt(uint256 _index) external view returns (bytes32) {
        require(_index < certificateIds.length, "CertificateNotary: index out of bounds");
        return certificateIds[_index];
    }
}
