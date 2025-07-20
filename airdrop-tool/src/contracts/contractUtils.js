
import { ethers } from 'ethers';
import { AIRDROP_CONTRACT_ABI, ERC20_ABI, CONTRACT_ADDRESSES } from './AirdropContractABI';
import { NETWORKS, BATCH_SIZES } from './config';

// Get contract instance
export const getAirdropContract = (chainId, signer) => {
  const contractAddress = CONTRACT_ADDRESSES[chainId];
  if (!contractAddress || contractAddress.includes('YOUR_')) {
    throw new Error(`Airdrop contract not deployed on network ${chainId}`);
  }
  
  return new ethers.Contract(contractAddress, AIRDROP_CONTRACT_ABI, signer);
};

// Get ERC20 token contract
export const getTokenContract = (tokenAddress, signer) => {
  return new ethers.Contract(tokenAddress, ERC20_ABI, signer);
};

// Check if user is fee exempt
export const checkWhitelistStatus = async (contract, userAddress) => {
  try {
    const isFeeExempt = await contract.isFeeExempt(userAddress);
    const owner = await contract.owner();
    const isOwner = userAddress.toLowerCase() === owner.toLowerCase();
    
    return {
      isWhitelisted: isFeeExempt, // For backward compatibility
      isFeeExempt,
      whitelistEnabled: true, // Always true since it's for fees
      isOwner,
      canUseAirdrop: true // Everyone can use airdrop
    };
  } catch (error) {
    console.error('Error checking fee exemption status:', error);
    // Fallback for old contract
    try {
      const isWhitelisted = await contract.isWhitelisted(userAddress);
      const whitelistEnabled = await contract.whitelistEnabled();
      
      return {
        isWhitelisted,
        isFeeExempt: isWhitelisted,
        whitelistEnabled,
        isOwner: false,
        canUseAirdrop: !whitelistEnabled || isWhitelisted
      };
    } catch {
      throw error;
    }
  }
};

// Get fee information
export const getFeeInfo = async (contract, chainId) => {
  try {
    const feeAmount = await contract.getFeeInfo();
    console.log('Raw fee amount from contract:', feeAmount.toString());
    
    return {
      feeAmount,
      feeAmountFormatted: ethers.formatEther(feeAmount),
      isNativeFee: true // Always native OPN now
    };
  } catch (error) {
    console.error('Error getting fee info:', error);
    // Default to 0.01 OPN if contract call fails
    return {
      feeAmount: ethers.parseEther('0.01'),
      feeAmountFormatted: '0.01',
      isNativeFee: true
    };
  }
};

// Check fee amount (no approval needed for native fees)
export const checkFeeAmount = async (contract, signer) => {
  try {
    const feeAmount = await contract.getFeeInfo();
    const signerAddress = await signer.getAddress();
    const balance = await signer.provider.getBalance(signerAddress);
    
    if (balance < feeAmount) {
      throw new Error(`Insufficient OPN balance. Need ${ethers.formatEther(feeAmount)} OPN for fee`);
    }
    
    return { 
      sufficient: true, 
      feeAmount,
      feeAmountFormatted: ethers.formatEther(feeAmount)
    };
  } catch (error) {
    console.error('Fee check error:', error);
    throw error;
  }
};

// Parse amount based on token decimals
export const parseAmount = (amount, decimals = 18) => {
  return ethers.parseUnits(amount.toString(), decimals);
};

// Format amount for display
export const formatAmount = (amount, decimals = 18) => {
  return ethers.formatUnits(amount, decimals);
};

// Split recipients into batches
export const batchRecipients = (recipients, batchSize) => {
  const batches = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }
  return batches;
};

// Calculate total amount needed
export const calculateTotalAmount = (recipients, tokenType = 'NATIVE', chainId = '1') => {
  let decimals = 18;
  
  // OPN is native on IOPN network (chain 984)
  if (chainId === '984' && tokenType === 'OPN') {
    tokenType = 'NATIVE';
  }
  
  if (tokenType === 'NATIVE' || tokenType === 'OPN') {
    decimals = NETWORKS[chainId]?.decimals || 18;
  }
  
  return recipients.reduce((total, recipient) => {
    const amount = parseAmount(recipient.amount, decimals);
    return total + amount;
  }, BigInt(0));
};

// Check token allowance for ERC20 airdrops
export const checkAndApproveToken = async (
  tokenAddress,
  spenderAddress,
  amount,
  signer
) => {
  try {
    const tokenContract = getTokenContract(tokenAddress, signer);
    const signerAddress = await signer.getAddress();
    
    // Check current allowance
    const currentAllowance = await tokenContract.allowance(signerAddress, spenderAddress);
    
    if (currentAllowance < amount) {
      console.log('Approving token spend...');
      const approveTx = await tokenContract.approve(spenderAddress, amount);
      await approveTx.wait();
      console.log('Token approval successful');
      return { approved: true, txHash: approveTx.hash };
    }
    
    return { approved: true, alreadyApproved: true };
  } catch (error) {
    console.error('Token approval error:', error);
    throw error;
  }
};

