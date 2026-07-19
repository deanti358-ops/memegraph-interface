export const FACTORY_ABI = [
  "function memeCount() view returns (uint256)",
  "function getMeme(uint256 memeId) view returns (tuple(address token, address pool, address creator, string memeMemo, uint64 launchedAt))",
  "function tokenToMemeId(address token) view returns (uint256)",
  "function pendingRoyalties(address token) view returns (uint256)",
  "function distributeRoyalties(address token)",
  "function launchMeme(string name, string symbol, string memeMemo) payable returns (address token, address pool)",
  "function poolSeed() view returns (uint256)",
  "function creationFee() view returns (uint256)",
  "function protocolTreasury() view returns (address)",
  "event MemeLaunched(uint256 indexed memeId, address indexed token, address indexed creator, address pool, string memeMemo)",
  "event RoyaltiesDistributed(address indexed token, uint256 creatorAmount, uint256 protocolAmount, uint256 poolAmount)",
];

export const POOL_ABI = [
  "function buy(uint256 minTokensOut) payable returns (uint256)",
  "function sell(uint256 tokensIn, uint256 minHbarOut) returns (uint256)",
  "function getReserves() view returns (uint256 hbarReserve, uint256 tokenReserve)",
  "function getTokensOut(uint256 hbarIn) view returns (uint256)",
  "function getHbarOut(uint256 tokensIn) view returns (uint256)",
  "function getPrice() view returns (uint256)",
  "event Buy(address indexed buyer, uint256 hbarIn, uint256 tokensOut, uint256 hbarReserve, uint256 tokenReserve)",
  "event Sell(address indexed seller, uint256 tokensIn, uint256 hbarOut, uint256 hbarReserve, uint256 tokenReserve)",
];

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];
