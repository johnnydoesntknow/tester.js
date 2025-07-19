// Network configurations
export const NETWORKS = {
  '1': {
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    blockExplorer: 'https://etherscan.io'
  },
  '11155111': {
    name: 'Sepolia Testnet',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    blockExplorer: 'https://sepolia.etherscan.io'
  },
  '137': {
    name: 'Polygon Mainnet',
    symbol: 'MATIC',
    decimals: 18,
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    blockExplorer: 'https://polygonscan.com'
  },
  '80001': {
    name: 'Polygon Mumbai',
    symbol: 'MATIC',
    decimals: 18,
    rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    blockExplorer: 'https://mumbai.polygonscan.com'
  },
  '56': {
    name: 'BSC Mainnet',
    symbol: 'BNB',
    decimals: 18,
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    blockExplorer: 'https://bscscan.com'
  },
  '97': {
    name: 'BSC Testnet',
    symbol: 'tBNB',
    decimals: 18,
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorer: 'https://testnet.bscscan.com'
  },
  '984': {
    name: 'IOPN Testnet',
    symbol: 'OPN',
    decimals: 18,
    rpcUrl: 'https://testnet-rpc.iopn.tech', // Need the RPC URL
    blockExplorer: 'https://testnet.iopn.tech/' // Need explorer URL
  }
};

// OPN Token addresses on different networks
export const OPN_TOKEN_ADDRESSES = {
  '1': '0x... OPN_ON_ETHEREUM',          // Update with actual address
  '137': '0x... OPN_ON_POLYGON',         // Update with actual address
  '56': '0x... OPN_ON_BSC',              // Update with actual address
  '97': '0x... OPN_ON_BSC_TESTNET',      // Update with actual address
  '11155111': '0x... OPN_ON_SEPOLIA',    // Update with actual address
  '80001': '0x... OPN_ON_MUMBAI'         // Update with actual address
};

// Other tokens that can be airdropped
export const TOKENS = {
  OPN: {
    addresses: OPN_TOKEN_ADDRESSES,
    decimals: 18,
    symbol: 'OPN'
  },
  USDT: {
    addresses: {
      '1': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      '137': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      '56': '0x55d398326f99059fF775485246999027B3197955'
    },
    decimals: 6,
    symbol: 'USDT'
  },
  USDC: {
    addresses: {
      '1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      '137': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      '56': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
    },
    decimals: 6,
    symbol: 'USDC'
  }
};

// Batch size limits for gas optimization
export const BATCH_SIZES = {
  NATIVE: 50,   // Max recipients per transaction for native tokens
  ERC20: 30     // Max recipients per transaction for ERC20 tokens
};

// Gas limits
export const GAS_LIMITS = {
  NATIVE_PER_RECIPIENT: 35000,
  ERC20_PER_RECIPIENT: 65000,
  BASE_GAS: 100000
};

// Fee configuration
export const FEE_CONFIG = {
  DEFAULT_FEE_AMOUNT: '0.01', // 0.01 OPN
  FEE_DECIMALS: 18
};