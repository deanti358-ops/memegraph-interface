import { Contract, parseEther, MaxUint256, type Signer } from "ethers";
import {
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  TokenAssociateTransaction,
  TokenId,
  type Signer as HederaSigner,
} from "@hashgraph/sdk";
import BigNumber from "bignumber.js";
import { network } from "../config";
import {
  factoryRead,
  factoryWrite,
  poolWrite,
  tokenWrite,
  tokenRead,
  isAssociated,
  tokenEntityId,
} from "./memegraph";
import { getHashConnect } from "./hashpack";

/**
 * One trading interface, two signing backends:
 * - EthersAdapter: EVM wallets (MetaMask) via the JSON-RPC relay
 * - HashPackAdapter: native Hedera transactions signed through HashConnect
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

// ---------------------------------------------------------------------------
// HashPack (native Hedera transactions via HashConnect)
// ---------------------------------------------------------------------------

const UINT256_MAX = new BigNumber(2).pow(256).minus(1);

function contractId(evmAddress: string): ContractId {
  return ContractId.fromEvmAddress(0, 0, evmAddress);
}

function big(v: bigint): BigNumber {
  return new BigNumber(v.toString());
}

/** Strip 0x for ContractFunctionParameters.addAddress. */
function addr(evmAddress: string): string {
  return evmAddress.toLowerCase();
}

export class HashPackAdapter implements TxAdapter {
  private accountId: string;

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  private signer(): HederaSigner {
    return getHashConnect().getSigner(
      AccountId.fromString(this.accountId)
    ) as unknown as HederaSigner;
  }

  private async exec(
    tx: ContractExecuteTransaction,
    onStep: (msg: string) => void,
    confirmMsg: string,
    workingMsg: string
  ) {
    const signer = this.signer();
    onStep(confirmMsg);
    const frozen = await tx.freezeWithSigner(signer);
    const resp = await frozen.executeWithSigner(signer);
    onStep(workingMsg);
    await resp.getReceiptWithSigner(signer);
  }

  /** Associate via a native TokenAssociateTransaction if needed. */
  private async ensureAssociated(
    token: string,
    onStep: (msg: string) => void
  ) {
    if (await isAssociated(this.accountId, token)) return;
    onStep("One-time setup: approve the token association in HashPack…");
    const signer = this.signer();
    const tx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(this.accountId))
      .setTokenIds([TokenId.fromString(tokenEntityId(token))]);
    const frozen = await tx.freezeWithSigner(signer);
    const resp = await frozen.executeWithSigner(signer);
    await resp.getReceiptWithSigner(signer);
  }

  async launchMeme(
    name: string,
    symbol: string,
    memo: string,
    valueHbar: string,
    onStep: (msg: string) => void
  ) {
    const tx = new ContractExecuteTransaction()
      .setContractId(contractId(network.factoryAddress))
      .setGas(4_000_000)
      .setPayableAmount(Hbar.fromString(valueHbar))
      .setFunction(
        "launchMeme",
        new ContractFunctionParameters()
          .addString(name)
          .addString(symbol)
          .addString(memo)
      );
    await this.exec(tx, onStep, "Approve the launch in HashPack…", "Launching on Hedera…");
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
    const tx = new ContractExecuteTransaction()
      .setContractId(contractId(pool))
      .setGas(1_500_000)
      .setPayableAmount(Hbar.fromString(hbarAmount))
      .setFunction(
        "buy",
        new ContractFunctionParameters().addUint256(big(minTokensOut))
      );
    await this.exec(tx, onStep, "Approve the buy in HashPack…", "Buying…");
  }

  async sellWithApproval(
    token: string,
    pool: string,
    units: bigint,
    minHbarOut: bigint,
    ownerEvm: string,
    onStep: (msg: string) => void
  ) {
    const allowance: bigint = await tokenRead(token).allowance(ownerEvm, pool);
    if (allowance < units) {
      const approveTx = new ContractExecuteTransaction()
        .setContractId(contractId(token))
        .setGas(1_000_000)
        .setFunction(
          "approve",
          new ContractFunctionParameters()
            .addAddress(addr(pool))
            .addUint256(UINT256_MAX)
        );
      await this.exec(
        approveTx,
        onStep,
        "Approve the spending allowance in HashPack…",
        "Setting allowance…"
      );
    }
    const sellTx = new ContractExecuteTransaction()
      .setContractId(contractId(pool))
      .setGas(1_500_000)
      .setFunction(
        "sell",
        new ContractFunctionParameters()
          .addUint256(big(units))
          .addUint256(big(minHbarOut))
      );
    await this.exec(sellTx, onStep, "Approve the sell in HashPack…", "Selling…");
  }

  async distribute(token: string, onStep: (msg: string) => void) {
    const tx = new ContractExecuteTransaction()
      .setContractId(contractId(network.factoryAddress))
      .setGas(1_500_000)
      .setFunction(
        "distributeRoyalties",
        new ContractFunctionParameters().addAddress(addr(token))
      );
    await this.exec(
      tx,
      onStep,
      "Approve the distribution in HashPack…",
      "Distributing royalties…"
    );
  }

  async claimCreator(token: string, onStep: (msg: string) => void) {
    const tx = new ContractExecuteTransaction()
      .setContractId(contractId(network.factoryAddress))
      .setGas(1_500_000)
      .setFunction(
        "claimCreatorRoyalties",
        new ContractFunctionParameters().addAddress(addr(token))
      );
    await this.exec(
      tx,
      onStep,
      "Approve the claim in HashPack…",
      "Claiming vested royalties…"
    );
  }
}
