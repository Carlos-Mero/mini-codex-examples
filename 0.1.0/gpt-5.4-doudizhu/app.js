const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const SUITS = [
  { key: "spade", symbol: "♠", red: false },
  { key: "heart", symbol: "♥", red: true },
  { key: "club", symbol: "♣", red: false },
  { key: "diamond", symbol: "♦", red: true }
];
const RANK_LABELS = {
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
  15: "2",
  16: "SJ",
  17: "BJ"
};
const PLAYER_NAMES = ["You", "Computer A", "Computer B"];
const TYPE_LABELS = {
  single: "Single",
  pair: "Pair",
  triple: "Triple",
  triple_single: "Triple + Single",
  triple_pair: "Triple + Pair",
  straight: "Straight",
  pair_straight: "Consecutive Pairs",
  airplane: "Airplane",
  airplane_single: "Airplane + Singles",
  airplane_pair: "Airplane + Pairs",
  four_two_singles: "Four + Two Singles",
  four_two_pairs: "Four + Two Pairs",
  bomb: "Bomb",
  rocket: "Rocket"
};
const LEAD_PRIORITY = {
  airplane_pair: 1,
  airplane_single: 2,
  airplane: 3,
  straight: 4,
  pair_straight: 5,
  triple_pair: 6,
  triple_single: 7,
  four_two_pairs: 8,
  four_two_singles: 9,
  triple: 10,
  pair: 11,
  single: 12,
  bomb: 90,
  rocket: 100
};

const els = {
  phaseLabel: document.getElementById("phaseLabel"),
  turnLabel: document.getElementById("turnLabel"),
  bidLabel: document.getElementById("bidLabel"),
  messageLabel: document.getElementById("messageLabel"),
  biddingPanel: document.getElementById("biddingPanel"),
  bottomCards: document.getElementById("bottomCards"),
  logList: document.getElementById("logList"),
  playBtn: document.getElementById("playBtn"),
  passBtn: document.getElementById("passBtn"),
  hintBtn: document.getElementById("hintBtn"),
  restartBtn: document.getElementById("restartBtn"),
  bidButtons: Array.from(document.querySelectorAll("[data-bid]")),
  playerPanels: [
    document.getElementById("player0"),
    document.getElementById("player1"),
    document.getElementById("player2")
  ]
};

const state = {
  players: [],
  bottomCards: [],
  phase: "idle",
  currentPlayer: 0,
  bidOrder: [],
  bidIndex: 0,
  highestBid: 0,
  highestBidder: null,
  landlord: null,
  currentTrick: { lastPlay: null, lastPlayer: null, passes: 0 },
  selected: new Set(),
  log: [],
  message: "Starting game...",
  winner: null,
  timer: null
};

function init() {
  els.restartBtn.addEventListener("click", startNewGame);
  els.playBtn.addEventListener("click", onPlaySelected);
  els.passBtn.addEventListener("click", onPass);
  els.hintBtn.addEventListener("click", onHint);
  els.bidButtons.forEach((button) => {
    button.addEventListener("click", () => onHumanBid(Number(button.dataset.bid)));
  });
  startNewGame();
}

