import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { ethers } from 'ethers';
import { NETWORKS } from './contracts/config';

// Convert our network config to Reown format
const reownNetworks = Object.entries(NETWORKS).map(([chainId, network]) => ({
  id: parseInt(chainId),
  name: network.name,
  currency: network.symbol,
  explorerUrl: network.blockExplorer,
  rpcUrl: network.rpcUrl
}));

// Project ID from Reown Cloud (you'll need to get this from https://cloud.reown.com)
// For now, using a placeholder - replace with your actual project ID
const projectId = '05ecf5f25da55f389ae29a5eb4555fc0';

// Metadata for your dApp
const metadata = {
  name: 'IOPN Airdrop Console',
  description: 'Official OPN token distribution platform for the Internet of People Network',
  url: 'https://airdrop.iopn.tech', // Update with your actual URL
  icons: ['/iopn-logo.png']
};

// Create the Ethers adapter
const ethersAdapter = new EthersAdapter();

// Create and configure AppKit
export const appKit = createAppKit({
  adapters: [ethersAdapter],
  networks: reownNetworks,
  defaultNetwork: reownNetworks.find(n => n.id === 984) || reownNetworks[0], // Default to IOPN or first network
  projectId,
  metadata,
  features: {
    analytics: true,
    email: true,
    socials: ['google', 'x', 'github', 'discord'],
    emailShowWallets: true
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-color-mix': '#15BFC2',
    '--w3m-color-mix-strength': 20,
    '--w3m-font-family': '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '--w3m-font-size-master': '10px',
    '--w3m-border-radius-master': '8px',
    '--w3m-z-index': 10000
  }
});

// Helper function to get provider and signer
export const getWalletConnection = async () => {
  try {
    const walletProvider = await appKit.getWalletProvider();
    if (!walletProvider) throw new Error('No wallet provider found');
    
    const ethersProvider = new ethers.BrowserProvider(walletProvider);
    const signer = await ethersProvider.getSigner();
    const address = await signer.getAddress();
    const network = await ethersProvider.getNetwork();
    
    return {
      provider: ethersProvider,
      signer,
      address,
      chainId: network.chainId.toString()
    };
  } catch (error) {
    console.error('Error getting wallet connection:', error);
    throw error;
  }
};

// Helper to check if wallet is connected
export const isWalletConnected = () => {
  return appKit.getState().selectedNetworkId !== undefined;
};

// Helper to disconnect wallet
export const disconnectWallet = async () => {
  await appKit.disconnect();
};

// Export modal controls
export const openConnectModal = () => appKit.open();
export const closeConnectModal = () => appKit.close();
export const openAccountModal = () => appKit.open({ view: 'Account' });
export const openNetworkModal = () => appKit.open({ view: 'Networks' });