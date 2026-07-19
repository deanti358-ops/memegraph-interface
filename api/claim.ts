/**
 * Memegraph claim endpoint (Vercel serverless).
 *
 * GET  /api/claim?hash=<sha256>  → { claimed, claim? }
 * POST /api/claim { hash, creator, name, symbol }
 *      → { topicId, sequenceNumber, memo } (rejects duplicate hashes)
 *
 * Claims are JSON messages on the public HCS topic — an immutable,
 * consensus-timestamped provenance record. The topic has a submit key
 * (spam control), so writes go through this function; reads are public
 * on any mirror node.
 */
import {
  Client,
  PrivateKey,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
// .trim(): env values entered via CLI pipes can carry stray CR/LF
const TOPIC_ID = (process.env.HCS_TOPIC_ID || "0.0.9638085").trim();

type Claim = {
  v: 1;
  hash: string;
  creator: string;
  name: string;
  symbol: string;
  ts: string;
};

async function findClaim(hash: string): Promise<(Claim & { seq: number }) | null> {
  let url = `${MIRROR}/topics/${TOPIC_ID}/messages?limit=100&order=asc`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`mirror ${res.status}`);
    const d = await res.json();
    for (const m of d.messages ?? []) {
      try {
        const claim = JSON.parse(
          Buffer.from(m.message, "base64").toString("utf8")
        ) as Claim;
        if (claim.hash === hash) {
          return { ...claim, seq: m.sequence_number };
        }
      } catch {
        /* non-JSON message; skip */
      }
    }
    url = d.links?.next ? `${MIRROR.replace("/api/v1", "")}${d.links.next}` : "";
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const hash = String(req.query.hash || "").toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) {
        return res.status(400).json({ error: "hash must be sha256 hex" });
      }
      const claim = await findClaim(hash);
      return res.status(200).json({ claimed: !!claim, claim });
    }

    if (req.method === "POST") {
      const { hash, creator, name, symbol } = req.body ?? {};
      if (!/^[0-9a-f]{64}$/.test(String(hash || "").toLowerCase())) {
        return res.status(400).json({ error: "hash must be sha256 hex" });
      }
      if (!creator || !name || !symbol) {
        return res.status(400).json({ error: "creator, name, symbol required" });
      }

      const existing = await findClaim(String(hash).toLowerCase());
      if (existing) {
        return res.status(409).json({
          error: "meme already claimed",
          claim: existing,
        });
      }

      const claim: Claim = {
        v: 1,
        hash: String(hash).toLowerCase(),
        creator: String(creator),
        name: String(name).slice(0, 100),
        symbol: String(symbol).slice(0, 20),
        ts: new Date().toISOString(),
      };

      const operatorId = (process.env.HCS_OPERATOR_ID || "").trim();
      const operatorKey = PrivateKey.fromStringECDSA(
        (process.env.HCS_OPERATOR_KEY || "").trim()
      );
      const client = Client.forTestnet().setOperator(operatorId, operatorKey);
      try {
        const tx = await new TopicMessageSubmitTransaction()
          .setTopicId(TOPIC_ID)
          .setMessage(JSON.stringify(claim))
          .execute(client);
        const receipt = await tx.getReceipt(client);
        const seq = receipt.topicSequenceNumber?.toNumber() ?? 0;
        return res.status(200).json({
          topicId: TOPIC_ID,
          sequenceNumber: seq,
          memo: `hcs:${TOPIC_ID}/${seq}`,
        });
      } finally {
        client.close();
      }
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String((e as Error).message ?? e) });
  }
}
