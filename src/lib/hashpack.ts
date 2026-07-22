import { HashConnect, type SessionData } from "hashconnect";
import { LedgerId } from "@hashgraph/sdk";
import { network, ACTIVE_NETWORK, WALLETCONNECT_PROJECT_ID } from "../config";

const appMetadata = {
  name: "Memegraph",
  description:
    "Meme launchpad on Hedera — creators earn a network-enforced royalty on every transfer.",
  icons: ["https://memegraph-interface.vercel.app/favicon.svg"],
  url: "https://memegraph-interface.vercel.app",
};

let instance: HashConnect | null = null;
let initPromise: Promise<SessionData | null> | null = null;

/**
 * Throw away the current HashConnect instance and init state. Used after a
 * failed/timed-out connection attempt so the next try starts from scratch
 * instead of reusing a socket stuck in a retry loop (e.g. after the user
 * fixes a skewed system clock without reloading the page).
 */
export function resetHashConnect() {
  instance = null;
  initPromise = null;
}

export function getHashConnect(): HashConnect {
  if (!instance) {
    instance = new HashConnect(
      ACTIVE_NETWORK === "mainnet" ? LedgerId.MAINNET : LedgerId.TESTNET,
      WALLETCONNECT_PROJECT_ID,
      appMetadata,
      false
    );
  }
  return instance;
}

/**
 * Initialize once (StrictMode-safe). Resolves with an existing session if
 * HashPack was already paired in a previous visit, else null.
 */
export function initHashConnect(
  onPairing: (session: SessionData) => void,
  onDisconnect: () => void
): Promise<SessionData | null> {
  const hc = getHashConnect();
  if (!initPromise) {
    initPromise = new Promise((resolve) => {
      let resolved = false;
      hc.pairingEvent.on((session) => {
        onPairing(session);
        if (!resolved) {
          resolved = true;
          resolve(session);
        }
      });
      hc.disconnectionEvent.on(() => onDisconnect());
      hc.init()
        .then(() => {
          // Give a restored session a moment to emit; else report none.
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve(null);
            }
          }, 400);
        })
        .catch(() => {
          // Failed init must not poison future attempts.
          resetHashConnect();
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        });
    });
  } else {
    // Later callers still want fresh events routed to them.
    hc.pairingEvent.on((session) => onPairing(session));
    hc.disconnectionEvent.on(() => onDisconnect());
  }
  return initPromise;
}

/** Hedera account id (0.0.x) → EVM address, via mirror node. */
export async function accountEvmAddress(accountId: string): Promise<string> {
  const res = await fetch(`${network.mirrorNodeUrl}/accounts/${accountId}`);
  if (!res.ok) throw new Error(`mirror node ${res.status}`);
  const d = await res.json();
  return d.evm_address as string;
}
