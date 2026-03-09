const SUITS = ["♠", "♥", "♣", "♦"];
const SUIT_ORDER = { "♠": 0, "♥": 1, "♣": 2, "♦": 3, "☆": 4, "★": 5 };
const RANK_LABEL = {
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
  15: "2",
  16: "SJ",
  17: "BJ",
};

const SORT_MODES = ["grouped", "rank"];
const STORAGE_KEY = "ddz-deluxe-stats-v1";

const seatMap = {
  0: { info: "human-info", play: "human-play", hand: "human-hand", avatarClass: "human" },
  1: { info: "left-info", play: "left-play", hand: "left-hand", avatarClass: "left" },
  2: { info: "right-info", play: "right-play", hand: "right-hand", avatarClass: "right" },
};

const els = {
  roundValue: document.getElementById("round-value"),
  multiplierValue: document.getElementById("multiplier-value"),
  winsValue: document.getElementById("wins-value"),
  scoreValue: document.getElementById("score-value"),
  statusPill: document.getElementById("status-pill"),
  turnPill: document.getElementById("turn-pill"),
  bottomCards: document.getElementById("bottom-cards"),
  bidList: document.getElementById("bid-list"),
  selectionSummary: document.getElementById("selection-summary"),
  bidControls: document.getElementById("bid-controls"),
  playControls: document.getElementById("play-controls"),
  messageBox: document.getElementById("message-box"),
  logList: document.getElementById("log-list"),
  scoreGrid: document.getElementById("score-grid"),
  rulesPanel: document.getElementById("rules-panel"),
  overlay: document.getElementById("result-overlay"),
  resultBadge: document.getElementById("result-badge"),
  resultTitle: document.getElementById("result-title"),
  resultSubtitle: document.getElementById("result-subtitle"),
  resultStats: document.getElementById("result-stats"),
  playBtn: document.getElementById("play-btn"),
  passBtn: document.getElementById("pass-btn"),
  hintBtn: document.getElementById("hint-btn"),
  clearBtn: document.getElementById("clear-btn"),
  sortBtn: document.getElementById("sort-btn"),
  newGameBtn: document.getElementById("new-game-btn"),
  rulesToggleBtn: document.getElementById("rules-toggle-btn"),
  rematchBtn: document.getElementById("rematch-btn"),
  closeOverlayBtn: document.getElementById("close-overlay-btn"),
};

const state = {
  players: [
    createPlayer(0, "You", true),
    createPlayer(1, "West AI", false),
    createPlayer(2, "East AI", false),
  ],
  round: 0,
  phase: "idle",
  currentTurn: 0,
  startingBidder: 0,
  bidsTaken: 0,
  currentBid: 0,
  highestBidder: null,
  bottomCards: [],
  multiplier: 1,
  lastPlay: null,
  lastNonPassPlayer: null,
  selectedCardIds: new Set(),
  sortMode: "grouped",
  log: [],
  message: "Press New Match to begin.",
  status: "Welcome to the table.",
  biddingHistory: [],
  aiTimer: null,
  actionLocked: false,
  stats: loadStats(),
};

function createPlayer(id, name, isHuman) {
  return {
    id,
    name,
    isHuman,
    hand: [],
    role: null,
    bid: null,
    score: 0,
    latestAction: null,
    latestBidText: "",
  };
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { games: 0, humanWins: 0, humanScore: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      games: Number(parsed.games || 0),
      humanWins: Number(parsed.humanWins || 0),
      humanScore: Number(parsed.humanScore || 0),
    };
  } catch {
    return { games: 0, humanWins: 0, humanScore: 0 };
  }
}

function saveStats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats));
}

function createDeck() {
  const deck = [];
  let id = 0;
  for (let value = 3; value <= 15; value += 1) {
    for (const suit of SUITS) {
      deck.push({
        id: `c${id++}`,
        value,
        rank: RANK_LABEL[value],
        suit,
        color: suit === "♥" || suit === "♦" ? "red" : "black",
      });
    }
  }
  deck.push({
    id: `c${id++}`,
    value: 16,
    rank: "SJ",
    suit: "☆",
    color: "black",
    jokerText: "JOKER",
  });
  deck.push({
    id: `c${id++}`,
    value: 17,
    rank: "BJ",
    suit: "★",
    color: "red",
    jokerText: "JOKER",
  });
  return deck;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextPlayerId(id) {
  return (id + 1) % 3;
}

function sameTeam(playerA, playerB) {
  if (!playerA || !playerB || !playerA.role || !playerB.role) return false;
  return playerA.role === playerB.role;
}

function getOpponents(player) {
  return state.players.filter((p) => p.id !== player.id && !sameTeam(player, p));
}

function addLog(text) {
  state.log.unshift({ id: `${Date.now()}-${Math.random()}`, text });
  state.log = state.log.slice(0, 24);
}

function transientMessage(text) {
  state.message = text;
  render();
}

function clearTimer() {
  if (state.aiTimer) {
    clearTimeout(state.aiTimer);
    state.aiTimer = null;
  }
}

function countCards(cards) {
  const map = new Map();
  cards.forEach((card) => {
    if (!map.has(card.value)) map.set(card.value, []);
    map.get(card.value).push(card);
  });
  return map;
}

function sortCards(cards, mode = state.sortMode) {
  const counts = countCards(cards);
  const sorted = [...cards];
  sorted.sort((a, b) => {
    if (mode === "grouped") {
      const countDiff = (counts.get(b.value)?.length || 0) - (counts.get(a.value)?.length || 0);
      if (countDiff !== 0) return countDiff;
    }
    if (b.value !== a.value) return b.value - a.value;
    return (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0);
  });
  return sorted;
}

function getCountEntries(cards) {
  return [...countCards(cards).entries()]
    .map(([value, grouped]) => ({ value: Number(value), count: grouped.length, cards: [...grouped] }))
    .sort((a, b) => a.value - b.value);
}

function isConsecutive(values) {
  if (values.length < 2) return true;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function getRuns(values) {
  if (!values.length) return [];
  const runs = [];
  let run = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] === values[i - 1] + 1) run.push(values[i]);
    else {
      runs.push(run);
      run = [values[i]];
    }
  }
  runs.push(run);
  return runs;
}

