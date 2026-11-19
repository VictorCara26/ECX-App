const AVATAR_LABELS = {
  goblin: 'GB',
  shiba: 'SH',
  cyber: 'CY',
  phoenix: 'PX'
};

let appState = {
  user: null,
  bounties: [],
  memes: null,
  selectedBountyId: null
};

let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById('ecxToast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function initAmbientParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 24; i++) {
    const spark = document.createElement('div');
    spark.className = 'spark';
    const size = (Math.random() * 3 + 1.5).toFixed(1);
    spark.style.width = `${size}px`;
    spark.style.height = `${size}px`;
    spark.style.left = `${(Math.random() * 100).toFixed(2)}%`;
    spark.style.top = `${(Math.random() * 100).toFixed(2)}%`;
    spark.style.setProperty('--dur', `${(Math.random() * 8 + 8).toFixed(1)}s`);
    container.appendChild(spark);
  }
}

function openModal(modalId) {
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.remove('open'));
  if (modalId && modalId !== 'none') {
    const target = document.getElementById(modalId);
    if (target) target.classList.add('open');
  }
}

function renderAvatarElement(container, user) {
  container.innerHTML = '';
  if (user.avatarUrl) {
    const img = document.createElement('img');
    img.src = user.avatarUrl;
    img.alt = user.displayName;
    container.appendChild(img);
  } else {
    container.textContent = AVATAR_LABELS[user.avatar] || user.displayName.slice(0, 2).toUpperCase();
  }
}

function renderUserAndWallet() {
  const user = appState.user;
  if (!user) return;

  // Header status pills
  document.getElementById('headerBalanceText').textContent = `${user.wallet.balanceEcx.toLocaleString()} ECX`;
  document.getElementById('headerUsernameText').textContent = user.username;
  renderAvatarElement(document.getElementById('headerAvatarBadge'), user);

  // Active Wallet Modal
  document.getElementById('walletOriginBadge').textContent = user.wallet.origin;
  document.getElementById('walletBalanceDisplay').textContent = `${user.wallet.balanceEcx.toLocaleString()} ECX`;
  document.getElementById('walletAddressDisplay').textContent = user.wallet.address;

  const seedGrid = document.getElementById('seedWordsGrid');
  seedGrid.innerHTML = '';
  user.wallet.seedPhrase.split(' ').forEach((word, index) => {
    const pill = document.createElement('div');
    pill.className = 'seed-word-pill';
    pill.textContent = `${index + 1}. ${word}`;
    seedGrid.appendChild(pill);
  });

  const txList = document.getElementById('walletTxList');
  txList.innerHTML = '';
  user.wallet.transactions.slice(0, 6).forEach((tx) => {
    const row = document.createElement('div');
    row.className = 'tx-row';
    const sign = tx.direction === 'in' ? '+' : '-';
    row.innerHTML = `
      <div>
        <div class="ivory-bold">${tx.type}</div>
        <div class="mono-muted">${tx.txid}</div>
      </div>
      <span class="mono-gold">${sign}${tx.amount} ECX</span>
    `;
    txList.appendChild(row);
  });

  // Populate User Profile Form
  document.getElementById('profileDisplayName').value = user.displayName || '';
  document.getElementById('profileUsername').value = user.username || '';
  document.getElementById('profileEmail').value = user.email || '';
  document.getElementById('profileBio').value = user.bio || '';
  document.getElementById('profileAvatarUrl').value = user.avatarUrl || '';
  document.getElementById('socialTwitter').value = user.socials?.twitter || '';
  document.getElementById('socialGithub').value = user.socials?.github || '';
  document.getElementById('socialTelegram').value = user.socials?.telegram || '';
  document.getElementById('socialDiscord').value = user.socials?.discord || '';
  document.getElementById('socialWebsite').value = user.socials?.website || '';

  renderAvatarElement(document.getElementById('profileAvatarPreview'), user);
  document.querySelectorAll('#avatarPresetsRow .avatar-preset-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.avatar === user.avatar);
  });
}

