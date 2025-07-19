import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Send, Wallet, ArrowRight, Check, X, Receipt, Plus, Trash2, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { ethers } from 'ethers';
import './App.css';

const App = () => {
  const [currentPage, setCurrentPage] = useState('welcome'); // welcome, main, receipt
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletError, setWalletError] = useState('');
  const [provider, setProvider] = useState(null); // eslint-disable-line no-unused-vars
  const [signer, setSigner] = useState(null); // eslint-disable-line no-unused-vars
  const [chainId, setChainId] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [manualRecipient, setManualRecipient] = useState({ address: '', amount: '', tokenType: 'OPN' });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [airdropResults, setAirdropResults] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleChainChanged = useCallback((chainId) => {
    // Reload to reset state when chain changes
    window.location.reload();
  }, []);

  // Check if wallet is already connected on load
  useEffect(() => {
    checkWalletConnection();
    
    // Listen for account changes
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
  }, [handleAccountsChanged, handleChainChanged, checkWalletConnection]);

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
    };
    return networks[chainId] || `Chain ID: ${chainId}`;
  };

  // Add manual recipient
  const addManualRecipient = () => {
    if (manualRecipient.address && manualRecipient.amount) {
      setRecipients([...recipients, { 
        ...manualRecipient, 
        id: Date.now(),
        source: 'manual'
      }]);
      setManualRecipient({ address: '', amount: '', tokenType: 'OPN' });
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

  // Execute airdrop
  const executeAirdrop = async () => {
    setShowConfirmation(false);
    
    // Simulate airdrop execution
    const results = {
      total: recipients.length,
      successful: [],
      failed: [],
      timestamp: new Date().toISOString()
    };

    for (let i = 0; i < recipients.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate processing
      
      const success = Math.random() > 0.1; // 90% success rate
      const txHash = '0x' + Math.random().toString(16).substr(2, 40);
      
      if (success) {
        results.successful.push({
          ...recipients[i],
          txHash,
          status: 'success'
        });
      } else {
        results.failed.push({
          ...recipients[i],
          error: 'Insufficient gas or network error',
          status: 'failed'
        });
      }
    }
    
    setAirdropResults(results);
    setCurrentPage('receipt');
  };

  const downloadTemplate = () => {
    const csvContent = "wallet_address,amount,token_type\n0x742d35Cc8545EB5c8C5B0cB1234567890abcdef,100,OPN\n0x123d35Cc8545EB5c8C5B0cB9876543210fedcba,50,ERC20";
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
    setManualRecipient({ address: '', amount: '', tokenType: 'OPN' });
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
                              <span>TX: {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}</span>
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
                        <option value="OPN">OPN (Native)</option>
                        <option value="ERC20">ERC-20 Token</option>
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
                  <button onClick={() => setShowConfirmation(true)} className="airdrop-button">
                    <Send className="button-icon" />
                    Execute Airdrop ({recipients.length} recipients)
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