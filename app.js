// Configuration
const CONFIG = {
    NETWORK: {
        chainId: '0x45c', // Core Testnet 2
        chainName: 'Core Testnet 2',
        rpcUrl: 'https://rpc.test2.btcs.network',
        blockExplorer: 'https://scan.test2.btcs.network'
    },
    CONTRACT_ADDRESS: '0xYourContractAddress' // Replace with your contract
};

// Application State
const state = {
    provider: null,
    signer: null,
    contract: null,
    userAddress: null,
    isMember: false,
    votingPower: 0
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkWalletConnection();
});

// Event Listeners
function setupEventListeners() {
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    document.getElementById('joinDAO').addEventListener('click', joinDAO);
    document.getElementById('createProposal').addEventListener('click', showProposalForm);
    document.getElementById('cancelProposal').addEventListener('click', hideProposalForm);
    document.getElementById('proposalForm').addEventListener('submit', handleProposalSubmit);
    
    // Wallet events
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
    }
}

// Wallet Connection
async function connectWallet() {
    try {
        if (!window.ethereum) {
            showToast('Please install MetaMask!', 'error');
            return;
        }

        showLoading('Connecting wallet...');
        
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        
        state.provider = new ethers.providers.Web3Provider(window.ethereum);
        state.signer = state.provider.getSigner();
        state.userAddress = accounts[0];
        
        // Check network
        const network = await state.provider.getNetwork();
        if (network.chainId !== parseInt(CONFIG.NETWORK.chainId, 16)) {
            await switchNetwork();
        }
        
        await updateUI();
        showToast('Wallet connected successfully!', 'success');
        
    } catch (error) {
        console.error('Connection error:', error);
        showToast('Failed to connect wallet', 'error');
    } finally {
        hideLoading();
    }
}

async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.NETWORK.chainId }]
        });
    } catch (error) {
        if (error.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: CONFIG.NETWORK.chainId,
                    chainName: CONFIG.NETWORK.chainName,
                    rpcUrls: [CONFIG.NETWORK.rpcUrl],
                    blockExplorerUrls: [CONFIG.NETWORK.blockExplorer]
                }]
            });
        }
    }
}

async function checkWalletConnection() {
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        state.userAddress = null;
        updateUI();
    } else {
        window.location.reload();
    }
}

// DAO Functions
async function joinDAO() {
    try {
        showLoading('Joining DAO...');
        
        // Simulate transaction
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        state.isMember = true;
        state.votingPower = 100;
        
        updateUI();
        showToast('Successfully joined the DAO!', 'success');
        
    } catch (error) {
        console.error('Join DAO error:', error);
        showToast('Failed to join DAO', 'error');
    } finally {
        hideLoading();
    }
}

// Proposal Functions
function showProposalForm() {
    document.getElementById('proposalCreation').style.display = 'block';
    document.getElementById('proposalCreation').scrollIntoView({ behavior: 'smooth' });
}

function hideProposalForm() {
    document.getElementById('proposalCreation').style.display = 'none';
    document.getElementById('proposalForm').reset();
}

async function handleProposalSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('proposalTitle').value;
    const description = document.getElementById('proposalDescription').value;
    const category = document.getElementById('proposalCategory').value;
    
    try {
        showLoading('Creating proposal...');
        
        // Simulate transaction
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showToast('Proposal created successfully!', 'success');
        hideProposalForm();
        
    } catch (error) {
        console.error('Create proposal error:', error);
        showToast('Failed to create proposal', 'error');
    } finally {
        hideLoading();
    }
}

// UI Updates
async function updateUI() {
    if (state.userAddress) {
        // Update wallet info
        document.getElementById('walletAddress').textContent = 
            `${state.userAddress.slice(0, 6)}...${state.userAddress.slice(-4)}`;
        
        const balance = await state.provider.getBalance(state.userAddress);
        document.getElementById('walletBalance').textContent = 
            `${ethers.utils.formatEther(balance).slice(0, 6)} ETH`;
        
        // Update network status
        document.getElementById('networkIndicator').classList.add('connected');
        document.getElementById('networkName').textContent = CONFIG.NETWORK.chainName;
        
        // Update member status
        if (state.isMember) {
            document.getElementById('memberInfo').innerHTML = 
                '<p class="status-text">✓ Active Member</p>';
            document.getElementById('createProposal').disabled = false;
        } else {
            document.getElementById('memberInfo').innerHTML = 
                '<p class="status-text">Not a member</p>';
            document.getElementById('joinDAO').disabled = false;
        }
        
        // Update voting power
        document.querySelector('.power-display').textContent = state.votingPower;
        
        // Update connect button
        document.getElementById('connectWallet').innerHTML = 
            `<i class="fas fa-wallet"></i><span>Connected</span>`;
    }
}

// Utility Functions
function showLoading(message = 'Loading...') {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
