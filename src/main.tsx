import { Buffer } from "buffer";
// hashconnect (WalletConnect internals) expects a global Buffer
if (!window.Buffer) window.Buffer = Buffer;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { WalletProvider } from "./lib/wallet";

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
