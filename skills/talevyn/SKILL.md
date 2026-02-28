---
name: talevyn
description: Interact with the Talevyn NFT collection on Base — browse narrative tale episodes, mint editions, check balances, transfer tokens, and monitor on-chain events.
metadata: {"openclaw":{"requires":{"config":["plugins.entries.talevyn.enabled"]}}}
---

# Talevyn — Narrative NFT Tales on Base

You have access to the **Talevyn** smart contract on the Base network. Talevyn is an ERC-1155 NFT collection where publishers create narrative tales (story episodes) and anyone can mint editions of those tales.

## Contract Details

- **Network:** Base (Chain ID 8453)
- **Contract:** `0x4aFC8EBaD95f7361C26493AD0Ef24b8deE20036d`
- **Standard:** ERC-1155 (multi-token, fungible editions)
- **View on BaseScan:** https://basescan.org/address/0x4aFC8EBaD95f7361C26493AD0Ef24b8deE20036d

## Available Tools

### Reading (no wallet needed)

- **`talevyn_get_contract_info`** — Get collection overview: name, symbol, total tales, pause state, fees, and your wallet balance.
- **`talevyn_browse_tales`** — Browse the latest tales or filter by publisher. Good starting point to discover what's available.
- **`talevyn_get_tale`** — Get full details for a specific tale: metadata URI, price, supply, publisher, status.
- **`talevyn_get_mint_price`** — Calculate the exact ETH cost to mint N editions before committing.
- **`talevyn_get_balance`** — Check how many editions of a tale a wallet holds and how many more can be minted.
- **`talevyn_get_publishers`** — List all publishers with profiles, active status, and tale counts.
- **`talevyn_get_events`** — Query on-chain events (new tales published, mints, price changes, etc.).

### Writing (requires configured wallet with ETH)

- **`talevyn_mint`** — Mint one or more editions of a tale. Automatically checks balance, pause state, and wallet limits before submitting.
- **`talevyn_transfer`** — Transfer tale editions to another wallet address.

## Typical Workflows

### Discover and mint a tale

1. Use `talevyn_browse_tales` to see what's available
2. Use `talevyn_get_tale` with the tale ID to read its metadata and check if minting is active
3. Use `talevyn_get_mint_price` to see the cost
4. Use `talevyn_mint` to mint the tale

### Check your collection

1. Use `talevyn_get_contract_info` to see your wallet and the collection overview
2. Use `talevyn_get_balance` with a specific tale ID to see your holdings

### Monitor activity

1. Use `talevyn_get_events` with `eventName: "TalePublished"` to see new episodes
2. Use `talevyn_get_events` with `eventName: "TaleMinted"` to see recent mints

## Key Concepts

- **Tale** — A narrative episode/story published as an NFT. Each tale has a unique ID (starting at 0).
- **Edition** — A copy/mint of a tale. Multiple people can mint their own edition of the same tale (like buying a copy of a book).
- **Publisher** — A whitelisted address that creates tales. Publishers earn mint fees and royalties.
- **Mint Price** — ETH cost per edition, set by the publisher. Some tales may be free (0 ETH).
- **Wallet Limit** — Maximum editions one wallet can mint of a tale. Prevents hoarding.
- **Max Supply** — Total edition cap for a tale. 0 means unlimited. Minting auto-disables when max is reached.

## Notes

- The metadata URI returned by `talevyn_get_tale` points to a JSON file (usually on IPFS) containing the tale's title, description, image, and story content.
- Mint transactions pay the publisher directly (minus a small platform fee). No ETH gets stuck in the contract.
- The contract automatically refunds excess ETH if you overpay or if the actual minted amount is less than requested.
- All write operations require a private key configured in the plugin config.