function cardsText(cards) {
  return sortCards(cards, "rank")
    .map((card) => (card.value >= 16 ? card.rank : `${card.rank}${card.suit}`))
    .join(" ");
}

function describePlay(play) {
  if (!play) return "";
  const typeLabel = {
    single: "single",
    pair: "pair",
    triple: "triple",
    triple_single: "triple + single",
    triple_pair: "triple + pair",
    straight: "straight",
    pair_straight: "pair straight",
    airplane: "airplane",
    airplane_single: "airplane + singles",
    airplane_pair: "airplane + pairs",
    four_two_singles: "four + two",
    four_two_pairs: "four + two pairs",
    bomb: "bomb",
    rocket: "rocket",
  }[play.type] || play.type;
  return `${typeLabel} · ${cardsText(play.cards)}`;
}

function analyzeCards(cardsInput) {
  if (!cardsInput || !cardsInput.length) return null;
  const cards = [...cardsInput].sort((a, b) => a.value - b.value || ((SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0)));
  const n = cards.length;
  const entries = getCountEntries(cards);
  const values = entries.map((entry) => entry.value);
  const counts = entries.map((entry) => entry.count).sort((a, b) => b - a);

  const build = (type, mainValue, extra = {}) => ({
    type,
    mainValue,
    cards: sortCards(cards, "rank"),
    length: n,
    ...extra,
  });

  if (n === 1) return build("single", values[0]);
  if (n === 2) {
    if (values[0] === 16 && values[1] === 17) return build("rocket", 17);
    if (entries.length === 1 && counts[0] === 2) return build("pair", values[0]);
    return null;
  }
  if (n === 3 && entries.length === 1 && counts[0] === 3) return build("triple", values[0]);

  if (n === 4) {
    if (entries.length === 1 && counts[0] === 4) return build("bomb", values[0]);
    const tripleEntry = entries.find((entry) => entry.count === 3);
    if (tripleEntry) return build("triple_single", tripleEntry.value);
    return null;
  }

  if (entries.length === n && n >= 5 && values.at(-1) <= 14 && isConsecutive(values)) {
    return build("straight", values[0], { sequenceLength: n });
  }

  if (
    n >= 6 &&
    n % 2 === 0 &&
    entries.length === n / 2 &&
    entries.every((entry) => entry.count === 2) &&
    values.at(-1) <= 14 &&
    isConsecutive(values)
  ) {
    return build("pair_straight", values[0], { sequenceLength: entries.length });
  }

  if (n === 5) {
    const tripleEntry = entries.find((entry) => entry.count === 3);
    const pairEntry = entries.find((entry) => entry.count === 2);
    if (tripleEntry && pairEntry) return build("triple_pair", tripleEntry.value);
  }

  if (n === 6) {
    const fourEntry = entries.find((entry) => entry.count === 4);
    if (fourEntry) return build("four_two_singles", fourEntry.value);
  }

  if (n === 8) {
    const fourEntry = entries.find((entry) => entry.count === 4);
    if (fourEntry) {
      const remainder = entries.filter((entry) => entry.value !== fourEntry.value);
      if (remainder.length === 2 && remainder.every((entry) => entry.count === 2)) {
        return build("four_two_pairs", fourEntry.value);
      }
    }
  }

  const tripleValues = entries.filter((entry) => entry.count >= 3 && entry.value <= 14).map((entry) => entry.value);
  const runs = getRuns(tripleValues);

  for (const run of runs) {
    for (let len = run.length; len >= 2; len -= 1) {
      for (let start = 0; start <= run.length - len; start += 1) {
        const seq = run.slice(start, start + len);
        const seqSet = new Set(seq);
        const remainderMap = new Map(entries.map((entry) => [entry.value, entry.count]));
        seq.forEach((value) => remainderMap.set(value, remainderMap.get(value) - 3));
        const remainderEntries = [...remainderMap.entries()]
          .filter(([, count]) => count > 0)
          .map(([value, count]) => ({ value: Number(value), count }));

        const baseCount = len * 3;
        const remainderCount = remainderEntries.reduce((sum, entry) => sum + entry.count, 0);
        if (remainderEntries.some((entry) => seqSet.has(entry.value))) continue;

        if (n === baseCount && remainderCount === 0) {
          return build("airplane", seq[0], { sequenceLength: len });
        }
        if (n === baseCount + len && remainderCount === len && remainderEntries.every((entry) => entry.count === 1)) {
          return build("airplane_single", seq[0], { sequenceLength: len });
        }
        if (n === baseCount + len * 2 && remainderCount === len * 2 && remainderEntries.every((entry) => entry.count === 2)) {
          return build("airplane_pair", seq[0], { sequenceLength: len });
        }
      }
    }
  }

  return null;
}

