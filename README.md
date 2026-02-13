This is a Solana Escrow Program built with Anchor. It allows two parties (a Maker and a Taker) to trustlessly swap two different SPL tokens (Token A and Token B).

make (Create Offer):
Action: The Maker initializes an escrow.

Logic:
Deposits Token A into a vault (a Program Derived Address or PDA).


Creates an Escrow account storing the deal terms: "I deposited X amount of Token A, runs strictly if you give me Y amount of Token B."


take (Accept Offer):
Action: The Taker fulfills the escrow.

Logic:
Transfers Token B from the Taker to the Maker.
Transfers Token A from the vault to the Taker.

Closes the vault and escrow accounts, returning the rent (SOL) to the Maker, because the maker iniciated the escrow.


refund (Cancel Offer):
Action: The Maker cancels the escrow (if no one has taken it yet).
Logic:

Transfers Token A from the vault back to the Maker.
Closes the accounts and refunds rent to the Maker.

<img width="2880" height="1706" alt="image" src="https://github.com/user-attachments/assets/f708f37a-95d3-457e-8e82-3c7c23d3f0d9" />

Running: surfpool start

<img width="2880" height="1710" alt="image" src="https://github.com/user-attachments/assets/cb346c42-d718-4973-8bd9-e9eb250657cd" />
