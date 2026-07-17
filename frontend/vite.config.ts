import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @stellar/stellar-sdk pulls in a few node-ish globals; Vite handles ESM fine,
// but we expose `global` for the buffer shim some transitive deps expect.
export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  server: {
    port: 5173,
  },
});