function renderBounties() {
  const bounties = appState.bounties || [];
  if (!bounties.length) return;

  if (!appState.selectedBountyId || !bounties.some((b) => b.id === appState.selectedBountyId)) {
    appState.selectedBountyId = bounties[0].id;
  }

  const featured = bounties.find((b) => b.id === appState.selectedBountyId) || bounties[0];

  // Update Phone Mockup inside Bounty Goblins card
  document.getElementById('featuredBountyCat').textContent = featured.category;
  document.getElementById('featuredBountyPrice').textContent = `${featured.priceEcx} ECX`;
  document.getElementById('featuredBountyTitle').textContent = featured.title;
  document.getElementById('featuredBountyDesc').textContent = featured.description;

  const condList = document.getElementById('featuredBountyConditions');
  condList.innerHTML = '';
  featured.conditions.forEach((cond) => {
    const li = document.createElement('li');
    li.textContent = cond;
    condList.appendChild(li);
  });

  const claimBtn = document.getElementById('btnClaimFeaturedBounty');
  claimBtn.textContent = featured.status === 'Paid'
    ? `Paid to ${featured.claimedBy || 'Contributor'}`
    : `Deliver Proof & Earn ${featured.priceEcx} ECX`;
  claimBtn.disabled = featured.status === 'Paid';

  // Update Side List on Main Stage
  document.getElementById('bountyCountLabel').textContent = `${bounties.length} Listed`;
  const sideStack = document.getElementById('bountyShowcaseList');
  sideStack.innerHTML = '';

  bounties.slice(0, 3).forEach((b) => {
    const card = document.createElement('div');
    card.className = `bounty-mini-card ${b.id === featured.id ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="bounty-mini-top">
        <span class="bounty-mini-title">${b.title}</span>
        <span class="mono-gold">${b.priceEcx} ECX</span>
      </div>
      <div class="bounty-mini-conds">${b.conditions.length} Conditions · ${b.category} · ${b.status}</div>
    `;
    card.addEventListener('click', () => {
      appState.selectedBountyId = b.id;
      renderBounties();
    });
    sideStack.appendChild(card);
  });

  // Update Full Bounty Modal Feed (Price + All Conditions)
  const modalFeed = document.getElementById('modalBountyFeed');
  modalFeed.innerHTML = '';
  bounties.forEach((b) => {
    const item = document.createElement('div');
    item.className = 'bounty-full-card';
    const condHtml = b.conditions.map((c) => `<li>${c}</li>`).join('');
    item.innerHTML = `
      <div class="bounty-full-head">
        <div>
          <div class="bounty-full-title">${b.title}</div>
          <div class="bounty-full-meta">${b.category} · Posted by ${b.sponsor} · ${b.deadline}</div>
        </div>
        <span class="bounty-price-tag">${b.priceEcx} ECX</span>
      </div>
      <p class="card-copy-xs">${b.description}</p>
      <div class="conditions-box">
        <div class="conditions-label">REQUIRED CONDITIONS</div>
        <ul class="conditions-list">${condHtml}</ul>
      </div>
    `;
    modalFeed.appendChild(item);
  });
}

function renderMemes() {
  const memes = appState.memes;
  if (!memes) return;

  const a = memes.activeBattle.contenderA;
  const b = memes.activeBattle.contenderB;
  const total = a.votes + b.votes;
  const pctA = Math.round((a.votes / total) * 100);
  const pctB = 100 - pctA;

  document.getElementById('memeShareA').textContent = `${pctA}%`;
  document.getElementById('memeShareB').textContent = `${pctB}%`;
  document.getElementById('votePctLeft').textContent = `${pctA}% (${a.votes.toLocaleString()})`;
  document.getElementById('votePctRight').textContent = `${pctB}% (${b.votes.toLocaleString()})`;
  document.getElementById('voteBarLeft').style.width = `${pctA}%`;
  document.getElementById('voteBarRight').style.width = `${pctB}%`;

  const lbList = document.getElementById('memeLeaderboardList');
  lbList.innerHTML = '';
  memes.leaderboard.forEach((row) => {
    const div = document.createElement('div');
    div.className = 'lb-row';
    div.innerHTML = `
      <span><strong class="gold-text">#${row.rank}</strong> ${row.handle}</span>
      <span class="mono-gold">${row.earnedEcx.toLocaleString()} ECX</span>
    `;
    lbList.appendChild(div);
  });
}

async function fetchInitialState() {
  const res = await fetch('/api/state');
  const data = await res.json();
  appState.user = data.user;
  appState.bounties = data.bounties;
  appState.memes = data.memes;
  renderUserAndWallet();
  renderBounties();
  renderMemes();
}

