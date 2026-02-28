/**
 * Standalone test script for the Talevyn plugin's contract interactions.
 * Tests all read methods against the live Base mainnet contract.
 * No OpenClaw or model provider needed — just ethers + Base RPC.
 *
 * Usage: node test-contract.mjs
 */

import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0x4aFC8EBaD95f7361C26493AD0Ef24b8deE20036d";
const RPC_URL = process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com";
const CHAIN_ID = 8453;

const ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function contractURI() view returns (string)",
  "function paused() view returns (bool)",
  "function ABSOLUTE_MAX_ROYALTY_BPS() view returns (uint16)",
  "function maxRoyaltyBps() view returns (uint16)",
  "function platformFeeBps() view returns (uint16)",
  "function platformFeeRecipient() view returns (address)",
  "function defaultMaxPerWallet() view returns (uint256)",
  "function publishers(address) view returns (bool)",
  "function getPublisherProfile(address _publisher) view returns (string metadataURI, uint40 registeredAt, bool hasProfile)",
  "function getPublisherTaleCount(address _publisher) view returns (uint256)",
  "function getTalesByPublisher(address _publisher, uint256 _offset, uint256 _limit) view returns (uint256[] taleIds, uint256 total)",
  "function getLatestTaleByPublisher(address _publisher) view returns (uint256 taleId, bool found)",
  "function getAllPublishers(uint256 _offset, uint256 _limit) view returns (tuple(address publisherAddress, string profileURI, bool isActive)[] publisherList, uint256 total)",
  "function totalTales() view returns (uint256)",
  "function getLastTale() view returns (uint256 taleId, bool found)",
  "function getTale(uint256 _taleId) view returns (string metadataURI, address publisher, uint96 mintPrice, uint64 maxSupply, uint32 maxPerWallet, uint64 totalMinted, uint40 timestamp, bool active, uint16 royalty)",
  "function getPublisher(uint256 _taleId) view returns (address)",
  "function totalSupply(uint256 _id) view returns (uint64)",
  "function maxSupply(uint256 _id) view returns (uint64)",
  "function getMintPrice(uint256 _id, uint256 _amount) view returns (uint256)",
  "function uri(uint256 _tokenId) view returns (string)",
  "function mintedPerWallet(uint256 taleId, address wallet) view returns (uint256)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)",
];

// ─── Test helpers ───────────────────────────────────────────────────────────

const DELAY_MS = 300; // delay between calls to avoid rate limiting
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;

let passed = 0;
let failed = 0;
const failures = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit =
        err.message?.includes("data=null") ||
        err.message?.includes("CALL_EXCEPTION") ||
        err.message?.includes("too many requests") ||
        err.message?.includes("rate limit") ||
        err.code === "SERVER_ERROR";
      if (isRateLimit && attempt < retries) {
        const backoff = RETRY_BACKOFF_MS * attempt;
        console.log(`        [retry ${attempt}/${retries}, waiting ${backoff}ms]`);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
}