function isComparableStructure(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (["straight", "pair_straight", "airplane", "airplane_single", "airplane_pair"].includes(a.type)) {
    return a.sequenceLength === b.sequenceLength;
  }
  return a.length === b.length;
}

function canBeat(candidate, target) {
  if (!candidate) return false;
  if (!target) return true;
  if (target.type === "rocket") return false;
  if (candidate.type === "rocket") return true;
  if (candidate.type === "bomb" && target.type !== "bomb") return true;
  if (target.type === "bomb" && candidate.type !== "bomb") return false;
  if (!isComparableStructure(candidate, target)) return false;
  return candidate.mainValue > target.mainValue;
}

function chooseK(items, k, limit = 60) {
  const result = [];
  if (k === 0) return [[]];
  if (items.length < k) return result;

  const recurse = (start, path) => {
    if (result.length >= limit) return;
    if (path.length === k) {
      result.push([...path]);
      return;
    }
    for (let i = start; i <= items.length - (k - path.length); i += 1) {
      path.push(items[i]);
      recurse(i + 1, path);
      path.pop();
      if (result.length >= limit) return;
    }
  };

  recurse(0, []);
  return result;
}

function buildPlaySignature(play) {
  const values = [...play.cards].sort((a, b) => a.value - b.value).map((card) => card.value).join("-");
  return `${play.type}|${play.sequenceLength || 0}|${values}`;
}

function generateAllPlays(hand, limit = 320) {
  const counts = countCards(hand);
  const entries = [...counts.entries()]
    .map(([value, cards]) => ({ value: Number(value), cards: [...cards].sort((a, b) => a.value - b.value), count: cards.length }))
    .sort((a, b) => a.value - b.value);

  const plays = [];
  const seen = new Set();

  const addCards = (cards) => {
    if (plays.length >= limit) return;
    const play = analyzeCards(cards);
    if (!play) return;
    const signature = buildPlaySignature(play);
    if (seen.has(signature)) return;
    seen.add(signature);
    plays.push(play);
  };

  entries.forEach((entry) => addCards([entry.cards[0]]));
  entries.filter((entry) => entry.count >= 2).forEach((entry) => addCards(entry.cards.slice(0, 2)));
  entries.filter((entry) => entry.count >= 3).forEach((entry) => addCards(entry.cards.slice(0, 3)));
  entries.filter((entry) => entry.count === 4).forEach((entry) => addCards(entry.cards.slice(0, 4)));

  if (counts.has(16) && counts.has(17)) addCards([counts.get(16)[0], counts.get(17)[0]]);

  const singleValues = entries.map((entry) => entry.value);
  getRuns(singleValues.filter((value) => value <= 14)).forEach((run) => {
    for (let len = 5; len <= run.length; len += 1) {
      for (let start = 0; start <= run.length - len; start += 1) {
        const seq = run.slice(start, start + len);
        addCards(seq.map((value) => counts.get(value)[0]));
      }
    }
  });

  const pairValues = entries.filter((entry) => entry.count >= 2).map((entry) => entry.value).filter((value) => value <= 14);
  getRuns(pairValues).forEach((run) => {
    for (let len = 3; len <= run.length; len += 1) {
      for (let start = 0; start <= run.length - len; start += 1) {
        const seq = run.slice(start, start + len);
        addCards(seq.flatMap((value) => counts.get(value).slice(0, 2)));
      }
    }
  });

  entries.filter((entry) => entry.count >= 3).forEach((tripleEntry) => {
    const tripleCards = tripleEntry.cards.slice(0, 3);
    entries.filter((entry) => entry.value !== tripleEntry.value)
      .forEach((otherEntry) => addCards([...tripleCards, otherEntry.cards[0]]));
    entries.filter((entry) => entry.value !== tripleEntry.value && entry.count >= 2)
      .forEach((otherEntry) => addCards([...tripleCards, ...otherEntry.cards.slice(0, 2)]));
  });

  entries.filter((entry) => entry.count === 4).forEach((fourEntry) => {
    const remainingCards = hand.filter((card) => card.value !== fourEntry.value);
    chooseK(remainingCards, 2, 24).forEach((extra) => addCards([...fourEntry.cards.slice(0, 4), ...extra]));
    const pairOptions = entries.filter((entry) => entry.value !== fourEntry.value && entry.count >= 2);
    chooseK(pairOptions, 2, 18).forEach((pairs) => {
      addCards([...fourEntry.cards.slice(0, 4), ...pairs.flatMap((pairEntry) => pairEntry.cards.slice(0, 2))]);
    });
  });

  const tripleValues = entries.filter((entry) => entry.count >= 3 && entry.value <= 14).map((entry) => entry.value);
  getRuns(tripleValues).forEach((run) => {
    for (let len = 2; len <= run.length; len += 1) {
      for (let start = 0; start <= run.length - len; start += 1) {
        const seq = run.slice(start, start + len);
        const seqSet = new Set(seq);
        const baseCards = seq.flatMap((value) => counts.get(value).slice(0, 3));
        addCards(baseCards);

        const singleOptions = entries.filter((entry) => !seqSet.has(entry.value)).map((entry) => entry.cards[0]);
        chooseK(singleOptions, len, 24).forEach((wings) => addCards([...baseCards, ...wings]));

        const pairOptions = entries.filter((entry) => !seqSet.has(entry.value) && entry.count >= 2);
        chooseK(pairOptions, len, 24).forEach((pairs) => {
          addCards([...baseCards, ...pairs.flatMap((pairEntry) => pairEntry.cards.slice(0, 2))]);
        });
      }
    }
  });

  return plays;
}

