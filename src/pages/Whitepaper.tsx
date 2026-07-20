import { network, CONTACT_EMAIL } from "../config";

/**
 * The Memegraph whitepaper, rendered in-app so it ships with the dapp and
 * always matches the deployed contracts.
 */
export default function Whitepaper() {
  return (
    <div className="whitepaper mx-auto max-w-3xl rounded-2xl border border-hairline bg-panel/50 p-6 backdrop-blur-xl sm:p-9">
      <h1>Memegraph Whitepaper</h1>
      <p className="muted">v1.0 · July 2026 · Hedera testnet</p>

      <section>
        <h2>Abstract</h2>
        <p>
          Every memecoin cycle produces the same injustice: the person who made
          the meme earns nothing while traders and deployers extract everything.
          Platforms that promise creator fees enforce them inside their own
          contracts — the moment trading moves elsewhere, the royalty dies.
          Memegraph fixes this at the protocol level. Each meme token is a
          native Hedera Token Service (HTS) token created with a{" "}
          <strong>fractional custom fee</strong>: 1% of{" "}
          <em>every transfer, anywhere, forever</em> is collected by the Hedera
          network itself and split 0.4% to the meme's creator, 0.4% to the
          protocol, and 0.2% back into the token's liquidity pool. No contract
          upgrade, exchange listing, or wallet-to-wallet transfer can bypass
          it, because the fee is assessed by consensus nodes on the transfer
          transaction itself.
        </p>
      </section>

      <section>
        <h2>1. The problem</h2>
        <p>
          Memecoin launchpads monetize attention that creators generate, but
          creators capture none of it. Contract-level royalty schemes fail for
          a structural reason: a launchpad only controls trades that route
          through its own contracts. After a token "graduates" to a DEX — the
          moment it succeeds — the launchpad's fee logic is out of the loop.
          On Ethereum or Solana, making a royalty follow the token requires a
          custom token standard that exchanges then refuse to list.
        </p>
      </section>

      <section>
        <h2>2. The mechanism: royalties as a property of the token</h2>
        <p>
          Hedera Token Service supports fractional custom fees on fungible
          tokens: a percentage of every transfer, routed to designated
          collector accounts by the network, with the fee schedule stored in
          the token entity itself. Memegraph tokens are created with:
        </p>
        <ul>
          <li>
            a single 1% fractional fee collected by the Memegraph factory
            contract;
          </li>
          <li>
            <strong>no keys of any kind</strong> — no admin key, no supply key,
            no pause key, no freeze key, and critically no fee-schedule key.
            The token, its finite supply, and its fee schedule are immutable
            from the moment of creation;
          </li>
          <li>
            the meme's provenance record (a Hedera Consensus Service claim,
            §5) sealed into the token's immutable memo field.
          </li>
        </ul>
        <p>
          The factory splits collected royalties permissionlessly:{" "}
          <strong>40%</strong> accrues to the creator under vesting (§4),{" "}
          <strong>40%</strong> to the protocol treasury, and <strong>20%</strong>{" "}
          is returned to the token's pool, deepening liquidity for everyone.
        </p>
      </section>

      <section>
        <h2>3. Markets: permanent pools, no graduation</h2>
        <p>
          Each token trades against HBAR on its own constant-product market
          (x·y=k) from the second it exists. The full billion-token supply is
          minted directly into the pool — the creator receives no
          pre-allocation and buys on the curve like everyone else. There is no
          graduation event, no LP token, and no function that can withdraw
          reserves: liquidity is locked by construction, permanently. A 1%
          trading fee on the HBAR side funds the protocol.
        </p>
      </section>

      <section>
        <h2>4. Creator vesting: aligning creators with their tokens</h2>
        <p>
          The creator's royalty share unlocks <strong>linearly over 90 days
          from launch</strong>. A creator who launches and disappears collects
          almost nothing; a creator whose meme keeps trading collects
          everything their token ever earned. Claims are permissionless —
          anyone can trigger a payout, which always goes to the creator on
          record — so payouts cannot be censored or forgotten.
        </p>
      </section>

      <section>
        <h2>5. Provenance: first claim wins, on the public record</h2>
        <p>
          Before launch, the meme image is hashed (SHA-256) and the claim —
          hash, creator account, token metadata — is submitted to a public
          Hedera Consensus Service topic, producing an immutable, timestamped
          record. The claim reference is sealed into the token's memo field at
          creation. Anyone can verify, forever, which account claimed which
          meme first.
        </p>
      </section>

      <section>
        <h2>6. Anti-rug properties</h2>
        <ul>
          <li>No creator pre-allocation — everyone buys on the same curve.</li>
          <li>Pool reserves can never be withdrawn; there is no LP token.</li>
          <li>
            Tokens carry no admin, supply, pause, freeze, wipe, or fee-schedule
            keys — nothing about them can ever be changed by anyone.
          </li>
          <li>Identical curve parameters for every launch; no special deals.</li>
          <li>Creator royalties vest over 90 days, punishing dump-and-run.</li>
          <li>
            Every number the interface shows is derived from public chain
            state and mirror-node data — nothing is self-reported.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Fees</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Fee</th>
              <th>Rate</th>
              <th>Applies to</th>
              <th>Goes to</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Network royalty</td>
              <td>1%</td>
              <td>Every transfer, anywhere</td>
              <td>0.4% creator (vesting) · 0.4% protocol · 0.2% pool</td>
            </tr>
            <tr>
              <td>Trading fee</td>
              <td>1%</td>
              <td>Pool buys and sells (HBAR side)</td>
              <td>Protocol treasury</td>
            </tr>
            <tr>
              <td>Launch</td>
              <td>~50 ℏ</td>
              <td>Token creation</td>
              <td>Pool seed (5 ℏ) + Hedera token-creation fee</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>8. Architecture</h2>
        <ul>
          <li>
            <strong>HTS</strong> — native token issuance with the immutable 1%
            fractional custom fee (the royalty engine).
          </li>
          <li>
            <strong>Smart Contract Service</strong> — MemegraphFactory
            (launches, royalty ledger, vesting) and one permanent MemePool per
            token.
          </li>
          <li>
            <strong>HCS</strong> — the public meme-claims topic (provenance).
          </li>
          <li>
            <strong>Mirror nodes</strong> — power the price charts, the market
            table, and the creator royalty dashboard.
          </li>
        </ul>
        <p className="mono small">
          Factory (testnet): {network.factoryAddress}
        </p>
      </section>

      <section>
        <h2>9. Status & roadmap</h2>
        <p>
          Live on Hedera testnet with the full loop validated on-chain: launch
          → trade → network-assessed royalties → distribution → vested creator
          claims. Roadmap: mainnet deployment, a challenge window and dispute
          process for contested meme claims, dormant-creator redirection at
          the distribution layer, and DEX listings for graduated communities —
          which the royalty survives by construction.
        </p>
      </section>

      <section>
        <h2>10. Risks & honest disclosures</h2>
        <ul>
          <li>
            Most memecoins go to zero. Nothing here changes that base rate —
            Memegraph changes who gets paid along the way.
          </li>
          <li>
            Royalties are paid in the meme token itself; their value depends
            on the token's market.
          </li>
          <li>
            The contracts are unaudited testnet software. Do not commit funds
            you cannot afford to lose.
          </li>
        </ul>
        <p>
          Contracts and interface are open source —{" "}
          <a
            href="https://github.com/deanti358-ops/memegraph-contracts"
            target="_blank"
            rel="noreferrer"
          >
            memegraph-contracts
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/deanti358-ops/memegraph-interface"
            target="_blank"
            rel="noreferrer"
          >
            memegraph-interface
          </a>
          . Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </section>
    </div>
  );
}