async function test(name, fn) {
  await sleep(DELAY_MS);
  try {
    const result = await withRetry(fn);
    console.log(`  PASS  ${name}`);
    if (result !== undefined) {
      const display = typeof result === "object" ? JSON.stringify(result, replacer, 2) : String(result);
      // Indent multi-line results
      const lines = display.split("\n");
      if (lines.length > 1) {
        console.log(`        ${lines.join("\n        ")}`);
      } else {
        console.log(`        => ${display}`);
      }
    }
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function replacer(_key, value) {
  if (typeof value === "bigint") return value.toString();
  return value;
}

function formatEth(wei) {
  return ethers.formatEther(wei) + " ETH";
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(70));
  console.log("  Talevyn Plugin — Contract Integration Tests");
  console.log(`  Contract: ${CONTRACT_ADDRESS}`);
  console.log(`  RPC: ${RPC_URL} (Chain ID: ${CHAIN_ID})`);
  console.log("=".repeat(70));
  console.log();

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  // ── 1. Collection metadata ──────────────────────────────────────────────

  console.log("── Collection Metadata ──");

  await test("name()", async () => {
    const n = await contract.name();
    if (typeof n !== "string" || n.length === 0) throw new Error("Expected non-empty string");
    return n;
  });

  await test("symbol()", async () => {
    const s = await contract.symbol();
    if (typeof s !== "string" || s.length === 0) throw new Error("Expected non-empty string");
    return s;
  });

  await test("contractURI()", async () => {
    const uri = await contract.contractURI();
    return uri || "(empty)";
  });

  await test("paused()", async () => {
    const p = await contract.paused();
    if (typeof p !== "boolean") throw new Error("Expected boolean");
    return p;
  });

  console.log();

  // ── 2. Platform config ──────────────────────────────────────────────────

  console.log("── Platform Config ──");

  await test("ABSOLUTE_MAX_ROYALTY_BPS()", async () => {
    const v = await contract.ABSOLUTE_MAX_ROYALTY_BPS();
    return Number(v);
  });

  await test("maxRoyaltyBps()", async () => {
    const v = await contract.maxRoyaltyBps();
    return Number(v);
  });

  await test("platformFeeBps()", async () => {
    const v = await contract.platformFeeBps();
    return Number(v);
  });

  await test("platformFeeRecipient()", async () => {
    const addr = await contract.platformFeeRecipient();
    if (!ethers.isAddress(addr)) throw new Error("Invalid address");
    return addr;
  });

  await test("defaultMaxPerWallet()", async () => {
    const v = await contract.defaultMaxPerWallet();
    return v.toString();
  });

  console.log();

  // ── 3. Tales ────────────────────────────────────────────────────────────

  console.log("── Tales ──");

  let totalTalesNum = 0;

  await test("totalTales()", async () => {
    const t = await contract.totalTales();
    totalTalesNum = Number(t);
    if (totalTalesNum < 0) throw new Error("Negative total");
    return totalTalesNum;
  });

  await test("getLastTale()", async () => {
    const [id, found] = await contract.getLastTale();
    return { taleId: Number(id), found };
  });

  if (totalTalesNum > 0) {
    const testTaleId = 0; // First tale

    await test(`getTale(${testTaleId})`, async () => {
      const [metadataURI, publisher, mintPrice, maxSup, maxPerWallet, totalMinted, timestamp, active, royalty] =
        await contract.getTale(testTaleId);
      if (!ethers.isAddress(publisher)) throw new Error("Invalid publisher address");
      return {
        metadataURI: metadataURI.substring(0, 80) + (metadataURI.length > 80 ? "..." : ""),
        publisher,
        mintPrice: formatEth(mintPrice),
        maxSupply: maxSup.toString(),
        maxPerWallet: maxPerWallet.toString(),
        totalMinted: totalMinted.toString(),
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
        active,
        royaltyBps: Number(royalty),
      };
    });

    await test(`getPublisher(${testTaleId})`, async () => {
      const pub = await contract.getPublisher(testTaleId);
      if (!ethers.isAddress(pub)) throw new Error("Invalid address");
      return pub;
    });

    await test(`totalSupply(${testTaleId})`, async () => {
      const s = await contract.totalSupply(testTaleId);
      return s.toString();
    });

    await test(`maxSupply(${testTaleId})`, async () => {
      const s = await contract.maxSupply(testTaleId);
      return s.toString();
    });

    await test(`getMintPrice(${testTaleId}, 1)`, async () => {
      const p = await contract.getMintPrice(testTaleId, 1);
      return formatEth(p);
    });

    await test(`getMintPrice(${testTaleId}, 3)`, async () => {
      const p = await contract.getMintPrice(testTaleId, 3);
      return formatEth(p);
    });

    await test(`uri(${testTaleId})`, async () => {
      const u = await contract.uri(testTaleId);
      return u.substring(0, 100) + (u.length > 100 ? "..." : "");
    });

    await test(`mintedPerWallet(${testTaleId}, 0x0...0)`, async () => {
      const m = await contract.mintedPerWallet(testTaleId, ethers.ZeroAddress);
      return m.toString();
    });
  }

  console.log();

  // ── 4. Publisher info ───────────────────────────────────────────────────

  console.log("── Publishers ──");

  let publisherAddr = null;

  await test("getAllPublishers(0, 5)", async () => {
    const [list, total] = await contract.getAllPublishers(0, 5);
    const publishers = list.map((p) => ({
      address: p.publisherAddress,
      profileURI: p.profileURI || "(none)",
      isActive: p.isActive,
    }));
    if (publishers.length > 0) {
      publisherAddr = publishers[0].address;
    }
    return { publishers, total: total.toString() };
  });

  if (publisherAddr) {
    await test(`publishers(${publisherAddr.slice(0, 10)}...)`, async () => {
      const isPublisher = await contract.publishers(publisherAddr);
      if (typeof isPublisher !== "boolean") throw new Error("Expected boolean");
      return isPublisher;
    });

    await test(`getPublisherProfile(${publisherAddr.slice(0, 10)}...)`, async () => {
      const [metadataURI, registeredAt, hasProfile] = await contract.getPublisherProfile(publisherAddr);
      return {
        metadataURI: metadataURI || "(none)",
        registeredAt: new Date(Number(registeredAt) * 1000).toISOString(),
        hasProfile,
      };
    });

    await test(`getPublisherTaleCount(${publisherAddr.slice(0, 10)}...)`, async () => {
      const count = await contract.getPublisherTaleCount(publisherAddr);
      return Number(count);
    });

    await test(`getTalesByPublisher(${publisherAddr.slice(0, 10)}..., 0, 5)`, async () => {
      const [ids, total] = await contract.getTalesByPublisher(publisherAddr, 0, 5);
      return { taleIds: ids.map(Number), total: total.toString() };
    });

    await test(`getLatestTaleByPublisher(${publisherAddr.slice(0, 10)}...)`, async () => {
      const [id, found] = await contract.getLatestTaleByPublisher(publisherAddr);
      return { taleId: Number(id), found };
    });
  }

  console.log();

  // ── 5. ERC-1155 standard ────────────────────────────────────────────────

  console.log("── ERC-1155 Standard ──");

  await test("balanceOf(0x0...0, 0)", async () => {
    const b = await contract.balanceOf(ethers.ZeroAddress, 0);
    return b.toString();
  });

  if (totalTalesNum >= 2) {
    await test("balanceOfBatch([0x0, 0x0], [0, 1])", async () => {
      const b = await contract.balanceOfBatch([ethers.ZeroAddress, ethers.ZeroAddress], [0, 1]);
      return b.map((x) => x.toString());
    });
  }

  await test("isApprovedForAll(0x0, 0x0)", async () => {
    const approved = await contract.isApprovedForAll(ethers.ZeroAddress, ethers.ZeroAddress);
    return approved;
  });

  // ERC-165 interfaces
  await test("supportsInterface(ERC1155: 0xd9b67a26)", async () => {
    const s = await contract.supportsInterface("0xd9b67a26");
    if (s !== true) throw new Error("Should support ERC-1155");
    return s;
  });

  await test("supportsInterface(ERC2981: 0x2a55205a)", async () => {
    const s = await contract.supportsInterface("0x2a55205a");
    if (s !== true) throw new Error("Should support ERC-2981");
    return s;
  });

  await test("supportsInterface(ERC165: 0x01ffc9a7)", async () => {
    const s = await contract.supportsInterface("0x01ffc9a7");
    if (s !== true) throw new Error("Should support ERC-165");
    return s;
  });

  console.log();

  // ── 6. ERC-2981 royalty ─────────────────────────────────────────────────

  console.log("── ERC-2981 Royalty ──");

  if (totalTalesNum > 0) {
    await test("royaltyInfo(0, 1 ETH)", async () => {
      const salePrice = ethers.parseEther("1");
      const [receiver, amount] = await contract.royaltyInfo(0, salePrice);
      return {
        receiver,
        royaltyAmount: formatEth(amount),
        royaltyPercent: ((Number(amount) / Number(salePrice)) * 100).toFixed(2) + "%",
      };
    });
  }

  console.log();

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log("=".repeat(70));
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failures.length > 0) {
    console.log("\n  Failures:");
    for (const f of failures) {
      console.log(`    - ${f.name}: ${f.error}`);
    }
  }
  console.log("=".repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