function removeCardsFromHand(hand, cardsToRemove) {
  const removeIds = new Set(cardsToRemove.map((card) => card.id));
  return hand.filter((card) => !removeIds.has(card.id));
}

function handBreakPenalty(play, hand) {
  const original = countCards(hand);
  const used = countCards(play.cards);
  let penalty = 0;
  original.forEach((cards, value) => {
    const usedCount = used.get(value)?.length || 0;
    if (usedCount > 0 && usedCount < cards.length) {
      if (cards.length === 4) penalty += 90;
      else if (cards.length === 3) penalty += 45;
      else if (cards.length === 2) penalty += 16;
    }
  });
  return penalty;
}

function leadScore(play, hand, player) {
  if (play.length === hand.length) return 10000;
  const typeWeight = {
    airplane_pair: 360,
    airplane_single: 330,
    airplane: 300,
    pair_straight: 280,
    straight: 260,
    triple_pair: 220,
    triple_single: 200,
    four_two_pairs: 150,
    four_two_singles: 130,
    triple: 100,
    pair: 70,
    single: 30,
    bomb: -140,
    rocket: -220,
  }[play.type] || 0;

  const opponents = getOpponents(player);
  const critical = opponents.some((opponent) => opponent.hand.length <= 2);
  const controlBonus = critical ? play.mainValue * 12 : 0;
  const lowCardBonus = critical ? 0 : (20 - play.mainValue) * 7;
  const sizeBonus = play.length * 16;
  return typeWeight + sizeBonus + lowCardBonus + controlBonus - handBreakPenalty(play, hand);
}

function responseCost(play, hand) {
  const typeCost = {
    single: 10,
    pair: 18,
    triple: 26,
    triple_single: 30,
    triple_pair: 34,
    straight: 42,
    pair_straight: 50,
    airplane: 58,
    airplane_single: 66,
    airplane_pair: 74,
    four_two_singles: 120,
    four_two_pairs: 135,
    bomb: 260,
    rocket: 360,
  }[play.type] || 100;
  return typeCost + play.mainValue * 4 + handBreakPenalty(play, hand);
}

function chooseLeadPlay(player) {
  const plays = generateAllPlays(player.hand);
  plays.sort((a, b) => leadScore(b, player.hand, player) - leadScore(a, player.hand, player));
  return plays[0] || null;
}

function shouldUseBigPlay(play, player, sourcePlayer) {
  if (!play) return false;
  if (play.length === player.hand.length) return true;
  const opponents = sourcePlayer ? [sourcePlayer] : getOpponents(player);
  return opponents.some((opponent) => opponent.hand.length <= 3);
}

function chooseResponsePlay(player, lastPlay) {
  const sourcePlayer = state.players[lastPlay.playerId];
  const partnerPlayed = sameTeam(player, sourcePlayer);
  const candidates = generateAllPlays(player.hand).filter((play) => canBeat(play, lastPlay));
  if (!candidates.length) return null;

  const opponentThreat = getOpponents(player).some((opponent) => opponent.hand.length <= 2);
  if (partnerPlayed && !opponentThreat) return null;

  const normal = candidates.filter((play) => play.type !== "bomb" && play.type !== "rocket");
  const pool = normal.length ? normal : candidates;
  pool.sort((a, b) => responseCost(a, player.hand) - responseCost(b, player.hand));

  const best = pool[0];
  if ((best.type === "bomb" || best.type === "rocket") && !shouldUseBigPlay(best, player, sourcePlayer) && lastPlay.type !== "bomb") {
    return null;
  }
  return best;
}

