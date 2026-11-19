const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BOUNTIES_FILE = path.join(DATA_DIR, 'bounties.json');
const MEMES_FILE = path.join(DATA_DIR, 'memes.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Wordlist used by backend to generate deterministic 12-word recovery seeds
const SEED_WORDS = [
  'amber', 'anchor', 'apex', 'arc', 'atlas', 'aurora', 'badge', 'beacon',
  'blaze', 'block', 'bounty', 'bridge', 'bronze', 'canyon', 'chain', 'cipher',
  'citadel', 'cobalt', 'comet', 'copper', 'cosmos', 'crest', 'crown', 'crystal',
  'cyber', 'dawn', 'delta', 'dome', 'dragon', 'drift', 'dune', 'echo',
  'eclipse', 'ember', 'emerald', 'empire', 'energy', 'epoch', 'escrow', 'falcon',
  'flame', 'flux', 'forge', 'frontier', 'galaxy', 'genesis', 'glacier', 'goblin',
  'golden', 'guardian', 'harbor', 'horizon', 'hunter', 'ignite', 'ivory', 'jade',
  'kairo', 'kinetic', 'lantern', 'ledger', 'legend', 'lumen', 'lunar', 'matrix',
  'meteor', 'mint', 'mirage', 'monarch', 'nebula', 'nexus', 'nova', 'obsidian',
  'oracle', 'orbit', 'origin', 'paladin', 'phoenix', 'pioneer', 'pixel', 'prism',
  'protocol', 'pulse', 'quantum', 'quest', 'radar', 'raven', 'relic', 'ridge',
  'rocket', 'royal', 'saffron', 'satoshi', 'sentinel', 'shadow', 'shiba', 'signal',
  'solar', 'spark', 'specter', 'sphere', 'summit', 'titan', 'token', 'torch',
  'vanguard', 'vault', 'vector', 'velvet', 'vertex', 'vortex', 'warden', 'zenith'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function generateMnemonicSeed() {
  const words = [];
  for (let i = 0; i < 12; i++) {
    const idx = crypto.randomInt(0, SEED_WORDS.length);
    words.push(SEED_WORDS[idx]);
  }
  return words.join(' ');
}

function deriveEcashAddress(seedPhrase) {
  const normalized = seedPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `ecash:qp${hash.slice(0, 38)}`;
}

function createTxId() {
  const hex = crypto.randomBytes(8).toString('hex');
  return `0x${hex.slice(0, 4)}...${hex.slice(-4)}`;
}

function getActiveUser(usersDb) {
  return usersDb.users.find((u) => u.id === usersDb.activeUserId) || usersDb.users[0];
}

// ==================== API ENDPOINTS ====================

// Get full ecosystem state
app.get('/api/state', (req, res) => {
  const usersDb = readJson(USERS_FILE);
  const bountiesDb = readJson(BOUNTIES_FILE);
  const memesDb = readJson(MEMES_FILE);
  const activeUser = getActiveUser(usersDb);

  res.json({
    user: activeUser,
    bounties: bountiesDb.bounties,
    memes: memesDb
  });
});

// Sign-up & auto-generate new on-site eCash wallet
app.post('/api/wallet/signup', (req, res) => {
  const { username, displayName, email } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required to generate a wallet.' });
  }

  const usersDb = readJson(USERS_FILE);
  const cleanHandle = username.trim().startsWith('@')
    ? username.trim().toLowerCase()
    : `@${username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')}`;

  const seedPhrase = generateMnemonicSeed();
  const address = deriveEcashAddress(seedPhrase);
  const newUser = {
    id: `usr_${Date.now()}`,
    username: cleanHandle,
    displayName: (displayName && displayName.trim()) || cleanHandle.replace('@', ''),
    email: (email && email.trim()) || '',
    bio: 'Building and earning on the eCash (ECX) consumer ecosystem.',
    avatar: 'goblin',
    avatarUrl: '',
    socials: {
      twitter: cleanHandle,
      github: '',
      telegram: cleanHandle,
      discord: '',
      website: ''
    },
    wallet: {
      address,
      seedPhrase,
      balanceEcx: 500,
      origin: 'Generated on Sign-Up',
      createdAt: new Date().toISOString(),
      transactions: [
        {
          txid: createTxId(),
          type: 'Welcome Grant',
          amount: 500,
          direction: 'in',
          timestamp: new Date().toISOString()
        }
      ]
    }
  };

  usersDb.users.push(newUser);
  usersDb.activeUserId = newUser.id;
  writeJson(USERS_FILE, usersDb);

  res.status(201).json({
    message: 'Account created and eCash wallet generated.',
    user: newUser
  });
});

// Import an existing wallet via seed phrase
app.post('/api/wallet/import', (req, res) => {
  const { seedPhrase, username } = req.body;
  if (!seedPhrase || !seedPhrase.trim()) {
    return res.status(400).json({ error: 'Please enter a valid 12 or 24-word seed phrase.' });
  }

  const normalizedSeed = seedPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
  const wordCount = normalizedSeed.split(' ').length;
  if (wordCount !== 12 && wordCount !== 24) {
    return res.status(400).json({ error: `Seed phrase must be 12 or 24 words (received ${wordCount}).` });
  }

  const usersDb = readJson(USERS_FILE);
  const derivedAddress = deriveEcashAddress(normalizedSeed);

  // Check if wallet already exists in JSON store
  let existingUser = usersDb.users.find((u) => u.wallet.address === derivedAddress);

  if (!existingUser) {
    const fallbackHandle = username && username.trim()
      ? (username.trim().startsWith('@') ? username.trim().toLowerCase() : `@${username.trim().toLowerCase()}`)
      : `@ecx_${derivedAddress.slice(-5)}`;

    existingUser = {
      id: `usr_${Date.now()}`,
      username: fallbackHandle,
      displayName: fallbackHandle.replace('@', '').toUpperCase(),
      email: '',
      bio: 'Imported external eCash wallet holder.',
      avatar: 'shiba',
      avatarUrl: '',
      socials: {
        twitter: '',
        github: '',
        telegram: '',
        discord: '',
        website: ''
      },
      wallet: {
        address: derivedAddress,
        seedPhrase: normalizedSeed,
        balanceEcx: 1000,
        origin: 'Imported External Seed',
        createdAt: new Date().toISOString(),
        transactions: [
          {
            txid: createTxId(),
            type: 'Seed Wallet Sync',
            amount: 1000,
            direction: 'in',
            timestamp: new Date().toISOString()
          }
        ]
      }
    };
    usersDb.users.push(existingUser);
  }

  usersDb.activeUserId = existingUser.id;
  writeJson(USERS_FILE, usersDb);

  res.json({
    message: 'Wallet imported and synced with eCash backend.',
    user: existingUser
  });
});

// Update User Profile (personal info, avatar, description, social networks)
app.put('/api/profile', (req, res) => {
  const { displayName, username, email, bio, avatar, avatarUrl, socials } = req.body;
  const usersDb = readJson(USERS_FILE);
  const user = getActiveUser(usersDb);

  if (displayName !== undefined) user.displayName = displayName.trim() || user.displayName;
  if (username !== undefined && username.trim()) {
    user.username = username.trim().startsWith('@')
      ? username.trim().toLowerCase()
      : `@${username.trim().toLowerCase()}`;
  }
  if (email !== undefined) user.email = email.trim();
  if (bio !== undefined) user.bio = bio.trim();
  if (avatar !== undefined) user.avatar = avatar;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl.trim();
  if (socials && typeof socials === 'object') {
    user.socials = {
      twitter: (socials.twitter || '').trim(),
      github: (socials.github || '').trim(),
      telegram: (socials.telegram || '').trim(),
      discord: (socials.discord || '').trim(),
      website: (socials.website || '').trim()
    };
  }

  writeJson(USERS_FILE, usersDb);
  res.json({ message: 'Profile saved.', user });
});

// List all bounties (includes price & conditions)
app.get('/api/bounties', (req, res) => {
  const bountiesDb = readJson(BOUNTIES_FILE);
  res.json({ bounties: bountiesDb.bounties });
});

// Create a new bounty with ECX price and conditions
app.post('/api/bounties', (req, res) => {
  const { title, category, description, priceEcx, deadline, conditions } = req.body;
  const numericPrice = Number(priceEcx);

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Bounty title is required.' });
  }
  if (!numericPrice || numericPrice <= 0) {
    return res.status(400).json({ error: 'A valid ECX price greater than 0 is required.' });
  }

  const parsedConditions = Array.isArray(conditions)
    ? conditions.map((c) => String(c).trim()).filter(Boolean)
    : [];

  if (parsedConditions.length === 0) {
    return res.status(400).json({ error: 'At least one completion condition is required.' });
  }

  const usersDb = readJson(USERS_FILE);
  const bountiesDb = readJson(BOUNTIES_FILE);
  const activeUser = getActiveUser(usersDb);

  const newBounty = {
    id: `bnt_${Date.now()}`,
    title: title.trim(),
    category: (category && category.trim()) || 'Development',
    description: (description && description.trim()) || 'Complete all listed conditions for instant ECX payout.',
    priceEcx: numericPrice,
    sponsor: activeUser.username,
    deadline: (deadline && deadline.trim()) || '5 days left',
    status: 'Open',
    conditions: parsedConditions
  };

  bountiesDb.bounties.unshift(newBounty);
  writeJson(BOUNTIES_FILE, bountiesDb);

  res.status(201).json({
    message: `Bounty listed for ${numericPrice} ECX.`,
    bounty: newBounty,
    bounties: bountiesDb.bounties
  });
});

