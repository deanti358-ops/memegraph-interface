/**
 * Memegraph claim endpoint (Vercel serverless).
 *
 * GET  /api/claim?hash=<sha256>
 *      → { claimed, claim?: { …, seq, consensusTs, readyAt, challenges } }
 * POST /api/claim { hash, creator, name, symbol }            — file a claim
 * POST /api/claim { kind:"challenge", hash, challenger, reason? } — dispute one
 *
 * Claims and challenges are JSON messages on a public HCS topic — an
 * immutable, consensus-timestamped provenance record. First claim wins,
 * but a token launch is only permitted after the challenge window
 * (CHALLENGE_WINDOW_SECONDS, default 10 minutes on testnet; 24h planned
 * for mainnet). Challenges filed during the window are surfaced to the
 * creator and the UI; dispute arbitration is manual in the MVP.
 */
import {
  Client,
  PrivateKey,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
// .trim(): env values entered via CLI pipes can carry stray CR/LF
const TOPIC_ID = (process.env.HCS_TOPIC_ID || "0.0.9638085").trim();
// 0 on testnet → launches proceed immediately after the claim is recorded on
// HCS (provenance is still sealed); a real window (e.g. 24h) is planned for
// mainnet via the CHALLENGE_WINDOW_SECONDS env var.
const WINDOW_SEC = Number(process.env.CHALLENGE_WINDOW_SECONDS || 0);

type Msg = {
  v: 1;
  kind?: "claim" | "challenge" | "image"; // legacy messages without kind are claims
  hash: string;
  creator?: string;
  challenger?: string;
  reason?: string;
  name?: string;
  symbol?: string;
  /** kind:"image" — base64 JPEG, ≤50k chars; SDK chunks it onto the topic */
  data?: string;
  ts: string;
};

type FoundClaim = Msg & {
  seq: number;
  consensusTs: number;
  readyAt: number;
  challenges: number;
  memo: string;
};

async function scanTopic(hash: string): Promise<FoundClaim | null> {
  let claim: FoundClaim | null = null;
  let challenges = 0;
  let url = `${MIRROR}/topics/${TOPIC_ID}/messages?limit=100&order=asc`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`mirror ${res.status}`);
    const d = await res.json();
    for (const m of d.messages ?? []) {
      try {
        const msg = JSON.parse(
          Buffer.from(m.message, "base64").toString("utf8")
        ) as Msg;
        if (msg.hash !== hash) continue;
        if (msg.kind === "image") continue;
        const isChallenge = msg.kind === "challenge";
        if (isChallenge) {
          challenges++;
        } else if (!claim) {
          const consensusTs = Number(
            String(m.consensus_timestamp).split(".")[0]
          );
          claim = {
            ...msg,
            seq: m.sequence_number,
            consensusTs,
            readyAt: consensusTs + WINDOW_SEC,
            challenges: 0,
            memo: `hcs:${TOPIC_ID}/${m.sequence_number}`,
          };
        }
      } catch {
        /* non-JSON message; skip */
      }
    }
    url = d.links?.next ? `${MIRROR.replace("/api/v1", "")}${d.links.next}` : "";
  }
  if (claim) claim.challenges = challenges;
  return claim;
}

async function submitMessage(payload: Msg): Promise<number> {
  const operatorId = (process.env.HCS_OPERATOR_ID || "").trim();
  const operatorKey = PrivateKey.fromStringECDSA(
    (process.env.HCS_OPERATOR_KEY || "").trim()
  );
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);
  try {
    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(TOPIC_ID)
      // 512px artwork payloads run ~50KB; the SDK default of 20 x 1KB
      // chunks would reject them.
      .setMaxChunks(60)
      .setMessage(JSON.stringify(payload))
      .execute(client);
    const receipt = await tx.getReceipt(client);
    return receipt.topicSequenceNumber?.toNumber() ?? 0;
  } finally {
    client.close();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const hash = String(req.query.hash || "").toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) {
        return res.status(400).json({ error: "hash must be sha256 hex" });
      }
      const claim = await scanTopic(hash);
      return res
        .status(200)
        .json({ claimed: !!claim, windowSec: WINDOW_SEC, claim });
    }

    if (req.method === "POST") {
      const body = req.body ?? {};
      const hash = String(body.hash || "").toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) {
        return res.status(400).json({ error: "hash must be sha256 hex" });
      }

      if (body.kind === "image") {
        const data = String(body.data || "");
        if (!data || data.length > 50_000) {
          return res.status(400).json({ error: "image data missing or too large" });
        }
        // The claim this image belongs to was usually submitted seconds ago,
        // and the mirror node lags consensus — retry before rejecting, or a
        // launch's artwork upload 404s and the token ships without its meme.
        let existing = await scanTopic(hash);
        for (let i = 0; !existing && i < 3; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          existing = await scanTopic(hash);
        }
        if (!existing) {
          return res.status(404).json({ error: "no claim for this hash" });
        }
        const seq = await submitMessage({
          v: 1,
          kind: "image",
          hash,
          data,
          ts: new Date().toISOString(),
        });
        return res.status(200).json({ topicId: TOPIC_ID, sequenceNumber: seq });
      }

      if (body.kind === "challenge") {
        if (!body.challenger) {
          return res.status(400).json({ error: "challenger required" });
        }
        const existing = await scanTopic(hash);
        if (!existing) {
          return res.status(404).json({ error: "no claim to challenge" });
        }
        const seq = await submitMessage({
          v: 1,
          kind: "challenge",
          hash,
          challenger: String(body.challenger),
          reason: String(body.reason ?? "").slice(0, 300),
          ts: new Date().toISOString(),
        });
        return res.status(200).json({ topicId: TOPIC_ID, sequenceNumber: seq });
      }

      const { creator, name, symbol } = body;
      if (!creator || !name || !symbol) {
        return res.status(400).json({ error: "creator, name, symbol required" });
      }
      const existing = await scanTopic(hash);
      if (existing) {
        return res
          .status(409)
          .json({ error: "meme already claimed", claim: existing });
      }

      const seq = await submitMessage({
        v: 1,
        kind: "claim",
        hash,
        creator: String(creator),
        name: String(name).slice(0, 100),
        symbol: String(symbol).slice(0, 20),
        ts: new Date().toISOString(),
      });
      const now = Math.floor(Date.now() / 1000);
      return res.status(200).json({
        topicId: TOPIC_ID,
        sequenceNumber: seq,
        memo: `hcs:${TOPIC_ID}/${seq}`,
        readyAt: now + WINDOW_SEC,
        windowSec: WINDOW_SEC,
      });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String((e as Error).message ?? e) });
  }
}