function estimateBid(hand) {
  const counts = countCards(hand);
  let score = 0;

  hand.forEach((card) => {
    if (card.value === 17) score += 5.5;
    else if (card.value === 16) score += 4.5;
    else if (card.value === 15) score += 2.5;
    else if (card.value === 14) score += 1.6;
    else if (card.value === 13) score += 1.1;
  });

  counts.forEach((cards, value) => {
    if (cards.length === 4) score += 6.5;
    else if (cards.length === 3) score += value >= 11 ? 2.4 : 1.6;
    else if (cards.length === 2 && value >= 12) score += 0.9;
  });

  const plays = generateAllPlays(hand, 180);
  if (plays.some((play) => play.type === "rocket")) score += 4;
  if (plays.some((play) => play.type === "straight" && play.sequenceLength >= 6)) score += 1.5;
  if (plays.some((play) => play.type === "pair_straight" && play.sequenceLength >= 3)) score += 1.2;
  if (plays.some((play) => play.type === "airplane")) score += 2.5;

  if (score >= 20) return 3;
  if (score >= 15) return 2;
  if (score >= 11) return 1;
  return 0;
}

function getBidOptions() {
  const options = [0];
  for (let bid = Math.max(1, state.currentBid + 1); bid <= 3; bid += 1) {
    options.push(bid);
  }
  return options;
}

function renderCard(card, { small = false, selectable = false, selected = false, facedown = false } = {}) {
  if (facedown) return `<div class="card ${small ? "small " : ""}card-back"></div>`;
  const jokerClass = card.value >= 16 ? "joker-small" : "";
  return `
    <div class="card ${small ? "small " : ""}${selectable ? "human-card " : ""}${selected ? "selected " : ""}${card.color} ${jokerClass}" data-card-id="${card.id}">
      <div class="card-corner">
        <div class="card-rank">${card.rank}</div>
        <div class="card-suit">${card.suit}</div>
      </div>
      <div class="card-center">${card.value >= 16 ? card.jokerText : card.suit}</div>
    </div>
  `;
}

function renderSeat(player) {
  const seat = seatMap[player.id];
  const infoEl = document.getElementById(seat.info);
  const playEl = document.getElementById(seat.play);
  const handEl = document.getElementById(seat.hand);

  const latestBid = player.latestBidText ? `<span class="badge bid">${player.latestBidText}</span>` : "";
  const roleBadge = player.role
    ? `<span class="badge ${player.role === "landlord" ? "landlord" : "farmer"}">${player.role === "landlord" ? "Landlord" : "Farmer"}</span>`
    : "";
  const turnBadge = state.phase !== "idle" && state.currentTurn === player.id ? `<span class="badge turn">Acting</span>` : "";

  infoEl.innerHTML = `
    <div class="player-card">
      <div class="avatar ${seat.avatarClass}">${player.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
      <div class="player-meta">
        <h3>${player.name}</h3>
        <p>${player.isHuman ? "Human player" : "Computer opponent"} · ${player.hand.length} cards</p>
        <div class="badge-row">
          ${roleBadge}
          ${turnBadge}
          ${latestBid}
        </div>
      </div>
    </div>
  `;

  if (player.isHuman) {
    handEl.innerHTML = sortCards(player.hand).map((card) =>
      renderCard(card, {
        selectable: state.phase === "playing" && state.currentTurn === player.id,
        selected: state.selectedCardIds.has(card.id),
      }),
    ).join("");
  } else {
    const stackCount = Math.min(8, Math.max(0, player.hand.length));
    handEl.innerHTML = `
      <div class="ai-stack">
        ${Array.from({ length: stackCount }).map((_, index) => `<div class="card small card-back" style="--i:${index};"></div>`).join("")}
      </div>
      <div class="ai-count">${player.hand.length} cards remaining</div>
    `;
  }

  if (player.latestAction?.type === "play") {
    const play = player.latestAction.play;
    playEl.innerHTML = `
      <div class="play-caption">${describePlay(play)}</div>
      <div class="play-cards">${play.cards.map((card) => renderCard(card, { small: true })).join("")}</div>
    `;
  } else if (player.latestAction?.type === "pass") {
    playEl.innerHTML = `
      <div class="play-caption">Latest action</div>
      <div class="play-pass">Pass</div>
    `;
  } else {
    playEl.innerHTML = `
      <div class="play-caption">Latest action</div>
      <div class="play-empty">No play yet this round.</div>
    `;
  }
}

function renderBottomCards() {
  const hidden = state.phase === "bidding" || state.phase === "dealing";
  els.bottomCards.innerHTML = state.bottomCards
    .map((card) => renderCard(card, { small: true, facedown: hidden }))
    .join("");
}

function renderBids() {
  if (!state.biddingHistory.length) {
    els.bidList.innerHTML = `<div class="bid-chip">No bids yet</div>`;
    return;
  }
  els.bidList.innerHTML = state.biddingHistory
    .map((entry) => `<div class="bid-chip">${entry.name}: ${entry.text}</div>`)
    .join("");
}

function renderScoreGrid() {
  els.scoreGrid.innerHTML = state.players
    .map((player) => `
      <div class="score-row">
        <div>
          <div class="score-row-name">${player.name}</div>
          <div class="score-row-role">${player.role ? player.role : "Awaiting deal"}</div>
        </div>
        <div class="score-row-value">${player.score >= 0 ? "+" : ""}${player.score}</div>
        <div class="score-row-role">${player.hand.length} cards</div>
      </div>
    `)
    .join("");
}

