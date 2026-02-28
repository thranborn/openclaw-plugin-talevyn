/**
 * Talevyn OpenClaw Plugin
 *
 * Exposes all public-facing Talevyn contract methods as agent tools.
 * Restricted methods (onlyOwner, onlyPublisher, publisher-gated) are excluded.
 *
 * Tools registered:
 *   READ (anyone):
 *     talevyn_get_tale          — Get full details for a tale by ID
 *     talevyn_browse_tales      — List recent tales or tales by publisher
 *     talevyn_get_mint_price    — Calculate mint cost for N editions
 *     talevyn_get_balance       — Check how many editions a wallet holds
 *     talevyn_get_publishers    — List all publishers with profiles
 *     talevyn_get_contract_info — Collection name, symbol, pause state, fees
 *     talevyn_get_events        — Query recent contract events
 *
 *   WRITE (anyone with a wallet):
 *     talevyn_mint              — Mint editions of a published tale
 *     talevyn_transfer          — Transfer tale editions to another wallet
 */

import { ethers } from "ethers";
import { TALEVYN_ABI, DEFAULT_CONTRACT_ADDRESS, DEFAULT_RPC_URL, BASE_CHAIN_ID } from "./abi.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

interface PluginConfig {
  rpcUrl?: string;
  contractAddress?: string;
  privateKey?: string;
}

function getProvider(cfg: PluginConfig): ethers.JsonRpcProvider {
  const url = cfg.rpcUrl || DEFAULT_RPC_URL;
  return new ethers.JsonRpcProvider(url, BASE_CHAIN_ID);
}

function getReadContract(cfg: PluginConfig): ethers.Contract {
  const provider = getProvider(cfg);
  const address = cfg.contractAddress || DEFAULT_CONTRACT_ADDRESS;
  return new ethers.Contract(address, TALEVYN_ABI, provider);
}

function getWriteSigner(cfg: PluginConfig): ethers.Wallet {
  if (!cfg.privateKey) {
    throw new Error(
      "No private key configured. Set plugins.entries.talevyn.config.privateKey " +
      "or TALEVYN_PRIVATE_KEY environment variable to enable write operations (mint, transfer)."
    );
  }
  const provider = getProvider(cfg);
  return new ethers.Wallet(cfg.privateKey, provider);
}

function getWriteContract(cfg: PluginConfig): ethers.Contract {
  const signer = getWriteSigner(cfg);
  const address = cfg.contractAddress || DEFAULT_CONTRACT_ADDRESS;
  return new ethers.Contract(address, TALEVYN_ABI, signer);
}

function resolveConfig(api: any): PluginConfig {
  const entry = api.config?.plugins?.entries?.talevyn?.config ?? {};
  return {
    rpcUrl: entry.rpcUrl || process.env.TALEVYN_RPC_URL || DEFAULT_RPC_URL,
    contractAddress: entry.contractAddress || process.env.TALEVYN_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
    privateKey: entry.privateKey || process.env.TALEVYN_PRIVATE_KEY || undefined,
  };
}

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

function formatEth(wei: bigint): string {
  return ethers.formatEther(wei);
}

function formatTimestamp(ts: number | bigint): string {
  const d = new Date(Number(ts) * 1000);
  return d.toISOString();
}

// ─── Plugin entry ───────────────────────────────────────────────────────────

