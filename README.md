# Memegraph Interface

Frontend for Memegraph — the meme launchpad on Hedera where creators earn a
network-enforced royalty on every transfer of their token, forever.

Vite + React + TypeScript. Deployed on Vercel.

## Stack decisions (planned)

- **Wallet**: HashPack via [hashconnect](https://github.com/Hashpack/hashconnect),
  with WalletConnect as fallback
- **Chain access**: ethers v6 against the Hedera JSON-RPC relay (Hashio) for
  contract calls; [Mirror Node REST API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api)
  for token balances, transfer history, and the creator-royalty leaderboard
- **Contracts**: [memegraph-contracts](https://github.com/deanti358-ops/memegraph-contracts)

## Pages (planned)

- `/` — live token board (new launches, top by volume)
- `/launch` — claim a meme + launch its token
- `/t/:tokenId` — trade panel (buy/sell on the pool), chart, royalty stats
- `/creators` — royalty leaderboard: what creators have actually been paid,
  straight from Mirror Node data (this doubles as the grant milestone dashboard)

## Develop

```bash
npm install
npm run dev
```

Contract addresses and network config live in `src/config.ts`.
