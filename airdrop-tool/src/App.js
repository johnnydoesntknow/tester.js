import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { 
  Plus, 
  Upload, 
  Download, 
  Send, 
  Wallet, 
  X, 
  Check, 
  Loader2, 
  HelpCircle,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Info
} from 'lucide-react';
import './App.css';
import { CONTRACT_ADDRESSES } from './contracts/AirdropContractABI';
import { NETWORKS } from './contracts/config';
import { 
  getAirdropContract, 
  checkWhitelistStatus, 
  getFeeInfo,
  executeNativeTokenAirdrop,
  isValidAddress
} from './contracts/contractUtils';
import { 
  appKit, 
  getWalletConnection, 
  openConnectModal, 
  openAccountModal, 
  openNetworkModal,
  disconnectWallet as reownDisconnect 
} from './walletConfig';

function App() {
  // State management
  const [currentPage, setCurrentPage] = useState('welcome');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [walletError, setWalletError] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [manualRecipient, setManualRecipient] = useState({ address: '', amount: '', tokenType: 'OPN' });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [airdropResults, setAirdropResults] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [contractReady, setContractReady] = useState(false);
  const [whitelistStatus, setWhitelistStatus] = useState({
    isWhitelisted: false,
    isOwner: false,
    isFeeExempt: false,
    canUseAirdrop: false
  });
  const [feeInfo, setFeeInfo] = useState({
    amount: '0',
    formatted: '0',
    symbol: 'OPN'
  });

  // Handle wallet connection from Reown
  const handleWalletConnection = async () => {
    try {
      const connection = await getWalletConnection();
      
      setProvider(connection.provider);
      setSigner(connection.signer);
      setWalletAddress(connection.address);
      setChainId(connection.chainId);
      setIsWalletConnected(true);
      setWalletError('');
      
    } catch (error) {
      console.error('Error getting wallet connection:', error);
      setWalletError('Failed to get wallet details. Please try again.');
    }
  };

  // Check contract status
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

  // Initialize Reown modal and check for existing connection
  useEffect(() => {
    const checkExistingConnection = async () => {
      try {
        if (appKit.getState().selectedNetworkId) {
          await handleWalletConnection();
        }
      } catch (error) {
        console.error('Error checking existing connection:', error);
      }
    };
    checkExistingConnection();
  }, []);

  // Subscribe to Reown state changes
  useEffect(() => {
    const unsubscribe = appKit.subscribeState(async (state) => {
      // Handle wallet connection state changes
      if (state.open === false && state.selectedNetworkId) {
        // Modal closed and wallet is connected
        await handleWalletConnection();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Check for account/network changes periodically
  useEffect(() => {
    if (!isWalletConnected) return;

    const checkForChanges = async () => {
      try {
        const connection = await getWalletConnection();
        
        // Check if account changed
        if (connection.address !== walletAddress) {
          setWalletAddress(connection.address);
          setSigner(connection.signer);
          // Reset contract status for new account
          await checkContractStatus();
        }
        
        // Check if network changed
        if (connection.chainId !== chainId) {
          setChainId(connection.chainId);
          setProvider(connection.provider);
          setSigner(connection.signer);
          setContractReady(false);
          // Reset for new network
          const defaultTokenType = connection.chainId === '984' ? 'OPN' : 'NATIVE';
          setManualRecipient(prev => ({ ...prev, tokenType: defaultTokenType }));
          await checkContractStatus();
        }
      } catch (error) {
        // If we can't get connection, user probably disconnected
        if (error.message.includes('No wallet provider')) {
          await disconnectWallet();
        }
      }
    };

    // Check every 2 seconds for changes
    const interval = setInterval(checkForChanges, 2000);

    return () => clearInterval(interval);
  }, [isWalletConnected, walletAddress, chainId, checkContractStatus]);

  // Check contract status when wallet connects
  useEffect(() => {
  if (provider && isWalletConnected) {
    // Provider is being used to verify connection
    const checkConnection = async () => {
      try {
        await provider.getNetwork();
      } catch (error) {
        console.error('Lost connection to provider:', error);
        disconnectWallet();
      }
    };
    checkConnection();
  }
}, [provider, isWalletConnected]);
  // How To Content Component
  const HowToContent = () => (
    <div className="how-to-content">
      <h3>How to Use the IOPN Airdrop Console</h3>
      <ol>
        <li>Connect your wallet using any supported method (MetaMask, WalletConnect, Social logins, etc.)</li>
        <li>Ensure you're on the correct network (IOPN Testnet, Ethereum, Polygon, or BSC)</li>
        <li>Check that you have sufficient OPN tokens for fees (0.01 OPN per airdrop)</li>
        <li>Add recipient addresses manually or upload a CSV file</li>
        <li>Review the summary and confirm the airdrop</li>
        <li>Sign the transaction in your wallet</li>
        <li>Download the receipt for your records</li>
      </ol>
      <div className="how-to-note">
        <p>
          <Info className="help-icon" /> 
          Owner addresses are exempt from fees. Other users pay 0.01 OPN per airdrop.
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          <strong>Note:</strong> Multiple wallet options are supported including MetaMask, WalletConnect, 
          and social logins through Reown.
        </p>
      </div>
    </div>
  );

  // Help Modal Component
  const HelpModal = () => (
    <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setShowHelpModal(false)}>
          <X />
        </button>
        <HowToContent />
      </div>
    </div>
  );

  // Connect wallet using Reown
  const connectWallet = async () => {
    try {
      setWalletError('');
      
      // Open Reown modal
      openConnectModal();
      
    } catch (error) {
      console.error('Error opening wallet modal:', error);
      setWalletError('Failed to open wallet connection. Please try again.');
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      await reownDisconnect();
      setIsWalletConnected(false);
      setWalletAddress('');
      setProvider(null);
      setSigner(null);
      setChainId(null);
      setWalletError('');
      setRecipients([]);
      setManualRecipient({ address: '', amount: '', tokenType: 'OPN' });
      setContractReady(false);
      setCurrentPage('connect');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  // Get network name
  const getNetworkName = (chainId) => {
    return NETWORKS[chainId]?.name || `Chain ID: ${chainId}`;
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

  // Download template
  const downloadTemplate = () => {
    const tokenExample = chainId === '984' ? 'OPN' : 'NATIVE';
    const csvContent = `wallet_address,amount,token_type\n0x742d35Cc8545EB5c8C5B0cB1234567890abcdef,100,${tokenExample}\n0x123d35Cc8545EB5c8C5B0cB9876543210fedcba,50,OPN`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airdrop_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Execute airdrop
  const executeAirdrop = async () => {
    setShowConfirmation(false);
    setIsProcessing(true);
    
    try {
      const contractAddress = CONTRACT_ADDRESSES[chainId];
      if (!contractAddress || contractAddress.includes('YOUR_')) {
        alert(`Airdrop contract not deployed on ${getNetworkName(chainId)}.`);
        setIsProcessing(false);
        return;
      }
      
      const airdropContract = getAirdropContract(chainId, signer);
      
      // Separate recipients by token type
      const nativeRecipients = recipients.filter(r => {
        if (chainId === '984') {
          return r.tokenType === 'NATIVE' || r.tokenType === 'OPN';
        }
        return r.tokenType === 'NATIVE';
      });
      
      const results = {
        total: recipients.length,
        successful: [],
        failed: [],
        timestamp: new Date().toISOString(),
        transactions: []
      };
      
      // Process native token airdrops
      if (nativeRecipients.length > 0) {
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
      
      setAirdropResults(results);
      setCurrentPage('receipt');
      
    } catch (error) {
      console.error('Airdrop execution error:', error);
      alert(`Airdrop failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset app
  const resetApp = () => {
    setCurrentPage('main');
    setRecipients([]);
    setAirdropResults(null);
    const defaultTokenType = chainId === '984' ? 'OPN' : 'NATIVE';
    setManualRecipient({ address: '', amount: '', tokenType: defaultTokenType });
  };

  // WELCOME PAGE
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
              <img src="/iopn-logo.png" alt="IOPn Logo" className="welcome-logo-image" />
            </div>
            <h1 className="welcome-title">IOPN Distribution Hub</h1>
            <p className="welcome-subtitle">
              The official OPN token distribution platform for the Internet of People Network
            </p>
            <button onClick={() => setCurrentPage('connect')} className="welcome-button">
              Get Started
              <ChevronRight className="button-icon" />
            </button>
          </div>
        </div>

        {/* Fixed Help Button */}
        <button onClick={() => setShowHelpModal(true)} className="help-button-fixed">
          <HelpCircle className="help-icon" />
          How It Works
        </button>

        {/* Help Modal */}
        {showHelpModal && <HelpModal />}

        {/* Reown Modal */}
        <appkit-modal></appkit-modal>
      </div>
    );
  }

  // CONNECT PAGE
  if (currentPage === 'connect') {
    return (
      <div className="app-container">
        <div className="app-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>
        
        <div className="connect-container">
          <div className="connect-content">
            <div className="connect-header">
              <h1 className="connect-title">
                <span className="title-line">Let's get your</span>
                <span className="title-line">OPN airdrop started</span>
              </h1>
              <p className="connect-subtitle">
                Connect your wallet to begin distributing OPN tokens
              </p>
            </div>

            {/* How-to Section */}
            <div className="how-to-section">
              <HowToContent />
            </div>

            {/* Connect Wallet Section */}
            <div className="connect-wallet-section">
              {!isWalletConnected ? (
                <button onClick={connectWallet} className="connect-wallet-btn">
                  <Wallet className="button-icon" />
                  Connect Wallet
                </button>
              ) : (
                <div className="wallet-connected-info">
                  <div className="success-icon">
                    <Check />
                  </div>
                  <p>Wallet Connected!</p>
                  <p className="wallet-address-display">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</p>
                  <button 
                    onClick={() => setCurrentPage('main')} 
                    className="proceed-button"
                  >
                    Proceed to Airdrop
                    <ArrowRight className="button-icon" />
                  </button>
                </div>
              )}
              
              {walletError && (
                <div className="wallet-error">
                  <AlertCircle className="error-icon" />
                  <span>{walletError}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reown Modal */}
        <appkit-modal></appkit-modal>
      </div>
    );
  }

  // RECEIPT PAGE
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
                  <img src="/iopn-logo.png" alt="IOPn Logo" className="brand-logo-image" />
                </div>
                <div className="header-text">
                  <h1 className="app-title">OPN Airdrop Complete</h1>
                  <p>Your OPN tokens have been distributed successfully</p>
                </div>
              </div>
            </div>
          </header>

          <div className="content-area">
            <div className="content-container">
              <div className="receipt-container">
                <div className="receipt-header">
                  <h2>Airdrop Receipt</h2>
                  <p className="receipt-timestamp">
                    {new Date(airdropResults.timestamp).toLocaleString()}
                  </p>
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
                      <Send className="card-icon" />
                      <div className="card-content">
                        <span className="card-value">{airdropResults.total}</span>
                        <span className="card-label">Total Recipients</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="transactions-section">
                  <h3>Transaction Details</h3>
                  {airdropResults.transactions.length > 0 && (
                    <div className="transactions-list">
                      <div className="transaction-header">
                        <span>Batch</span>
                        <span>Recipients</span>
                        <span>Status</span>
                        <span>Transaction</span>
                      </div>
                      <div className="transaction-items">
                        {airdropResults.transactions.map((tx, index) => (
                          <div key={index} className="transaction-item">
                            <span className="tx-batch">#{tx.batchIndex + 1}</span>
                            <span className="tx-recipients">{tx.recipients} recipients</span>
                            <span className={`tx-status ${tx.status}`}>
                              {tx.status === 'success' ? <Check /> : <X />}
                              {tx.status}
                            </span>
                            <div className="tx-info">
                              {tx.hash ? (
                                <a 
                                  href={`${NETWORKS[chainId]?.blockExplorer}/tx/${tx.hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tx-link"
                                >
                                  <span className="tx-hash">
                                    {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                                  </span>
                                  <ExternalLink className="link-icon" />
                                </a>
                              ) : (
                                <span className="tx-error">{tx.error || 'Failed'}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {airdropResults.failed.length > 0 && (
                  <div className="failed-section">
                    <h3>Failed Transactions</h3>
                    <div className="failed-list">
                      {airdropResults.failed.map((failed, index) => (
                        <div key={index} className="failed-item">
                          <div className="failed-info">
                            <span className="failed-address">
                              {failed.address}
                            </span>
                            <span className="failed-amount">
                              {failed.amount} {failed.tokenType}
                            </span>
                          </div>
                          <div className="failed-error">
                            <AlertCircle className="error-icon" />
                            <span>{failed.error || 'Transaction failed'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={resetApp} className="new-airdrop-button">
                  <Plus className="button-icon" />
                  Start New OPN Airdrop
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reown Modal */}
        <appkit-modal></appkit-modal>
      </div>
    );
  }

  // MAIN PAGE
  return (
    <div className="app-container">
      <div className="app-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="main-content-centered">
        {/* Centered Logo Section */}
        <div className="centered-logo-section">
          <img src="/iopn-logo.png" alt="IOPn Logo" className="main-logo-large" />
          
          {/* Wallet Status Under Logo */}
          <div className="wallet-status-centered">
            <button onClick={openAccountModal} className="wallet-info-button">
              <Wallet className="wallet-icon" />
              <span className="wallet-address">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            </button>
            <button onClick={openNetworkModal} className="network-button">
              <span className="network-badge">{getNetworkName(chainId)}</span>
            </button>
            <button onClick={disconnectWallet} className="disconnect-btn-small">
              Disconnect
            </button>
          </div>
        </div>

        {/* Contract Status */}
        {contractReady && whitelistStatus.isFeeExempt && (
          <div className="fee-exempt-banner">
            <Check className="banner-icon" />
            <span>You are fee-exempt for airdrops</span>
          </div>
        )}

        {!contractReady && (
          <div className="warning-banner">
            <AlertCircle />
            <p>Airdrop contract not available on {getNetworkName(chainId)}.</p>
          </div>
        )}

        {/* Main Content */}
        <div className="content-area">
          <div className="content-container">
            
            {/* Add Recipients Section */}
            <div className="manual-entry-section">
              <h2 className="section-title">Add IOPn Recipients</h2>
              <p className="section-description">Distribute OPN tokens to IOPn network participants</p>
              
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
                        </>
                      ) : (
                        <>
                          <option value="NATIVE">{NETWORKS[chainId]?.symbol || 'NATIVE'}</option>
                          <option value="OPN">OPN (ERC20)</option>
                        </>
                      )}
                    </select>
                  </div>
                  <button onClick={addManualRecipient} className="add-recipient-button">
                    <Plus />
                    Add
                  </button>
                </div>
              </div>

              {/* CSV Upload */}
              <div className="csv-upload-section">
                <div className="upload-row">
                  <label className="csv-upload-button">
                    <Upload />
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="file-input"
                    />
                  </label>
                  <button onClick={downloadTemplate} className="template-button">
                    <Download />
                    Download Template
                  </button>
                </div>
              </div>
            </div>

            {/* Recipients List */}
            {recipients.length > 0 && (
              <div className="recipients-section">
                <h3 className="recipients-title">Recipients ({recipients.length})</h3>
                <div className="recipients-list">
                  {recipients.map((recipient) => (
                    <div key={recipient.id} className="recipient-item">
                      <div className="recipient-info">
                        <span className="recipient-address">{recipient.address}</span>
                        <span className="recipient-amount">
                          {recipient.amount} {recipient.tokenType}
                        </span>
                        <span className={`recipient-source ${recipient.source}`}>
                          {recipient.source}
                        </span>
                      </div>
                      <button 
                        onClick={() => removeRecipient(recipient.id)} 
                        className="remove-recipient"
                      >
                        <X className="remove-icon" />
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
                  disabled={!contractReady || isProcessing}
                >
                  <Send />
                  {isProcessing ? 'Processing...' : 'Start Airdrop'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Help Button */}
        <button onClick={() => setShowHelpModal(true)} className="help-button-fixed">
          <HelpCircle className="help-icon" />
          How It Works
        </button>

        {/* Help Modal */}
        {showHelpModal && <HelpModal />}

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="modal-overlay" onClick={() => setShowConfirmation(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowConfirmation(false)}>
                <X />
              </button>
              
              <h2>Confirm Airdrop</h2>
              
              <div className="confirmation-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Recipients:</span>
                  <span className="summary-value">{recipients.length}</span>
                </div>
                
                <div className="summary-item">
                  <span className="summary-label">Total Amount:</span>
                  <span className="summary-value">
                    {recipients.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)} tokens
                  </span>
                </div>
                
                {!whitelistStatus.isFeeExempt && (
                  <div className="summary-item fee">
                    <span className="summary-label">Fee:</span>
                    <span className="summary-value">{feeInfo.formatted} {feeInfo.symbol}</span>
                  </div>
                )}
              </div>
              
              <p className="confirmation-warning">
                This action will distribute tokens to all listed recipients. 
                Please ensure all addresses and amounts are correct.
              </p>
              
              <div className="modal-buttons">
                <button onClick={() => setShowConfirmation(false)} className="modal-cancel">
                  Cancel
                </button>
                <button onClick={executeAirdrop} className="modal-confirm" disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="spinning" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send />
                      Confirm Airdrop
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reown Modal */}
      <appkit-modal></appkit-modal>
    </div>
  );
}

export default App;