export default function register(api: any) {
  const cfg = resolveConfig(api);

  // ═══════════════════════════════════════════════════════════════════════════
  // READ TOOLS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── talevyn_get_tale ────────────────────────────────────────────────────
  api.registerTool({
    name: "talevyn_get_tale",
    description:
      "Get complete details for a Talevyn tale (narrative NFT episode) by its ID. " +
      "Returns metadata URI, publisher, mint price, supply info, and whether minting is active.",
    parameters: {
      type: "object",
      properties: {
        taleId: {
          type: "number",
          description: "The tale ID (0-indexed integer)",
        },
      },
      required: ["taleId"],
    },
    async execute(_id: string, params: { taleId: number }) {
      try {
        const contract = getReadContract(cfg);
        const [metadataURI, publisher, mintPrice, maxSup, maxPerWallet, totalMinted, timestamp, active, royalty] =
          await contract.getTale(params.taleId);

        const uri = await contract.uri(params.taleId);

        return text(JSON.stringify({
          taleId: params.taleId,
          metadataURI,
          publisher,
          mintPrice: formatEth(mintPrice) + " ETH",
          mintPriceWei: mintPrice.toString(),
          maxSupply: maxSup.toString() === "0" ? "unlimited" : maxSup.toString(),
          maxPerWallet: maxPerWallet.toString() === "0" ? "unlimited" : maxPerWallet.toString(),
          totalMinted: totalMinted.toString(),
          timestamp: formatTimestamp(timestamp),
          active,
          royaltyBps: Number(royalty),
          royaltyPercent: (Number(royalty) / 100).toFixed(2) + "%",
          tokenURI: uri,
        }, null, 2));
      } catch (e: any) {
        return text(`Error fetching tale ${params.taleId}: ${e.message}`);
      }
    },
  });

  // ── talevyn_browse_tales ───────────────────────────────────────────────
  api.registerTool({
    name: "talevyn_browse_tales",
    description:
      "Browse available Talevyn tales. Can list the most recent tales, " +
      "or filter by publisher address. Returns a summary of each tale.",
    parameters: {
      type: "object",
      properties: {
        publisher: {
          type: "string",
          description: "Optional: filter by publisher address. If omitted, shows the most recent tales.",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
        },
        limit: {
          type: "number",
          description: "Max tales to return (default: 10, max: 20)",
        },
      },
      required: [],
    },
    async execute(_id: string, params: { publisher?: string; offset?: number; limit?: number }) {
      try {
        const contract = getReadContract(cfg);
        const limit = Math.min(params.limit ?? 10, 20);
        const offset = params.offset ?? 0;

        let taleIds: bigint[] = [];
        let total: bigint;

        if (params.publisher) {
          const [ids, tot] = await contract.getTalesByPublisher(params.publisher, offset, limit);
          taleIds = ids;
          total = tot;
        } else {
          // Get total tales and list the most recent ones
          total = await contract.totalTales();
          const totalNum = Number(total);
          if (totalNum === 0) {
            return text(JSON.stringify({ tales: [], total: 0, message: "No tales published yet." }));
          }
          // Walk backwards from the latest tale
          const start = Math.max(0, totalNum - offset - limit);
          const end = Math.max(0, totalNum - offset);
          for (let i = end - 1; i >= start; i--) {
            taleIds.push(BigInt(i));
          }
        }

        const tales = [];
        for (const id of taleIds) {
          try {
            const [metadataURI, publisher, mintPrice, maxSup, _maxPerWallet, totalMinted, _timestamp, active] =
              await contract.getTale(id);
            tales.push({
              taleId: Number(id),
              metadataURI,
              publisher,
              mintPrice: formatEth(mintPrice) + " ETH",
              maxSupply: maxSup.toString() === "0" ? "unlimited" : maxSup.toString(),
              totalMinted: totalMinted.toString(),
              active,
            });
          } catch {
            // skip tales that fail to load
          }
        }

        return text(JSON.stringify({ tales, total: total.toString(), offset, limit }, null, 2));
      } catch (e: any) {
        return text(`Error browsing tales: ${e.message}`);
      }
    },
  });

  // ── talevyn_get_mint_price ─────────────────────────────────────────────
  api.registerTool({
    name: "talevyn_get_mint_price",
    description:
      "Calculate the total mint cost for a given number of editions of a tale. " +
      "Use this before minting to know how much ETH is needed.",
    parameters: {
      type: "object",
      properties: {
        taleId: {
          type: "number",
          description: "The tale ID",
        },
        amount: {
          type: "number",
          description: "Number of editions to mint (default: 1)",
        },
      },
      required: ["taleId"],
    },
    async execute(_id: string, params: { taleId: number; amount?: number }) {
      try {
        const contract = getReadContract(cfg);
        const amount = params.amount ?? 1;
        const totalPrice = await contract.getMintPrice(params.taleId, amount);

        // Also get tale info for context
        const [_meta, _pub, mintPrice, _maxSup, _maxPW, totalMinted, _ts, active] =
          await contract.getTale(params.taleId);

        return text(JSON.stringify({
          taleId: params.taleId,
          amount,
          pricePerEdition: formatEth(mintPrice) + " ETH",
          totalCost: formatEth(totalPrice) + " ETH",
          totalCostWei: totalPrice.toString(),
          mintingActive: active,
          alreadyMinted: totalMinted.toString(),
        }, null, 2));
      } catch (e: any) {
        return text(`Error getting mint price: ${e.message}`);
      }
    },
  });

  // ── talevyn_get_balance ────────────────────────────────────────────────
  api.registerTool({
    name: "talevyn_get_balance",
    description:
      "Check how many editions of a tale a wallet owns, plus minting stats. " +
      "If no wallet is provided, uses the configured plugin wallet.",
    parameters: {
      type: "object",
      properties: {
        taleId: {
          type: "number",
          description: "The tale ID",
        },
        wallet: {
          type: "string",
          description: "Wallet address to check (optional, defaults to the plugin wallet)",
        },
      },
      required: ["taleId"],
    },
    async execute(_id: string, params: { taleId: number; wallet?: string }) {
      try {
        const contract = getReadContract(cfg);
        let wallet = params.wallet;
        if (!wallet && cfg.privateKey) {
          wallet = new ethers.Wallet(cfg.privateKey).address;
        }
        if (!wallet) {
          return text("No wallet address provided and no private key configured.");
        }

        const [balance, minted] = await Promise.all([
          contract.balanceOf(wallet, params.taleId),
          contract.mintedPerWallet(params.taleId, wallet),
        ]);

        // Get tale info for wallet limit context
        const [_meta, _pub, _price, _maxSup, maxPerWallet, _totalMinted, _ts, active] =
          await contract.getTale(params.taleId);

        const walletLimitNum = Number(maxPerWallet);
        const mintedNum = Number(minted);

        return text(JSON.stringify({
          taleId: params.taleId,
          wallet,
          balance: balance.toString(),
          mintedByWallet: minted.toString(),
          walletLimit: walletLimitNum === 0 ? "unlimited" : walletLimitNum,
          canMintMore: active && (walletLimitNum === 0 || mintedNum < walletLimitNum),
          remainingMints: walletLimitNum === 0 ? "unlimited" : Math.max(0, walletLimitNum - mintedNum),
        }, null, 2));
      } catch (e: any) {
        return text(`Error checking balance: ${e.message}`);
      }
    },
  });

  // ── talevyn_get_publishers ─────────────────────────────────────────────
  api.registerTool({
    name: "talevyn_get_publishers",
    description:
      "List all Talevyn publishers with their profile info and active status. " +
      "Supports pagination for large publisher lists.",
    parameters: {
      type: "object",
      properties: {
        offset: {
          type: "number",
          description: "Pagination offset (default: 0)",
        },
        limit: {
          type: "number",
          description: "Max publishers to return (default: 20)",
        },
      },
      required: [],
    },
    async execute(_id: string, params: { offset?: number; limit?: number }) {
      try {
        const contract = getReadContract(cfg);
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 20;

        const [publisherList, total] = await contract.getAllPublishers(offset, limit);

        const publishers = publisherList.map((p: any) => ({
          address: p.publisherAddress,
          profileURI: p.profileURI || null,
          isActive: p.isActive,
        }));

        // Enrich with tale counts
        const enriched = [];
        for (const pub of publishers) {
          try {
            const count = await contract.getPublisherTaleCount(pub.address);
            enriched.push({ ...pub, taleCount: Number(count) });
          } catch {
            enriched.push({ ...pub, taleCount: "unknown" });
          }
        }

        return text(JSON.stringify({
          publishers: enriched,
          total: total.toString(),
          offset,
          limit,
        }, null, 2));
      } catch (e: any) {
        return text(`Error listing publishers: ${e.message}`);
      }
    },
  });

  // ── talevyn_get_contract_info ──────────────────────────────────────────
  api.registerTool({
    name: "talevyn_get_contract_info",
    description:
      "Get Talevyn collection info: name, symbol, total tales, pause state, " +
      "platform fees, royalty caps, and the contract address.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      try {
        const contract = getReadContract(cfg);
        const contractAddress = cfg.contractAddress || DEFAULT_CONTRACT_ADDRESS;

        const [name, symbol, totalTalesCount, isPaused, maxRoyalty, platformFee, feeRecipient, defaultMaxPW, contractUri] =
          await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.totalTales(),
            contract.paused(),
            contract.maxRoyaltyBps(),
            contract.platformFeeBps(),
            contract.platformFeeRecipient(),
            contract.defaultMaxPerWallet(),
            contract.contractURI(),
          ]);

        // Get the latest tale info if any exist
        let latestTale = null;
        if (Number(totalTalesCount) > 0) {
          const [lastId, found] = await contract.getLastTale();
          if (found) {
            const [metadataURI, publisher, mintPrice, _maxSup, _maxPW, _minted, _ts, active] =
              await contract.getTale(lastId);
            latestTale = {
              taleId: Number(lastId),
              metadataURI,
              publisher,
              mintPrice: formatEth(mintPrice) + " ETH",
              active,
            };
          }
        }

        // Check configured wallet balance if available
        let walletInfo = null;
        if (cfg.privateKey) {
          const signer = getWriteSigner(cfg);
          const balance = await getProvider(cfg).getBalance(signer.address);
          walletInfo = {
            address: signer.address,
            balance: formatEth(balance) + " ETH",
          };
        }

        return text(JSON.stringify({
          contractAddress,
          network: "Base (Chain ID 8453)",
          name,
          symbol,
          totalTales: totalTalesCount.toString(),
          paused: isPaused,
          maxRoyaltyBps: Number(maxRoyalty),
          maxRoyaltyPercent: (Number(maxRoyalty) / 100).toFixed(2) + "%",
          platformFeeBps: Number(platformFee),
          platformFeePercent: (Number(platformFee) / 100).toFixed(2) + "%",
          platformFeeRecipient: feeRecipient,
          defaultMaxPerWallet: defaultMaxPW.toString(),
          contractURI: contractUri || null,
          latestTale,
          configuredWallet: walletInfo,
        }, null, 2));
      } catch (e: any) {
        return text(`Error fetching contract info: ${e.message}`);
      }
    },
  });

  // ── talevyn_get_events ─────────────────────────────────────────────────
  api.registerTool({
    name: "talevyn_get_events",
    description:
      "Query recent Talevyn contract events (TalePublished, TaleMinted, etc.). " +
      "Useful for monitoring new episodes, mints, and publisher activity.",
    parameters: {
      type: "object",
      properties: {
        eventName: {
          type: "string",
          description:
            "Event to query. One of: TalePublished, TaleMinted, TaleUpdated, " +
            "TaleMintingToggled, TaleMaxSupplyReached, TalePriceUpdated, " +
            "PublisherAdded, PublisherRemoved, PublisherProfileSet. " +
            "Default: TaleMinted",
        },
        fromBlock: {
          type: "number",
          description: "Starting block number. Default: latest 5000 blocks (~2.8 hours on Base).",
        },
        taleId: {
          type: "number",
          description: "Optional: filter events by tale ID (only for tale-specific events)",
        },
      },
      required: [],
    },
    async execute(_id: string, params: { eventName?: string; fromBlock?: number; taleId?: number }) {
      try {
        const contract = getReadContract(cfg);
        const provider = getProvider(cfg);
        const eventName = params.eventName || "TaleMinted";

        const currentBlock = await provider.getBlockNumber();
        const fromBlock = params.fromBlock ?? Math.max(0, currentBlock - 5000);

        // Build filter based on event name
        let filter: ethers.DeferredTopicFilter;
        const taleIdArg = params.taleId !== undefined ? params.taleId : null;

        switch (eventName) {
          case "TalePublished":
            filter = contract.filters.TalePublished(taleIdArg);
            break;
          case "TaleMinted":
            filter = contract.filters.TaleMinted(taleIdArg);
            break;
          case "TaleUpdated":
            filter = contract.filters.TaleUpdated(taleIdArg);
            break;
          case "TaleMintingToggled":
            filter = contract.filters.TaleMintingToggled(taleIdArg);
            break;
          case "TaleMaxSupplyReached":
            filter = contract.filters.TaleMaxSupplyReached(taleIdArg);
            break;
          case "TalePriceUpdated":
            filter = contract.filters.TalePriceUpdated(taleIdArg);
            break;
          case "PublisherAdded":
            filter = contract.filters.PublisherAdded();
            break;
          case "PublisherRemoved":
            filter = contract.filters.PublisherRemoved();
            break;
          case "PublisherProfileSet":
            filter = contract.filters.PublisherProfileSet();
            break;
          default:
            return text(`Unknown event name: ${eventName}. Use one of: TalePublished, TaleMinted, TaleUpdated, TaleMintingToggled, TaleMaxSupplyReached, TalePriceUpdated, PublisherAdded, PublisherRemoved, PublisherProfileSet`);
        }

        const events = await contract.queryFilter(filter, fromBlock, currentBlock);

        const formatted = events.slice(-50).map((ev: any) => {
          const parsed: any = {
            event: eventName,
            blockNumber: ev.blockNumber,
            transactionHash: ev.transactionHash,
          };

          // Decode args based on event type
          if (ev.args) {
            switch (eventName) {
              case "TalePublished":
                parsed.taleId = Number(ev.args.taleId);
                parsed.publisher = ev.args.publisher;
                parsed.metadataURI = ev.args.metadataURI;
                parsed.mintPrice = formatEth(ev.args.mintPrice) + " ETH";
                parsed.maxSupply = ev.args.maxSupply.toString();
                parsed.maxPerWallet = ev.args.maxPerWallet.toString();
                break;
              case "TaleMinted":
                parsed.taleId = Number(ev.args.taleId);
                parsed.minter = ev.args.minter;
                parsed.amount = ev.args.amount.toString();
                parsed.totalPaid = formatEth(ev.args.totalPaid) + " ETH";
                break;
              case "TaleUpdated":
                parsed.taleId = Number(ev.args.taleId);
                parsed.publisher = ev.args.publisher;
                parsed.newMetadataURI = ev.args.newMetadataURI;
                break;
              case "TaleMintingToggled":
                parsed.taleId = Number(ev.args.taleId);
                parsed.active = ev.args.active;
                break;
              case "TaleMaxSupplyReached":
                parsed.taleId = Number(ev.args.taleId);
                break;
              case "TalePriceUpdated":
                parsed.taleId = Number(ev.args.taleId);
                parsed.newPrice = formatEth(ev.args.newPrice) + " ETH";
                break;
              case "PublisherAdded":
              case "PublisherRemoved":
                parsed.publisher = ev.args.publisher;
                break;
              case "PublisherProfileSet":
                parsed.publisher = ev.args.publisher;
                parsed.metadataURI = ev.args.metadataURI;
                break;
            }
          }
          return parsed;
        });

        return text(JSON.stringify({
          event: eventName,
          fromBlock,
          toBlock: currentBlock,
          count: formatted.length,
          totalFound: events.length,
          events: formatted,
        }, null, 2));
      } catch (e: any) {
        return text(`Error querying events: ${e.message}`);
      }
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WRITE TOOLS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── talevyn_mint ───────────────────────────────────────────────────────
  api.registerTool({
    name: "talevyn_mint",
    description:
      "Mint editions of a Talevyn tale (narrative NFT). Requires a configured wallet " +
      "with enough ETH to cover the mint price + gas. The contract will automatically " +
      "adjust the amount if supply or wallet limits are reached, and refund excess ETH.",
    parameters: {
      type: "object",
      properties: {
        taleId: {
          type: "number",
          description: "The tale ID to mint",
        },
        amount: {
          type: "number",
          description: "Number of editions to mint (default: 1)",
        },
      },
      required: ["taleId"],
    },
    async execute(_id: string, params: { taleId: number; amount?: number }) {
      try {
        const amount = params.amount ?? 1;
        const readContract = getReadContract(cfg);

        // Pre-flight checks
        const isPaused = await readContract.paused();
        if (isPaused) {
          return text("Minting is currently paused on the Talevyn contract.");
        }

        const [_meta, _pub, mintPrice, _maxSup, maxPerWallet, _totalMinted, _ts, active] =
          await readContract.getTale(params.taleId);

        if (!active) {
          return text(`Tale ${params.taleId} is not currently active for minting.`);
        }

        const totalCost = await readContract.getMintPrice(params.taleId, amount);

        // Check wallet balance
        const signer = getWriteSigner(cfg);
        const balance = await getProvider(cfg).getBalance(signer.address);

        if (balance < totalCost) {
          return text(JSON.stringify({
            error: "Insufficient ETH balance",
            required: formatEth(totalCost) + " ETH",
            available: formatEth(balance) + " ETH",
            wallet: signer.address,
          }, null, 2));
        }

        // Check wallet limit
        const alreadyMinted = await readContract.mintedPerWallet(params.taleId, signer.address);
        const walletLimitNum = Number(maxPerWallet);
        if (walletLimitNum > 0 && Number(alreadyMinted) >= walletLimitNum) {
          return text(JSON.stringify({
            error: "Wallet mint limit reached",
            walletLimit: walletLimitNum,
            alreadyMinted: alreadyMinted.toString(),
            wallet: signer.address,
          }, null, 2));
        }

        // Execute mint
        const writeContract = getWriteContract(cfg);
        const tx = await writeContract.mint(params.taleId, amount, { value: totalCost });

        const receipt = await tx.wait();

        // Parse TaleMinted event from receipt
        let mintedAmount = amount;
        let totalPaid = totalCost;
        if (receipt && receipt.logs) {
          for (const log of receipt.logs) {
            try {
              const parsed = writeContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
              if (parsed && parsed.name === "TaleMinted") {
                mintedAmount = Number(parsed.args.amount);
                totalPaid = parsed.args.totalPaid;
              }
            } catch {
              // Not a recognized event log, skip
            }
          }
        }

        return text(JSON.stringify({
          success: true,
          taleId: params.taleId,
          amountMinted: mintedAmount,
          totalPaid: formatEth(totalPaid) + " ETH",
          transactionHash: receipt?.hash || tx.hash,
          blockNumber: receipt?.blockNumber,
          wallet: signer.address,
          basescanUrl: `https://basescan.org/tx/${receipt?.hash || tx.hash}`,
        }, null, 2));
      } catch (e: any) {
        // Parse revert reasons
        let reason = e.message;
        if (e.reason) reason = e.reason;
        if (e.revert) reason = e.revert.name || e.revert;
        return text(`Mint failed: ${reason}`);
      }
    },
  });

  // ── talevyn_transfer ───────────────────────────────────────────────────
  api.registerTool({
    name: "talevyn_transfer",
    description:
      "Transfer tale editions (ERC-1155 tokens) from the configured wallet to another address. " +
      "Uses safeTransferFrom — the recipient must be able to receive ERC-1155 tokens.",
    parameters: {
      type: "object",
      properties: {
        taleId: {
          type: "number",
          description: "The tale ID to transfer",
        },
        to: {
          type: "string",
          description: "Recipient wallet address",
        },
        amount: {
          type: "number",
          description: "Number of editions to transfer (default: 1)",
        },
      },
      required: ["taleId", "to"],
    },
    async execute(_id: string, params: { taleId: number; to: string; amount?: number }) {
      try {
        const amount = params.amount ?? 1;
        const signer = getWriteSigner(cfg);
        const readContract = getReadContract(cfg);

        // Check balance
        const balance = await readContract.balanceOf(signer.address, params.taleId);
        if (Number(balance) < amount) {
          return text(JSON.stringify({
            error: "Insufficient token balance",
            available: balance.toString(),
            requested: amount,
            wallet: signer.address,
          }, null, 2));
        }

        const writeContract = getWriteContract(cfg);
        const tx = await writeContract.safeTransferFrom(
          signer.address,
          params.to,
          params.taleId,
          amount,
          "0x",
        );

        const receipt = await tx.wait();

        return text(JSON.stringify({
          success: true,
          taleId: params.taleId,
          from: signer.address,
          to: params.to,
          amount,
          transactionHash: receipt?.hash || tx.hash,
          blockNumber: receipt?.blockNumber,
          basescanUrl: `https://basescan.org/tx/${receipt?.hash || tx.hash}`,
        }, null, 2));
      } catch (e: any) {
        let reason = e.message;
        if (e.reason) reason = e.reason;
        return text(`Transfer failed: ${reason}`);
      }
    },
  });

  api.logger?.info("[talevyn] Plugin loaded — tools: talevyn_get_tale, talevyn_browse_tales, talevyn_get_mint_price, talevyn_get_balance, talevyn_get_publishers, talevyn_get_contract_info, talevyn_get_events, talevyn_mint, talevyn_transfer");
}
