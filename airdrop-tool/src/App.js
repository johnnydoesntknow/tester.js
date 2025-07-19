import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Send, Wallet, ArrowRight, Check, X, Receipt, Plus, Trash2, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { ethers } from 'ethers';
import './App.css';
// Contract imports
import { 
  getAirdropContract, 
  executeNativeTokenAirdrop, 
  executeERC20TokenAirdrop,
  checkWhitelistStatus,
  getFeeInfo,
  isValidAddress,
  getExplorerUrl
} from './contracts/contractUtils';
import { NETWORKS, OPN_TOKEN_ADDRESSES } from './contracts/config';
import { CONTRACT_ADDRESSES } from './contracts/AirdropContractABI';

const App = () => {
  const [currentPage, setCurrentPage] = useState('welcome'); // welcome, main, receipt
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletError, setWalletError] = useState('');
  const [provider, setProvider] = useState(null); // eslint-disable-line no-unused-vars
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [manualRecipient, setManualRecipient] = useState({ 
    address: '', 
    amount: '', 
    tokenType: 'OPN' 
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [airdropResults, setAirdropResults] = useState(null);
  const fileInputRef = useRef(null);
  // Contract-related state
  const [whitelistStatus, setWhitelistStatus] = useState({ isWhitelisted: false, whitelistEnabled: true, canUseAirdrop: false });
  const [feeInfo, setFeeInfo] = useState({ feeAmount: '0', feeToken: '', isOPNToken: true });
  const [contractReady, setContractReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check contract status (whitelist and fee info)
  const checkContractStatus = useCallback(async () => {
    try {
      if (!signer || !chainId) return;
      
      const contractAddress = CONTRACT_ADDRESSES[chainId];
      if (!contractAddress || contractAddress.includes('YOUR_')) {
        setContractReady(false);
        return;
      }
      
      const contract = getAirdropContract(chainId, signer);
      const signerAddress = await signer.getAddress();
      
      // Check whitelist status
      const whitelistInfo = await checkWhitelistStatus(contract, signerAddress);
      setWhitelistStatus(whitelistInfo);
      
      // Get fee info
      const feeData = await getFeeInfo(contract, chainId);
      setFeeInfo(feeData);
      
      setContractReady(true);
    } catch (error) {
      console.error('Error checking contract status:', error);
      setContractReady(false);
    }
  }, [signer, chainId]);

  const checkWalletConnection = useCallback(async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          const network = await provider.getNetwork();
          
          setProvider(provider);
          setSigner(signer);
          setWalletAddress(address);
          setChainId(network.chainId.toString());
          setIsWalletConnected(true);
          setWalletError('');
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  }, []);

  const handleAccountsChanged = useCallback((accounts) => {
    if (accounts.length === 0) {
      setIsWalletConnected(false);
      setWalletAddress('');
      setProvider(null);
      setSigner(null);
      setChainId(null);
      setWalletError('');
      setRecipients([]);
      setManualRecipient({ address: '', amount: '', tokenType: 'OPN' });
    } else {
      // Re-check connection when accounts change
      checkWalletConnection();
    }
  }, [checkWalletConnection]);

  const handleChainChanged = useCallback(() => {
    // Reload to reset state when chain changes
    window.location.reload();
  }, []);

  // Listen for wallet events but DON'T auto-connect
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [handleAccountsChanged, handleChainChanged]);

  // Check contract status when wallet connects
  useEffect(() => {
    if (isWalletConnected && signer && chainId) {
      checkContractStatus();
      // Set default token type based on network
      const defaultTokenType = chainId === '984' ? 'OPN' : 'NATIVE';
      setManualRecipient(prev => ({ ...prev, tokenType: defaultTokenType }));
    }
  }, [isWalletConnected, signer, chainId, checkContractStatus]);

  const connectWallet = async () => {
    try {
      setWalletError('');
      
      // Check if MetaMask is installed
      if (!window.ethereum) {
        setWalletError('MetaMask is not installed. Please install MetaMask to continue.');
        return;
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      
      setProvider(provider);
      setSigner(signer);
      setWalletAddress(address);
      setChainId(network.chainId.toString());
      setIsWalletConnected(true);
      setWalletError('');
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      
      if (error.code === 4001) {
        setWalletError('Connection rejected by user.');
      } else {
        setWalletError('Failed to connect wallet. Please try again.');
      }
    }
  };

  const disconnectWallet = () => {
    setIsWalletConnected(false);
    setWalletAddress('');
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setWalletError('');
    setRecipients([]);
    setManualRecipient({ address: '', amount: '', tokenType: 'OPN' });
    setContractReady(false);
    setWhitelistStatus({ isWhitelisted: false, whitelistEnabled: true, canUseAirdrop: false });
    setFeeInfo({ feeAmount: '0', feeToken: '', isOPNToken: true });
  };

  // Get network name for display
  const getNetworkName = (chainId) => {
    const networks = {
      '1': 'Ethereum Mainnet',
      '5': 'Goerli Testnet',
      '11155111': 'Sepolia Testnet',
      '137': 'Polygon Mainnet',
      '80001': 'Polygon Mumbai',
      '56': 'BSC Mainnet',
      '97': 'BSC Testnet',
      '984': 'IOPN Testnet'
    };
    return networks[chainId] || `Chain ID: ${chainId}`;
  };

  // Add manual recipient
  const addManualRecipient = () => {
    if (manualRecipient.address && manualRecipient.amount) {
      if (!isValidAddress(manualRecipient.address)) {
        alert('Invalid wallet address');
        return;
      }
      
      setRecipients([...recipients, { 
        ...manualRecipient, 
        id: Date.now(),
        source: 'manual'
      }]);
      
      const defaultTokenType = chainId === '984' ? 'OPN' : 'NATIVE';
      setManualRecipient({ address: '', amount: '', tokenType: defaultTokenType });
    }
  };

  // Remove recipient
  const removeRecipient = (id) => {
    setRecipients(recipients.filter(r => r.id !== id));
  };

  // Handle CSV upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const csvRecipients = results.data
            .filter(row => row.wallet_address && row.wallet_address.trim() && row.amount)
            .map((row, index) => ({
              id: Date.now() + index,
              address: row.wallet_address.trim(),
              amount: row.amount,
              tokenType: row.token_type || 'OPN',
              source: 'csv'
            }));
          
          setRecipients([...recipients, ...csvRecipients]);
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          alert('Error parsing CSV file. Please check the format.');
        }
      });
    }
  };

  // Execute airdrop - REAL CONTRACT IMPLEMENTATION
  const executeAirdrop = async () => {
    setShowConfirmation(false);
    setIsProcessing(true);
    
    try {
      // Check if contract is deployed on this network
      const contractAddress = CONTRACT_ADDRESSES[chainId];
      if (!contractAddress || contractAddress.includes('YOUR_')) {
        alert(`Airdrop contract not deployed on ${getNetworkName(chainId)}. Please switch to a supported network.`);
        setIsProcessing(false);
        return;
      }
      
      // Check whitelist status
      if (!whitelistStatus.canUseAirdrop) {
        alert('Your address is not whitelisted for airdrops. Please contact the admin.');
        setIsProcessing(false);
        return;
      }
      
      // Get contract instance
      const airdropContract = getAirdropContract(chainId, signer);
      
      // Validate all addresses
      const invalidAddresses = recipients.filter(r => !isValidAddress(r.address));
      if (invalidAddresses.length > 0) {
        alert(`Invalid addresses found: ${invalidAddresses.map(r => r.address).join(', ')}`);
        setIsProcessing(false);
        return;
      }
      
      // Separate recipients by token type
      const nativeRecipients = recipients.filter(r => {
        // On IOPN network (984), OPN is the native token
        if (chainId === '984') {
          return r.tokenType === 'NATIVE' || r.tokenType === 'OPN';
        }
        return r.tokenType === 'NATIVE';
      });
      
      const opnRecipients = recipients.filter(r => {
        // On IOPN network (984), OPN is native, not ERC20
        if (chainId === '984') {
          return false; // No separate OPN token on IOPN
        }
        return r.tokenType === 'OPN';
      });
      
      const otherERC20Recipients = recipients.filter(r => r.tokenType === 'ERC20');
      
      // Debug logging
      console.log('Chain ID:', chainId);
      console.log('Recipients:', recipients);
      console.log('Native recipients:', nativeRecipients);
      console.log('OPN recipients:', opnRecipients);
      
      const results = {
        total: recipients.length,
        successful: [],
        failed: [],
        timestamp: new Date().toISOString(),
        transactions: []
      };
      
      // Process native token airdrops
      if (nativeRecipients.length > 0) {
        console.log('Processing native token airdrops...');
        const nativeResults = await executeNativeTokenAirdrop(
          airdropContract,
          nativeRecipients,
          signer,
          chainId
        );
        
        results.successful.push(...nativeResults.successful);
        results.failed.push(...nativeResults.failed);
        results.transactions.push(...nativeResults.transactions);
      }
      
      // Process OPN token airdrops (only for non-IOPN networks)
      if (opnRecipients.length > 0) {
        const opnTokenAddress = OPN_TOKEN_ADDRESSES[chainId];
        if (!opnTokenAddress || opnTokenAddress.includes('0x...')) {
          alert('OPN token not configured for this network');
          setIsProcessing(false);
          return;
        }
        
        console.log('Processing OPN token airdrops...');
        const opnResults = await executeERC20TokenAirdrop(
          airdropContract,
          opnTokenAddress,
          opnRecipients,
          signer,
          chainId
        );
        
        results.successful.push(...opnResults.successful);
        results.failed.push(...opnResults.failed);
        results.transactions.push(...opnResults.transactions);
      }
      
      // Process other ERC20 token airdrops (if any)
      if (otherERC20Recipients.length > 0) {
        // You would need to get the token address from user
        alert('Custom ERC20 token airdrops not yet implemented');
      }
      
      setAirdropResults(results);
      setCurrentPage('receipt');
      
    } catch (error) {
      console.error('Airdrop execution error:', error);
      alert(`Airdrop failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const tokenExample = chainId === '984' ? 'OPN' : 'NATIVE';
    const csvContent = `wallet_address,amount,token_type\n0x742d35Cc8545EB5c8C5B0cB1234567890abcdef,100,${tokenExample}\n0x123d35Cc8545EB5c8C5B0cB9876543210fedcba,50,ERC20`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airdrop_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetApp = () => {
    setCurrentPage('main');
    setRecipients([]);
    setAirdropResults(null);
    const defaultTokenType = chainId === '984' ? 'OPN' : 'NATIVE';
    setManualRecipient({ address: '', amount: '', tokenType: defaultTokenType });
  };

  // Welcome Page
  if (currentPage === 'welcome') {
    return (
      <div className="app-container">
        <div className="app-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>
        
        <div className="welcome-container">
          <div className="welcome-content">
            <div className="welcome-logo">
              <img src="/iopn-logo.png" alt="IOPN Logo" className="welcome-logo-image" />
            </div>
            <h1 className="welcome-title">IOPN Airdrop Console</h1>
            <p className="welcome-subtitle">Enterprise-grade token distribution for the Internet of People Network</p>
            
            <button 
              onClick={() => setCurrentPage('main')}
              className="welcome-button"
            >
              <Send className="button-icon" />
              Launch Console
              <ArrowRight className="button-icon" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Receipt Page
  if (currentPage === 'receipt' && airdropResults) {
    return (
      <div className="app-container">
        <div className="app-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>
        
        <div className="main-content">
          <header className="app-header">
            <div className="header-content">
              <div className="brand-section">
                <div className="iopn-logo">
                  <img src="/iopn-logo.png" alt="IOPN Logo" className="brand-logo-image" />
                </div>
                <div className="header-text">
                  <h1 className="app-title">Airdrop Complete</h1>
                  <p className="app-subtitle">Transaction receipt and summary</p>
                </div>
              </div>
            </div>
          </header>

          <div className="content-area">
            <div className="content-container">
              <div className="receipt-section">
                <div className="receipt-header">
                  <Receipt className="receipt-icon" />
                  <h2>Airdrop Receipt</h2>
                  <p>Completed at {new Date(airdropResults.timestamp).toLocaleString()}</p>
                </div>

                <div className="receipt-summary">
                  <div className="summary-cards">
                    <div className="summary-card success">
                      <Check className="card-icon" />
                      <div className="card-content">
                        <span className="card-value">{airdropResults.successful.length}</span>
                        <span className="card-label">Successful</span>
                      </div>
                    </div>
                    <div className="summary-card failed">
                      <X className="card-icon" />
                      <div className="card-content">
                        <span className="card-value">{airdropResults.failed.length}</span>
                        <span className="card-label">Failed</span>
                      </div>
                    </div>
                    <div className="summary-card total">
                      <Receipt className="card-icon" />
                      <div className="card-content">
                        <span className="card-value">{airdropResults.total}</span>
                        <span className="card-label">Total</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="receipt-details">
                  {airdropResults.successful.length > 0 && (
                    <div className="transaction-group">
                      <h3 className="group-title successful">✅ Successful Transactions</h3>
                      <div className="transaction-list">
                        {airdropResults.successful.map((tx, index) => (
                          <div key={index} className="transaction-item success">
                            <div className="tx-info">
                              <span className="tx-address">{tx.address.slice(0, 8)}...{tx.address.slice(-6)}</span>
                              <span className="tx-amount">{tx.amount} {tx.tokenType}</span>
                            </div>
                            <div className="tx-hash">
                              <a 
                                href={getExplorerUrl(tx.txHash, chainId)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="tx-link"
                              >
                                View Transaction: {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {airdropResults.failed.length > 0 && (
                    <div className="transaction-group">
                      <h3 className="group-title failed">❌ Failed Transactions</h3>
                      <div className="transaction-list">
                        {airdropResults.failed.map((tx, index) => (
                          <div key={index} className="transaction-item failed">
                            <div className="tx-info">
                              <span className="tx-address">{tx.address.slice(0, 8)}...{tx.address.slice(-6)}</span>
                              <span className="tx-amount">{tx.amount} {tx.tokenType}</span>
                            </div>
                            <div className="tx-error">
                              <span>{tx.error}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={resetApp} className="new-airdrop-button">
                  <Plus className="button-icon" />
                  Start New Airdrop
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main App Page
  return (
    <div className="app-container">
      <div className="app-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="header-content">
            <div className="brand-section">
              <div className="iopn-logo">
                <img src="/iopn-logo.png" alt="IOPN Logo" className="brand-logo-image" />
              </div>
              <div className="header-text">
                <h1 className="app-title">Airdrop Distribution Console</h1>
                <p className="app-subtitle">Enterprise-grade token distribution for the Internet of People Network</p>
              </div>
            </div>
          </div>
        </header>

        {/* Wallet Connection */}
        <div className="wallet-section">
          {!isWalletConnected ? (
            <div className="wallet-connect-area">
              <button onClick={connectWallet} className="wallet-connect-button">
                <Wallet className="button-icon" />
                Connect MetaMask
              </button>
              {walletError && (
                <div className="wallet-error">
                  <AlertCircle className="error-icon" />
                  <span>{walletError}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="wallet-connected">
              <div className="wallet-info">
                <Wallet className="wallet-icon" />
                <div className="wallet-details">
                  <span className="wallet-address">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
                  <span className="network-info">{getNetworkName(chainId)}</span>
                </div>
                <span className="connected-badge">Connected</span>
              </div>
              <button onClick={disconnectWallet} className="disconnect-button">
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Contract Status Section */}
        {isWalletConnected && contractReady && (
          <div className="contract-status-section">
            <div className="status-cards">
              <div className={`status-card ${whitelistStatus.canUseAirdrop ? 'success' : 'warning'}`}>
                <div className="status-icon">
                  {whitelistStatus.canUseAirdrop ? <Check /> : <AlertCircle />}
                </div>
                <div className="status-content">
                  <h4>Whitelist Status</h4>
                  <p>{whitelistStatus.whitelistEnabled 
                    ? (whitelistStatus.isWhitelisted ? 'Whitelisted' : 'Not Whitelisted')
                    : 'Whitelist Disabled (Open to All)'
                  }</p>
                </div>
              </div>
              
              <div className="status-card">
                <div className="status-icon">
                  <Receipt />
                </div>
                <div className="status-content">
                  <h4>Airdrop Fee</h4>
                  <p>{feeInfo.feeAmountFormatted} OPN per airdrop</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contract Not Ready Warning */}
        {isWalletConnected && !contractReady && (
          <div className="warning-banner">
            <AlertCircle />
            <p>Airdrop contract not available on {getNetworkName(chainId)}. Please switch to a supported network.</p>
          </div>
        )}

        {/* Main Content */}
        {isWalletConnected && (
          <div className="content-area">
            <div className="content-container">
              
              {/* Manual Entry Section */}
              <div className="manual-entry-section">
                <h2 className="section-title">Add Recipients</h2>
                <p className="section-description">Manually add recipients or upload a CSV file</p>
                
                <div className="manual-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Recipient Address</label>
                      <input
                        type="text"
                        value={manualRecipient.address}
                        onChange={(e) => setManualRecipient({...manualRecipient, address: e.target.value})}
                        className="form-input"
                        placeholder="0x..."
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount</label>
                      <input
                        type="number"
                        value={manualRecipient.amount}
                        onChange={(e) => setManualRecipient({...manualRecipient, amount: e.target.value})}
                        className="form-input"
                        placeholder="100"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Token Type</label>
                      <select
                        value={manualRecipient.tokenType}
                        onChange={(e) => setManualRecipient({...manualRecipient, tokenType: e.target.value})}
                        className="form-select"
                      >
                        {chainId === '984' ? (
                          <>
                            <option value="OPN">OPN (Native)</option>
                            <option value="ERC20">ERC20 Token</option>
                          </>
                        ) : (
                          <>
                            <option value="NATIVE">{NETWORKS[chainId]?.symbol || 'Native'}</option>
                            <option value="OPN">OPN Token</option>
                            <option value="ERC20">Custom ERC20</option>
                          </>
                        )}
                      </select>
                    </div>
                    <button onClick={addManualRecipient} className="add-recipient-button">
                      <Plus className="button-icon" />
                      Add
                    </button>
                  </div>
                </div>

                {/* CSV Upload */}
                <div className="csv-upload-section">
                  <div className="upload-row">
                    <button onClick={() => fileInputRef.current?.click()} className="csv-upload-button">
                      <Upload className="button-icon" />
                      Upload CSV File
                    </button>
                    <button onClick={downloadTemplate} className="template-button">
                      <Download className="button-icon" />
                      Download Template
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".csv"
                      className="file-input"
                    />
                  </div>
                </div>
              </div>

              {/* Recipients List */}
              {recipients.length > 0 && (
                <div className="recipients-section">
                  <h3 className="recipients-title">Recipients ({recipients.length})</h3>
                  <div className="recipients-list">
                    {recipients.map(recipient => (
                      <div key={recipient.id} className="recipient-item">
                        <div className="recipient-info">
                          <span className="recipient-address">{recipient.address.slice(0, 8)}...{recipient.address.slice(-6)}</span>
                          <span className="recipient-amount">{recipient.amount} {recipient.tokenType}</span>
                          <span className={`recipient-source ${recipient.source}`}>{recipient.source}</span>
                        </div>
                        <button onClick={() => removeRecipient(recipient.id)} className="remove-recipient">
                          <Trash2 className="remove-icon" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Airdrop Button */}
              {recipients.length > 0 && (
                <div className="airdrop-section">
                  <button 
                    onClick={() => setShowConfirmation(true)} 
                    className="airdrop-button"
                    disabled={isProcessing || !contractReady || !whitelistStatus.canUseAirdrop}
                  >
                    {isProcessing ? (
                      <>Processing...</>
                    ) : (
                      <>
                        <Send className="button-icon" />
                        Execute Airdrop ({recipients.length} recipients)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="modal-overlay">
            <div className="confirmation-modal">
              <h3>Confirm Airdrop</h3>
              <p>Are you sure you want to execute the airdrop to {recipients.length} recipients?</p>
              <div className="modal-buttons">
                <button onClick={() => setShowConfirmation(false)} className="cancel-button">
                  Cancel
                </button>
                <button onClick={executeAirdrop} className="confirm-airdrop-button">
                  Execute Airdrop
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;