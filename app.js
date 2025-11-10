// app.js
/* global ethers */
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const connectBtn = document.getElementById('connectWallet');
  const connectLabel = document.getElementById('connectLabel');
  const networkName = document.getElementById('networkName');
  const networkIndicator = document.getElementById('networkIndicator');
  const walletAddressEl = document.getElementById('walletAddress');
  const walletBalanceEl = document.getElementById('walletBalance');
  const joinDAO = document.getElementById('joinDAO');
  const createProposalBtn = document.getElementById('createProposal');
  const proposalCreation = document.getElementById('proposalCreation');
  const proposalForm = document.getElementById('proposalForm');
  const cancelProposal = document.getElementById('cancelProposal');
  const proposalDescription = document.getElementById('proposalDescription');
  const charCount = document.getElementById('charCount');

  // Vote modal
  const voteModal = document.getElementById('voteModal');
  const voteAmount = document.getElementById('voteAmount');
  const voteCount = document.getElementById('voteCount');
  const voteCost = document.getElementById('voteCost');
  const voteRemaining = document.getElementById('voteRemaining');
  const powerDisplay = document.getElementById('powerDisplay');
  const confirmVote = document.getElementById('confirmVote');
  const closeModalBtn = document.getElementById('closeModal');

  // Loading + Toasts
  const loadingOverlay = document.getElementById('loadingOverlay');
  const toastContainer = document.getElementById('toastContainer');

  // App state
  let provider = null;
  let signer = null;
  let userAddress = null;
  let credits = 0; // voting credits (example)

  // Basic UI helpers
  function showToast(message, type = 'info', timeout = 4000) {
    const div = document.createElement('div');
    div.className = `toast toast-${type}`;
    div.textContent = message;
    toastContainer.appendChild(div);
    setTimeout(() => div.remove(), timeout);
  }
  function showLoading(msg = 'Processing...') {
    loadingOverlay.style.display = 'flex';
    loadingOverlay.setAttribute('aria-hidden', 'false');
    const msgEl = document.getElementById('loadingMessage');
    if (msgEl) msgEl.textContent = msg;
  }
  function hideLoading() {
    loadingOverlay.style.display = 'none';
    loadingOverlay.setAttribute('aria-hidden', 'true');
  }

  // Quadratic cost function
  function quadraticCost(votes) {
    // cost = votes^2
    return votes * votes;
  }

  // Update vote calculator UI
  function updateVoteUI() {
    const v = parseInt(voteAmount.value, 10) || 1;
    const cost = quadraticCost(v);
    voteCount.textContent = v;
    voteCost.textContent = cost;
    const remaining = Math.max(0, credits - cost);
    voteRemaining.textContent = remaining;
    // disable confirm if insufficient credits
    confirmVote.disabled = cost > credits;
  }

  // Wire vote amount change
  voteAmount.addEventListener('input', updateVoteUI);

  // Modal open/close
  function openVoteModal({ title = '', desc = '' } = {}) {
    document.getElementById('modalProposalTitle').textContent = title;
    document.getElementById('modalProposalDesc').textContent = desc;
    voteModal.style.display = 'block';
    voteModal.setAttribute('aria-hidden', 'false');
    // reset slider
    voteAmount.value = 1;
    updateVoteUI();
    // focus
    confirmVote.focus();
    // basic trap: listen for Esc to close
    document.addEventListener('keydown', escCloseHandler);
  }

  function closeVoteModal() {
    voteModal.style.display = 'none';
    voteModal.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', escCloseHandler);
  }

  function escCloseHandler(e) {
    if (e.key === 'Escape') closeVoteModal();
  }

  closeModalBtn.addEventListener('click', closeVoteModal);

  // Confirm vote handler (example only — no on-chain tx)
  confirmVote.addEventListener('click', () => {
    const v = parseInt(voteAmount.value, 10);
    const cost = quadraticCost(v);
    if (cost > credits) {
      showToast('Insufficient voting credits', 'error');
      return;
    }
    // simulate processing
    showLoading('Submitting vote...');
    setTimeout(() => {
      hideLoading();
      credits -= cost;
      powerDisplay.textContent = credits;
      showToast(`Voted ${v} (${cost} credits). Thank you!`, 'success');
      closeVoteModal();
    }, 900);
  });

  // Proposal form char counter
  if (proposalDescription) {
    proposalDescription.addEventListener('input', () => {
      const len = proposalDescription.value.length;
      charCount.textContent = len;
    });
  }

  // Show/hide proposal form
  createProposalBtn.addEventListener('click', () => {
    const expanded = createProposalBtn.getAttribute('aria-expanded') === 'true';
    if (!expanded) {
      // show
      proposalCreation.style.display = 'block';
      proposalCreation.setAttribute('aria-hidden', 'false');
      createProposalBtn.setAttribute('aria-expanded', 'true');
      proposalCreation.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  cancelProposal.addEventListener('click', () => {
    proposalCreation.style.display = 'none';
    proposalCreation.setAttribute('aria-hidden', 'true');
    createProposalBtn.setAttribute('aria-expanded', 'false');
  });

  // Handle proposal submission (UI only)
  proposalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('proposalTitle').value.trim();
    const description = document.getElementById('proposalDescription').value.trim();
    if (!title || !description) {
      showToast('Please complete required fields', 'warning');
      return;
    }
    showLoading('Publishing proposal...');
    setTimeout(() => {
      hideLoading();
      showToast('Proposal submitted (UI only). Integrate with smart contract to persist.', 'info');
      // reset form
      proposalForm.reset();
      charCount.textContent = '0';
      // hide form
      proposalCreation.style.display = 'none';
      proposalCreation.setAttribute('aria-hidden', 'true');
      createProposalBtn.setAttribute('aria-expanded', 'false');
      // TODO: refresh proposal list
    }, 700);
  });

  // Wallet connect using ethers (read-only provider + optional signer)
  async function connectWallet() {
    if (!window.ethereum) {
      showToast('No Web3 wallet detected. Install MetaMask or similar.', 'error');
      return;
    }
    try {
      provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
      // request account access
      await provider.send('eth_requestAccounts', []);
      signer = provider.getSigner();
      userAddress = await signer.getAddress();
      const network = await provider.getNetwork();

      // small UI updates
      walletAddressEl.textContent = `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`;
      networkName.textContent = network.name || `chain:${network.chainId}`;
      networkIndicator.classList.add('connected');
      connectLabel.textContent = 'Connected';
      connectBtn.setAttribute('aria-pressed', 'true');

      // example: read ETH balance
      const balance = await provider.getBalance(userAddress);
      const eth = ethers.utils.formatEther(balance);
      walletBalanceEl.textContent = `${parseFloat(eth).toFixed(4)} ETH`;

      // example: set credits based on some local logic (in a real dApp this comes from a contract)
      credits = 100; // example starting credits per member
      powerDisplay.textContent = credits;
      joinDAO.disabled = false;
      createProposalBtn.disabled = false;
      showToast('Wallet connected', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to connect wallet', 'error');
    }
  }

  connectBtn.addEventListener('click', connectWallet);

  // Example: populate a couple of mock proposals and wire vote buttons
  const proposalsList = document.getElementById('proposalsList');

  const mockProposals = [
    { id: 1, title: 'Increase development grant', status: 'active', desc: 'Allocate 10 ETH to the dev team.' },
    { id: 2, title: 'Lower joining fee', status: 'active', desc: 'Reduce fee to 0.05 ETH for new members.' },
    { id: 3, title: 'Partnership with X', status: 'passed', desc: 'Enter strategic partnership with project X.' }
  ];

  function renderProposals(list = []) {
    proposalsList.innerHTML = '';
    list.forEach(p => {
      const card = document.createElement('article');
      card.className = 'proposal-card';
      card.innerHTML = `
        <div class="proposal-header">
          <div>
            <div class="proposal-title">${p.title}</div>
            <div class="proposal-meta">${p.status} • ID ${p.id}</div>
          </div>
          <div>
            <span class="proposal-status ${p.status === 'active' ? 'status-active' : ''}">${p.status}</span>
          </div>
        </div>
        <div class="proposal-description">${p.desc}</div>
        <div class="proposal-actions" style="display:flex;gap:.5rem;justify-content:flex-end;">
          <button class="btn btn-primary btn-vote" data-id="${p.id}" type="button" ${p.status !== 'active' ? 'disabled' : ''}><i class="fas fa-vote-yea" aria-hidden="true"></i> Vote</button>
          <button class="btn btn-outline btn-view" data-id="${p.id}" type="button">View</button>
        </div>
      `;
      proposalsList.appendChild(card);
    });

    // wire vote buttons
    document.querySelectorAll('.btn-vote').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const p = mockProposals.find(x => String(x.id) === String(id));
        openVoteModal({ title: p.title, desc: p.desc });
      });
    });
  }

  renderProposals(mockProposals);

  // Basic search filter
  const searchInput = document.getElementById('searchProposals');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const filtered = mockProposals.filter(p => p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
      renderProposals(filtered);
    });
  }

  // initial vote UI state
  updateVoteUI();
});