function renderLog() {
  if (!state.log.length) {
    els.logList.innerHTML = `<div class="log-entry">Logs from the table will appear here.</div>`;
    return;
  }
  els.logList.innerHTML = state.log.map((entry) => `<div class="log-entry">${entry.text}</div>`).join("");
}

function updateActionButtons() {
  const isHumanTurn = state.phase === "playing" && state.currentTurn === 0;
  const canBid = state.phase === "bidding" && state.currentTurn === 0;
  els.bidControls.classList.toggle("hidden", !canBid);

  const options = new Set(getBidOptions());
  [...els.bidControls.querySelectorAll("button")].forEach((button) => {
    const bid = Number(button.dataset.bid);
    button.disabled = !options.has(bid);
  });

  const selected = state.players[0].hand.filter((card) => state.selectedCardIds.has(card.id));
  const selectedPlay = analyzeCards(selected);
  const canPlaySelection = isHumanTurn && !!selectedPlay && canBeat(selectedPlay, state.lastPlay);
  const canPass = isHumanTurn && !!state.lastPlay;
  els.playBtn.disabled = !canPlaySelection;
  els.passBtn.disabled = !canPass;
  els.hintBtn.disabled = !isHumanTurn;
  els.clearBtn.disabled = !isHumanTurn || state.selectedCardIds.size === 0;
  els.sortBtn.textContent = `Sort: ${state.sortMode === "grouped" ? "Grouped" : "Rank"}`;

  if (!selected.length) {
    els.selectionSummary.textContent = "No cards selected";
  } else if (!selectedPlay) {
    els.selectionSummary.textContent = `${selected.length} cards selected · invalid combination`;
  } else if (!canBeat(selectedPlay, state.lastPlay)) {
    els.selectionSummary.textContent = `${describePlay(selectedPlay)} · does not beat current trick`;
  } else {
    els.selectionSummary.textContent = describePlay(selectedPlay);
  }
}

function renderHud() {
  els.roundValue.textContent = String(state.round);
  els.multiplierValue.textContent = `${state.multiplier}x`;
  els.winsValue.textContent = String(state.stats.humanWins);
  els.scoreValue.textContent = String(state.stats.humanScore);
  els.statusPill.textContent = state.status;
  els.turnPill.textContent = turnText();
  els.messageBox.textContent = state.message;
}

function turnText() {
  if (state.phase === "idle") return "Press New Match to begin.";
  const player = state.players[state.currentTurn];
  if (state.phase === "dealing") return "Dealing cards...";
  if (state.phase === "bidding") return `${player.name} is bidding for landlord.`;
  if (state.phase === "playing") {
    if (!state.lastPlay) return `${player.name} leads this trick.`;
    return `${player.name} must respond to ${state.players[state.lastPlay.playerId].name}.`;
  }
  if (state.phase === "roundEnd") return "Round finished. Review results or start the next hand.";
  return "";
}

function render() {
  state.players.forEach(renderSeat);
  renderBottomCards();
  renderBids();
  renderScoreGrid();
  renderLog();
  renderHud();
  updateActionButtons();
}

async function startNewRound() {
  clearTimer();
  state.actionLocked = true;
  state.selectedCardIds.clear();
  state.round += 1;
  state.phase = "dealing";
  state.currentBid = 0;
  state.highestBidder = null;
  state.bidsTaken = 0;
  state.biddingHistory = [];
  state.lastPlay = null;
  state.lastNonPassPlayer = null;
  state.multiplier = 1;
  state.status = "Shuffling and dealing a fresh deck.";
  state.message = "New round started.";
  state.players.forEach((player) => {
    player.hand = [];
    player.role = null;
    player.bid = null;
    player.latestBidText = "";
    player.latestAction = null;
  });
  render();

  await sleep(450);

  const deck = shuffle(createDeck());
  state.bottomCards = deck.slice(-3);
  for (let i = 0; i < 17; i += 1) {
    for (let playerId = 0; playerId < 3; playerId += 1) {
      state.players[playerId].hand.push(deck[i * 3 + playerId]);
    }
  }
  state.players.forEach((player) => {
    player.hand = sortCards(player.hand);
  });

  state.startingBidder = Math.floor(Math.random() * 3);
  state.currentTurn = state.startingBidder;
  state.phase = "bidding";
  state.status = "Bid for the landlord role.";
  addLog(`Round ${state.round} begins. ${state.players[state.currentTurn].name} bids first.`);
  render();

  state.actionLocked = false;
  maybeContinueGame();
}

function completeBidding() {
  if (state.highestBidder === null) {
    state.status = "Everyone passed. Redealing.";
    state.message = "All players passed on bidding. A new deal is being prepared.";
    addLog("All players passed on the bid. Redealing.");
    render();
    setTimeout(() => startNewRound(), 1400);
    return;
  }

  const landlord = state.players[state.highestBidder];
  landlord.role = "landlord";
  state.players.forEach((player) => {
    if (player.id !== landlord.id) player.role = "farmer";
  });

  landlord.hand = sortCards([...landlord.hand, ...state.bottomCards]);
  state.currentTurn = landlord.id;
  state.phase = "playing";
  state.lastPlay = null;
  state.lastNonPassPlayer = landlord.id;
  state.multiplier = Math.max(state.currentBid, 1);
  state.status = `${landlord.name} becomes the landlord.`;
  state.message = `${landlord.name} claimed the landlord role and picked up the bottom cards.`;
  addLog(`${landlord.name} becomes the landlord with bid ${state.currentBid || 1}.`);
  render();
  maybeContinueGame();
}

