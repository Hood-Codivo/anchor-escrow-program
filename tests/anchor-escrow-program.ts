import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { AnchorEscrowProgram } from "../target/types/anchor_escrow_program";
import { expect } from "chai";
import { PublicKey, ConfirmOptions, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAccount,
} from "@solana/spl-token";
import { Connection } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";


const confirmOpts: ConfirmOptions = {
  commitment: "confirmed",
}

describe("anchor-escrow-program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .AnchorEscrowProgram as Program<AnchorEscrowProgram>;

  const connection = provider.connection;

  const maker = anchor.web3.Keypair.generate();
  const taker = anchor.web3.Keypair.generate();

  let mintA: PublicKey;
  let mintB: PublicKey;
  let makerAtaA: PublicKey;
  let takerAtaB: PublicKey;
  let makerAtaB: PublicKey;
  let takerAtaA: PublicKey;

  const seed = new anchor.BN(1);

  const depositAmount = new BN(10_000_000);
  const receiveAmount = new BN(50_000_000);
  const decimals = 6;

  async function airdrop(to: PublicKey, amount: number) {
    const lastestBlockhash = await connection.getLatestBlockhash();
    const sig = await connection.requestAirdrop(to, amount);
    await connection.confirmTransaction(
      { signature: sig, ...lastestBlockhash },
      "confirmed"
    )
  }

  function getEscrowPda(makerKey: PublicKey, escrowSeed: BN): PublicKey {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        makerKey.toBuffer(),
        escrowSeed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    )[0];
  }

function getVaultAta(escrow: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, escrow, true)
}

before(async () => {
  await airdrop(maker.publicKey, 10 * LAMPORTS_PER_SOL)
  await airdrop(taker.publicKey, 10 * LAMPORTS_PER_SOL)

  mintA = await createMint(
    connection,
    maker,
    maker.publicKey,
    null,
    decimals,
    undefined,
    confirmOpts,

  );

  mintB = await createMint(
    connection,
    maker,
    maker.publicKey,
    null,
    decimals,
    undefined,
    confirmOpts,

  );

  makerAtaA = await createAssociatedTokenAccount(
    connection,
    maker,
    mintA,
    maker.publicKey,
    confirmOpts,
    
  );

  takerAtaB = await createAssociatedTokenAccount(
    connection,
    taker,
    mintB,
    taker.publicKey,
    confirmOpts,
    
  );

 
  takerAtaA = await createAssociatedTokenAccount(
    connection,
    taker,
    mintA,
    taker.publicKey,
    confirmOpts,
    
  );

   makerAtaB = await createAssociatedTokenAccount(
    connection,
    maker,
    mintB,
    maker.publicKey,
    confirmOpts,
    
  );

  await mintTo(
    connection,
    maker,
    mintA,
    makerAtaA,
    maker,
    100_000_000,
    undefined,
    confirmOpts,
  );

  await mintTo(
    connection, 
    maker,
    mintB,
    makerAtaB,
    maker,
    100_000_000,
    undefined,
    confirmOpts,
  );


});

it("make", async () => {
  const escrow = getEscrowPda(maker.publicKey, seed);
  const vault = getVaultAta(escrow, mintA);

  await program.methods.make(seed, depositAmount, receiveAmount)
    .accountsPartial({
      maker: maker.publicKey,
      mintA,
      mintB,
      makerAtaA,
      escrow,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([maker])
    .rpc(confirmOpts);

    const escrowAccount = await program.account.escrow.fetch(escrow);
    expect(escrowAccount.seeds.toNumber()).to.equal(seed.toNumber());
    expect(escrowAccount.maker.toBase58()).to.equal(maker.publicKey.toBase58());
    expect(escrowAccount.mintA.toBase58()).to.equal(mintA.toBase58());
    expect(escrowAccount.mintB.toBase58()).to.equal(mintB.toBase58());
    expect(escrowAccount.receive.toNumber()).to.equal(receiveAmount.toNumber());
  

    const vaultAccount = await getAccount(connection, vault);

    expect(Number(vaultAccount.amount)).to.equal(depositAmount.toNumber());
      

    


});


it("take", async () => {
  const escrow = getEscrowPda(maker.publicKey, seed);
  const vault = getVaultAta(escrow, mintA);

  // Mint B tokens to taker so they can pay maker
  await mintTo(
    connection,
    maker,
    mintB,
    takerAtaB,
    maker,
    receiveAmount.toNumber(),
    undefined,
    confirmOpts
  );

  await program.methods.take()
    .accountsPartial({
      taker: taker.publicKey,
      maker: maker.publicKey,
      mintA,
      mintB,
      takerAtaB,
      makerAtaB,
      takerAtaA,
      escrow,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([taker])
    .rpc(confirmOpts);

  // ✅ Escrow account should be closed
  const escrowAccount = await connection.getAccountInfo(escrow);
  expect(escrowAccount).to.be.null;

  // ✅ Maker should receive B tokens
  const makerBAccount = await getAccount(connection, makerAtaB);
  expect(Number(makerBAccount.amount)).to.equal(
    100_000_000 + receiveAmount.toNumber()
  );

  // ✅ Vault should be closed
  const vaultAccount = await connection.getAccountInfo(vault);
  expect(vaultAccount).to.be.null;
});


describe("refund", () => {
  let refundSeed = new BN(999);
  let escrow: PublicKey;
  let vault: PublicKey;

  before(async () => {
    escrow = getEscrowPda(maker.publicKey, refundSeed);
    vault = getVaultAta(escrow, mintA);

    await program.methods.make(refundSeed, depositAmount, receiveAmount)
      .accountsPartial({
        maker: maker.publicKey,
        mintA,
        mintB,
        makerAtaA,
        escrow,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc(confirmOpts);
  });

  it("refunds maker and closes escrow", async () => {

    const makerBalanceBefore = await getAccount(connection, makerAtaA);

    await program.methods.refund()
      .accountsPartial({
        maker: maker.publicKey,
        mintA,
        makerAtaA,
        escrow,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([maker])
      .rpc(confirmOpts);

    // ✅ Escrow closed
    const escrowAccount = await connection.getAccountInfo(escrow);
    expect(escrowAccount).to.be.null;

    // ✅ Vault closed
    const vaultAccount = await connection.getAccountInfo(vault);
    expect(vaultAccount).to.be.null;

    // ✅ Maker got tokens back
    const makerBalanceAfter = await getAccount(connection, makerAtaA);

    expect(Number(makerBalanceAfter.amount)).to.equal(
      Number(makerBalanceBefore.amount) + depositAmount.toNumber()
    );
  });
});


})




