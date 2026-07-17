import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import type { Provider } from "../lib/wallet";
import { DEMO } from "../lib/config";
import { DEMO_ACCOUNTS } from "../lib/demo";
import { shortAddr } from "../lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, User } from "lucide-react";
import { PlexaMark } from "./Logo";

const FreighterIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: "var(--accent)" }}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.8" />
    <ellipse cx="12" cy="12" rx="9" ry="3" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

const AlbedoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: "#7dd3fc" }}>
    <path d="M12 3V6M12 18V21M3 12H6M18 12H21M5.6 5.6L7.8 7.8M16.2 16.2L18.4 18.4M5.6 18.4L7.8 16.2M16.2 7.8L18.4 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
    <circle cx="12" cy="12" r="4" fill="currentColor" />
  </svg>
);

const WALLETS: { id: Provider; name: string; tag: string; icon: () => JSX.Element }[] = [
  { id: "freighter", name: "Freighter Wallet", tag: "Stellar Browser Extension", icon: FreighterIcon },
  { id: "albedo", name: "Albedo Link", tag: "Secure Web Wallet · No Install", icon: AlbedoIcon },
];

export function WalletModal() {
  const { pickerOpen, closePicker, connect, connectDemo, connecting, error } = useWallet();
  const navigate = useNavigate();

  async function choose(p: Provider) {
    const ok = await connect(p);
    if (ok) {
      closePicker();
      navigate("/app/groups");
    }
  }

  function chooseDemo(address: string) {
    const ok = connectDemo(address);
    if (ok) {
      closePicker();
      navigate("/app/groups");
    }
  }

  return (
    <AnimatePresence>
      {pickerOpen && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(3, 3, 4, 0.8)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "grid",
            placeItems: "center",
            padding: "20px"
          }}
          onClick={closePicker}
        >
          <motion.div
            className="modal glass"
            initial={{ scale: 0.94, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            style={{
              width: "100%",
              maxWidth: "440px",
              background: "rgba(10, 10, 12, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "24px",
              padding: "36px",
              boxShadow: "0 30px 80px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
              position: "relative",
              overflow: "hidden"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Soft Ambient Inner Glow */}
            <div
              style={{
                position: "absolute",
                top: "-40%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "300px",
                height: "200px",
                background: "radial-gradient(circle, rgba(52, 211, 153, 0.12) 0%, transparent 70%)",
                pointerEvents: "none",
                zIndex: 0
              }}
            />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="row between" style={{ marginBottom: "12px", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    className="plexa-logo"
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "9px",
                      background: "rgba(52, 211, 153, 0.1)",
                      border: "1px solid rgba(52, 211, 153, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <PlexaMark size={22} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
                    {DEMO ? "Choose Demo Profile" : "Connect Wallet"}
                  </h3>
                </div>
                <button
                  className="btn sm ghost"
                  onClick={closePicker}
                  style={{
                    width: "32px",
                    height: "32px",
                    padding: 0,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    background: "rgba(255, 255, 255, 0.02)"
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              <p className="muted" style={{ marginTop: 0, marginBottom: "28px", fontSize: "14.5px", lineHeight: "1.5" }}>
                {DEMO
                  ? "Select a simulated account to test deposits, voting, and payouts."
                  : "Connect your Stellar wallet to discover and join secure circles."}
              </p>

              {error && (
                <div
                  className="banner error"
                  style={{
                    borderRadius: "12px",
                    padding: "12px 16px",
                    marginBottom: "20px",
                    border: "1px solid rgba(248, 113, 113, 0.2)",
                    background: "rgba(248, 113, 113, 0.05)",
                    fontSize: "13.5px"
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "grid", gap: "12px" }}>
                {DEMO ? (
                  DEMO_ACCOUNTS.map((a, index) => (
                    <motion.button
                      key={a.address}
                      className="wallet-option"
                      disabled={connecting}
                      onClick={() => chooseDemo(a.address)}
                      whileHover={{ scale: 1.015, y: -2, backgroundColor: "rgba(255, 255, 255, 0.04)", borderColor: "rgba(52, 211, 153, 0.3)" }}
                      whileTap={{ scale: 0.99 }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        width: "100%",
                        padding: "16px",
                        borderRadius: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        background: "rgba(255, 255, 255, 0.02)",
                        color: "var(--text)",
                        font: "inherit",
                        cursor: "pointer",
                        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)"
                      }}
                    >
                      <span
                        className="wglyph"
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "10px",
                          background: "rgba(255, 255, 255, 0.04)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-dim)"
                        }}
                      >
                        <User size={18} />
                      </span>
                      <span style={{ textAlign: "left", flexGrow: 1 }}>
                        <b style={{ display: "block", fontSize: "15px", fontWeight: 600 }}>{a.name}</b>
                        <span className="faint" style={{ display: "block", fontSize: "12px", marginTop: "2px" }}>
                          {shortAddr(a.address)}
                        </span>
                      </span>
                      <ArrowRight size={16} className="faint" style={{ transition: "transform 0.2s ease" }} />
                    </motion.button>
                  ))
                ) : (
                  WALLETS.map((w, index) => {
                    const WalletIcon = w.icon;
                    return (
                      <motion.button
                        key={w.id}
                        className="wallet-option"
                        disabled={connecting}
                        onClick={() => choose(w.id)}
                        whileHover={{ scale: 1.015, y: -2, backgroundColor: "rgba(255, 255, 255, 0.04)", borderColor: "rgba(255, 255, 255, 0.15)" }}
                        whileTap={{ scale: 0.99 }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          width: "100%",
                          padding: "16px 20px",
                          borderRadius: "14px",
                          border: "1px solid rgba(255, 255, 255, 0.05)",
                          background: "rgba(255, 255, 255, 0.02)",
                          color: "var(--text)",
                          font: "inherit",
                          cursor: "pointer",
                          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)"
                        }}
                      >
                        <span
                          className="wglyph"
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "10px",
                            background: "rgba(255, 255, 255, 0.04)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <WalletIcon />
                        </span>
                        <span style={{ textAlign: "left", flexGrow: 1 }}>
                          <b style={{ display: "block", fontSize: "15px", fontWeight: 600 }}>{w.name}</b>
                          <span className="faint" style={{ display: "block", fontSize: "12px", marginTop: "2px" }}>
                            {w.tag}
                          </span>
                        </span>
                        {connecting ? (
                          <span className="faint">...</span>
                        ) : (
                          <ArrowRight size={16} className="faint" style={{ transition: "transform 0.2s ease" }} />
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
