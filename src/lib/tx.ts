import { Contract, parseEther, MaxUint256, type Signer } from "ethers";
import {
  factoryRead,
  factoryWrite,
  poolWrite,
  tokenWrite,
  tokenRead,
  isAssociated,
} from "./memegraph";

/**
 * The trading interface. Backed by EthersAdapter, which signs EVM
 * transactions through whatever wallet Reown AppKit connected (MetaMask,
 * HashPack via WalletConnect, Rainbow, …).
 *
 * `onStep` lets pages surface progress ("confirm in wallet…").
 */
export interface TxAdapter {
  launchMeme(
    name: string,
    symbol: string,
    memo: string,
    valueHbar: string,
    onStep: (msg: string) => void
  ): Promise<void>;
  buy(
    token: string,
    pool: string,
    hbarAmount: string,
    minTokensOut: bigint,
    onStep: (msg: string) => void
  ): Promise<void>;
  sellWithApproval(
    token: string,
    pool: string,
    units: bigint,
    minHbarOut: bigint,
    ownerEvm: string,
    onStep: (msg: string) => void
  ): Promise<void>;
  distribute(token: string, onStep: (msg: string) => void): Promise<void>;
  claimCreator(token: string, onStep: (msg: string) => void): Promise<void>;
}

// ---------------------------------------------------------------------------
// EVM wallets (ethers)
// ---------------------------------------------------------------------------

export class EthersAdapter implements TxAdapter {
  private getSigner: () => Promise<Signer>;

  constructor(getSigner: () => Promise<Signer>) {
    this.getSigner = getSigner;
  }

  /**
   * Hedera accounts can't receive an HTS token they aren't associated with —
   * a pool buy would revert mid-transfer. EVM wallets associate through the
   * token's HIP-719 facade.
   */
  private async ensureAssociated(
    token: string,
    onStep: (msg: string) => void
  ) {
    const signer = await this.getSigner();
    const owner = await signer.getAddress();
    if (await isAssociated(owner, token)) return;
    onStep("One-time setup: confirm the token association in your wallet…");
    const facade = new Contract(token, ["function associate()"], signer);
    const tx = await facade.associate({ gasLimit: 1_000_000 });
    await tx.wait();
  }

  async launchMeme(
    name: string,
    symbol: string,
    memo: string,
    valueHbar: string,
    onStep: (msg: string) => void
  ) {
    const factory = factoryWrite(await this.getSigner());
    onStep("Confirm the launch in your wallet…");
    const tx = await factory.launchMeme(name, symbol, memo, {
      value: parseEther(valueHbar),
      gasLimit: 4_000_000,
    });
    onStep("Launching on Hedera…");
    await tx.wait();
    // Associate the creator with their token now, so royalty payouts and
    // curve buys can't revert on an unassociated account later.
    try {
      const meme = await factoryRead().getMeme(await factoryRead().memeCount());
      await this.ensureAssociated(meme.token, onStep);
    } catch {
      /* payouts will surface this later; not fatal to the launch */
    }
  }

  async buy(
    token: string,
    pool: string,
    hbarAmount: string,
    minTokensOut: bigint,
    onStep: (msg: string) => void
  ) {
    await this.ensureAssociated(token, onStep);
    const p = poolWrite(pool, await this.getSigner());
    onStep("Confirm the buy in your wallet…");
    const tx = await p.buy(minTokensOut, {
      value: parseEther(hbarAmount),
      gasLimit: 1_500_000,
    });
    onStep("Buying…");
    await tx.wait();
  }

  async sellWithApproval(
    token: string,
    pool: string,
    units: bigint,
    minHbarOut: bigint,
    ownerEvm: string,
    onStep: (msg: string) => void
  ) {
    const signer = await this.getSigner();
    const allowance: bigint = await tokenRead(token).allowance(ownerEvm, pool);
    if (allowance < units) {
      onStep("Approve the pool to spend your tokens…");
      const atx = await tokenWrite(token, signer).approve(pool, MaxUint256, {
        gasLimit: 1_000_000,
      });
      await atx.wait();
    }
    onStep("Confirm the sell in your wallet…");
    const tx = await poolWrite(pool, signer).sell(units, minHbarOut, {
      gasLimit: 1_500_000,
    });
    onStep("Selling…");
    await tx.wait();
  }

  async distribute(token: string, onStep: (msg: string) => void) {
    const factory = factoryWrite(await this.getSigner());
    onStep("Confirm the distribution in your wallet…");
    const tx = await factory.distributeRoyalties(token, {
      gasLimit: 1_500_000,
    });
    onStep("Distributing royalties…");
    await tx.wait();
  }

  async claimCreator(token: string, onStep: (msg: string) => void) {
    const factory = factoryWrite(await this.getSigner());
    onStep("Confirm the claim in your wallet…");
    const tx = await factory.claimCreatorRoyalties(token, {
      gasLimit: 1_500_000,
    });
    onStep("Claiming vested royalties…");
    await tx.wait();
  }
}
