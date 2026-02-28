# openclaw-plugin-talevyn

[OpenClaw](https://openclaw.ai) plugin for the **Talevyn** NFT contract on Base. Lets your OpenClaw agent browse narrative tales, mint editions, check balances, transfer tokens, and monitor on-chain events.

- **Contract:** [`0x4aFC8EBaD95f7361C26493AD0Ef24b8deE20036d`](https://basescan.org/address/0x4aFC8EBaD95f7361C26493AD0Ef24b8deE20036d)
- **Network:** Base (Chain ID 8453)
- **Standard:** ERC-1155 with ERC-2981 royalties

## Install

```bash
openclaw plugins install thranborn/openclaw-plugin-talevyn
```

Or link a local clone:

```bash
git clone https://github.com/thranborn/openclaw-plugin-talevyn.git
cd openclaw-plugin-talevyn
npm install
openclaw plugins install -l .
```

## Configuration

All config is optional for read-only usage. A private key is only needed for minting and transfers.

Add to your `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "talevyn": {
        "enabled": true,
        "config": {
          "rpcUrl": "https://base-rpc.publicnode.com",
          "contractAddress": "0x4aFC8EBaD95f7361C26493AD0Ef24b8deE20036d",
          "privateKey": "0x..."
        }
      }
    }
  }
}
```

Environment variables are also supported:

| Variable | Description |
|---|---|
| `TALEVYN_RPC_URL` | Base RPC endpoint (default: `https://base-rpc.publicnode.com`) |
| `TALEVYN_CONTRACT_ADDRESS` | Contract address (default: the mainnet address above) |
| `TALEVYN_PRIVATE_KEY` | Wallet private key for write operations |

## Tools

### Read (no wallet needed)

| Tool | Description |
|---|---|
| `talevyn_get_contract_info` | Collection name, symbol, total tales, pause state, platform fees, royalty caps |
| `talevyn_browse_tales` | List recent tales or filter by publisher address, with pagination |
| `talevyn_get_tale` | Full details for a tale: metadata URI, price, supply, publisher, minting status |
| `talevyn_get_mint_price` | Calculate exact ETH cost to mint N editions of a tale |
| `talevyn_get_balance` | Check how many editions a wallet holds and remaining mint allowance |
| `talevyn_get_publishers` | List all publishers with profiles, active status, and tale counts |
| `talevyn_get_events` | Query on-chain events (TalePublished, TaleMinted, TaleUpdated, etc.) |

### Write (requires private key)

| Tool | Description |
|---|---|
| `talevyn_mint` | Mint editions of a tale. Pre-checks balance, pause state, and wallet limits. |
| `talevyn_transfer` | Transfer tale editions (ERC-1155 safeTransferFrom) to another address |

## Example conversations

**Browse what's available:**
> "What tales are on Talevyn?"

The agent calls `talevyn_browse_tales` and returns a summary of the latest published tales with prices and mint counts.

**Mint a tale:**
> "Mint 2 copies of tale 3"

The agent calls `talevyn_get_mint_price` to show the cost, then `talevyn_mint` to execute the transaction, returning a BaseScan link.

**Monitor activity:**
> "Have there been any new mints recently?"

The agent calls `talevyn_get_events` with `eventName: "TaleMinted"` and reports recent mint activity.

## Key concepts

- **Tale** — A narrative episode published as an NFT. Each tale has a unique ID (starting at 0).
- **Edition** — A copy of a tale. Multiple wallets can mint their own editions (like buying copies of a book).
- **Publisher** — A whitelisted address that creates tales and earns mint fees plus royalties.
- **Mint Price** — ETH cost per edition, set by the publisher. Can be 0 (free mint).
- **Wallet Limit** — Max editions one wallet can mint per tale. 0 means unlimited.
- **Max Supply** — Total edition cap per tale. 0 means unlimited. Minting auto-disables when reached.

## Running the tests

The test script exercises all read methods against the live Base contract:

```bash
node test-contract.mjs
```

Includes retry logic for RPC rate limiting. Expects 32 passing tests.

## License

MIT
