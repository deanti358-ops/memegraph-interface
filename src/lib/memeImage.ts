import { network } from "../config";

/**
 * Meme images live ON HEDERA: a downscaled JPEG is written to the public
 * HCS topic (SDK-chunked into ≤1KB consensus messages) next to the claim.
 * This module reads them back from the mirror node — reassembling chunked
 * messages — and hands out data URIs. No image servers, no IPFS.
 */

const TOPIC_ID = "0.0.9638085";

/** Downscale + compress a meme to fit comfortably in chunked HCS messages. */
export async function downscaleToB64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 128;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);

  for (let q = 0.85; q >= 0.3; q -= 0.15) {
    const dataUrl = canvas.toDataURL("image/jpeg", q);
    const b64 = dataUrl.split(",")[1];
    if (b64.length <= 14_000) return b64;
  }
  return canvas.toDataURL("image/jpeg", 0.25).split(",")[1].slice(0, 14_000);
}

type MirrorMessage = {
  message: string; // base64 chunk
  sequence_number: number;
  chunk_info?: {
    initial_transaction_id: { account_id: string; transaction_valid_start: string };
    number: number;
    total: number;
  } | null;
};

let topicCache: { seqToHash: Map<number, string>; hashToImage: Map<string, string> } | null = null;
let topicCacheAt = 0;

/**
 * One pass over the whole claims topic: reassembles chunked messages,
 * indexes claim hashes by sequence number and images by hash.
 */
async function loadTopic() {
  if (topicCache && Date.now() - topicCacheAt < 60_000) return topicCache;

  const seqToHash = new Map<number, string>();
  const hashToImage = new Map<string, string>();
  const groups = new Map<string, MirrorMessage[]>();
  const singles: MirrorMessage[] = [];

  let url = `${network.mirrorNodeUrl}/topics/${TOPIC_ID}/messages?limit=100&order=asc`;
  for (let page = 0; url && page < 40; page++) {
    const res = await fetch(url);
    if (!res.ok) break;
    const d = await res.json();
    for (const m of (d.messages ?? []) as MirrorMessage[]) {
      if (m.chunk_info && m.chunk_info.total > 1) {
        const k = `${m.chunk_info.initial_transaction_id.account_id}-${m.chunk_info.initial_transaction_id.transaction_valid_start}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(m);
      } else {
        singles.push(m);
      }
    }
    url = d.links?.next
      ? `${network.mirrorNodeUrl.replace("/api/v1", "")}${d.links.next}`
      : "";
  }

  const decode = (b64: string) => {
    try {
      return atob(b64);
    } catch {
      return "";
    }
  };

  for (const m of singles) {
    try {
      const msg = JSON.parse(decode(m.message));
      if (msg.hash && msg.kind !== "challenge" && msg.kind !== "image") {
        seqToHash.set(m.sequence_number, String(msg.hash));
      }
      if (msg.kind === "image" && msg.hash && msg.data) {
        hashToImage.set(String(msg.hash), `data:image/jpeg;base64,${msg.data}`);
      }
    } catch {
      /* not JSON */
    }
  }

  for (const chunks of groups.values()) {
    chunks.sort((a, b) => a.chunk_info!.number - b.chunk_info!.number);
    try {
      const joined = chunks.map((c) => decode(c.message)).join("");
      const msg = JSON.parse(joined);
      if (msg.kind === "image" && msg.hash && msg.data) {
        hashToImage.set(String(msg.hash), `data:image/jpeg;base64,${msg.data}`);
      }
    } catch {
      /* incomplete group */
    }
  }

  topicCache = { seqToHash, hashToImage };
  topicCacheAt = Date.now();
  return topicCache;
}

/** memeMemo ("hcs:0.0.x/seq") → on-chain image data URI, or null. */
export async function memeImageFromMemo(memeMemo: string): Promise<string | null> {
  if (!memeMemo?.startsWith("hcs:")) return null;
  const seq = Number(memeMemo.split("/")[1]);
  if (!seq) return null;
  const { seqToHash, hashToImage } = await loadTopic();
  const hash = seqToHash.get(seq);
  return (hash && hashToImage.get(hash)) || null;
}

/** Does this claim hash already have an image on the topic? */
export async function hashHasImage(hash: string): Promise<boolean> {
  const { hashToImage } = await loadTopic();
  return hashToImage.has(hash);
}

export function invalidateTopicCache() {
  topicCache = null;
}