function clearTimer() {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

function schedule(fn, delay = 850) {
  clearTimer();
  state.timer = setTimeout(() => {
    state.timer = null;
    fn();
  }, delay);
}

function startNewGame() {
  clearTimer();
  const deck = shuffle(createDeck());
  state.players = PLAYER_NAMES.map((name, id) => ({
    id,
    name,
    isHuman: id === 0,
    hand: [],
    role: "Farmer",
    bid: null,
    lastActionText: "",
    lastActionCards: []
  }));

  for (let i = 0; i < 17; i += 1) {
    for (let p = 0; p < 3; p += 1) {
      state.players[p].hand.push(deck.pop());
    }
  }

  state.bottomCards = deck.splice(0, 3);
  state.players.forEach((player) => sortHand(player.hand));
  state.phase = "bidding";
  const starter = Math.floor(Math.random() * 3);
  state.bidOrder = [0, 1, 2].map((offset) => (starter + offset) % 3);
  state.bidIndex = 0;
  state.highestBid = 0;
  state.highestBidder = null;
  state.landlord = null;
  state.currentPlayer = state.bidOrder[0];
  state.currentTrick = { lastPlay: null, lastPlayer: null, passes: 0 };
  state.selected = new Set();
  state.log = [];
  state.winner = null;
  state.message = `${state.players[state.currentPlayer].name} starts the bidding.`;
  state.players.forEach((player) => {
    player.role = "Farmer";
    player.bid = null;
    player.lastActionText = "";
    player.lastActionCards = [];
  });
  addLog("A new game has started.");
  addLog(`${state.players[state.currentPlayer].name} bids first.`);
  render();
  maybeRunAi();
}

function createDeck() {
  let id = 1;
  const deck = [];
  for (const rank of RANKS.slice(0, 13)) {
    for (const suit of SUITS) {
      deck.push({
        id,
        rank,
        suit: suit.key,
        suitSymbol: suit.symbol,
        red: suit.red
      });
      id += 1;
    }
  }
  deck.push({ id, rank: 16, suit: "joker", suitSymbol: "", red: false });
  id += 1;
  deck.push({ id, rank: 17, suit: "joker", suitSymbol: "", red: true });
  return deck;
}

function shuffle(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

function sortHand(hand) {
  hand.sort((a, b) => a.rank - b.rank || String(a.suit).localeCompare(String(b.suit)));
}

function addLog(text) {
  state.log.unshift(text);
  state.log = state.log.slice(0, 14);
}

function onHumanBid(score) {
  if (state.phase !== "bidding" || state.currentPlayer !== 0) return;
  if (score !== 0 && score <= state.highestBid) return;
  handleBid(0, score);
}

function handleBid(playerId, score) {
  const player = state.players[playerId];
  player.bid = score;

  if (score > 0) {
    state.highestBid = score;
    state.highestBidder = playerId;
    state.message = `${player.name} bids ${score}.`;
    addLog(`${player.name} bids ${score}.`);
  } else {
    state.message = `${player.name} passes.`;
    addLog(`${player.name} passes.`);
  }

  const biddingEnds = score === 3 || state.bidIndex >= state.bidOrder.length - 1;
  if (biddingEnds) {
    if (state.highestBidder === null) {
      state.message = "Nobody bid. Redealing...";
      addLog("Nobody bid. Cards are redealt.");
      render();
      schedule(startNewGame, 1000);
      return;
    }
    beginPlay();
    return;
  }

  state.bidIndex += 1;
  state.currentPlayer = state.bidOrder[state.bidIndex];
  render();
  maybeRunAi();
}

function beginPlay() {
  state.phase = "playing";
  state.landlord = state.highestBidder;
  const landlord = state.players[state.landlord];
  landlord.role = "Landlord";
  landlord.hand.push(...state.bottomCards);
  sortHand(landlord.hand);
  state.currentPlayer = state.landlord;
  state.currentTrick = { lastPlay: null, lastPlayer: null, passes: 0 };
  state.selected.clear();
  state.players.forEach((player) => {
    if (player.id !== state.landlord) player.role = "Farmer";
    player.lastActionText = "";
    player.lastActionCards = [];
  });
  state.message = `${landlord.name} becomes the landlord and plays first.`;
  addLog(`${landlord.name} becomes the landlord and takes the bottom cards.`);
  render();
  maybeRunAi();
}

function maybeRunAi() {
  if (state.winner !== null) return;

  if (state.phase === "bidding" && state.currentPlayer !== 0) {
    schedule(() => {
      const hand = state.players[state.currentPlayer].hand;
      const desiredBid = estimateBid(hand);
      const actualBid = desiredBid > state.highestBid ? desiredBid : 0;
      handleBid(state.currentPlayer, actualBid);
    });
  }

  if (state.phase === "playing" && state.currentPlayer !== 0) {
    schedule(() => runAiTurn(state.currentPlayer));
  }
}

function estimateBid(hand) {
  const groups = countByRank(hand);
  let score = 0;
  for (const [rank, cards] of groups.entries()) {
    const count = cards.length;
    if (rank === 17) score += 4;
    else if (rank === 16) score += 3;
    else if (rank === 15) score += count * 2.2;
    else if (rank === 14) score += count * 1.4;
    else if (rank === 13) score += count * 0.9;
    else if (rank >= 11) score += count * 0.5;
    if (count === 4) score += 4;
    if (count === 3) score += 1.4;
  }
  const plays = generateAllPlays(hand);
  const chainCount = plays.filter((play) => ["straight", "pair_straight", "airplane", "airplane_single", "airplane_pair"].includes(play.combo.type)).length;
  score += Math.min(chainCount * 0.35, 2.5);
  if (score >= 14) return 3;
  if (score >= 10) return 2;
  if (score >= 7) return 1;
  return 0;
}

function onPlaySelected() {
  if (state.phase !== "playing" || state.currentPlayer !== 0 || state.winner !== null) return;
  const human = state.players[0];
  const cards = human.hand.filter((card) => state.selected.has(card.id));
  if (!cards.length) {
    setMessage("Select cards to play.");
    return;
  }
  const combo = analyzeCards(cards);
  if (!combo) {
    setMessage("That is not a valid Dou Dizhu combination.");
    return;
  }
  if (!canBeat(combo, state.currentTrick.lastPlay ? state.currentTrick.lastPlay.combo : null)) {
    setMessage("Those cards do not beat the current play.");
    return;
  }
  playCards(0, cards, combo);
}

function onPass() {
  if (state.phase !== "playing" || state.currentPlayer !== 0 || state.winner !== null) return;
  if (!state.currentTrick.lastPlay || state.currentTrick.lastPlayer === 0) {
    setMessage("You cannot pass when you are leading the trick.");
    return;
  }
  handlePass(0);
}

function onHint() {
  if (state.phase !== "playing" || state.currentPlayer !== 0 || state.winner !== null) return;
  const human = state.players[0];
  const suggestion = chooseAiPlay(human.hand, state.currentTrick.lastPlay, true, human.hand.length, getNextPlayer(0));
  if (!suggestion) {
    state.selected.clear();
    state.message = "No playable response. You should pass.";
    render();
    return;
  }
  state.selected = new Set(suggestion.cards.map((card) => card.id));
  state.message = `Hint: ${describeCombo(suggestion.combo)}.`;
  render();
}

function runAiTurn(playerId) {
  if (state.phase !== "playing" || state.currentPlayer !== playerId || state.winner !== null) return;
  const player = state.players[playerId];
  const suggestion = chooseAiPlay(player.hand, state.currentTrick.lastPlay, false, player.hand.length, getNextPlayer(playerId));
  if (!suggestion) {
    handlePass(playerId);
    return;
  }
  playCards(playerId, suggestion.cards, suggestion.combo);
}

function chooseAiPlay(hand, lastPlay, isHint, handSize, nextPlayerId) {
  const plays = generateAllPlays(hand);
  if (!plays.length) return null;

  const exactOut = plays.find((play) => play.cards.length === hand.length && canBeat(play.combo, lastPlay ? lastPlay.combo : null));
  if (exactOut) return exactOut;

  if (!lastPlay) {
    const leads = sortLeadCandidates(plays, isHint);
    return leads.length ? leads[0] : null;
  }

  let responses = plays.filter((play) => canBeat(play.combo, lastPlay.combo));
  if (!responses.length) return null;

  const sameType = responses.filter((play) => play.combo.type === lastPlay.combo.type);
  if (sameType.length) {
    sameType.sort(compareResponses);
    return sameType[0];
  }

  const nextPlayer = state.players[nextPlayerId];
  const danger = nextPlayer.hand.length <= 2 || handSize <= 5;
  if (!danger && !isHint) return null;

  const bombs = responses.filter((play) => play.combo.type === "bomb").sort(compareResponses);
  if (bombs.length) return bombs[0];
  return responses.find((play) => play.combo.type === "rocket") || null;
}

function sortLeadCandidates(plays, isHint) {
  const sorted = plays.slice().sort((a, b) => {
    const typeDiff = (LEAD_PRIORITY[a.combo.type] || 50) - (LEAD_PRIORITY[b.combo.type] || 50);
    if (typeDiff !== 0) return typeDiff;
    const lengthDiff = b.cards.length - a.cards.length;
    if (lengthDiff !== 0) return lengthDiff;
    return a.combo.rank - b.combo.rank;
  });
  if (isHint) return sorted;
  const safe = sorted.filter((play) => play.combo.type !== "bomb" && play.combo.type !== "rocket");
  return safe.length ? safe : sorted;
}

function compareResponses(a, b) {
  if (a.combo.type !== b.combo.type) {
    return (LEAD_PRIORITY[a.combo.type] || 50) - (LEAD_PRIORITY[b.combo.type] || 50);
  }
  if ((a.combo.chainLength || 0) !== (b.combo.chainLength || 0)) {
    return (a.combo.chainLength || 0) - (b.combo.chainLength || 0);
  }
  if (a.combo.rank !== b.combo.rank) return a.combo.rank - b.combo.rank;
  return a.cards.length - b.cards.length;
}

function playCards(playerId, cards, combo) {
  const player = state.players[playerId];
  const ids = new Set(cards.map((card) => card.id));
  player.hand = player.hand.filter((card) => !ids.has(card.id));
  sortHand(player.hand);
  player.lastActionCards = cards.slice().sort((a, b) => a.rank - b.rank);
  player.lastActionText = describeCombo(combo);
  state.currentTrick = {
    lastPlay: { playerId, cards: player.lastActionCards, combo },
    lastPlayer: playerId,
    passes: 0
  };
  state.selected.clear();
  state.message = `${player.name} plays ${describeCombo(combo)}.`;
  addLog(`${player.name}: ${describeCards(cards)} (${describeCombo(combo)})`);

  if (player.hand.length === 0) {
    finishGame(playerId);
    return;
  }

  state.currentPlayer = getNextPlayer(playerId);
  render();
  maybeRunAi();
}

function handlePass(playerId) {
  const player = state.players[playerId];
  player.lastActionCards = [];
  player.lastActionText = "Pass";
  state.currentTrick.passes += 1;
  state.message = `${player.name} passes.`;
  addLog(`${player.name} passes.`);
  state.currentPlayer = getNextPlayer(playerId);

  if (state.currentTrick.passes >= 2 && state.currentTrick.lastPlay) {
    const leader = state.players[state.currentTrick.lastPlayer];
    state.currentTrick = { lastPlay: null, lastPlayer: null, passes: 0 };
    state.message = `${leader.name} wins the trick and leads again.`;
    addLog(`${leader.name} wins the trick and leads again.`);
  }

  render();
  maybeRunAi();
}

function finishGame(playerId) {
  state.phase = "finished";
  state.winner = playerId;
  state.currentPlayer = playerId;
  const winner = state.players[playerId];
  const teamText = playerId === state.landlord ? "Landlord side wins!" : "Farmers win!";
  state.message = `${winner.name} wins. ${teamText}`;
  addLog(`${winner.name} wins the game. ${teamText}`);
  render();
}

function getNextPlayer(playerId) {
  return (playerId + 1) % 3;
}

function setMessage(text) {
  state.message = text;
  els.messageLabel.textContent = text;
}

function render() {
  els.phaseLabel.textContent = capitalize(state.phase);
  els.turnLabel.textContent = state.players.length ? state.players[state.currentPlayer].name : "-";
  if (state.phase === "bidding") {
    els.bidLabel.textContent = state.highestBid ? `${state.highestBid} by ${state.players[state.highestBidder].name}` : "No bids yet";
  } else {
    els.bidLabel.textContent = state.landlord !== null ? `${state.players[state.landlord].name} is landlord` : "-";
  }
  els.messageLabel.textContent = state.message;
  els.biddingPanel.classList.toggle("hidden", !(state.phase === "bidding" && state.currentPlayer === 0));
  renderBidButtons();
  renderBottomCards();
  renderPlayers();
  renderLog();
  renderActionButtons();
}

function renderBidButtons() {
  els.bidButtons.forEach((button) => {
    const bid = Number(button.dataset.bid);
    button.disabled = state.phase !== "bidding" || state.currentPlayer !== 0 || (bid !== 0 && bid <= state.highestBid);
  });
}

function renderBottomCards() {
  els.bottomCards.innerHTML = "";
  if (!state.bottomCards.length) {
    els.bottomCards.appendChild(createEmptySlot("-"));
    return;
  }
  const reveal = state.phase !== "bidding" || state.winner !== null;
  if (!reveal) {
    for (let i = 0; i < 3; i += 1) {
      els.bottomCards.appendChild(createCardBack());
    }
    return;
  }
  state.bottomCards.forEach((card) => {
    els.bottomCards.appendChild(createCardElement(card, { played: true }));
  });
}

function renderPlayers() {
  state.players.forEach((player) => {
    const panel = els.playerPanels[player.id];
    if (!panel) return;

    const current = state.phase !== "idle" && state.winner === null && state.currentPlayer === player.id;
    const revealHand = player.isHuman || state.phase === "finished";
    const bidText = player.bid === null ? "-" : player.bid === 0 ? "Pass" : String(player.bid);

    panel.innerHTML = `
      <div class="player-header">
        <div>
          <div class="player-name">${player.name}</div>
          <div class="small-label">Bid: ${bidText}</div>
        </div>
        <div class="badges">
          <span class="badge ${player.role === "Landlord" ? "landlord" : ""}">${player.role}</span>
          ${current ? "<span class=\"badge current\">Current Turn</span>" : ""}
          ${player.lastActionText === "Pass" ? "<span class=\"badge pass\">Pass</span>" : ""}
        </div>
      </div>
      <div class="meta-row">
        <span>Cards left: ${player.hand.length}</span>
        <span>${player.isHuman ? "Your hand" : "Computer player"}</span>
      </div>
      <div class="small-label">Last played</div>
      <div class="card-row played-row"></div>
      <div class="action-text ${player.lastActionText === "Pass" ? "pass" : ""}">${player.lastActionText || "&nbsp;"}</div>
      <div class="small-label">${player.isHuman ? "Hand" : "Hidden hand"}</div>
      <div class="card-row hand-row"></div>
      ${player.isHuman ? "<div class=\"instructions\">Supported plays: singles, pairs, triples, triple with single or pair, straights, consecutive pairs, airplanes, four with two, bombs, and rocket.</div>" : ""}
    `;

    const playedRow = panel.querySelector(".played-row");
    if (player.lastActionCards.length) {
      player.lastActionCards.forEach((card) => {
        playedRow.appendChild(createCardElement(card, { played: true }));
      });
    } else {
      playedRow.appendChild(createEmptySlot("None"));
    }

    const handRow = panel.querySelector(".hand-row");
    if (revealHand) {
      player.hand.forEach((card) => {
        const cardEl = createCardElement(card, { selected: player.isHuman && state.selected.has(card.id) });
        if (player.isHuman && state.phase === "playing" && state.winner === null) {
          cardEl.addEventListener("click", () => toggleSelected(card.id));
        }
        handRow.appendChild(cardEl);
      });
      if (!player.hand.length) handRow.appendChild(createEmptySlot("Empty"));
    } else {
      for (let i = 0; i < Math.min(player.hand.length, 17); i += 1) {
        handRow.appendChild(createCardBack());
      }
    }
  });
}

function renderLog() {
  if (!state.log.length) {
    els.logList.innerHTML = "<div class=\"log-item\">No actions yet.</div>";
    return;
  }
  els.logList.innerHTML = state.log.map((item) => `<div class="log-item">${item}</div>`).join("");
}

function renderActionButtons() {
  const canAct = state.phase === "playing" && state.currentPlayer === 0 && state.winner === null;
  els.playBtn.disabled = !canAct;
  els.hintBtn.disabled = !canAct;
  els.passBtn.disabled = !(canAct && state.currentTrick.lastPlay && state.currentTrick.lastPlayer !== 0);
}

function toggleSelected(cardId) {
  if (state.phase !== "playing" || state.currentPlayer !== 0 || state.winner !== null) return;
  if (state.selected.has(cardId)) state.selected.delete(cardId);
  else state.selected.add(cardId);
  render();
}

function createCardElement(card, options) {
  const el = document.createElement("button");
  const selected = options && options.selected;
  const played = options && options.played;
  el.className = `card${card.red ? " red" : ""}${selected ? " selected" : ""}${played ? " played" : ""}`;
  el.type = "button";
  el.textContent = formatCard(card);
  if (played) el.disabled = true;
  return el;
}

function createCardBack() {
  const el = document.createElement("div");
  el.className = "card-back";
  el.textContent = "🂠";
  return el;
}

function createEmptySlot(text) {
  const el = document.createElement("div");
  el.className = "empty-slot";
  el.textContent = text;
  return el;
}

function formatCard(card) {
  if (card.rank === 16) return "SJ";
  if (card.rank === 17) return "BJ";
  return `${card.suitSymbol}${RANK_LABELS[card.rank] || card.rank}`;
}

function describeCards(cards) {
  return cards.slice().sort((a, b) => a.rank - b.rank).map((card) => formatCard(card)).join(" ");
}

function describeCombo(combo) {
  const label = TYPE_LABELS[combo.type] || combo.type;
  if (["straight", "pair_straight", "airplane", "airplane_single", "airplane_pair"].includes(combo.type)) {
    return `${label} (${combo.chainLength})`;
  }
  return label;
}

function countByRank(cards) {
  const map = new Map();
  cards.forEach((card) => {
    if (!map.has(card.rank)) map.set(card.rank, []);
    map.get(card.rank).push(card);
  });
  return new Map(Array.from(map.entries()).sort((a, b) => a[0] - b[0]));
}

function analyzeCards(cards) {
  if (!cards || !cards.length) return null;
  const sorted = cards.slice().sort((a, b) => a.rank - b.rank);
  const groups = countByRank(sorted);
  const entries = Array.from(groups.entries()).map(([rank, arr]) => [rank, arr.length]);
  const len = sorted.length;
  const ranks = entries.map((entry) => entry[0]);
  const unique = entries.length;

  if (len === 1) return { type: "single", rank: sorted[0].rank };
  if (len === 2) {
    if (ranks.includes(16) && ranks.includes(17)) return { type: "rocket", rank: 17 };
    if (unique === 1) return { type: "pair", rank: ranks[0] };
    return null;
  }
  if (len === 3) {
    if (unique === 1) return { type: "triple", rank: ranks[0] };
    return null;
  }
  if (len === 4) {
    if (unique === 1) return { type: "bomb", rank: ranks[0] };
    const tripleRank = findRankWithCount(entries, 3);
    if (tripleRank !== null) return { type: "triple_single", rank: tripleRank };
    return null;
  }
  if (len === 5) {
    const tripleRank = findRankWithCount(entries, 3);
    const pairRank = findRankWithCount(entries, 2);
    if (tripleRank !== null && pairRank !== null) return { type: "triple_pair", rank: tripleRank };
  }

  if (isStraight(entries, len)) return { type: "straight", rank: ranks[ranks.length - 1], chainLength: len };
  if (isPairStraight(entries, len)) return { type: "pair_straight", rank: ranks[ranks.length - 1], chainLength: len / 2 };

  const airplane = detectAirplane(entries, len);
  if (airplane) return airplane;

  if (len === 6) {
    const fourRank = findRankWithCount(entries, 4);
    if (fourRank !== null) return { type: "four_two_singles", rank: fourRank };
  }

  if (len === 8) {
    const fourRank = findRankWithCount(entries, 4);
    if (fourRank !== null) {
      const rest = entries.filter((entry) => entry[0] !== fourRank);
      if (rest.length === 2 && rest.every((entry) => entry[1] === 2)) {
        return { type: "four_two_pairs", rank: fourRank };
      }
    }
  }

  return null;
}

function findRankWithCount(entries, count) {
  const found = entries.find((entry) => entry[1] === count);
  return found ? found[0] : null;
}

function isStraight(entries, len) {
  if (len < 5 || entries.length !== len) return false;
  if (entries.some((entry) => entry[1] !== 1 || entry[0] >= 15)) return false;
  return isConsecutive(entries.map((entry) => entry[0]));
}

function isPairStraight(entries, len) {
  if (len < 6 || len % 2 !== 0) return false;
  if (entries.some((entry) => entry[1] !== 2 || entry[0] >= 15)) return false;
  return isConsecutive(entries.map((entry) => entry[0]));
}

function detectAirplane(entries, len) {
  const counts = new Map(entries);
  if (len >= 6 && len % 3 === 0) {
    const run = findTripleRun(counts, len / 3, null);
    if (run) return { type: "airplane", rank: run[run.length - 1], chainLength: run.length };
  }
  if (len >= 8 && len % 4 === 0) {
    const run = findTripleRun(counts, len / 4, (rest) => rest.length === len / 4 && rest.every((entry) => entry[1] === 1));
    if (run) return { type: "airplane_single", rank: run[run.length - 1], chainLength: run.length };
  }
  if (len >= 10 && len % 5 === 0) {
    const run = findTripleRun(counts, len / 5, (rest) => rest.length === len / 5 && rest.every((entry) => entry[1] === 2));
    if (run) return { type: "airplane_pair", rank: run[run.length - 1], chainLength: run.length };
  }
  return null;
}

function findTripleRun(counts, targetLength, leftoverCheck) {
  if (targetLength < 2) return null;
  const ranks = Array.from(counts.entries())
    .filter((entry) => entry[0] < 15 && entry[1] >= 3)
    .map((entry) => entry[0])
    .sort((a, b) => a - b);
  if (ranks.length < targetLength) return null;

  for (let i = 0; i <= ranks.length - targetLength; i += 1) {
    const slice = ranks.slice(i, i + targetLength);
    if (!isConsecutive(slice)) continue;
    const temp = new Map(counts);
    slice.forEach((rank) => temp.set(rank, temp.get(rank) - 3));
    const rest = Array.from(temp.entries()).filter((entry) => entry[1] > 0);
    if (!rest.every((entry) => !slice.includes(entry[0]))) continue;
    if (!leftoverCheck) {
      if (rest.length === 0) return slice;
      continue;
    }
    if (leftoverCheck(rest)) return slice;
  }
  return null;
}

function isConsecutive(values) {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function canBeat(current, previous) {
  if (!current) return false;
  if (!previous) return true;
  if (current.type === "rocket") return true;
  if (previous.type === "rocket") return false;
  if (current.type === "bomb" && previous.type !== "bomb") return true;
  if (previous.type === "bomb" && current.type !== "bomb") return false;
  if (current.type !== previous.type) return false;

  if (["straight", "pair_straight", "airplane", "airplane_single", "airplane_pair"].includes(current.type)) {
    return current.chainLength === previous.chainLength && current.rank > previous.rank;
  }
  return current.rank > previous.rank;
}

function generateAllPlays(hand) {
  const groups = countByRank(hand);
  const entries = Array.from(groups.entries());
  const plays = [];
  const seen = new Set();

  function addPlay(cards) {
    const sorted = cards.slice().sort((a, b) => a.rank - b.rank || a.id - b.id);
    const key = sorted.map((card) => card.id).join("-");
    if (seen.has(key)) return;
    const combo = analyzeCards(sorted);
    if (!combo) return;
    seen.add(key);
    plays.push({ cards: sorted, combo });
  }

  entries.forEach((entry) => addPlay([entry[1][0]]));
  entries.forEach((entry) => { if (entry[1].length >= 2) addPlay(entry[1].slice(0, 2)); });
  entries.forEach((entry) => { if (entry[1].length >= 3) addPlay(entry[1].slice(0, 3)); });
  entries.forEach((entry) => { if (entry[1].length === 4) addPlay(entry[1].slice(0, 4)); });

  if (groups.has(16) && groups.has(17)) addPlay([groups.get(16)[0], groups.get(17)[0]]);

  const triples = entries.filter((entry) => entry[1].length >= 3);
  const singles = entries.map((entry) => entry[1][0]);
  const pairs = entries.filter((entry) => entry[1].length >= 2).map((entry) => entry[1].slice(0, 2));

  triples.forEach((entry) => {
    const rank = entry[0];
    const cards = entry[1].slice(0, 3);
    singles.forEach((single) => {
      if (single.rank !== rank) addPlay(cards.concat([single]));
    });
    pairs.forEach((pair) => {
      if (pair[0].rank !== rank) addPlay(cards.concat(pair));
    });
  });

  generateRuns(entries.filter((entry) => entry[0] < 15 && entry[1].length >= 1).map((entry) => entry[0]), 5)
    .forEach((run) => addPlay(run.map((rank) => groups.get(rank)[0])));

  generateRuns(entries.filter((entry) => entry[0] < 15 && entry[1].length >= 2).map((entry) => entry[0]), 3)
    .forEach((run) => addPlay(run.flatMap((rank) => groups.get(rank).slice(0, 2))));

  const tripleRuns = generateRuns(entries.filter((entry) => entry[0] < 15 && entry[1].length >= 3).map((entry) => entry[0]), 2);
  tripleRuns.forEach((run) => {
    const base = run.flatMap((rank) => groups.get(rank).slice(0, 3));
    addPlay(base);

    const singlePool = entries.filter((entry) => !run.includes(entry[0])).map((entry) => entry[1][0]);
    combinations(singlePool, run.length).forEach((pick) => addPlay(base.concat(pick)));

    const pairPool = entries.filter((entry) => !run.includes(entry[0]) && entry[1].length >= 2).map((entry) => entry[1].slice(0, 2));
    combinations(pairPool, run.length).forEach((pick) => addPlay(base.concat(pick.flat())));
  });

  entries.forEach((entry) => {
    if (entry[1].length !== 4) return;
    const bombCards = entry[1].slice(0, 4);
    const others = hand.filter((card) => card.rank !== entry[0]);
    combinations(others, 2).forEach((extra) => addPlay(bombCards.concat(extra)));

    const otherPairs = entries.filter((other) => other[0] !== entry[0] && other[1].length >= 2).map((other) => other[1].slice(0, 2));
    combinations(otherPairs, 2).forEach((pairPick) => addPlay(bombCards.concat(pairPick.flat())));
  });

  return plays;
}

function generateRuns(values, minLength) {
  const sorted = values.slice().sort((a, b) => a - b);
  const runs = [];
  let start = 0;
  while (start < sorted.length) {
    let end = start + 1;
    while (end < sorted.length && sorted[end] === sorted[end - 1] + 1) end += 1;
    const section = sorted.slice(start, end);
    if (section.length >= minLength) {
      for (let i = 0; i <= section.length - minLength; i += 1) {
        for (let j = i + minLength; j <= section.length; j += 1) {
          runs.push(section.slice(i, j));
        }
      }
    }
    start = end;
  }
  return runs;
}

function combinations(items, choose) {
  if (choose === 0) return [[]];
  if (items.length < choose) return [];
  const result = [];
  const path = [];

  function backtrack(index) {
    if (path.length === choose) {
      result.push(path.slice());
      return;
    }
    for (let i = index; i <= items.length - (choose - path.length); i += 1) {
      path.push(items[i]);
      backtrack(i + 1);
      path.pop();
    }
  }

  backtrack(0);
  return result;
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

init();