function submitBid(playerId, bid) {
  if (state.phase !== "bidding" || state.currentTurn !== playerId || state.actionLocked) return;
  const player = state.players[playerId];
  const allowed = new Set(getBidOptions());
  if (!allowed.has(bid)) return;

  player.bid = bid;
  player.latestBidText = bid === 0 ? "Passed" : `Bid ${bid}`;
  state.biddingHistory.push({ playerId, name: player.name, text: bid === 0 ? "Pass" : `Bid ${bid}` });
  addLog(`${player.name} ${bid === 0 ? "passes" : `bids ${bid}`}.`);

  if (bid > state.currentBid) {
    state.currentBid = bid;
    state.highestBidder = playerId;
  }

  state.bidsTaken += 1;
  if (bid === 3 || state.bidsTaken >= 3) {
    completeBidding();
    return;
  }

  state.currentTurn = nextPlayerId(playerId);
  state.status = `${state.players[state.currentTurn].name} is deciding the bid.`;
  state.message = bid === 0 ? `${player.name} passed.` : `${player.name} raised the bid to ${bid}.`;
  render();
  maybeContinueGame();
}

function applyPlay(playerId, playInput) {
  if (state.phase !== "playing" || state.currentTurn !== playerId || state.actionLocked) return;
  const player = state.players[playerId];
  const analyzed = analyzeCards(playInput.cards || playInput);
  if (!analyzed) {
    transientMessage("That selection is not a valid Dou Dizhu combination.");
    return;
  }
  if (!canBeat(analyzed, state.lastPlay)) {
    transientMessage("That play does not beat the current trick.");
    return;
  }

  player.hand = sortCards(removeCardsFromHand(player.hand, analyzed.cards));
  player.latestAction = { type: "play", play: analyzed };
  state.lastPlay = { ...analyzed, playerId };
  state.lastNonPassPlayer = playerId;
  state.selectedCardIds.clear();

  if (analyzed.type === "bomb" || analyzed.type === "rocket") {
    state.multiplier *= 2;
    addLog(`${player.name} played a ${analyzed.type === "rocket" ? "rocket" : "bomb"}! Multiplier doubled to ${state.multiplier}x.`);
  } else {
    addLog(`${player.name} played ${describePlay(analyzed)}.`);
  }

  if (player.hand.length === 0) {
    finishRound(player);
    return;
  }

  state.currentTurn = nextPlayerId(playerId);
  state.status = `${player.name} takes the trick lead.`;
  state.message = `${player.name} played ${describePlay(analyzed)}.`;
  render();
  maybeContinueGame();
}

function applyPass(playerId) {
  if (state.phase !== "playing" || state.currentTurn !== playerId || !state.lastPlay || state.actionLocked) return;
  const player = state.players[playerId];
  player.latestAction = { type: "pass" };
  addLog(`${player.name} passed.`);

  const next = nextPlayerId(playerId);
  if (next === state.lastNonPassPlayer) {
    state.currentTurn = state.lastNonPassPlayer;
    state.lastPlay = null;
    state.status = `${state.players[state.currentTurn].name} may lead any valid combination.`;
    state.message = "Two consecutive passes. Trick control resets.";
    addLog("The trick resets after two consecutive passes.");
  } else {
    state.currentTurn = next;
    state.status = `${state.players[state.currentTurn].name} is up next.`;
    state.message = `${player.name} passed.`;
  }

  render();
  maybeContinueGame();
}

function finishRound(winner) {
  state.phase = "roundEnd";
  state.status = `${winner.name} wins the round.`;
  const landlord = state.players.find((player) => player.role === "landlord");
  const farmers = state.players.filter((player) => player.role === "farmer");
  const landlordWon = winner.role === "landlord";
  const swing = state.multiplier;

  if (landlordWon) {
    landlord.score += swing * 2;
    farmers.forEach((farmer) => { farmer.score -= swing; });
  } else {
    landlord.score -= swing * 2;
    farmers.forEach((farmer) => { farmer.score += swing; });
  }

  state.stats.games += 1;
  if (winner.id === 0) state.stats.humanWins += 1;
  state.stats.humanScore = state.players[0].score;
  saveStats();

  addLog(`${winner.name} wins the round as ${winner.role}. Final multiplier: ${state.multiplier}x.`);
  state.message = "Round complete. Start the next hand when ready.";
  renderResultOverlay(winner, landlordWon, swing);
  render();
}

