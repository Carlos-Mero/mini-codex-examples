(function () {
  const PLAYER_NAMES = ["You", "Computer A", "Computer B"];
  const SUITS = ["spades", "hearts", "clubs", "diamonds"];
  const SUIT_SYMBOLS = {
    spades: "♠",
    hearts: "♥",
    clubs: "♣",
    diamonds: "♦",
    joker: "★"
  };
  const RANK_ORDER = [
    { rank: "3", value: 3 },
    { rank: "4", value: 4 },
    { rank: "5", value: 5 },
    { rank: "6", value: 6 },
    { rank: "7", value: 7 },
    { rank: "8", value: 8 },
    { rank: "9", value: 9 },
    { rank: "10", value: 10 },
    { rank: "J", value: 11 },
    { rank: "Q", value: 12 },
    { rank: "K", value: 13 },
    { rank: "A", value: 14 },
    { rank: "2", value: 15 },
    { rank: "SJ", value: 16 },
    { rank: "BJ", value: 17 }
  ];
  const VALUE_TO_RANK = Object.fromEntries(RANK_ORDER.map((item) => [item.value, item.rank]));
  const TYPE_LABELS = {
    single: "Single",
    pair: "Pair",
    triple: "Triple",
    triple_single: "Triple with Single",
    triple_pair: "Triple with Pair",
    straight: "Straight",
    pair_straight: "Pair Straight",
    airplane: "Airplane",
    airplane_single: "Airplane with Singles",
    airplane_pair: "Airplane with Pairs",
    bomb: "Bomb",
    rocket: "Rocket",
    four_two_singles: "Four with Two Singles",
    four_two_pairs: "Four with Two Pairs"
  };
  const PLAYABLE_SEQUENCE_MAX = 14;

  function createDeck() {
    const deck = [];
    let id = 1;
    for (const item of RANK_ORDER.slice(0, 13)) {
      for (const suit of SUITS) {
        deck.push({
          id: id++,
          rank: item.rank,
          value: item.value,
          suit
        });
      }
    }
    deck.push({ id: id++, rank: "SJ", value: 16, suit: "joker" });
    deck.push({ id: id++, rank: "BJ", value: 17, suit: "joker" });
    return deck;
  }

  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function cardSort(a, b) {
    if (a.value !== b.value) {
      return b.value - a.value;
    }
    return a.id - b.id;
  }

  function sortCards(cards) {
    return cards.slice().sort(cardSort);
  }

  function cardsByValue(cards) {
    const map = new Map();
    for (const card of cards) {
      if (!map.has(card.value)) {
        map.set(card.value, []);
      }
      map.get(card.value).push(card);
    }
    for (const list of map.values()) {
      list.sort(cardSort);
    }
    return map;
  }

  function isConsecutive(values) {
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] !== values[i - 1] + 1) {
        return false;
      }
    }
    return true;
  }

  function getSequenceCandidates(values, minLength) {
    const uniqueSorted = values
      .filter((value) => value <= PLAYABLE_SEQUENCE_MAX)
      .sort((a, b) => a - b);
    const groups = [];
    let current = [];

    for (const value of uniqueSorted) {
      if (!current.length || value === current[current.length - 1] + 1) {
        current.push(value);
      } else {
        if (current.length >= minLength) {
          groups.push(current);
        }
        current = [value];
      }
    }
    if (current.length >= minLength) {
      groups.push(current);
    }
    return groups;
  }

  function pickCardsForValues(groupedCards, values, countEach) {
    const selected = [];
    for (const value of values) {
      const cards = groupedCards.get(value);
      if (!cards || cards.length < countEach) {
        return null;
      }
      selected.push(...cards.slice(0, countEach));
    }
    return sortCards(selected);
  }

  function chooseSinglesExcluding(groupedCards, excludedValues, count) {
    const excluded = new Set(excludedValues);
    const singles = [];
    const values = Array.from(groupedCards.keys()).sort((a, b) => a - b);
    for (const value of values) {
      if (excluded.has(value)) {
        continue;
      }
      const cards = groupedCards.get(value) || [];
      for (const card of cards) {
        singles.push(card);
      }
    }
    if (singles.length < count) {
      return null;
    }
    return sortCards(singles.slice(0, count));
  }

  function choosePairsExcluding(groupedCards, excludedValues, count) {
    const excluded = new Set(excludedValues);
    const pairs = [];
    const values = Array.from(groupedCards.keys()).sort((a, b) => a - b);
    for (const value of values) {
      if (excluded.has(value)) {
        continue;
      }
      const cards = groupedCards.get(value) || [];
      if (cards.length >= 2) {
        pairs.push(cards.slice(0, 2));
      }
    }
    if (pairs.length < count) {
      return null;
    }
    return sortCards(pairs.slice(0, count).flat());
  }

  function getTripletSequences(groupedCards, minLength) {
    const tripleValues = Array.from(groupedCards.entries())
      .filter(([, cards]) => cards.length >= 3)
      .map(([value]) => value)
      .filter((value) => value <= PLAYABLE_SEQUENCE_MAX)
      .sort((a, b) => a - b);

    const consecutiveRuns = getSequenceCandidates(tripleValues, minLength);
    const sequences = [];
    for (const run of consecutiveRuns) {
      for (let length = minLength; length <= run.length; length += 1) {
        for (let start = 0; start <= run.length - length; start += 1) {
          sequences.push(run.slice(start, start + length));
        }
      }
    }
    return sequences;
  }

  function evaluateCombo(cards) {
    if (!cards.length) {
      return null;
    }

    const sorted = sortCards(cards);
    const grouped = cardsByValue(sorted);
    const entries = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
    const values = entries.map(([value]) => value);
    const counts = entries.map(([, group]) => group.length);
    const length = sorted.length;

    if (length === 1) {
      return { type: "single", rank: values[0], length, cards: sorted };
    }

    if (length === 2) {
      if (values[0] === 16 && values[1] === 17) {
        return { type: "rocket", rank: 17, length, cards: sorted };
      }
      if (counts.length === 1 && counts[0] === 2) {
        return { type: "pair", rank: values[0], length, cards: sorted };
      }
      return null;
    }

    if (length === 3 && counts.length === 1) {
      return { type: "triple", rank: values[0], length, cards: sorted };
    }

    if (length === 4) {
      if (counts.length === 1) {
        return { type: "bomb", rank: values[0], length, cards: sorted };
      }
      const tripleEntry = entries.find(([, group]) => group.length === 3);
      if (tripleEntry) {
        return { type: "triple_single", rank: tripleEntry[0], length, cards: sorted };
      }
      return null;
    }

    if (length === 5) {
      if (counts.every((count) => count === 1) && values[values.length - 1] <= PLAYABLE_SEQUENCE_MAX && isConsecutive(values)) {
        return {
          type: "straight",
          rank: values[values.length - 1],
          sequenceLength: length,
          length,
          cards: sorted
        };
      }
      const tripleEntry = entries.find(([, group]) => group.length === 3);
      const pairEntry = entries.find(([, group]) => group.length === 2);
      if (tripleEntry && pairEntry) {
        return { type: "triple_pair", rank: tripleEntry[0], length, cards: sorted };
      }
      return null;
    }

    if (counts.every((count) => count === 1) && length >= 5 && values[values.length - 1] <= PLAYABLE_SEQUENCE_MAX && isConsecutive(values)) {
      return {
        type: "straight",
        rank: values[values.length - 1],
        sequenceLength: length,
        length,
        cards: sorted
      };
    }

    if (
      length >= 6 &&
      length % 2 === 0 &&
      counts.every((count) => count === 2) &&
      values[values.length - 1] <= PLAYABLE_SEQUENCE_MAX &&
      isConsecutive(values)
    ) {
      return {
        type: "pair_straight",
        rank: values[values.length - 1],
        sequenceLength: values.length,
        length,
        cards: sorted
      };
    }

    if (length === 6) {
      const quadEntry = entries.find(([, group]) => group.length === 4);
      if (quadEntry) {
        return { type: "four_two_singles", rank: quadEntry[0], length, cards: sorted };
      }
    }

    if (length === 8) {
      const quadEntry = entries.find(([, group]) => group.length === 4);
      const pairEntries = entries.filter(([, group]) => group.length === 2);
      if (quadEntry && pairEntries.length === 2) {
        return { type: "four_two_pairs", rank: quadEntry[0], length, cards: sorted };
      }
    }

    const pureAirplane = detectAirplane(entries, length, "pure");
    if (pureAirplane) {
      return { ...pureAirplane, cards: sorted };
    }
    const airplaneSingles = detectAirplane(entries, length, "singles");
    if (airplaneSingles) {
      return { ...airplaneSingles, cards: sorted };
    }
    const airplanePairs = detectAirplane(entries, length, "pairs");
    if (airplanePairs) {
      return { ...airplanePairs, cards: sorted };
    }

    if (length === 6) {
      return null;
    }

    const quadEntry = entries.find(([, group]) => group.length === 4);
    if (quadEntry && length === 6) {
      return { type: "four_two_singles", rank: quadEntry[0], length, cards: sorted };
    }
    if (quadEntry && length === 8 && entries.filter(([, group]) => group.length === 2).length === 2) {
      return { type: "four_two_pairs", rank: quadEntry[0], length, cards: sorted };
    }

    return null;
  }

  function detectAirplane(entries, totalLength, mode) {
    const tripleValues = entries
      .filter(([, group]) => group.length >= 3)
      .map(([value]) => value)
      .filter((value) => value <= PLAYABLE_SEQUENCE_MAX)
      .sort((a, b) => a - b);

    if (tripleValues.length < 2) {
      return null;
    }

    const runs = getSequenceCandidates(tripleValues, 2);
    for (const run of runs) {
      for (let sequenceLength = 2; sequenceLength <= run.length; sequenceLength += 1) {
        for (let start = 0; start <= run.length - sequenceLength; start += 1) {
          const sequence = run.slice(start, start + sequenceLength);
          const baseSize = sequenceLength * 3;
          const expectedLength =
            mode === "pure" ? baseSize : mode === "singles" ? sequenceLength * 4 : sequenceLength * 5;
          if (expectedLength !== totalLength) {
            continue;
          }

          const leftover = [];
          for (const [value, group] of entries) {
            const used = sequence.includes(value) ? 3 : 0;
            const remainder = group.length - used;
            if (remainder < 0) {
              break;
            }
            for (let i = 0; i < remainder; i += 1) {
              leftover.push(value);
            }
          }

          if (leftover.length !== totalLength - baseSize) {
            continue;
          }

          if (mode === "pure" && leftover.length === 0) {
            return {
              type: "airplane",
              rank: sequence[sequence.length - 1],
              sequenceLength
            };
          }
          if (mode === "singles" && leftover.length === sequenceLength) {
            return {
              type: "airplane_single",
              rank: sequence[sequence.length - 1],
              sequenceLength
            };
          }
          if (mode === "pairs") {
            const pairCheck = cardsByValue(leftover.map((value, index) => ({ id: index, value })));
            const pairCounts = Array.from(pairCheck.values()).map((group) => group.length);
            if (pairCounts.length === sequenceLength && pairCounts.every((count) => count === 2)) {
              return {
                type: "airplane_pair",
                rank: sequence[sequence.length - 1],
                sequenceLength
              };
            }
          }
        }
      }
    }
    return null;
  }

  function canBeat(candidate, target) {
    if (!candidate) {
      return false;
    }
    if (!target) {
      return true;
    }
    if (candidate.type === "rocket") {
      return true;
    }
    if (target.type === "rocket") {
      return false;
    }
    if (candidate.type === "bomb" && target.type !== "bomb") {
      return true;
    }
    if (candidate.type !== target.type) {
      return false;
    }
    if (candidate.type === "bomb") {
      return candidate.rank > target.rank;
    }
    const candidateSpan = candidate.sequenceLength || candidate.length;
    const targetSpan = target.sequenceLength || target.length;
    if (candidateSpan !== targetSpan) {
      return false;
    }
    return candidate.rank > target.rank;
  }

  function comboSignature(combo) {
    return `${combo.type}:${combo.cards.map((card) => card.value).sort((a, b) => a - b).join("-")}`;
  }

  function generateCombos(hand) {
    const cards = sortCards(hand);
    const grouped = cardsByValue(cards);
    const combos = [];
    const seen = new Set();
    const valuesAsc = Array.from(grouped.keys()).sort((a, b) => a - b);

    function pushCombo(comboCards) {
      const combo = evaluateCombo(comboCards);
      if (!combo) {
        return;
      }
      const signature = comboSignature(combo);
      if (seen.has(signature)) {
        return;
      }
      seen.add(signature);
      combos.push(combo);
    }

    for (const value of valuesAsc) {
      const group = grouped.get(value);
      pushCombo(group.slice(0, 1));
      if (group.length >= 2) {
        pushCombo(group.slice(0, 2));
      }
      if (group.length >= 3) {
        pushCombo(group.slice(0, 3));
      }
      if (group.length === 4) {
        pushCombo(group.slice(0, 4));
      }
    }

    if (grouped.has(16) && grouped.has(17)) {
      pushCombo([grouped.get(16)[0], grouped.get(17)[0]]);
    }

    for (const tripleValue of valuesAsc.filter((value) => (grouped.get(value) || []).length >= 3)) {
      const tripleCards = grouped.get(tripleValue).slice(0, 3);
      for (const singleValue of valuesAsc.filter((value) => value !== tripleValue)) {
        pushCombo([...tripleCards, grouped.get(singleValue)[0]]);
      }
      for (const pairValue of valuesAsc.filter((value) => value !== tripleValue && (grouped.get(value) || []).length >= 2)) {
        pushCombo([...tripleCards, ...grouped.get(pairValue).slice(0, 2)]);
      }
    }

    for (const run of getSequenceCandidates(valuesAsc, 5)) {
      for (let length = 5; length <= run.length; length += 1) {
        for (let start = 0; start <= run.length - length; start += 1) {
          pushCombo(pickCardsForValues(grouped, run.slice(start, start + length), 1));
        }
      }
    }

    const pairValues = valuesAsc.filter((value) => (grouped.get(value) || []).length >= 2);
    for (const run of getSequenceCandidates(pairValues, 3)) {
      for (let length = 3; length <= run.length; length += 1) {
        for (let start = 0; start <= run.length - length; start += 1) {
          pushCombo(pickCardsForValues(grouped, run.slice(start, start + length), 2));
        }
      }
    }

    const tripletSequences = getTripletSequences(grouped, 2);
    for (const sequence of tripletSequences) {
      const tripleCards = pickCardsForValues(grouped, sequence, 3);
      pushCombo(tripleCards);

      const singleWings = chooseSinglesExcluding(grouped, sequence, sequence.length);
      if (singleWings) {
        pushCombo([...tripleCards, ...singleWings]);
      }

      const pairWings = choosePairsExcluding(grouped, sequence, sequence.length);
      if (pairWings) {
        pushCombo([...tripleCards, ...pairWings]);
      }
    }

    for (const value of valuesAsc.filter((item) => (grouped.get(item) || []).length === 4)) {
      const quadCards = grouped.get(value).slice(0, 4);
      const singles = chooseSinglesExcluding(grouped, [value], 2);
      if (singles) {
        pushCombo([...quadCards, ...singles]);
      }
      const pairs = choosePairsExcluding(grouped, [value], 2);
      if (pairs) {
        pushCombo([...quadCards, ...pairs]);
      }
    }

    return combos;
  }

  function comboWeight(combo) {
    const typeBias = {
      straight: -0.9,
      pair_straight: -0.8,
      airplane: -0.75,
      airplane_single: -0.72,
      airplane_pair: -0.7,
      triple_pair: -0.6,
      triple_single: -0.58,
      triple: -0.4,
      pair: -0.18,
      single: 0,
      four_two_singles: 0.3,
      four_two_pairs: 0.35,
      bomb: 2,
      rocket: 3
    };
    return combo.rank + combo.cards.length * 0.08 + (typeBias[combo.type] || 0);
  }

  function estimateBid(cards) {
    let score = 0;
    const grouped = cardsByValue(cards);
    for (const card of cards) {
      if (card.value >= 15) {
        score += 2.5;
      } else if (card.value >= 12) {
        score += 1.1;
      }
    }
    for (const [value, group] of grouped) {
      if (group.length === 4) {
        score += 6;
      } else if (group.length === 3) {
        score += 2.2;
      } else if (group.length === 2 && value >= 12) {
        score += 1.2;
      }
    }
    if (grouped.has(16) && grouped.has(17)) {
      score += 8;
    }
    const sequences = getSequenceCandidates(
      Array.from(grouped.keys()).filter((value) => value <= PLAYABLE_SEQUENCE_MAX),
      5
    );
    for (const sequence of sequences) {
      score += sequence.length * 0.35;
    }
    if (score >= 22) {
      return 3;
    }
    if (score >= 16) {
      return 2;
    }
    if (score >= 11) {
      return 1;
    }
    return 0;
  }

  class DouDizhuGame {
    constructor() {
      this.elements = {
        newGameButton: document.getElementById("new-game-button"),
        statusText: document.getElementById("status-text"),
        turnText: document.getElementById("turn-text"),
        kittyCards: document.getElementById("kitty-cards"),
        trickHistory: document.getElementById("trick-history"),
        humanHand: document.getElementById("human-hand"),
        bidControls: document.getElementById("bid-controls"),
        playControls: document.getElementById("play-controls"),
        panels: [0, 1, 2].map((index) => document.getElementById(`player-${index}-panel`))
      };

      this.state = null;
      this.aiTimer = null;
      this.bindEvents();
      this.startRound();
    }

    bindEvents() {
      this.elements.newGameButton.addEventListener("click", () => this.startRound());
    }

    clearAiTimer() {
      if (this.aiTimer) {
        clearTimeout(this.aiTimer);
        this.aiTimer = null;
      }
    }

    startRound() {
      this.clearAiTimer();
      const deck = shuffle(createDeck());
      const hands = [[], [], []];
      for (let i = 0; i < 51; i += 1) {
        hands[i % 3].push(deck[i]);
      }
      for (let i = 0; i < 3; i += 1) {
        hands[i] = sortCards(hands[i]);
      }

      this.state = {
        hands,
        kitty: deck.slice(51),
        selectedIds: new Set(),
        phase: "bidding",
        currentPlayer: Math.floor(Math.random() * 3),
        bidderOrder: [],
        bids: [null, null, null],
        highestBid: 0,
        highestBidder: null,
        landlord: null,
        lastCombo: null,
        lastPlayedBy: null,
        passCount: 0,
        playedText: ["Waiting", "Waiting", "Waiting"],
        status: "New round. Bidding decides who becomes the landlord.",
        winner: null
      };

      this.state.bidderOrder = [
        this.state.currentPlayer,
        (this.state.currentPlayer + 1) % 3,
        (this.state.currentPlayer + 2) % 3
      ];
      this.render();
      this.runAiIfNeeded();
    }

    getRole(playerIndex) {
      if (this.state.landlord == null) {
        return "Undecided";
      }
      return this.state.landlord === playerIndex ? "Landlord" : "Farmer";
    }

    getTeam(playerIndex) {
      if (this.state.landlord == null) {
        return playerIndex;
      }
      return this.state.landlord === playerIndex ? "landlord" : "farmers";
    }

    setStatus(text) {
      this.state.status = text;
      this.renderStatus();
    }

    render() {
      this.renderStatus();
      this.renderPanels();
      this.renderKitty();
      this.renderHistory();
      this.renderHumanHand();
      this.renderControls();
    }

    renderStatus() {
      this.elements.statusText.textContent = this.state.status;
      if (this.state.phase === "gameover") {
        this.elements.turnText.textContent = `${PLAYER_NAMES[this.state.winner]} wins on ${this.getRole(this.state.winner)} side.`;
        return;
      }
      if (this.state.phase === "bidding") {
        this.elements.turnText.textContent = `${PLAYER_NAMES[this.state.currentPlayer]} is bidding. Highest bid: ${this.state.highestBid}.`;
        return;
      }
      const role = this.getRole(this.state.currentPlayer);
      const trickLabel = this.state.lastCombo ? `Current target: ${describeCombo(this.state.lastCombo)}.` : "Fresh trick. Any valid combo can lead.";
      this.elements.turnText.textContent = `${PLAYER_NAMES[this.state.currentPlayer]}'s turn (${role}). ${trickLabel}`;
    }

    renderPanels() {
      this.elements.panels.forEach((panel, index) => {
        const role = this.getRole(index);
        const bid = this.state.bids[index];
        const hand = this.state.hands[index];
        const isHuman = index === 0;
        const played = this.state.playedText[index];
        panel.innerHTML = "";

        const header = document.createElement("div");
        header.className = "player-header";
        header.innerHTML = `
          <div>
            <p class="section-label">${isHuman ? "Human" : "Computer"}</p>
            <h2 class="player-name">${PLAYER_NAMES[index]}</h2>
          </div>
          <span class="role-badge ${role === "Landlord" ? "landlord" : ""}">${role}</span>
        `;

        const meta = document.createElement("div");
        meta.className = "meta-row";
        meta.textContent = `Cards left: ${hand.length}${bid == null ? "" : ` • Bid: ${bid}`}${this.state.currentPlayer === index && this.state.phase !== "gameover" ? " • Acting now" : ""}`;

        const playedRow = document.createElement("div");
        playedRow.className = "played-row";
        playedRow.textContent = `Latest: ${played}`;

        const miniRow = document.createElement("div");
        miniRow.className = "mini-card-row";
        if (isHuman) {
          const combosLeft = generateCombos(hand).length;
          const summary = document.createElement("div");
          summary.className = "empty-copy";
          summary.textContent = `Playable combinations in hand: ${combosLeft}`;
          miniRow.appendChild(summary);
        } else {
          for (let i = 0; i < hand.length; i += 1) {
            const back = document.createElement("div");
            back.className = "card-back";
            back.textContent = "♣";
            miniRow.appendChild(back);
          }
        }

        panel.appendChild(header);
        panel.appendChild(meta);
        panel.appendChild(playedRow);
        panel.appendChild(miniRow);
      });
    }

    renderKitty() {
      this.elements.kittyCards.innerHTML = "";
      const visibleCards = this.state.landlord == null ? [{ rank: "?", suit: "joker" }, { rank: "?", suit: "joker" }, { rank: "?", suit: "joker" }] : this.state.kitty;
      for (const card of visibleCards) {
        const node = document.createElement("div");
        node.className = "kitty-item";
        node.textContent = card.rank;
        this.elements.kittyCards.appendChild(node);
      }
    }

    renderHistory() {
      this.elements.trickHistory.innerHTML = "";
      for (let i = 0; i < 3; i += 1) {
        const item = document.createElement("div");
        item.className = "history-item";
        const leader = this.state.lastPlayedBy === i ? " (leading)" : "";
        item.innerHTML = `<strong>${PLAYER_NAMES[i]}${leader}</strong><span>${this.state.playedText[i]}</span>`;
        this.elements.trickHistory.appendChild(item);
      }
    }

    renderHumanHand() {
      const hand = this.state.hands[0];
      const selected = this.state.selectedIds;
      this.elements.humanHand.innerHTML = "";

      if (!hand.length) {
        const empty = document.createElement("p");
        empty.className = "empty-copy";
        empty.textContent = "No cards left.";
        this.elements.humanHand.appendChild(empty);
        return;
      }

      for (const card of hand) {
        const button = document.createElement("button");
        const colorClass = card.suit === "hearts" || card.suit === "diamonds" || card.rank === "BJ" ? "red" : "black";
        button.className = `hand-card ${selected.has(card.id) ? "selected" : ""}`;
        button.innerHTML = `
          <span class="card-rank ${colorClass}">${card.rank}</span>
          <span class="card-suit ${colorClass}">${SUIT_SYMBOLS[card.suit]}</span>
        `;
        button.disabled = this.state.phase !== "playing" || this.state.currentPlayer !== 0;
        button.addEventListener("click", () => {
          if (selected.has(card.id)) {
            selected.delete(card.id);
          } else {
            selected.add(card.id);
          }
          this.renderHumanHand();
          this.renderControls();
        });
        this.elements.humanHand.appendChild(button);
      }
    }

    renderControls() {
      this.renderBidControls();
      this.renderPlayControls();
    }

    renderBidControls() {
      const container = this.elements.bidControls;
      container.innerHTML = "";
      if (this.state.phase !== "bidding") {
        return;
      }
      const legalBids = [0, 1, 2, 3].filter((bid) => bid === 0 || bid > this.state.highestBid);
      for (const bid of [0, 1, 2, 3]) {
        const button = document.createElement("button");
        button.className = bid === 0 ? "ghost-button" : "primary-button";
        button.textContent = bid === 0 ? "Pass Bid" : `Bid ${bid}`;
        button.disabled = this.state.currentPlayer !== 0 || !legalBids.includes(bid);
        button.addEventListener("click", () => this.submitBid(0, bid));
        container.appendChild(button);
      }
    }

    renderPlayControls() {
      const container = this.elements.playControls;
      container.innerHTML = "";
      if (this.state.phase !== "playing") {
        return;
      }

      const selectedCards = this.getSelectedCards();
      const selectedCombo = evaluateCombo(selectedCards);
      const selectedLabel = selectedCombo ? describeCombo(selectedCombo) : selectedCards.length ? "Invalid selection" : "No cards selected";
      const hint = document.createElement("div");
      hint.className = "empty-copy";
      hint.textContent = `Selection: ${selectedLabel}`;
      container.appendChild(hint);

      const playButton = document.createElement("button");
      playButton.className = "primary-button";
      playButton.textContent = "Play Selected";
      playButton.disabled = this.state.currentPlayer !== 0 || !selectedCombo || !canBeat(selectedCombo, this.state.lastCombo);
      playButton.addEventListener("click", () => this.playHumanSelection());

      const passButton = document.createElement("button");
      passButton.className = "ghost-button";
      passButton.textContent = "Pass";
      passButton.disabled = this.state.currentPlayer !== 0 || !this.state.lastCombo || this.state.lastPlayedBy === 0;
      passButton.addEventListener("click", () => this.passTurn(0));

      const clearButton = document.createElement("button");
      clearButton.className = "secondary-button";
      clearButton.textContent = "Clear Selection";
      clearButton.disabled = !this.state.selectedIds.size;
      clearButton.addEventListener("click", () => {
        this.state.selectedIds.clear();
        this.renderHumanHand();
        this.renderPlayControls();
      });

      container.appendChild(playButton);
      container.appendChild(passButton);
      container.appendChild(clearButton);
    }

    getSelectedCards() {
      const selectedIds = this.state.selectedIds;
      return this.state.hands[0].filter((card) => selectedIds.has(card.id));
    }

    submitBid(playerIndex, bid) {
      if (this.state.phase !== "bidding" || this.state.currentPlayer !== playerIndex) {
        return;
      }
      if (bid !== 0 && bid <= this.state.highestBid) {
        return;
      }

      this.state.bids[playerIndex] = bid;
      this.state.playedText[playerIndex] = bid === 0 ? "Passed on bidding" : `Bid ${bid}`;

      if (bid > this.state.highestBid) {
        this.state.highestBid = bid;
        this.state.highestBidder = playerIndex;
      }

      const nextBidIndex = this.state.bidderOrder.findIndex((player) => this.state.bids[player] == null);
      if (bid === 3 || nextBidIndex === -1) {
        this.finishBidding();
        return;
      }

      this.state.currentPlayer = this.state.bidderOrder[nextBidIndex];
      this.setStatus(`${PLAYER_NAMES[playerIndex]} ${bid === 0 ? "passed" : `bid ${bid}`}.`);
      this.render();
      this.runAiIfNeeded();
    }

    finishBidding() {
      if (this.state.highestBidder == null) {
        this.setStatus("Nobody bid. Redealing a new round.");
        this.render();
        this.aiTimer = setTimeout(() => this.startRound(), 900);
        return;
      }

      const landlord = this.state.highestBidder;
      this.state.landlord = landlord;
      this.state.hands[landlord] = sortCards(this.state.hands[landlord].concat(this.state.kitty));
      this.state.phase = "playing";
      this.state.currentPlayer = landlord;
      this.state.lastCombo = null;
      this.state.lastPlayedBy = null;
      this.state.passCount = 0;
      this.state.selectedIds.clear();
      this.state.playedText[landlord] = `${this.state.playedText[landlord]} • Took landlord cards`;
      this.setStatus(`${PLAYER_NAMES[landlord]} becomes the landlord with bid ${this.state.highestBid}.`);
      this.render();
      this.runAiIfNeeded();
    }

    playHumanSelection() {
      const cards = this.getSelectedCards();
      const combo = evaluateCombo(cards);
      if (!combo) {
        this.setStatus("That selection is not a legal Dou Dizhu combination.");
        return;
      }
      if (!canBeat(combo, this.state.lastCombo)) {
        this.setStatus("That play does not beat the current target.");
        return;
      }
      this.state.selectedIds.clear();
      this.applyPlay(0, combo);
    }

    applyPlay(playerIndex, combo) {
      const hand = this.state.hands[playerIndex];
      const playedIds = new Set(combo.cards.map((card) => card.id));
      this.state.hands[playerIndex] = hand.filter((card) => !playedIds.has(card.id));
      this.state.lastCombo = combo;
      this.state.lastPlayedBy = playerIndex;
      this.state.passCount = 0;
      this.state.playedText[playerIndex] = describeCombo(combo);
      this.setStatus(`${PLAYER_NAMES[playerIndex]} played ${describeCombo(combo)}.`);

      if (this.state.hands[playerIndex].length === 0) {
        this.state.phase = "gameover";
        this.state.winner = playerIndex;
        this.render();
        return;
      }

      this.state.currentPlayer = (playerIndex + 1) % 3;
      this.render();
      this.runAiIfNeeded();
    }

    passTurn(playerIndex) {
      if (this.state.phase !== "playing" || this.state.currentPlayer !== playerIndex) {
        return;
      }
      if (!this.state.lastCombo || this.state.lastPlayedBy === playerIndex) {
        return;
      }

      this.state.passCount += 1;
      this.state.playedText[playerIndex] = "Pass";

      if (this.state.passCount >= 2) {
        const leader = this.state.lastPlayedBy;
        this.state.currentPlayer = leader;
        this.state.lastCombo = null;
        this.state.lastPlayedBy = null;
        this.state.passCount = 0;
        this.setStatus(`${PLAYER_NAMES[playerIndex]} passed. ${PLAYER_NAMES[leader]} leads a fresh trick.`);
      } else {
        this.state.currentPlayer = (playerIndex + 1) % 3;
        this.setStatus(`${PLAYER_NAMES[playerIndex]} passed.`);
      }

      this.render();
      this.runAiIfNeeded();
    }

    chooseAiPlay(playerIndex) {
      const hand = this.state.hands[playerIndex];
      const combos = generateCombos(hand);
      const target = this.state.lastCombo;
      const teammateLeads =
        this.state.lastPlayedBy != null &&
        this.state.lastPlayedBy !== playerIndex &&
        this.getTeam(this.state.lastPlayedBy) === this.getTeam(playerIndex);

      if (!target) {
        return combos.slice().sort((a, b) => comboWeight(a) - comboWeight(b))[0] || null;
      }

      if (teammateLeads) {
        const teammate = this.state.lastPlayedBy;
        if (this.state.hands[teammate].length <= 2) {
          return null;
        }
        return null;
      }

      let valid = combos.filter((combo) => canBeat(combo, target));
      if (!valid.length) {
        return null;
      }

      const threat = this.state.hands[(playerIndex + 2) % 3].length <= 2 || this.state.hands[(playerIndex + 1) % 3].length <= 2;
      if (!threat) {
        const noBomb = valid.filter((combo) => combo.type !== "bomb" && combo.type !== "rocket");
        if (noBomb.length) {
          valid = noBomb;
        }
      }

      valid.sort((a, b) => comboWeight(a) - comboWeight(b));
      return valid[0];
    }

    runAiIfNeeded() {
      this.clearAiTimer();
      if (!this.state || this.state.phase === "gameover" || this.state.currentPlayer === 0) {
        return;
      }

      this.aiTimer = setTimeout(() => {
        const playerIndex = this.state.currentPlayer;
        if (this.state.phase === "bidding") {
          const suggested = estimateBid(this.state.hands[playerIndex]);
          const legalBid = suggested > this.state.highestBid ? suggested : 0;
          this.submitBid(playerIndex, legalBid);
          return;
        }

        const play = this.chooseAiPlay(playerIndex);
        if (play) {
          this.applyPlay(playerIndex, play);
        } else {
          this.passTurn(playerIndex);
        }
      }, 850);
    }
  }

  function describeCombo(combo) {
    const label = TYPE_LABELS[combo.type] || combo.type;
    const rank = VALUE_TO_RANK[combo.rank] || "?";
    const cards = combo.cards.map((card) => `${card.rank}${card.suit === "joker" ? "" : SUIT_SYMBOLS[card.suit]}`).join(" ");
    return `${label} (${rank}) • ${cards}`;
  }

  const api = {
    createDeck,
    shuffle,
    sortCards,
    evaluateCombo,
    canBeat,
    generateCombos,
    estimateBid
  };

  if (typeof globalThis !== "undefined") {
    globalThis.DouDizhuLib = api;
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      new DouDizhuGame();
    });
  }
})();
