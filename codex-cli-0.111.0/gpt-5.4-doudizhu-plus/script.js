(function () {
  const STORAGE_KEY = "ddz-royale-stats";
  const SUITS = ["♠", "♥", "♣", "♦"];
  const RED_SUITS = new Set(["♥", "♦"]);
  const PLAYER_IDS = ["player", "left", "right"];
  const PLAYER_NAMES = {
    player: "You",
    left: "Left AI",
    right: "Right AI",
  };
  const TIP_POOL = [
    "Lead with long chains when you can retain a bomb as insurance.",
    "If your teammate is close to going out, deny the landlord tempo over greed.",
    "Do not waste rocket unless it flips the endgame or protects a winning line.",
    "Breaking a straight is expensive. Save it for forced defense.",
    "When leading, low-value singles are better tempo than sacrificing your pairs.",
  ];
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

  const ui = {
    phaseText: document.getElementById("phase-text"),
    turnText: document.getElementById("turn-text"),
    baseScore: document.getElementById("base-score"),
    multiplier: document.getElementById("multiplier"),
    coins: document.getElementById("player-coins"),
    kitty: document.getElementById("kitty"),
    historyLog: document.getElementById("history-log"),
    leftCount: document.getElementById("left-count"),
    rightCount: document.getElementById("right-count"),
    leftHand: document.getElementById("left-hand"),
    rightHand: document.getElementById("right-hand"),
    playerHand: document.getElementById("player-hand"),
    leftRole: document.getElementById("left-role"),
    rightRole: document.getElementById("right-role"),
    playerRole: document.getElementById("player-role"),
    leftPlayArea: document.getElementById("left-play-area"),
    rightPlayArea: document.getElementById("right-play-area"),
    playerPlayArea: document.getElementById("player-play-area"),
    currentPattern: document.getElementById("current-pattern"),
    lastWinner: document.getElementById("last-winner"),
    landlordName: document.getElementById("landlord-name"),
    centerMessage: document.getElementById("center-message"),
    wins: document.getElementById("stat-wins"),
    losses: document.getElementById("stat-losses"),
    streak: document.getElementById("stat-streak"),
    best: document.getElementById("stat-best"),
    bidBtn: document.getElementById("bid-btn"),
    passBidBtn: document.getElementById("pass-bid-btn"),
    hintBtn: document.getElementById("hint-btn"),
    playBtn: document.getElementById("play-btn"),
    passBtn: document.getElementById("pass-btn"),
    sortBtn: document.getElementById("sort-btn"),
    newGameBtn: document.getElementById("new-game-btn"),
    tipBox: document.getElementById("tip-box"),
    cardTemplate: document.getElementById("card-template"),
  };

  const state = {
    players: {},
    phase: "idle",
    currentTurn: null,
    landlord: null,
    starter: null,
    currentPlay: null,
    lastWinner: null,
    selected: new Set(),
    hiddenKitty: [],
    kitty: [],
    deck: [],
    multiplier: 1,
    baseScore: 1,
    history: [],
    pendingBidTurn: null,
    bidOrder: [],
    bidIndex: 0,
    turnLocked: false,
    sortMode: "rank",
    stats: loadStats(),
  };

  function loadStats() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        wins: parsed.wins || 0,
        losses: parsed.losses || 0,
        streak: parsed.streak || 0,
        best: parsed.best || 0,
        coins: parsed.coins || 1000,
      };
    } catch {
      return { wins: 0, losses: 0, streak: 0, best: 0, coins: 1000 };
    }
  }

  function saveStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats));
  }

  function createDeck() {
    const deck = [];
    let id = 0;
    for (let rank = 3; rank <= 15; rank += 1) {
      for (const suit of SUITS) {
        deck.push({ id: `c${id += 1}`, rank, suit });
      }
    }
    deck.push({ id: `c${id += 1}`, rank: 16, suit: "★" });
    deck.push({ id: `c${id += 1}`, rank: 17, suit: "☆" });
    return deck;
  }

  function shuffled(deck) {
    const copy = [...deck];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function sortCards(cards) {
    const suitOrder = { "★": 5, "☆": 6, "♠": 4, "♥": 3, "♣": 2, "♦": 1 };
    cards.sort((a, b) => b.rank - a.rank || suitOrder[b.suit] - suitOrder[a.suit]);
  }

  function groupByRank(cards) {
    const map = new Map();
    for (const card of cards) {
      if (!map.has(card.rank)) map.set(card.rank, []);
      map.get(card.rank).push(card);
    }
    return map;
  }

  function countByRank(cards) {
    const counts = new Map();
    for (const card of cards) {
      counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
    }
    return counts;
  }

  function rankList(cards) {
    return [...new Set(cards.map((card) => card.rank))].sort((a, b) => a - b);
  }

  function isConsecutive(ranks) {
    for (let i = 1; i < ranks.length; i += 1) {
      if (ranks[i] !== ranks[i - 1] + 1) return false;
    }
    return true;
  }

  function getSequenceRanks(counts, width, minLength) {
    const ranks = [...counts.entries()]
      .filter(([rank, count]) => rank < 15 && count >= width)
      .map(([rank]) => rank)
      .sort((a, b) => a - b);
    const sequences = [];
    let start = 0;
    while (start < ranks.length) {
      let end = start;
      while (end + 1 < ranks.length && ranks[end + 1] === ranks[end] + 1) end += 1;
      if (end - start + 1 >= minLength) {
        sequences.push(ranks.slice(start, end + 1));
      }
      start = end + 1;
    }
    return sequences;
  }

  function evaluatePlay(cards) {
    if (!cards.length) return null;
    const sorted = [...cards].sort((a, b) => a.rank - b.rank);
    const counts = countByRank(sorted);
    const entries = [...counts.entries()].sort((a, b) => a[0] - b[0]);
    const uniqueRanks = entries.map(([rank]) => rank);
    const size = sorted.length;

    if (size === 2 && counts.has(16) && counts.has(17)) {
      return { type: "rocket", key: 17, length: 2, label: "Rocket" };
    }

    if (size === 1) {
      return { type: "single", key: sorted[0].rank, length: 1, label: "Single" };
    }

    if (size === 2 && entries.length === 1 && entries[0][1] === 2) {
      return { type: "pair", key: entries[0][0], length: 1, label: "Pair" };
    }

    if (size === 3 && entries.length === 1) {
      return { type: "trio", key: entries[0][0], length: 1, label: "Triple" };
    }

    if (size === 4) {
      if (entries.length === 1) {
        return { type: "bomb", key: entries[0][0], length: 1, label: "Bomb" };
      }
      const triple = entries.find(([, count]) => count === 3);
      if (triple) {
        return { type: "trioSingle", key: triple[0], length: 1, label: "Triple + Single" };
      }
    }

    if (size === 5) {
      const triple = entries.find(([, count]) => count === 3);
      const pair = entries.find(([, count]) => count === 2);
      if (triple && pair) {
        return { type: "trioPair", key: triple[0], length: 1, label: "Triple + Pair" };
      }
    }

    if (size >= 5 && entries.every(([, count]) => count === 1) && uniqueRanks[uniqueRanks.length - 1] < 15 && isConsecutive(uniqueRanks)) {
      return { type: "straight", key: uniqueRanks[0], length: uniqueRanks.length, label: `Straight x${uniqueRanks.length}` };
    }

    if (size >= 6 && size % 2 === 0 && entries.every(([, count]) => count === 2) && uniqueRanks[uniqueRanks.length - 1] < 15 && isConsecutive(uniqueRanks)) {
      return { type: "pairStraight", key: uniqueRanks[0], length: uniqueRanks.length, label: `Pair Straight x${uniqueRanks.length}` };
    }

    const tripleRanks = entries.filter(([, count]) => count === 3).map(([rank]) => rank);
    if (tripleRanks.length >= 2 && tripleRanks[tripleRanks.length - 1] < 15 && isConsecutive(tripleRanks)) {
      const sequenceLength = tripleRanks.length;
      if (size === sequenceLength * 3) {
        return { type: "plane", key: tripleRanks[0], length: sequenceLength, label: `Plane x${sequenceLength}` };
      }
      if (size === sequenceLength * 4) {
        const singles = entries.filter(([, count]) => count === 1).length;
        if (singles === sequenceLength) {
          return { type: "planeSingle", key: tripleRanks[0], length: sequenceLength, label: `Plane + Singles x${sequenceLength}` };
        }
      }
      if (size === sequenceLength * 5) {
        const pairs = entries.filter(([, count]) => count === 2).length;
        if (pairs === sequenceLength) {
          return { type: "planePair", key: tripleRanks[0], length: sequenceLength, label: `Plane + Pairs x${sequenceLength}` };
        }
      }
    }

    if (size === 6) {
      const four = entries.find(([, count]) => count === 4);
      if (four) {
        return { type: "fourTwo", key: four[0], length: 1, label: "Four + Two Singles" };
      }
    }

    if (size === 8) {
      const four = entries.find(([, count]) => count === 4);
      const pairCount = entries.filter(([, count]) => count === 2).length;
      if (four && pairCount === 2) {
        return { type: "fourTwoPair", key: four[0], length: 1, label: "Four + Two Pairs" };
      }
    }

    return null;
  }

  function beats(play, currentPlay) {
    if (!play) return false;
    if (!currentPlay) return true;
    if (play.type === "rocket") return true;
    if (currentPlay.type === "rocket") return false;
    if (play.type === "bomb" && currentPlay.type !== "bomb") return true;
    if (play.type !== currentPlay.type) return false;
    if (play.length !== currentPlay.length) return false;
    return play.key > currentPlay.key;
  }

  function cardsFromRanks(hand, rank, count) {
    return hand.filter((card) => card.rank === rank).slice(0, count);
  }

  function generateAllPlays(hand) {
    const sorted = [...hand].sort((a, b) => a.rank - b.rank);
    const counts = countByRank(sorted);
    const groups = groupByRank(sorted);
    const plays = [];
    const seen = new Set();

    function push(cards) {
      const play = evaluatePlay(cards);
      if (!play) return;
      const key = `${play.type}|${play.key}|${play.length}|${cards.map((card) => card.id).sort().join(",")}`;
      if (!seen.has(key)) {
        seen.add(key);
        plays.push({ cards: [...cards], play });
      }
    }

    for (const [rank, group] of groups.entries()) {
      push(group.slice(0, 1));
      if (group.length >= 2) push(group.slice(0, 2));
      if (group.length >= 3) push(group.slice(0, 3));
      if (group.length === 4) push(group.slice(0, 4));
    }

    const ranks = [...groups.keys()].sort((a, b) => a - b);
    for (const rank of ranks) {
      if ((counts.get(rank) || 0) >= 3) {
        const tripleCards = cardsFromRanks(sorted, rank, 3);
        for (const singleRank of ranks) {
          if (singleRank !== rank) push([...tripleCards, ...cardsFromRanks(sorted, singleRank, 1)]);
        }
        for (const pairRank of ranks) {
          if (pairRank !== rank && (counts.get(pairRank) || 0) >= 2) {
            push([...tripleCards, ...cardsFromRanks(sorted, pairRank, 2)]);
          }
        }
      }
      if ((counts.get(rank) || 0) === 4) {
        const bombCards = cardsFromRanks(sorted, rank, 4);
        const singleCards = sorted.filter((card) => card.rank !== rank);
        for (let i = 0; i < singleCards.length; i += 1) {
          for (let j = i + 1; j < singleCards.length; j += 1) {
            push([...bombCards, singleCards[i], singleCards[j]]);
          }
        }
        const pairRanks = ranks.filter((candidate) => candidate !== rank && (counts.get(candidate) || 0) >= 2);
        for (let i = 0; i < pairRanks.length; i += 1) {
          for (let j = i + 1; j < pairRanks.length; j += 1) {
            push([
              ...bombCards,
              ...cardsFromRanks(sorted, pairRanks[i], 2),
              ...cardsFromRanks(sorted, pairRanks[j], 2),
            ]);
          }
        }
      }
    }

    const singleSequences = getSequenceRanks(counts, 1, 5);
    for (const seq of singleSequences) {
      for (let len = 5; len <= seq.length; len += 1) {
        for (let start = 0; start + len <= seq.length; start += 1) {
          push(seq.slice(start, start + len).flatMap((rank) => cardsFromRanks(sorted, rank, 1)));
        }
      }
    }

    const pairSequences = getSequenceRanks(counts, 2, 3);
    for (const seq of pairSequences) {
      for (let len = 3; len <= seq.length; len += 1) {
        for (let start = 0; start + len <= seq.length; start += 1) {
          push(seq.slice(start, start + len).flatMap((rank) => cardsFromRanks(sorted, rank, 2)));
        }
      }
    }

    const tripleSequences = getSequenceRanks(counts, 3, 2);
    for (const seq of tripleSequences) {
      for (let len = 2; len <= seq.length; len += 1) {
        for (let start = 0; start + len <= seq.length; start += 1) {
          const segment = seq.slice(start, start + len);
          const body = segment.flatMap((rank) => cardsFromRanks(sorted, rank, 3));
          push(body);

          const singlesPool = sorted.filter((card) => !segment.includes(card.rank));
          chooseAttachments(singlesPool, len, 1).forEach((attached) => push([...body, ...attached]));

          const pairRanks = ranks.filter((rank) => !segment.includes(rank) && (counts.get(rank) || 0) >= 2);
          chooseRankGroups(pairRanks, len).forEach((chosen) => {
            push([...body, ...chosen.flatMap((rank) => cardsFromRanks(sorted, rank, 2))]);
          });
        }
      }
    }

    if (counts.has(16) && counts.has(17)) {
      push([cardsFromRanks(sorted, 16, 1)[0], cardsFromRanks(sorted, 17, 1)[0]]);
    }

    plays.sort(compareGeneratedPlays);
    return plays;
  }

  function chooseAttachments(cards, pickCount, width) {
    const results = [];
    const chosen = [];
    function recur(start) {
      if (chosen.length === pickCount * width) {
        results.push([...chosen]);
        return;
      }
      for (let i = start; i < cards.length; i += 1) {
        chosen.push(cards[i]);
        recur(i + 1);
        chosen.pop();
      }
    }
    recur(0);
    return results;
  }

  function chooseRankGroups(ranks, count) {
    const results = [];
    const chosen = [];
    function recur(index, start) {
      if (index === count) {
        results.push([...chosen]);
        return;
      }
      for (let i = start; i < ranks.length; i += 1) {
        chosen.push(ranks[i]);
        recur(index + 1, i + 1);
        chosen.pop();
      }
    }
    recur(0, 0);
    return results;
  }

  function compareGeneratedPlays(a, b) {
    const order = {
      single: 1,
      pair: 2,
      trio: 3,
      trioSingle: 4,
      trioPair: 5,
      straight: 6,
      pairStraight: 7,
      plane: 8,
      planeSingle: 9,
      planePair: 10,
      fourTwo: 11,
      fourTwoPair: 12,
      bomb: 13,
      rocket: 14,
    };
    return (
      order[a.play.type] - order[b.play.type] ||
      a.play.length - b.play.length ||
      a.play.key - b.play.key ||
      a.cards.length - b.cards.length
    );
  }

  function createPlayers() {
    state.players = {
      player: {
        id: "player",
        name: "You",
        seat: "bottom",
        isHuman: true,
        hand: [],
        role: "Peasant",
        lastPlay: null,
      },
      left: {
        id: "left",
        name: "Left AI",
        seat: "left",
        isHuman: false,
        hand: [],
        role: "Peasant",
        lastPlay: null,
      },
      right: {
        id: "right",
        name: "Right AI",
        seat: "right",
        isHuman: false,
        hand: [],
        role: "Peasant",
        lastPlay: null,
      },
    };
  }

  function startNewRound() {
    createPlayers();
    state.deck = shuffled(createDeck());
    state.landlord = null;
    state.currentTurn = null;
    state.hiddenKitty = state.deck.slice(-3);
    state.kitty = [];
    state.currentPlay = null;
    state.lastWinner = null;
    state.multiplier = 1;
    state.baseScore = 1;
    state.history = [];
    state.selected.clear();
    state.phase = "bidding";
    state.turnLocked = false;
    state.sortMode = "rank";

    PLAYER_IDS.forEach((id, index) => {
      state.players[id].hand = state.deck.slice(index * 17, index * 17 + 17);
      sortCards(state.players[id].hand);
      state.players[id].role = "Peasant";
      state.players[id].lastPlay = null;
    });

    state.bidOrder = shuffled([...PLAYER_IDS]);
    state.bidIndex = 0;
    state.pendingBidTurn = state.bidOrder[0];
    ui.tipBox.textContent = TIP_POOL[Math.floor(Math.random() * TIP_POOL.length)];
    pushHistory("New round started. Bidding for landlord begins.");
    render();
    runBiddingTurn();
  }

  function pushHistory(text) {
    state.history.unshift(text);
    state.history = state.history.slice(0, 12);
  }

  function runBiddingTurn() {
    if (state.phase !== "bidding") return;
    const bidder = state.pendingBidTurn;
    ui.phaseText.textContent = "Landlord bidding";
    ui.turnText.textContent = `${PLAYER_NAMES[bidder]} is deciding whether to call.`;
    ui.centerMessage.textContent = `${PLAYER_NAMES[bidder]} to bid`;
    renderControls();

    if (bidder !== "player") {
      state.turnLocked = true;
      window.setTimeout(() => {
        const wantsLandlord = aiShouldBid(state.players[bidder].hand);
        if (wantsLandlord) {
          assignLandlord(bidder);
        } else {
          pushHistory(`${PLAYER_NAMES[bidder]} passed the landlord bid.`);
          advanceBidTurn();
        }
        state.turnLocked = false;
        render();
      }, 950);
    }
  }

  function aiShouldBid(hand) {
    const counts = countByRank(hand);
    let strength = 0;
    for (const [rank, count] of counts.entries()) {
      if (rank >= 16) strength += 4;
      else if (rank === 15) strength += 2.4;
      else if (rank >= 13) strength += 1.4;
      if (count === 4) strength += 5;
      if (count === 3) strength += 2;
      if (count === 2) strength += 0.7;
    }
    const highCards = hand.filter((card) => card.rank >= 14).length;
    strength += highCards * 0.9;
    return strength >= 14 + Math.random() * 2.4;
  }

  function assignLandlord(playerId) {
    state.landlord = playerId;
    state.players[playerId].role = "Landlord";
    state.players[playerId].hand.push(...state.hiddenKitty);
    sortCards(state.players[playerId].hand);
    state.kitty = [...state.hiddenKitty];
    state.hiddenKitty = [];
    state.phase = "playing";
    state.currentTurn = playerId;
    state.starter = playerId;
    state.lastWinner = playerId;
    state.pendingBidTurn = null;
    ui.centerMessage.textContent = `${PLAYER_NAMES[playerId]} becomes the landlord`;
    pushHistory(`${PLAYER_NAMES[playerId]} called landlord and takes the 3 hidden cards.`);
    render();
    if (playerId !== "player") {
      queueAiTurn();
    }
  }

  function advanceBidTurn() {
    state.bidIndex += 1;
    if (state.bidIndex >= state.bidOrder.length) {
      const fallback = state.bidOrder[Math.floor(Math.random() * state.bidOrder.length)];
      pushHistory(`No one called. ${PLAYER_NAMES[fallback]} is assigned as landlord by redraw rule.`);
      assignLandlord(fallback);
      return;
    }
    state.pendingBidTurn = state.bidOrder[state.bidIndex];
    runBiddingTurn();
  }

  function nextPlayer(playerId) {
    const idx = PLAYER_IDS.indexOf(playerId);
    return PLAYER_IDS[(idx + 1) % PLAYER_IDS.length];
  }

  function makePlay(playerId, cards, play) {
    const player = state.players[playerId];
    const ids = new Set(cards.map((card) => card.id));
    player.hand = player.hand.filter((card) => !ids.has(card.id));
    sortCards(player.hand);
    player.lastPlay = { cards: [...cards], play };
    state.currentPlay = { playerId, cards: [...cards], play, passes: 0 };
    state.lastWinner = playerId;
    state.currentTurn = nextPlayer(playerId);
    state.selected.clear();
    if (play.type === "bomb" || play.type === "rocket") {
      state.multiplier *= 2;
      pushHistory(`${PLAYER_NAMES[playerId]} played ${play.label}. Multiplier doubled to ${state.multiplier}x.`);
    } else {
      pushHistory(`${PLAYER_NAMES[playerId]} played ${formatCards(cards)}.`);
    }

    if (!player.hand.length) {
      finishRound(playerId);
      return;
    }

    ui.centerMessage.textContent = `${PLAYER_NAMES[playerId]} leads with ${play.label}`;
    render();
    if (state.currentTurn !== "player") queueAiTurn();
  }

  function handlePass(playerId) {
    if (!state.currentPlay || state.currentPlay.playerId === playerId) return;
    pushHistory(`${PLAYER_NAMES[playerId]} passed.`);
    state.currentPlay.passes += 1;
    state.players[playerId].lastPlay = null;
    const next = nextPlayer(playerId);
    if (state.currentPlay.passes >= 2) {
      const leader = state.currentPlay.playerId;
      state.currentTurn = leader;
      state.currentPlay = null;
      ui.centerMessage.textContent = `${PLAYER_NAMES[leader]} wins the trick and leads again`;
      pushHistory(`${PLAYER_NAMES[leader]} regains the lead.`);
    } else {
      state.currentTurn = next;
    }
    render();
    if (state.phase === "playing" && state.currentTurn !== "player") queueAiTurn();
  }

  function finishRound(winnerId) {
    state.phase = "finished";
    const landlordWon = winnerId === state.landlord;
    const playerWon = landlordWon ? state.landlord === "player" : state.landlord !== "player";
    const payout = state.baseScore * state.multiplier * (state.landlord === "player" || winnerId === "player" ? 2 : 1);

    if (playerWon) {
      state.stats.wins += 1;
      state.stats.streak += 1;
      state.stats.best = Math.max(state.stats.best, state.stats.streak);
      state.stats.coins += payout * 80;
      ui.centerMessage.textContent = `${PLAYER_NAMES[winnerId]} wins the round`;
      pushHistory(`Round complete. ${playerWon ? "You win" : "You lose"} ${payout * 80} coins.`);
    } else {
      state.stats.losses += 1;
      state.stats.streak = 0;
      state.stats.coins -= payout * 60;
      ui.centerMessage.textContent = `${PLAYER_NAMES[winnerId]} wins the round`;
      pushHistory(`Round complete. ${playerWon ? "You win" : "You lose"} ${payout * 60} coins.`);
    }

    saveStats();
    render();
  }

  function queueAiTurn() {
    if (state.phase !== "playing" || state.currentTurn === "player") return;
    const playerId = state.currentTurn;
    state.turnLocked = true;
    renderControls();
    window.setTimeout(() => {
      playAiTurn(playerId);
      state.turnLocked = false;
      renderControls();
    }, 980);
  }

  function playAiTurn(playerId) {
    if (state.phase !== "playing" || state.currentTurn !== playerId) return;
    const player = state.players[playerId];
    const move = chooseAiMove(playerId, player.hand, state.currentPlay);
    if (!move) {
      handlePass(playerId);
      return;
    }
    makePlay(playerId, move.cards, move.play);
  }

  function chooseAiMove(playerId, hand, currentPlay) {
    const all = generateAllPlays(hand);
    const legal = all.filter((candidate) => beats(candidate.play, currentPlay && currentPlay.play));
    if (!legal.length) return null;

    if (!currentPlay || currentPlay.playerId === playerId) {
      return preferOpeningMove(legal, hand.length);
    }

    const teammate = playerId !== state.landlord;
    const leaderIsTeammate = currentPlay.playerId !== state.landlord;
    if (teammate && leaderIsTeammate) {
      return null;
    }

    const nonBomb = legal.filter((item) => item.play.type !== "bomb" && item.play.type !== "rocket");
    if (nonBomb.length) return nonBomb[0];
    return hand.length <= 6 ? legal[0] : null;
  }

  function preferOpeningMove(candidates, handSize) {
    const preferred = candidates.filter((item) => !["bomb", "rocket"].includes(item.play.type));
    const pool = preferred.length ? preferred : candidates;
    pool.sort((a, b) => {
      const scoreA = openingScore(a, handSize);
      const scoreB = openingScore(b, handSize);
      return scoreA - scoreB;
    });
    return pool[0];
  }

  function openingScore(candidate, handSize) {
    const { play, cards } = candidate;
    let score = play.key;
    if (play.type === "single") score += 8;
    if (play.type === "pair") score += 5;
    if (play.type === "straight" || play.type === "pairStraight" || play.type.startsWith("plane")) score -= 6;
    if (play.type === "trioSingle" || play.type === "trioPair") score -= 2;
    if (play.type === "bomb" || play.type === "rocket") score += 30;
    if (cards.length === handSize) score -= 40;
    return score;
  }

  function formatCards(cards) {
    return cards
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((card) => `${RANK_LABEL[card.rank]}${card.suit === "★" || card.suit === "☆" ? "" : card.suit}`)
      .join(" ");
  }

  function cardColor(card) {
    if (card.suit === "★") return "red";
    if (card.suit === "☆") return "black";
    return RED_SUITS.has(card.suit) ? "red" : "black";
  }

  function renderCard(card, { small = false, selectable = false, selected = false } = {}) {
    const node = ui.cardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".card-rank").textContent = RANK_LABEL[card.rank];
    node.querySelector(".card-suit").textContent = card.suit === "★" ? "Joker" : card.suit === "☆" ? "Joker" : card.suit;
    node.classList.add(cardColor(card));
    if (small) node.classList.add("small");
    if (selected) node.classList.add("selected");
    if (selectable) {
      node.addEventListener("click", () => {
        if (state.phase !== "playing" || state.currentTurn !== "player") return;
        if (state.selected.has(card.id)) state.selected.delete(card.id);
        else state.selected.add(card.id);
        render();
      });
    } else {
      node.disabled = true;
    }
    return node;
  }

  function renderAiHand(container, count) {
    container.replaceChildren();
    for (let i = 0; i < count; i += 1) {
      const back = document.createElement("div");
      back.className = "back-card";
      back.style.setProperty("--i", `${i}`);
      container.appendChild(back);
    }
  }

  function renderPlayed(container, lastPlay) {
    container.replaceChildren();
    if (!lastPlay) return;
    for (const card of lastPlay.cards) {
      container.appendChild(renderCard(card, { small: true }));
    }
  }

  function renderKitty() {
    ui.kitty.replaceChildren();
    const source = state.kitty.length ? state.kitty : state.hiddenKitty;
    if (!source.length) return;
    source.forEach((card) => {
      if (state.phase === "bidding") {
        const back = document.createElement("div");
        back.className = "back-card";
        ui.kitty.appendChild(back);
      } else {
        ui.kitty.appendChild(renderCard(card, { small: true }));
      }
    });
  }

  function renderHistory() {
    ui.historyLog.replaceChildren();
    state.history.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.textContent = entry;
      ui.historyLog.appendChild(item);
    });
  }

  function renderPlayerHand() {
    ui.playerHand.replaceChildren();
    const hand = [...state.players.player.hand];
    if (state.sortMode === "pattern") {
      const rankCounts = countByRank(state.players.player.hand);
      hand.sort((a, b) => {
        const countDiff = rankCounts.get(b.rank) - rankCounts.get(a.rank);
        return countDiff || b.rank - a.rank;
      });
    }
    hand.forEach((card) => {
      ui.playerHand.appendChild(renderCard(card, { selectable: true, selected: state.selected.has(card.id) }));
    });
  }

  function renderRoles() {
    ui.leftRole.textContent = state.players.left.role;
    ui.rightRole.textContent = state.players.right.role;
    ui.playerRole.textContent = state.players.player.role;
    ui.landlordName.textContent = state.landlord ? PLAYER_NAMES[state.landlord] : "Pending";
  }

  function renderStats() {
    ui.wins.textContent = String(state.stats.wins);
    ui.losses.textContent = String(state.stats.losses);
    ui.streak.textContent = String(state.stats.streak);
    ui.best.textContent = String(state.stats.best);
    ui.coins.textContent = String(state.stats.coins);
  }

  function renderStatus() {
    ui.baseScore.textContent = String(state.baseScore);
    ui.multiplier.textContent = `${state.multiplier}x`;
    ui.leftCount.textContent = `${state.players.left.hand.length} cards`;
    ui.rightCount.textContent = `${state.players.right.hand.length} cards`;
    ui.currentPattern.textContent = state.currentPlay ? state.currentPlay.play.label : "Opening lead";
    ui.lastWinner.textContent = state.lastWinner ? PLAYER_NAMES[state.lastWinner] : "None";

    if (state.phase === "playing") {
      ui.phaseText.textContent = "Round in play";
      ui.turnText.textContent = `${PLAYER_NAMES[state.currentTurn]} to act`;
    } else if (state.phase === "finished") {
      ui.phaseText.textContent = "Round finished";
      ui.turnText.textContent = "Start another round when ready";
    }
  }

  function renderControls() {
    const playerTurn = state.currentTurn === "player";
    const mustRespond = state.currentPlay && state.currentPlay.playerId !== "player";
    const selectedCards = state.players.player.hand.filter((card) => state.selected.has(card.id));
    const play = evaluatePlay(selectedCards);
    const validSelection = play && beats(play, state.currentPlay && state.currentPlay.play);

    ui.bidBtn.disabled = !(state.phase === "bidding" && state.pendingBidTurn === "player" && !state.turnLocked);
    ui.passBidBtn.disabled = ui.bidBtn.disabled;
    ui.hintBtn.disabled = !(state.phase === "playing" && playerTurn && !state.turnLocked);
    ui.playBtn.disabled = !(state.phase === "playing" && playerTurn && validSelection && !state.turnLocked);
    ui.passBtn.disabled = !(state.phase === "playing" && playerTurn && mustRespond && !state.turnLocked);
    ui.sortBtn.disabled = state.phase !== "playing" && state.phase !== "finished";
    ui.newGameBtn.disabled = state.turnLocked;
  }

  function render() {
    renderStatus();
    renderStats();
    renderHistory();
    renderKitty();
    renderRoles();
    renderAiHand(ui.leftHand, state.players.left.hand.length);
    renderAiHand(ui.rightHand, state.players.right.hand.length);
    renderPlayed(ui.leftPlayArea, state.players.left.lastPlay);
    renderPlayed(ui.rightPlayArea, state.players.right.lastPlay);
    renderPlayed(ui.playerPlayArea, state.players.player.lastPlay);
    renderPlayerHand();
    renderControls();
  }

  function handleBid(call) {
    if (state.phase !== "bidding" || state.pendingBidTurn !== "player") return;
    if (call) {
      assignLandlord("player");
    } else {
      pushHistory("You passed the landlord bid.");
      advanceBidTurn();
      render();
    }
  }

  function handlePlaySelected() {
    if (state.phase !== "playing" || state.currentTurn !== "player") return;
    const cards = state.players.player.hand.filter((card) => state.selected.has(card.id));
    const play = evaluatePlay(cards);
    if (!play) {
      ui.centerMessage.textContent = "Selected cards do not form a legal Dou Dizhu pattern.";
      return;
    }
    if (!beats(play, state.currentPlay && state.currentPlay.play)) {
      ui.centerMessage.textContent = "Your selection does not beat the current pattern.";
      return;
    }
    makePlay("player", cards, play);
  }

  function handleHint() {
    if (state.phase !== "playing" || state.currentTurn !== "player") return;
    const candidates = generateAllPlays(state.players.player.hand).filter((candidate) => beats(candidate.play, state.currentPlay && state.currentPlay.play));
    if (!candidates.length) {
      ui.centerMessage.textContent = "No legal play available. You may pass.";
      return;
    }
    state.selected = new Set(candidates[0].cards.map((card) => card.id));
    ui.centerMessage.textContent = `Hint selected: ${candidates[0].play.label}`;
    render();
  }

  function bindEvents() {
    ui.bidBtn.addEventListener("click", () => handleBid(true));
    ui.passBidBtn.addEventListener("click", () => handleBid(false));
    ui.playBtn.addEventListener("click", handlePlaySelected);
    ui.passBtn.addEventListener("click", () => handlePass("player"));
    ui.hintBtn.addEventListener("click", handleHint);
    ui.sortBtn.addEventListener("click", () => {
      state.sortMode = state.sortMode === "rank" ? "pattern" : "rank";
      render();
    });
    ui.newGameBtn.addEventListener("click", startNewRound);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handlePlaySelected();
      if (event.key.toLowerCase() === "h") handleHint();
      if (event.key.toLowerCase() === "p") handlePass("player");
    });
  }

  bindEvents();
  startNewRound();
})();