function renderResultOverlay(winner, landlordWon, swing) {
  const you = state.players[0];
  const youWon = winner.id === 0;
  els.resultBadge.textContent = youWon ? "Victory" : "Defeat";
  els.resultBadge.style.background = youWon ? "rgba(120, 240, 160, 0.16)" : "rgba(255, 107, 107, 0.14)";
  els.resultBadge.style.color = youWon ? "#aef6c5" : "#ffd2d2";
  els.resultTitle.textContent = `${winner.name} won the round`;
  els.resultSubtitle.textContent = landlordWon
    ? `The landlord prevailed at ${swing}x multiplier.`
    : `The farmers defeated the landlord at ${swing}x multiplier.`;

  els.resultStats.innerHTML = [
    { label: "Your role", value: you.role || "—" },
    { label: "Your score total", value: `${you.score >= 0 ? "+" : ""}${you.score}` },
    { label: "Round multiplier", value: `${state.multiplier}x` },
    { label: "Wins / games", value: `${state.stats.humanWins} / ${state.stats.games}` },
  ]
    .map((line) => `<div class="result-line"><span>${line.label}</span><strong>${line.value}</strong></div>`)
    .join("");

  els.overlay.classList.remove("hidden");
}

function hideOverlay() {
  els.overlay.classList.add("hidden");
}

function hintForHuman() {
  if (state.phase !== "playing" || state.currentTurn !== 0) return;
  const human = state.players[0];
  const suggestion = state.lastPlay ? chooseResponsePlay(human, state.lastPlay) : chooseLeadPlay(human);

  if (!suggestion) {
    transientMessage("No better play found. You may need to pass.");
    state.selectedCardIds.clear();
    render();
    return;
  }

  state.selectedCardIds = new Set(suggestion.cards.map((card) => card.id));
  state.message = `Hint: ${describePlay(suggestion)}.`;
  render();
}

async function performAITurn(playerId) {
  if (state.actionLocked || state.currentTurn !== playerId) return;
  state.actionLocked = true;
  const player = state.players[playerId];
  state.message = `${player.name} is thinking...`;
  render();
  await sleep(700 + Math.random() * 500);

  if (state.phase === "bidding") {
    const desired = estimateBid(player.hand);
    const bid = desired > state.currentBid ? desired : 0;
    state.actionLocked = false;
    submitBid(playerId, bid);
    return;
  }

  if (state.phase === "playing") {
    if (state.lastPlay) {
      const choice = chooseResponsePlay(player, state.lastPlay);
      state.actionLocked = false;
      if (choice) applyPlay(playerId, choice);
      else applyPass(playerId);
    } else {
      const choice = chooseLeadPlay(player);
      state.actionLocked = false;
      applyPlay(playerId, choice);
    }
  } else {
    state.actionLocked = false;
  }
}

function maybeContinueGame() {
  clearTimer();
  if (state.phase === "bidding" || state.phase === "playing") {
    const player = state.players[state.currentTurn];
    if (!player.isHuman) {
      state.aiTimer = setTimeout(() => performAITurn(player.id), 220);
    }
  }
}

function handleCardClick(cardId) {
  if (state.phase !== "playing" || state.currentTurn !== 0) return;
  if (state.selectedCardIds.has(cardId)) state.selectedCardIds.delete(cardId);
  else state.selectedCardIds.add(cardId);
  render();
}

els.newGameBtn.addEventListener("click", () => {
  hideOverlay();
  startNewRound();
});

els.rulesToggleBtn.addEventListener("click", () => {
  els.rulesPanel.classList.toggle("collapsed");
});

els.rematchBtn.addEventListener("click", () => {
  hideOverlay();
  startNewRound();
});

els.closeOverlayBtn.addEventListener("click", hideOverlay);

els.bidControls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-bid]");
  if (!button) return;
  submitBid(0, Number(button.dataset.bid));
});

els.playBtn.addEventListener("click", () => {
  const selected = state.players[0].hand.filter((card) => state.selectedCardIds.has(card.id));
  applyPlay(0, selected);
});

els.passBtn.addEventListener("click", () => applyPass(0));
els.hintBtn.addEventListener("click", hintForHuman);

els.clearBtn.addEventListener("click", () => {
  state.selectedCardIds.clear();
  render();
});

els.sortBtn.addEventListener("click", () => {
  const nextIndex = (SORT_MODES.indexOf(state.sortMode) + 1) % SORT_MODES.length;
  state.sortMode = SORT_MODES[nextIndex];
  state.players.forEach((player) => { player.hand = sortCards(player.hand); });
  render();
});

document.getElementById("human-hand").addEventListener("click", (event) => {
  const cardEl = event.target.closest("[data-card-id]");
  if (!cardEl) return;
  handleCardClick(cardEl.dataset.cardId);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    state.selectedCardIds.clear();
    render();
  }
  if (event.key.toLowerCase() === "h") hintForHuman();
  if (event.key === " " && state.phase === "playing" && state.currentTurn === 0) {
    event.preventDefault();
    const selected = state.players[0].hand.filter((card) => state.selectedCardIds.has(card.id));
    const analysis = analyzeCards(selected);
    if (analysis && canBeat(analysis, state.lastPlay)) applyPlay(0, selected);
    else if (state.lastPlay) applyPass(0);
  }
});

render();
