use anchor_lang::prelude::*;
pub mod state;
pub mod instructions;
pub use instructions::*;
pub use state::*;


declare_id!("D9XqEpgF1FkB6qXA9mt99ck6WwmzPHA6coHbSPAN5Wgy");

#[program]
pub mod anchor_escrow_program {
    use super::*;

    pub fn make(ctx: Context<Make>, seed: u64, deposit: u64, receive: u64) -> Result<()> {
        ctx.accounts.init_escrow(seed, receive, &ctx.bumps)?;
        ctx.accounts.deposit(deposit)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        ctx.accounts.refund()
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
        ctx.accounts.take()
    }
}