function bindEvents() {
  // Modal openers
  document.querySelectorAll('[data-modal-target]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.dataset.modalTarget;
      document.querySelectorAll('.command-nav .nav-pill').forEach((p) => p.classList.remove('active'));
      if (el.classList.contains('nav-pill')) el.classList.add('active');
      openModal(target);
    });
  });

  // Modal closers
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => openModal('none'));
  });

  // Wallet modal sub-tabs
  document.querySelectorAll('#walletModalTabs .modal-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#walletModalTabs .modal-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('#walletModal .modal-pane').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.pane).classList.add('active');
    });
  });

  // Reveal/hide 12-word seed
  document.getElementById('btnToggleSeed').addEventListener('click', (e) => {
    const grid = document.getElementById('seedWordsGrid');
    const isBlurred = grid.classList.toggle('blurred');
    e.target.textContent = isBlurred ? 'Reveal Seed' : 'Hide Seed';
  });

  // Copy eCash address
  document.getElementById('btnCopyAddress').addEventListener('click', async () => {
    if (!appState.user) return;
    await navigator.clipboard.writeText(appState.user.wallet.address);
    showToast('eCash address copied to clipboard.');
  });

  // Sign-Up & Generate Wallet Form
  document.getElementById('paneSignupWallet').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      username: document.getElementById('signupUsername').value,
      displayName: document.getElementById('signupDisplayName').value,
      email: document.getElementById('signupEmail').value
    };
    const res = await fetch('/api/wallet/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Could not create wallet.');

    appState.user = data.user;
    renderUserAndWallet();
    document.querySelector('#walletModalTabs [data-pane="paneActiveWallet"]').click();
    showToast(data.message);
  });

  // Import Wallet Seed Form
  document.getElementById('paneImportWallet').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      seedPhrase: document.getElementById('importSeedInput').value,
      username: document.getElementById('importUsernameInput').value
    };
    const res = await fetch('/api/wallet/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Invalid seed phrase.');

    appState.user = data.user;
    renderUserAndWallet();
    document.querySelector('#walletModalTabs [data-pane="paneActiveWallet"]').click();
    showToast(data.message);
  });

  // Avatar Preset Selection
  document.querySelectorAll('#avatarPresetsRow .avatar-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#avatarPresetsRow .avatar-preset-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (appState.user) {
        appState.user.avatar = btn.dataset.avatar;
        appState.user.avatarUrl = '';
        document.getElementById('profileAvatarUrl').value = '';
        renderAvatarElement(document.getElementById('profileAvatarPreview'), appState.user);
      }
    });
  });

  // Save User Profile Form
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const activePreset = document.querySelector('#avatarPresetsRow .avatar-preset-btn.active');
    const payload = {
      displayName: document.getElementById('profileDisplayName').value,
      username: document.getElementById('profileUsername').value,
      email: document.getElementById('profileEmail').value,
      bio: document.getElementById('profileBio').value,
      avatar: activePreset ? activePreset.dataset.avatar : 'goblin',
      avatarUrl: document.getElementById('profileAvatarUrl').value,
      socials: {
        twitter: document.getElementById('socialTwitter').value,
        github: document.getElementById('socialGithub').value,
        telegram: document.getElementById('socialTelegram').value,
        discord: document.getElementById('socialDiscord').value,
        website: document.getElementById('socialWebsite').value
      }
    };

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Failed to save profile.');

    appState.user = data.user;
    renderUserAndWallet();
    openModal('none');
    showToast(data.message);
  });

  // Create New Bounty Form (with Price & Conditions)
  document.getElementById('createBountyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawConditions = document.getElementById('bountyConditionsInput').value;
    const conditions = rawConditions.split('\n').map((line) => line.trim()).filter(Boolean);

    const payload = {
      title: document.getElementById('bountyTitleInput').value,
      priceEcx: Number(document.getElementById('bountyPriceInput').value),
      category: document.getElementById('bountyCategoryInput').value,
      description: document.getElementById('bountyDescInput').value,
      conditions
    };

    const res = await fetch('/api/bounties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Could not publish bounty.');

    appState.bounties = data.bounties;
    appState.selectedBountyId = data.bounty.id;
    renderBounties();
    e.target.reset();
    showToast(data.message);
  });

  // Deliver Proof & Claim Featured Bounty
  document.getElementById('btnClaimFeaturedBounty').addEventListener('click', async () => {
    if (!appState.selectedBountyId) return;
    const res = await fetch(`/api/bounties/${appState.selectedBountyId}/claim`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Unable to claim bounty.');

    appState.bounties = data.bounties;
    appState.user = data.user;
    renderBounties();
    renderUserAndWallet();
    showToast(data.message);
  });

  // MemeWars Vote & Tip
  document.getElementById('btnVoteMeme').addEventListener('click', async () => {
    const res = await fetch('/api/memes/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side: 'left' })
    });
    const data = await res.json();
    appState.memes = data.memes;
    appState.user = data.user;
    renderMemes();
    renderUserAndWallet();
    showToast(data.message);
  });

  document.getElementById('btnTipMeme').addEventListener('click', async () => {
    const res = await fetch('/api/memes/tip', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Tip failed.');

    appState.memes = data.memes;
    appState.user = data.user;
    renderMemes();
    renderUserAndWallet();
    showToast(data.message);
  });

  // STUBS Seat Selection
  document.querySelectorAll('#stubSeatGrid .seat-node:not(.taken)').forEach((seatBtn) => {
    seatBtn.addEventListener('click', () => {
      document.querySelectorAll('#stubSeatGrid .seat-node').forEach((s) => s.classList.remove('selected'));
      seatBtn.classList.add('selected');
      const { seat, price } = seatBtn.dataset;
      document.getElementById('selectedSeatLabel').textContent = `Selected: ${seat}`;
      document.getElementById('stubSeatBadge').textContent = `Seat ${seat}`;
      document.getElementById('stubPriceTag').textContent = `${price} ECX`;
      showToast(`Selected ${seat} (${price} ECX)`);
    });
  });

  // Generic toast triggers
  document.querySelectorAll('[data-toast]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(btn.dataset.toast));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAmbientParticles();
  bindEvents();
  fetchInitialState();
});