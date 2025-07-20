import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Send, Wallet, ArrowRight, Check, X, Receipt, Plus, Trash2, AlertCircle, HelpCircle } from 'lucide-react';
import Papa from 'papaparse';
import { ethers } from 'ethers';
import './App.css';
// Contract imports
import { 
  getAirdropContract, 
  executeNativeTokenAirdrop,
  checkWhitelistStatus,
  getFeeInfo,
  isValidAddress,
  getExplorerUrl
} from './contracts/contractUtils';
import { NETWORKS } from './contracts/config';
import { CONTRACT_ADDRESSES } from './contracts/AirdropContractABI';

const App = () => {
  // Page state: welcome -> connect -> main -> receipt
  const [currentPage, setCurrentPage] = useState('welcome');
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Wallet state
const [isWalletConnected, setIsWalletConnected] = useState(false);
const [walletAddress, setWalletAddress] = useState('');
const [walletError, setWalletError] = useState('');
const [provider, setProvider] = useState(null); // eslint-disable-line no-unused-vars
const [signer, setSigner] = useState(null);
const [chainId, setChainId] = useState(null);
  
  // Airdrop state
  const [recipients, setRecipients] = useState([]);
  const [manualRecipient, setManualRecipient] = useState({ 
    address: '', 
    amount: '', 
    tokenType: 'OPN' 
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [airdropResults, setAirdropResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Contract state
  const [whitelistStatus, setWhitelistStatus] = useState({ 
    isWhitelisted: false, 
    isFeeExempt: false,
    whitelistEnabled: true, 
    canUseAirdrop: false 
  });
  const [feeInfo, setFeeInfo] = useState({ 
    feeAmount: '0', 
    feeAmountFormatted: '0.01',
    isNativeFee: true 
  });
  const [contractReady, setContractReady] = useState(false);
  
  const fileInputRef = useRef(null);

  // How-to content component
  const HowToContent = () => (
    <div className="how-to-content">
      <h3>How to Use OPN Drop</h3>
      <ol>
        <li>Connect your MetaMask wallet to the IOPn network</li>
        <li>Add recipient addresses manually or upload a CSV file</li>
        <li>Specify the amount of OPN tokens for each recipient</li>
        <li>Review your distribution list</li>
        <li>Click "Execute Airdrop" to initiate the transfer</li>
        <li>Approve the transaction in MetaMask</li>
        <li>Wait for confirmation and receive your receipt</li>
      </ol>
      <p className="how-to-note">
        <strong>Note:</strong> Fee-exempt addresses pay no fees. Other users pay 0.01 OPN per airdrop.
      </p>
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

  // Connect wallet
  const connectWallet = async () => {
    try {
      setWalletError('');
      
      if (!window.ethereum) {
        setWalletError('MetaMask is not installed. Please install MetaMask to continue.');
        return;
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
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

  // Disconnect wallet
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
    setCurrentPage('connect');
  };

  // Get network name
  const getNetworkName = (chainId) => {
    return NETWORKS[chainId]?.name || `Chain ID: ${chainId}`;
  };

  // Check contract status when wallet connects
  useEffect(() => {
    if (isWalletConnected && signer && chainId) {
      checkContractStatus();
      const defaultTokenType = chainId === '984' ? 'OPN' : 'NATIVE';
      setManualRecipient(prev => ({ ...prev, tokenType: defaultTokenType }));
    }
  }, [isWalletConnected, signer, chainId, checkContractStatus]);

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
            <h1 className="welcome-title">Welcome to OPN Drop</h1>
            <p className="welcome-subtitle">Official airdrop for the Internet of People Network ecosystem</p>
            
            <button 
              onClick={() => setCurrentPage('connect')}
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

  // CONNECT WALLET PAGE
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
                <span className="title-line">IOPn</span>
                <span className="title-line">Airdrop</span>
              </h1>
              <p className="connect-subtitle">Seamlessly distribute OPN tokens across the IOPn ecosystem</p>
            </div>

            <div className="how-to-section">
              <HowToContent />
            </div>

            <div className="connect-wallet-section">
              {!isWalletConnected ? (
                <button onClick={connectWallet} className="connect-wallet-btn">
                  <Wallet className="button-icon" />
                  Connect MetaMask
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
                  <p className="app-subtitle">Your OPN tokens have been distributed successfully</p>
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
                                View Transaction
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
                  Start New OPN Airdrop
                </button>
              </div>
            </div>
          </div>
        </div>
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
            <Wallet className="wallet-icon" />
            <span className="wallet-address">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            <span className="network-badge">{getNetworkName(chainId)}</span>
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
                        <option value="OPN">OPN (Native)</option>
                      ) : (
                        <>
                          <option value="NATIVE">{NETWORKS[chainId]?.symbol || 'Native'}</option>
                          <option value="OPN">OPN Token</option>
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

            {/* Execute Airdrop Button */}
            {recipients.length > 0 && (
              <div className="airdrop-section">
                <button 
                  onClick={() => setShowConfirmation(true)} 
                  className="airdrop-button"
                  disabled={isProcessing || !contractReady}
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

        {/* Help Button - Fixed Bottom Right */}
        <button onClick={() => setShowHelpModal(true)} className="help-button-fixed">
          <HelpCircle className="help-icon" />
          Help
        </button>

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="modal-overlay" onClick={() => setShowConfirmation(false)}>
            <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Confirm Airdrop</h3>
              <p>You're about to send tokens to {recipients.length} recipients.</p>
              {!whitelistStatus.isFeeExempt && (
                <p className="fee-warning">Fee: {feeInfo.feeAmountFormatted} OPN</p>
              )}
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

        {/* Help Modal */}
        {showHelpModal && <HelpModal />}
      </div>
    </div>
  );
};

export default App;