// Execute native token airdrop with fee (owner exempt)
export const executeNativeTokenAirdrop = async (
  contract,
  recipients,
  signer,
  chainId
) => {
  const results = {
    successful: [],
    failed: [],
    transactions: []
  };
  
  try {
    // Check whitelist status and if user is owner
    const signerAddress = await signer.getAddress();
    const whitelistStatus = await checkWhitelistStatus(contract, signerAddress);
    
    if (!whitelistStatus.canUseAirdrop) {
      throw new Error('Your address is not whitelisted for airdrops');
    }
    
    // Get fee amount (0 for owner)
    const feeAmount = await contract.getFeeInfo();
    const effectiveFee = whitelistStatus.isOwner ? BigInt(0) : feeAmount;
    
    if (!whitelistStatus.isOwner) {
      await checkFeeAmount(contract, signer);
    }
    
    console.log(`User is ${whitelistStatus.isOwner ? 'owner (no fee)' : 'not owner (fee required)'}`);
    
    // Split into batches
    const batches = batchRecipients(recipients, BATCH_SIZES.NATIVE);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const addresses = batch.map(r => r.address);
      const amounts = batch.map(r => parseAmount(r.amount, 18));
      
      // Calculate total for this batch
      const batchTotal = amounts.reduce((sum, amount) => sum + amount, BigInt(0));
      const totalValue = batchTotal + effectiveFee; // Add fee only if not owner
      
      try {
        console.log(`Processing batch ${batchIndex + 1}/${batches.length}`);
        console.log(`Sending ${ethers.formatEther(batchTotal)} OPN for airdrop`);
        if (!whitelistStatus.isOwner) {
          console.log(`Plus ${ethers.formatEther(effectiveFee)} OPN fee`);
        }
        
        // Execute transaction
        const tx = await contract.airdropNativeToken(
          addresses,
          amounts,
          { 
            value: totalValue,
            gasLimit: 300000
          }
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        
        results.transactions.push({
          hash: tx.hash,
          batchIndex,
          status: 'success'
        });
        
        // Mark all in batch as successful
        batch.forEach((recipient) => {
          results.successful.push({
            ...recipient,
            txHash: tx.hash,
            batchIndex,
            status: 'success'
          });
        });
        
      } catch (error) {
        console.error(`Batch ${batchIndex + 1} failed:`, error);
        
        // Mark all in batch as failed
        batch.forEach(recipient => {
          results.failed.push({
            ...recipient,
            error: error.message || 'Transaction failed',
            batchIndex,
            status: 'failed'
          });
        });
      }
    }
    
  } catch (error) {
    console.error('Airdrop execution error:', error);
    throw error;
  }
  
  return results;
};

// Execute ERC20 token airdrop with fee
export const executeERC20TokenAirdrop = async (
  contract,
  tokenAddress,
  recipients,
  signer,
  chainId
) => {
  const results = {
    successful: [],
    failed: [],
    transactions: []
  };
  
  try {
    // Check whitelist status
    const signerAddress = await signer.getAddress();
    const whitelistStatus = await checkWhitelistStatus(contract, signerAddress);
    
    if (!whitelistStatus.canUseAirdrop) {
      throw new Error('Your address is not whitelisted for airdrops');
    }
    
    // Get fee amount
    const feeAmount = await contract.getFeeInfo();
    await checkFeeAmount(contract, signer);
    
    // Get token details
    const tokenContract = getTokenContract(tokenAddress, signer);
    const decimals = await tokenContract.decimals();
    
    // Calculate total amount needed
    const totalAmount = recipients.reduce((sum, r) => {
      return sum + parseAmount(r.amount, decimals);
    }, BigInt(0));
    
    // Check and approve token
    const contractAddress = await contract.getAddress();
    await checkAndApproveToken(tokenAddress, contractAddress, totalAmount, signer);
    
    // Split into batches
    const batches = batchRecipients(recipients, BATCH_SIZES.ERC20);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const addresses = batch.map(r => r.address);
      const amounts = batch.map(r => parseAmount(r.amount, decimals));
      
      try {
        console.log(`Processing batch ${batchIndex + 1}/${batches.length}`);
        console.log(`Paying ${ethers.formatEther(feeAmount)} OPN fee`);
        
        // Estimate gas
        const estimatedGas = await contract.airdropERC20Token.estimateGas(
          tokenAddress,
          addresses,
          amounts,
          { value: feeAmount } // Fee paid in native OPN
        );
        
        // Execute transaction with fee
        const tx = await contract.airdropERC20Token(
          tokenAddress,
          addresses,
          amounts,
          { 
            value: feeAmount, // Send OPN fee
            gasLimit: (estimatedGas * BigInt(110)) / BigInt(100)
          }
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        await tx.wait();
        
        results.transactions.push({
          hash: tx.hash,
          batchIndex,
          status: 'success'
        });
        
        // Mark all in batch as successful
        batch.forEach((recipient) => {
          results.successful.push({
            ...recipient,
            txHash: tx.hash,
            batchIndex,
            status: 'success'
          });
        });
        
      } catch (error) {
        console.error(`Batch ${batchIndex + 1} failed:`, error);
        
        // Mark all in batch as failed
        batch.forEach(recipient => {
          results.failed.push({
            ...recipient,
            error: error.message || 'Transaction failed',
            batchIndex,
            status: 'failed'
          });
        });
      }
    }
    
  } catch (error) {
    console.error('ERC20 airdrop execution error:', error);
    throw error;
  }
  
  return results;
};

// Get transaction explorer URL
export const getExplorerUrl = (txHash, chainId) => {
  const network = NETWORKS[chainId];
  if (!network) return '#';
  
  return `${network.blockExplorer}/tx/${txHash}`;
};

// Validate recipient address
export const isValidAddress = (address) => {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
};