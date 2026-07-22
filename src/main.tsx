import { Buffer } from "buffer";
// WalletConnect internals (used by Reown AppKit) expect a global Buffer
if (!window.Buffer) window.Buffer = Buffer;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { WalletProvider } from "./lib/wallet";
import { initTheme } from "./lib/theme";

initTheme();

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <App />
      </WalletProvider>
    </BrowserRouter>
  </StrictMode>
);
