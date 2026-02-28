/**
 * Talevyn contract ABI — public-facing methods only.
 *
 * Excludes all onlyOwner, onlyPublisher, and publisher-gated methods.
 * Includes: read functions, public mint, ERC-1155 standard methods,
 * ERC-2981 royaltyInfo, and all contract events.
 */
export const TALEVYN_ABI = [
  // ──────────────────── Read functions ────────────────────

  // Collection metadata
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function contractURI() view returns (string)",
  "function paused() view returns (bool)",

  // Platform config (public state vars)
  "function ABSOLUTE_MAX_ROYALTY_BPS() view returns (uint16)",
  "function maxRoyaltyBps() view returns (uint16)",
  "function platformFeeBps() view returns (uint16)",
  "function platformFeeRecipient() view returns (address)",
  "function defaultMaxPerWallet() view returns (uint256)",

  // Publisher info
  "function publishers(address) view returns (bool)",
  "function getPublisherProfile(address _publisher) view returns (string metadataURI, uint40 registeredAt, bool hasProfile)",
  "function getPublisherTaleCount(address _publisher) view returns (uint256)",
  "function getTalesByPublisher(address _publisher, uint256 _offset, uint256 _limit) view returns (uint256[] taleIds, uint256 total)",
  "function getLatestTaleByPublisher(address _publisher) view returns (uint256 taleId, bool found)",
  "function getAllPublishers(uint256 _offset, uint256 _limit) view returns (tuple(address publisherAddress, string profileURI, bool isActive)[] publisherList, uint256 total)",

  // Tale info
  "function totalTales() view returns (uint256)",
  "function getLastTale() view returns (uint256 taleId, bool found)",
  "function getTale(uint256 _taleId) view returns (string metadataURI, address publisher, uint96 mintPrice, uint64 maxSupply, uint32 maxPerWallet, uint64 totalMinted, uint40 timestamp, bool active, uint16 royalty)",
  "function getPublisher(uint256 _taleId) view returns (address)",
  "function totalSupply(uint256 _id) view returns (uint64)",
  "function maxSupply(uint256 _id) view returns (uint64)",
  "function getMintPrice(uint256 _id, uint256 _amount) view returns (uint256)",
  "function uri(uint256 _tokenId) view returns (string)",
  "function mintedPerWallet(uint256 taleId, address wallet) view returns (uint256)",

  // ERC-1155 standard
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",

  // ERC-2981 royalty
  "function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)",

  // ──────────────────── Write functions ────────────────────

  // Public mint (anyone can call)
  "function mint(uint256 _id, uint256 _amount) payable",

  // ERC-1155 transfers (token holders)
  "function setApprovalForAll(address operator, bool approved)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
  "function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)",

  // ──────────────────── Events ────────────────────

  "event TalePublished(uint256 indexed taleId, address indexed publisher, string metadataURI, uint256 mintPrice, uint256 maxSupply, uint256 maxPerWallet)",
  "event TaleMinted(uint256 indexed taleId, address indexed minter, uint256 amount, uint256 totalPaid)",
  "event TaleUpdated(uint256 indexed taleId, address indexed publisher, string newMetadataURI)",
  "event TaleMintingToggled(uint256 indexed taleId, bool indexed active)",
  "event TaleMaxSupplyReached(uint256 indexed taleId)",
  "event TalePriceUpdated(uint256 indexed taleId, uint256 newPrice)",
  "event TaleMaxPerWalletUpdated(uint256 indexed taleId, uint256 maxPerWallet)",
  "event PublisherAdded(address indexed publisher)",
  "event PublisherRemoved(address indexed publisher)",
  "event PublisherProfileSet(address indexed publisher, string metadataURI)",
  "event PublisherProfileRemoved(address indexed publisher)",
] as const;

export const DEFAULT_CONTRACT_ADDRESS = "0x4aFC8EBaD95f7361C26493AD0Ef24b8deE20036d";
export const DEFAULT_RPC_URL = "https://base-rpc.publicnode.com";
export const BASE_CHAIN_ID = 8453;
