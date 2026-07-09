import React from "react";

/**
 * Header tactical strip: brand, badge network (Sepolia), badge role,
 * status dot connected/disconnected (blink, bukan glow blur), dan
 * tombol connect/disconnect.
 */
export default function ConnectWallet({
  account,
  isConnecting,
  isConnected,
  isCorrectNetwork,
  isOwner,
  isIssuer,
  onConnect,
  onDisconnect,
  onSwitchNetwork,
}) {
  const truncateAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const roleLabel = isOwner ? "OWNER" : isIssuer ? "ISSUER" : "PUBLIC";

  return (
    <nav className="navbar-pill">
      <div className="navbar-brand">
        <span className="brand-icon">[#]</span>
        <span className="brand-text">CERTNOTARY</span>
      </div>

      <div className="navbar-status">
        {isConnected && (
          <span className={`network-badge ${isCorrectNetwork ? "network-ok" : "network-warn"}`}>
            <span className="status-dot" />
            {isCorrectNetwork ? "SEPOLIA" : "WRONG NET"}
          </span>
        )}

        {isConnected && <span className="role-badge">{roleLabel}</span>}

        {isConnected && !isCorrectNetwork && (
          <button className="btn-ghost-sm" onClick={onSwitchNetwork}>
            Switch Network
          </button>
        )}

        {isConnected ? (
          <button className="wallet-chip" onClick={onDisconnect} title="Klik untuk disconnect">
            <span className="status-dot connected" />
            {truncateAddress(account)}
          </button>
        ) : (
          <button className="btn-primary-glow" onClick={onConnect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