// Claim / submit proof for a bounty
app.post('/api/bounties/:id/claim', (req, res) => {
  const bountiesDb = readJson(BOUNTIES_FILE);
  const usersDb = readJson(USERS_FILE);
  const activeUser = getActiveUser(usersDb);

  const bounty = bountiesDb.bounties.find((b) => b.id === req.params.id);
  if (!bounty) {
    return res.status(404).json({ error: 'Bounty not found.' });
  }
  if (bounty.status === 'Paid') {
    return res.status(400).json({ error: 'This bounty has already been paid out.' });
  }

  bounty.status = 'Paid';
  bounty.claimedBy = activeUser.username;

  activeUser.wallet.balanceEcx += bounty.priceEcx;
  activeUser.wallet.transactions.unshift({
    txid: createTxId(),
    type: `Bounty Payout: ${bounty.title}`,
    amount: bounty.priceEcx,
    direction: 'in',
    timestamp: new Date().toISOString()
  });

  writeJson(BOUNTIES_FILE, bountiesDb);
  writeJson(USERS_FILE, usersDb);

  res.json({
    message: `Verified & Paid! +${bounty.priceEcx} ECX sent to ${activeUser.username}.`,
    bounties: bountiesDb.bounties,
    user: activeUser
  });
});

// MemeWars vote endpoint
app.post('/api/memes/vote', (req, res) => {
  const { side } = req.body;
  const memesDb = readJson(MEMES_FILE);
  const usersDb = readJson(USERS_FILE);
  const activeUser = getActiveUser(usersDb);

  if (side === 'right') {
    memesDb.activeBattle.contenderB.votes += 1;
  } else {
    memesDb.activeBattle.contenderA.votes += 1;
  }

  activeUser.wallet.balanceEcx += 2;
  activeUser.wallet.transactions.unshift({
    txid: createTxId(),
    type: 'MemeWars Voter Reward',
    amount: 2,
    direction: 'in',
    timestamp: new Date().toISOString()
  });

  writeJson(MEMES_FILE, memesDb);
  writeJson(USERS_FILE, usersDb);

  res.json({
    message: 'Vote recorded on-chain! +2 ECX reward earned.',
    memes: memesDb,
    user: activeUser
  });
});

// MemeWars tip endpoint
app.post('/api/memes/tip', (req, res) => {
  const tipAmount = 25;
  const usersDb = readJson(USERS_FILE);
  const memesDb = readJson(MEMES_FILE);
  const activeUser = getActiveUser(usersDb);

  if (activeUser.wallet.balanceEcx < tipAmount) {
    return res.status(400).json({ error: 'Insufficient ECX balance to tip.' });
  }

  activeUser.wallet.balanceEcx -= tipAmount;
  activeUser.wallet.transactions.unshift({
    txid: createTxId(),
    type: `Tipped ${memesDb.activeBattle.contenderA.creator}`,
    amount: tipAmount,
    direction: 'out',
    timestamp: new Date().toISOString()
  });

  memesDb.leaderboard[0].earnedEcx += tipAmount;

  writeJson(USERS_FILE, usersDb);
  writeJson(MEMES_FILE, memesDb);

  res.json({
    message: `Sent ${tipAmount} ECX micro-tip to ${memesDb.activeBattle.contenderA.creator}!`,
    memes: memesDb,
    user: activeUser
  });
});

app.listen(PORT, () => {
  console.log(`eCash Ecosystem server running at http://localhost:${PORT}`);
});