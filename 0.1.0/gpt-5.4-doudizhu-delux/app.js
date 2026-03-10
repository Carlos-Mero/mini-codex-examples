const SUIT_SYMBOL = {
  spade: "♠",
  heart: "♥",
  club: "♣",
  diamond: "♦",
  joker: "★",
};

const RANK_LABEL = {
  3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "SJ", 17: "BJ",
};

const PLAYER_IDS = ["top", "left", "bottom"];
const PLAYER_NAMES = { top: "阿策", left: "小略", bottom: "你" };
const STORAGE_KEY = "doudizhu-deluxe-save-v2";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class DouDizhuGame {
  constructor() {
    this.el = {
      phaseLabel: document.getElementById("phaseLabel"),
      baseScore: document.getElementById("baseScore"),
      multiplier: document.getElementById("multiplier"),
      sortModeLabel: document.getElementById("sortModeLabel"),
      phaseBadge: document.getElementById("phaseBadge"),
      statusBanner: document.getElementById("statusBanner"),
      sidebarStatus: document.getElementById("sidebarStatus"),
      heroMultiplier: document.getElementById("heroMultiplier"),
      landlordLabel: document.getElementById("landlordLabel"),
      leaderLabel: document.getElementById("leaderLabel"),
      kittyCards: document.getElementById("kittyCards"),
      lastPlayType: document.getElementById("lastPlayType"),
      lastPlayCards: document.getElementById("lastPlayCards"),
      logPanel: document.getElementById("logPanel"),
      biddingActions: document.getElementById("biddingActions"),
      playActions: document.getElementById("playActions"),
      playBtn: document.getElementById("playBtn"),
      passBtn: document.getElementById("passBtn"),
      hintBtn: document.getElementById("hintBtn"),
      sortBtn: document.getElementById("sortBtn"),
      soundBtn: document.getElementById("soundBtn"),
      toast: document.getElementById("toast"),
      roundCount: document.getElementById("roundCount"),
      winCount: document.getElementById("winCount"),
      streakCount: document.getElementById("streakCount"),
      springFlag: document.getElementById("springFlag"),
      scoreSelf: document.getElementById("score-self"),
      scoreTop: document.getElementById("score-top"),
      scoreLeft: document.getElementById("score-left"),
      newGameBtn: document.getElementById("newGameBtn"),
      howToBtn: document.getElementById("howToBtn"),
      modal: document.getElementById("modal"),
      closeModalBtn: document.getElementById("closeModalBtn"),
      dealDeck: document.getElementById("dealDeck"),
      bidButtons: [...document.querySelectorAll(".bid-btn")],
      role: {
        top: document.getElementById("role-top"),
        left: document.getElementById("role-left"),
        bottom: document.getElementById("role-bottom"),
      },
      count: {
        top: document.getElementById("count-top"),
        left: document.getElementById("count-left"),
        bottom: document.getElementById("count-bottom"),
      },
      bid: {
        top: document.getElementById("bid-top"),
        left: document.getElementById("bid-left"),
        bottom: document.getElementById("bid-bottom"),
      },
      turn: {
        top: document.getElementById("turn-top"),
        left: document.getElementById("turn-left"),
        bottom: document.getElementById("turn-bottom"),
      },
      hand: {
        top: document.getElementById("hand-top"),
        left: document.getElementById("hand-left"),
        bottom: document.getElementById("hand-bottom"),
      },
      play: {
        top: document.getElementById("play-top"),
        left: document.getElementById("play-left"),
        bottom: document.getElementById("play-bottom"),
      },
      seat: {
        top: document.getElementById("seat-top"),
        left: document.getElementById("seat-left"),
        bottom: document.getElementById("seat-bottom"),
      },
      pressureCount: {
        top: document.getElementById("pressure-count-top"),
        left: document.getElementById("pressure-count-left"),
        bottom: document.getElementById("pressure-count-bottom"),
      },
      pressureRole: {
        top: document.getElementById("pressure-role-top"),
        left: document.getElementById("pressure-role-left"),
        bottom: document.getElementById("pressure-role-bottom"),
      },
      pressureTag: {
        top: document.getElementById("pressure-tag-top"),
        left: document.getElementById("pressure-tag-left"),
        bottom: document.getElementById("pressure-tag-bottom"),
      },
      pressureFill: {
        top: document.getElementById("pressure-fill-top"),
        left: document.getElementById("pressure-fill-left"),
        bottom: document.getElementById("pressure-fill-bottom"),
      },
    };

    this.audioCtx = null;
    this.toastTimer = null;
    this.busy = false;
    this.persistent = this.loadPersistent();
    this.sortMode = this.persistent.sortMode || "group";

    this.bindEvents();
    this.resetTransientState();
    this.render();
  }

  loadPersistent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          roundCount: 0,
          winCount: 0,
          streakCount: 0,
          sortMode: "group",
          soundOn: true,
          scores: { top: 1000, left: 1000, bottom: 1000 },
        };
      }
      const data = JSON.parse(raw);
      return {
        roundCount: Number(data.roundCount || 0),
        winCount: Number(data.winCount || 0),
        streakCount: Number(data.streakCount || 0),
        sortMode: data.sortMode === "rank" ? "rank" : "group",
        soundOn: data.soundOn !== false,
        scores: {
          top: Number(data.scores?.top ?? 1000),
          left: Number(data.scores?.left ?? 1000),
          bottom: Number(data.scores?.bottom ?? 1000),
        },
      };
    } catch {
      return {
        roundCount: 0,
        winCount: 0,
        streakCount: 0,
        sortMode: "group",
        soundOn: true,
        scores: { top: 1000, left: 1000, bottom: 1000 },
      };
    }
  }

  savePersistent() {
    this.persistent.sortMode = this.sortMode;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.persistent));
  }

  resetTransientState() {
    this.state = {
      phase: "idle",
      baseScore: 1,
      multiplier: 1,
      currentTurn: null,
      currentLeader: null,
      passCount: 0,
      landlord: null,
      highestBid: -1,
      highestBidder: null,
      bidTurnIndex: 0,
      biddingOrder: [],
      dealCounts: { top: 0, left: 0, bottom: 0 },
      players: PLAYER_IDS.map((id) => ({
        id,
        name: PLAYER_NAMES[id],
        isHuman: id === "bottom",
        hand: [],
        selected: new Set(),
        bid: null,
        role: "farmer",
        playedHands: 0,
      })),
      kitty: [],
      lastPlay: null,
      tablePlays: { top: null, left: null, bottom: null },
      log: [],
      winner: null,
      spring: false,
    };
  }

  bindEvents() {
    this.el.newGameBtn.addEventListener("click", () => this.startNewRound(true));
    this.el.howToBtn.addEventListener("click", () => this.toggleModal(true));
    this.el.closeModalBtn.addEventListener("click", () => this.toggleModal(false));
    this.el.modal.addEventListener("click", (e) => {
      if (e.target === this.el.modal) this.toggleModal(false);
    });

    this.el.soundBtn.addEventListener("click", () => {
      this.persistent.soundOn = !this.persistent.soundOn;
      if (this.persistent.soundOn) this.unlockAudio();
      this.savePersistent();
      this.render();
      this.showToast(this.persistent.soundOn ? "音效已开启" : "音效已关闭");
      if (this.persistent.soundOn) this.sound("hint");
    });

    window.addEventListener("pointerdown", () => this.unlockAudio(), { once: true });

    this.el.bidButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.busy || this.state.phase !== "bidding" || this.state.currentTurn !== "bottom" || btn.disabled) return;
        this.handleHumanBid(Number(btn.dataset.bid));
      });
    });

    this.el.playBtn.addEventListener("click", () => this.handleHumanPlay());
    this.el.passBtn.addEventListener("click", () => this.handleHumanPass());
    this.el.hintBtn.addEventListener("click", () => this.handleHint());
    this.el.sortBtn.addEventListener("click", () => this.toggleSort());

    window.addEventListener("keydown", (e) => {
      if (!this.el.modal.classList.contains("hidden")) {
        if (e.key === "Escape") this.toggleModal(false);
        return;
      }
      if (e.key === "n" || e.key === "N") this.startNewRound(true);
      if (e.key === "h" || e.key === "H") this.handleHint();
      if (e.key === "s" || e.key === "S") this.toggleSort();
      if (e.key === "p" || e.key === "P") this.handleHumanPass();
      if (e.key === "Escape") {
        const player = this.player("bottom");
        player.selected.clear();
        this.renderHand("bottom");
      }
      if (e.code === "Space") {
        e.preventDefault();
        this.handleHumanPlay();
      }
    });

    window.addEventListener("resize", () => {
      if (this.state.phase === "playing" || this.state.phase === "bidding" || this.state.phase === "dealing") {
        this.render();
      }
    });
  }

  unlockAudio() {
    if (!this.persistent.soundOn) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();
    } catch {}
  }

  sound(name) {
    if (!this.persistent.soundOn) return;
    this.unlockAudio();
    const ctx = this.audioCtx;
    if (!ctx) return;

    const playTone = (freq, dur = 0.08, type = "sine", vol = 0.03, endFreq = null, delay = 0) => {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq != null) osc.frequency.linearRampToValueAtTime(endFreq, now + dur);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    };

    if (name === "deal") return playTone(520, 0.05, "triangle", 0.012, 660);
    if (name === "bid") return playTone(700, 0.09, "triangle", 0.02, 900);
    if (name === "pass") return playTone(260, 0.08, "sine", 0.015, 220);
    if (name === "hint") return playTone(560, 0.08, "sine", 0.02, 760);
    if (name === "play") return playTone(420, 0.07, "triangle", 0.018, 540);
    if (name === "bomb") {
      playTone(180, 0.12, "square", 0.035, 120);
      playTone(90, 0.18, "sawtooth", 0.018, 60, 0.03);
      return;
    }
    if (name === "win") {
      playTone(660, 0.09, "triangle", 0.03, 880);
      playTone(880, 0.09, "triangle", 0.03, 1100, 0.1);
      playTone(1100, 0.15, "triangle", 0.03, 1320, 0.2);
    }
  }

  player(id) {
    return this.state.players.find((p) => p.id === id);
  }

  createDeck() {
    const suits = ["spade", "heart", "club", "diamond"];
    const ranks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const deck = [];
    let id = 0;
    for (const rank of ranks) {
      for (const suit of suits) {
        deck.push({ id: `c${id++}`, rank, suit });
      }
    }
    deck.push({ id: `c${id++}`, rank: 16, suit: "joker" });
    deck.push({ id: `c${id++}`, rank: 17, suit: "joker" });
    return deck;
  }

  shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  countMap(cards) {
    const map = new Map();
    cards.forEach((c) => map.set(c.rank, (map.get(c.rank) || 0) + 1));
    return map;
  }

  sortHand(hand, mode = "group") {
    const counts = this.countMap(hand);
    hand.sort((a, b) => {
      if (mode === "group") {
        const diff = (counts.get(b.rank) || 0) - (counts.get(a.rank) || 0);
        if (diff) return diff;
      }
      if (b.rank !== a.rank) return b.rank - a.rank;
      return a.suit.localeCompare(b.suit);
    });
  }

  evaluateHandStrength(hand) {
    const counts = this.countMap(hand);
    let score = 0;
    hand.forEach((card) => {
      if (card.rank >= 15) score += 1.15;
      else if (card.rank >= 13) score += 0.55;
      else if (card.rank <= 6) score -= 0.04;
    });
    for (const [rank, count] of counts.entries()) {
      if (count === 4) score += 2.8;
      if (count === 3) score += 1.1;
      if (count === 2) score += rank >= 10 ? 0.55 : 0.3;
    }
    if (counts.has(16) && counts.has(17)) score += 2.4;
    score += this.findSequences(hand, 1, 5).length * 0.28;
    score += this.findSequences(hand, 2, 3).length * 0.36;
    return score;
  }

  async startNewRound(countRound = true) {
    if (this.busy) return;
    this.busy = true;
    this.clearWinOverlay();
    this.resetTransientState();
    this.state.phase = "dealing";

    if (countRound) this.persistent.roundCount += 1;
    this.log(countRound ? `第 <strong>${this.persistent.roundCount}</strong> 局开始` : "重新发牌");
    this.setStatus(countRound ? "洗牌中..." : "无人叫分，重新发牌");
    this.render();

    await wait(220);

    const deck = this.shuffle(this.createDeck());
    const startIndex = Math.floor(Math.random() * 3);
    this.state.biddingOrder = [0, 1, 2].map((i) => PLAYER_IDS[(startIndex + i) % 3]);

    this.state.players.forEach((p) => {
      p.hand = [];
      p.selected.clear();
      p.bid = null;
      p.role = "farmer";
      p.playedHands = 0;
    });

    this.state.kitty = deck.splice(-3);
    for (let i = 0; i < 17; i++) {
      for (const id of this.state.biddingOrder) {
        this.player(id).hand.push(deck.shift());
      }
    }
    this.state.players.forEach((p) => this.sortHand(p.hand, this.sortMode));

    this.state.dealCounts = { top: 0, left: 0, bottom: 0 };
    this.render();

    for (let i = 0; i < 17; i++) {
      for (const id of this.state.biddingOrder) {
        this.state.dealCounts[id] += 1;
        this.sound("deal");
        this.render();
        await wait(45);
      }
    }

    this.state.phase = "bidding";
    this.state.currentTurn = this.state.biddingOrder[0];
    this.state.bidTurnIndex = 0;
    this.setStatus(`由 ${this.player(this.state.currentTurn).name} 先叫分`);
    this.render();
    await wait(220);

    this.busy = false;
    this.maybeRunAI();
  }

  setStatus(text) {
    this.el.statusBanner.textContent = text;
    if (this.el.sidebarStatus) this.el.sidebarStatus.textContent = text;
  }

  showToast(text) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove("show"), 1800);
  }

  log(html) {
    this.state.log.unshift(html);
    this.state.log = this.state.log.slice(0, 60);
  }

  toggleModal(show) {
    this.el.modal.classList.toggle("hidden", !show);
  }

  toggleSort() {
    this.sortMode = this.sortMode === "group" ? "rank" : "group";
    this.state.players.forEach((p) => this.sortHand(p.hand, this.sortMode));
    this.savePersistent();
    this.render();
    this.sound("hint");
    this.showToast(this.sortMode === "group" ? "已切换为：智能分组排序" : "已切换为：点数排序");
  }

  cardColor(card) {
    return card.suit === "heart" || card.suit === "diamond" || card.rank === 17 ? "red" : "";
  }

  cardCenter(card) {
    if (card.rank >= 16) return card.rank === 17 ? "🃏" : "☆";
    return SUIT_SYMBOL[card.suit];
  }

  createCardNode(card, options = {}) {
    const { small = false, human = false, selected = false, extraClass = "", animate = false } = options;
    const div = document.createElement("div");
    div.className = `card ${small ? "small" : ""} ${human ? "human-card" : ""} ${selected ? "selected" : ""} ${this.cardColor(card)} ${extraClass} ${animate ? "enter" : ""}`;
    div.innerHTML = `
      <div class="corner">
        <div class="rank">${RANK_LABEL[card.rank]}</div>
        <div class="suit">${card.rank >= 16 ? "" : SUIT_SYMBOL[card.suit]}</div>
      </div>
      <div class="center">${this.cardCenter(card)}</div>
    `;
    return div;
  }

  createBackNode({ small = false, animate = false } = {}) {
    const div = document.createElement("div");
    div.className = `card back ${small ? "small" : ""} ${animate ? "enter" : ""}`;
    return div;
  }

  computeOverlap(count, width, containerWidth, min = -46, max = -14) {
    if (count <= 1) return 0;
    const total = count * width;
    if (total <= containerWidth) return 0;
    const overlap = -Math.ceil((total - containerWidth) / (count - 1));
    return Math.max(min, Math.min(max, overlap));
  }

  render() {
    const phaseText = this.phaseText();
    this.el.phaseLabel.textContent = phaseText;
    this.el.phaseBadge.textContent = phaseText;
    this.el.phaseBadge.className = `phase-badge phase-${this.state.phase}`;
    this.el.baseScore.textContent = this.state.baseScore;
    this.el.multiplier.textContent = this.state.multiplier;
    this.el.heroMultiplier.textContent = `x${this.state.multiplier}`;
    this.el.sortModeLabel.textContent = this.sortMode === "group" ? "分组" : "点数";
    this.el.roundCount.textContent = this.persistent.roundCount;
    this.el.winCount.textContent = this.persistent.winCount;
    this.el.streakCount.textContent = this.persistent.streakCount;
    this.el.springFlag.textContent = this.state.spring ? "是" : "否";
    this.el.soundBtn.textContent = `音效：${this.persistent.soundOn ? "开" : "关"}`;
    this.el.dealDeck.classList.toggle("hidden", this.state.phase !== "dealing");

    this.el.scoreSelf.textContent = this.persistent.scores.bottom;
    this.el.scoreTop.textContent = this.persistent.scores.top;
    this.el.scoreLeft.textContent = this.persistent.scores.left;
    this.el.landlordLabel.textContent = this.state.landlord ? this.player(this.state.landlord).name : "待定";
    this.el.leaderLabel.textContent = this.state.currentLeader ? this.player(this.state.currentLeader).name : "—";
    this.el.sidebarStatus.textContent = this.state.phase === "idle" ? "等待开始" : this.el.statusBanner.textContent;

    for (const id of PLAYER_IDS) {
      const p = this.player(id);
      const count = this.state.phase === "dealing" ? this.state.dealCounts[id] : p.hand.length;
      this.el.count[id].textContent = count;
      this.el.bid[id].textContent = p.bid == null ? "" : p.bid === 0 ? "不叫" : `叫 ${p.bid} 分`;
      this.el.role[id].textContent = p.role === "landlord" ? "地主" : "农民";
      this.el.role[id].classList.toggle("landlord", p.role === "landlord");
      this.el.turn[id].classList.toggle("active", this.state.currentTurn === id);
      this.el.seat[id].classList.toggle("is-active", this.state.currentTurn === id);
      this.el.seat[id].classList.toggle("is-landlord", p.role === "landlord");
      this.el.pressureCount[id].textContent = `${count} 张`;
      this.el.pressureRole[id].textContent = p.role === "landlord" ? "地主" : "农民";
      const pressure = this.handPressureLevel(count);
      this.el.pressureTag[id].textContent = pressure.label;
      this.el.pressureFill[id].style.width = `${pressure.width}%`;
      this.el.pressureFill[id].style.background = pressure.color;
      this.renderHand(id);
      this.renderPlayed(id);
    }

    this.renderKitty();
    this.renderLastPlay();
    this.renderLog();
    this.syncActions();
  }


  handPressureLevel(count) {
    if (count <= 2) return { label: "极高", width: 100, color: "linear-gradient(90deg, #ff6f91, #ffb870)" };
    if (count <= 5) return { label: "高压", width: 82, color: "linear-gradient(90deg, #ff9966, #ffd56a)" };
    if (count <= 9) return { label: "警戒", width: 62, color: "linear-gradient(90deg, #7ed8ff, #8df0c2)" };
    return { label: "稳态", width: 38, color: "linear-gradient(90deg, #4bc2ff, #77f5a5)" };
  }

  phaseText() {
    if (this.state.phase === "idle") return "准备中";
    if (this.state.phase === "dealing") return "发牌";
    if (this.state.phase === "bidding") return "叫分";
    if (this.state.phase === "playing") return "出牌";
    if (this.state.phase === "roundOver") return "结算";
    return "进行中";
  }

  renderHand(id) {
    const el = this.el.hand[id];
    const player = this.player(id);
    el.innerHTML = "";

    if (this.state.phase === "dealing") {
      const count = this.state.dealCounts[id];
      const containerWidth = el.clientWidth || 620;
      const overlap = this.computeOverlap(count, id === "bottom" ? 72 : 54, containerWidth, -36, -12);

      for (let i = 0; i < count; i++) {
        const node = this.createBackNode({ small: id !== "bottom", animate: true });
        if (id === "bottom" || id === "top") {
          node.style.marginLeft = i === 0 ? "0px" : `${overlap}px`;
        }
        el.appendChild(node);
      }
      return;
    }

    if (player.isHuman) {
      const containerWidth = el.clientWidth || 960;
      const overlap = this.computeOverlap(player.hand.length, 72, containerWidth - 10, -40, -8);
      player.hand.forEach((card, index) => {
        const node = this.createCardNode(card, { human: true, selected: player.selected.has(card.id) });
        node.style.zIndex = String(index + 1);
        node.style.marginLeft = index === 0 ? "0px" : `${overlap}px`;
        node.addEventListener("click", () => {
          if (this.busy || this.state.phase !== "playing" || this.state.currentTurn !== "bottom") return;
          if (player.selected.has(card.id)) player.selected.delete(card.id);
          else player.selected.add(card.id);
          this.renderHand("bottom");
        });
        el.appendChild(node);
      });
      return;
    }

    if (id === "top") {
      const count = player.hand.length;
      const containerWidth = el.clientWidth || 620;
      const overlap = this.computeOverlap(count, 54, containerWidth - 10, -34, -10);
      for (let i = 0; i < count; i++) {
        const node = this.createBackNode({ small: true });
        node.style.marginLeft = i === 0 ? "0px" : `${overlap}px`;
        el.appendChild(node);
      }
      return;
    }

    const stackCount = Math.max(1, Math.ceil(player.hand.length / 3));
    for (let i = 0; i < stackCount; i++) {
      const stack = document.createElement("div");
      stack.className = "ai-stack";
      stack.innerHTML = `
        <div class="card back small"></div>
        <div class="card back small"></div>
        <div class="card back small"></div>
      `;
      el.appendChild(stack);
    }
  }

  renderPlayed(id) {
    const slot = this.el.play[id];
    slot.innerHTML = "";
    const play = this.state.tablePlays[id];
    if (!play) return;

    if (play.pass) {
      const chip = document.createElement("div");
      chip.className = "pass-chip";
      chip.textContent = "不出";
      slot.appendChild(chip);
      return;
    }

    const overlap = this.computeOverlap(play.cards.length, 54, Math.max(slot.clientWidth || 360, 220), -24, -8);
    play.cards.forEach((card, index) => {
      const node = this.createCardNode(card, { small: true, extraClass: "played-card", animate: true });
      node.style.marginLeft = index === 0 ? "0px" : `${overlap}px`;
      slot.appendChild(node);
    });
  }

  renderKitty() {
    this.el.kittyCards.innerHTML = "";
    if (!this.state.kitty.length) return;

    const showCards = this.state.phase === "playing" || this.state.phase === "roundOver";
    if (showCards) {
      this.state.kitty.forEach((card, index) => {
        const node = this.createCardNode(card, { small: true, extraClass: "kitty-card", animate: true });
        node.style.marginLeft = index === 0 ? "0px" : "-12px";
        this.el.kittyCards.appendChild(node);
      });
      return;
    }

    for (let i = 0; i < 3; i++) {
      const node = this.createBackNode({ small: true });
      node.style.marginLeft = i === 0 ? "0px" : "-12px";
      this.el.kittyCards.appendChild(node);
    }
  }

  renderLastPlay() {
    this.el.lastPlayType.textContent = this.state.lastPlay ? this.describePattern(this.state.lastPlay.pattern) : "—";
    this.el.lastPlayCards.innerHTML = "";
    if (!this.state.lastPlay) return;
    const overlap = this.computeOverlap(this.state.lastPlay.cards.length, 54, 220, -20, -8);
    this.state.lastPlay.cards.forEach((card, index) => {
      const node = this.createCardNode(card, { small: true, extraClass: "played-card" });
      node.style.marginLeft = index === 0 ? "0px" : `${overlap}px`;
      this.el.lastPlayCards.appendChild(node);
    });
  }

  renderLog() {
    this.el.logPanel.innerHTML = this.state.log.map((item) => `<div class="log-item">${item}</div>`).join("");
  }

  syncActions() {
    const bidding = this.state.phase === "bidding" && this.state.currentTurn === "bottom";
    const playing = this.state.phase === "playing" && this.state.currentTurn === "bottom";

    this.el.biddingActions.classList.toggle("hidden", !bidding);
    this.el.playActions.classList.toggle("hidden", !playing);

    const canPass = playing && !!this.state.lastPlay && this.state.lastPlay.playerId !== "bottom";
    this.el.passBtn.disabled = !canPass;
    this.el.playBtn.disabled = !playing;
    this.el.hintBtn.disabled = !playing;

    this.el.bidButtons.forEach((btn) => {
      const bid = Number(btn.dataset.bid);
      btn.disabled = !bidding || !(bid === 0 || bid > this.state.highestBid);
    });
  }

  async maybeRunAI() {
    if (this.busy) return;
    while (!this.busy && this.state.currentTurn && this.state.currentTurn !== "bottom" && this.state.phase !== "roundOver") {
      this.busy = true;
      await wait(720);
      if (this.state.phase === "bidding") this.handleAIBid(this.state.currentTurn);
      if (this.state.phase === "playing") this.handleAIPlay(this.state.currentTurn);
      this.busy = false;
    }
  }

  handleHumanBid(bid) {
    this.applyBid("bottom", bid);
  }

  handleAIBid(id) {
    const score = this.evaluateHandStrength(this.player(id).hand);
    let bid = 0;
    if (score >= 9.0) bid = 3;
    else if (score >= 7.6) bid = 2;
    else if (score >= 6.1) bid = 1;
    if (bid <= this.state.highestBid) bid = Math.random() < 0.12 && this.state.highestBid < 3 ? this.state.highestBid + 1 : 0;
    if (this.state.highestBid === 2 && score > 8.7) bid = 3;
    this.applyBid(id, Math.min(3, bid));
  }

  async applyBid(id, bid) {
    const player = this.player(id);
    player.bid = bid;
    if (bid > this.state.highestBid) {
      this.state.highestBid = bid;
      this.state.highestBidder = id;
    }

    this.sound("bid");
    this.log(`<strong>${player.name}</strong> ${bid === 0 ? "选择不叫" : `叫了 ${bid} 分`}`);
    this.setStatus(`${player.name}${bid === 0 ? "不叫" : `叫 ${bid} 分`}`);
    this.render();

    if (bid === 3) {
      this.finishBidding(id);
      return;
    }

    this.state.bidTurnIndex += 1;
    if (this.state.bidTurnIndex >= 3) {
      if (!this.state.highestBidder) {
        this.log("三家都不叫，自动重新发牌");
        this.setStatus("三家都不叫，重新发牌");
        this.render();
        await wait(900);
        this.busy = false;
        this.startNewRound(false);
        return;
      }
      this.finishBidding(this.state.highestBidder);
      return;
    }

    this.state.currentTurn = this.state.biddingOrder[this.state.bidTurnIndex];
    this.setStatus(`轮到 ${this.player(this.state.currentTurn).name} 叫分`);
    this.render();
    this.maybeRunAI();
  }

  finishBidding(landlordId) {
    this.state.landlord = landlordId;
    this.state.players.forEach((p) => p.role = p.id === landlordId ? "landlord" : "farmer");

    const landlord = this.player(landlordId);
    landlord.hand.push(...this.state.kitty);
    this.sortHand(landlord.hand, this.sortMode);

    this.state.baseScore = Math.max(1, this.state.highestBid > 0 ? this.state.highestBid : 1);
    this.state.phase = "playing";
    this.state.currentTurn = landlordId;
    this.state.currentLeader = landlordId;
    this.state.passCount = 0;
    this.state.lastPlay = null;
    this.state.tablePlays = { top: null, left: null, bottom: null };

    this.log(`<strong>${landlord.name}</strong> 成为地主，获得底牌`);
    this.setStatus(`${landlord.name} 成为地主，请出首手牌`);
    this.render();
    this.maybeRunAI();
  }

  handleHint() {
    if (this.state.phase !== "playing" || this.state.currentTurn !== "bottom") return;
    const player = this.player("bottom");
    const suggestion = this.pickAIPlay(player, this.state.lastPlay, true);
    if (!suggestion) {
      this.showToast("当前没有可压过的牌");
      return;
    }
    this.sound("hint");
    player.selected = new Set(suggestion.cards.map((c) => c.id));
    this.renderHand("bottom");
    this.showToast(`提示：${this.describePattern(suggestion.pattern)}`);
  }

  handleHumanPass() {
    if (this.busy || this.state.phase !== "playing" || this.state.currentTurn !== "bottom") return;
    if (!this.state.lastPlay || this.state.lastPlay.playerId === "bottom") {
      this.showToast("你是新一轮首家，不能不出");
      return;
    }
    this.applyPass("bottom");
  }

  handleHumanPlay() {
    if (this.busy || this.state.phase !== "playing" || this.state.currentTurn !== "bottom") return;
    const player = this.player("bottom");
    const cards = player.hand.filter((card) => player.selected.has(card.id));
    if (!cards.length) {
      this.showToast("请先选择要出的牌");
      return;
    }

    const pattern = this.identifyPattern(cards);
    if (!pattern) {
      this.showToast("所选牌型不合法");
      return;
    }

    if (!this.canBeat(pattern, this.state.lastPlay?.pattern, this.state.lastPlay?.playerId === "bottom")) {
      this.showToast("这手牌无法压过当前牌型");
      return;
    }

    this.applyPlay("bottom", cards, pattern);
  }

  handleAIPlay(id) {
    const player = this.player(id);
    const pick = this.pickAIPlay(player, this.state.lastPlay, false);
    if (!pick) {
      this.applyPass(id);
      return;
    }
    this.applyPlay(id, pick.cards, pick.pattern);
  }

  pickAIPlay(player, targetPlay, preferSoft) {
    const candidates = this.generateAllPlays(player.hand);
    let valid = candidates;

    if (targetPlay && targetPlay.playerId !== player.id) {
      valid = candidates.filter((item) => this.canBeat(item.pattern, targetPlay.pattern, false));
    }

    if (!valid.length) return null;

    const landlord = this.state.landlord;
    const teammate = player.role === "farmer" ? PLAYER_IDS.find((id) => id !== player.id && id !== landlord) : null;
    const landlordLeft = this.player(landlord)?.hand.length ?? 99;
    const teammateLeft = teammate ? this.player(teammate).hand.length : 99;

    valid.sort((a, b) => this.playHeuristic(a, player, preferSoft, landlordLeft, teammateLeft) - this.playHeuristic(b, player, preferSoft, landlordLeft, teammateLeft));

    if (
      targetPlay &&
      targetPlay.playerId !== player.id &&
      player.role === "farmer" &&
      this.player(targetPlay.playerId).role === "farmer" &&
      landlordLeft > 2
    ) {
      return null;
    }

    return valid[0];
  }

  playHeuristic(item, player, preferSoft, landlordLeft, teammateLeft) {
    const p = item.pattern;
    let score = p.mainValue * 10;
    if (p.type === "pair") score += 6;
    if (p.type === "triple") score += 8;
    if (p.type === "straight") score += 12;
    if (p.type === "pairStraight") score += 14;
    if (p.type === "airplane" || p.type === "airplaneSingle" || p.type === "airplanePair") score += 18;
    if (p.type === "bomb") score += 80;
    if (p.type === "rocket") score += 120;

    const handAfter = player.hand.length - item.cards.length;
    score += handAfter * 3.2;
    if (preferSoft) score -= item.cards.length * 3.6;
    if (!targetLead(player, this.state.lastPlay)) {
      if (p.type === "bomb") score += landlordLeft > 3 ? 25 : -20;
      if (p.type === "rocket") score += landlordLeft > 2 ? 35 : -25;
    }
    if (player.role === "landlord" && landlordLeft <= 4) score -= p.type === "bomb" ? 15 : 8;
    if (player.role === "farmer" && landlordLeft <= 2) score -= p.type === "bomb" ? 30 : 16;
    if (player.role === "farmer" && teammateLeft <= 2) score += 20;
    return score;
  }

  applyPass(id) {
    const player = this.player(id);
    this.sound("pass");
    this.state.tablePlays[id] = { pass: true };
    this.log(`<strong>${player.name}</strong> 选择不出`);
    this.state.passCount += 1;

    if (this.state.passCount >= 2) {
      this.state.currentTurn = this.state.currentLeader;
      this.state.lastPlay = null;
      this.state.passCount = 0;
      for (const pid of PLAYER_IDS) {
        if (pid !== this.state.currentLeader && this.state.tablePlays[pid]?.pass) this.state.tablePlays[pid] = null;
      }
      this.setStatus(`新一轮开始，由 ${this.player(this.state.currentTurn).name} 先出`);
      this.render();
      this.maybeRunAI();
      return;
    }

    this.advanceTurn();
    this.setStatus(`${player.name} 不出，轮到 ${this.player(this.state.currentTurn).name}`);
    this.render();
    this.maybeRunAI();
  }

  applyPlay(id, cards, pattern) {
    const player = this.player(id);
    const ids = new Set(cards.map((c) => c.id));
    player.hand = player.hand.filter((c) => !ids.has(c.id));
    player.selected.clear();
    player.playedHands += 1;

    if (!this.state.lastPlay) {
      this.state.tablePlays = { top: null, left: null, bottom: null };
    }

    const sortedCards = [...cards].sort((a, b) => a.rank - b.rank);

    if (pattern.type === "bomb" || pattern.type === "rocket") {
      this.state.multiplier *= 2;
      this.sound("bomb");
      this.log(`💥 <strong>${player.name}</strong> 打出${pattern.type === "rocket" ? "王炸" : "炸弹"}，倍率翻倍`);
    } else {
      this.sound("play");
      this.log(`<strong>${player.name}</strong> 出牌：${this.describePattern(pattern)}`);
    }

    this.state.lastPlay = { playerId: id, cards: sortedCards, pattern };
    this.state.tablePlays[id] = { cards: sortedCards, pattern };
    this.state.currentLeader = id;
    this.state.passCount = 0;

    if (!player.hand.length) {
      this.finishRound(id);
      return;
    }

    this.advanceTurn();
    this.setStatus(`${player.name} 出了 ${this.describePattern(pattern)}，轮到 ${this.player(this.state.currentTurn).name}`);
    this.render();
    this.maybeRunAI();
  }

  advanceTurn() {
    const idx = PLAYER_IDS.indexOf(this.state.currentTurn);
    this.state.currentTurn = PLAYER_IDS[(idx + 1) % 3];
  }

  finishRound(winnerId) {
    this.state.phase = "roundOver";
    this.state.winner = winnerId;

    const winner = this.player(winnerId);
    const landlord = this.player(this.state.landlord);
    const farmers = this.state.players.filter((p) => p.role === "farmer");
    const landlordWin = winner.role === "landlord";
    const spring = landlordWin ? farmers.every((p) => p.playedHands === 0) : landlord.playedHands <= 1;
    this.state.spring = spring;

    if (spring) {
      this.state.multiplier *= 2;
      this.log("🌸 触发春天，倍率再次翻倍");
    }

    const base = this.state.baseScore * this.state.multiplier;
    if (landlordWin) {
      this.persistent.scores[landlord.id] += base * 2;
      farmers.forEach((p) => this.persistent.scores[p.id] -= base);
    } else {
      this.persistent.scores[landlord.id] -= base * 2;
      farmers.forEach((p) => this.persistent.scores[p.id] += base);
    }

    const youWin = winnerId === "bottom" || (winner.role === "farmer" && this.player("bottom").role === "farmer");
    if (youWin) {
      this.persistent.winCount += 1;
      this.persistent.streakCount += 1;
    } else {
      this.persistent.streakCount = 0;
    }

    this.savePersistent();
    this.sound("win");
    this.setStatus(`${winner.name} 获胜`);
    this.log(`🏆 <strong>${winner.name}</strong> 获得本局胜利，结算分 <strong>${base}</strong>`);
    this.render();
    this.showWinOverlay({
      title: youWin ? "胜利！" : "再来一局",
      result: landlordWin ? "地主胜" : "农民胜",
      base,
      spring,
      winnerName: winner.name,
    });
  }

  showWinOverlay(info) {
    this.clearWinOverlay();
    const wrap = document.createElement("div");
    wrap.className = "win-overlay";
    wrap.innerHTML = `
      <div class="win-card glass">
        <h2>${info.title}</h2>
        <p><span class="emphasis">${info.winnerName}</span> 率先出完手牌，${info.result}</p>
        <p>本局得分：<span class="emphasis">${info.base}</span> ｜ 倍率：<span class="emphasis">${this.state.multiplier}</span> ｜ 春天：<span class="emphasis">${info.spring ? "是" : "否"}</span></p>
        <div class="win-actions">
          <button id="playAgainBtn" class="btn btn-primary">再来一局</button>
        </div>
      </div>
    `;
    document.querySelector(".table").appendChild(wrap);
    wrap.querySelector("#playAgainBtn").addEventListener("click", () => this.startNewRound(true));
  }

  clearWinOverlay() {
    document.querySelector(".win-overlay")?.remove();
  }

  identifyPattern(cards) {
    if (!cards.length) return null;
    const sorted = [...cards].sort((a, b) => a.rank - b.rank);
    const counts = this.countMap(sorted);
    const values = [...counts.keys()].sort((a, b) => a - b);
    const countValues = [...counts.values()].sort((a, b) => a - b);
    const len = sorted.length;

    if (len === 2 && counts.has(16) && counts.has(17)) return { type: "rocket", mainValue: 17, length: 2 };
    if (len === 1) return { type: "single", mainValue: sorted[0].rank, length: 1 };
    if (len === 2 && countValues[0] === 2) return { type: "pair", mainValue: values[0], length: 2 };
    if (len === 3 && countValues[0] === 3) return { type: "triple", mainValue: values.find((v) => counts.get(v) === 3), length: 3 };

    if (len === 4) {
      if (countValues.includes(4)) return { type: "bomb", mainValue: values.find((v) => counts.get(v) === 4), length: 4 };
      if (countValues.includes(3)) return { type: "tripleSingle", mainValue: values.find((v) => counts.get(v) === 3), length: 4 };
    }

    if (len === 5) {
      if (countValues.join(",") === "2,3") return { type: "triplePair", mainValue: values.find((v) => counts.get(v) === 3), length: 5 };
      if (this.isStraight(values, counts, 1, 5)) return { type: "straight", mainValue: Math.max(...values), length: 5, seqLength: 5 };
    }

    if (len >= 5 && this.isStraight(values, counts, 1, len)) {
      return { type: "straight", mainValue: Math.max(...values), length: len, seqLength: len };
    }

    if (len >= 6 && len % 2 === 0 && this.isStraight(values, counts, 2, len / 2)) {
      return { type: "pairStraight", mainValue: Math.max(...values), length: len, seqLength: len / 2 };
    }

    const triples = values.filter((v) => counts.get(v) === 3 && v < 15).sort((a, b) => a - b);
    if (triples.length >= 2) {
      const chains = this.findConsecutiveRuns(triples);
      for (const run of chains) {
        const n = run.length;
        if (n < 2) continue;
        if (len === n * 3) return { type: "airplane", mainValue: run[run.length - 1], length: len, seqLength: n };
        if (len === n * 4) {
          const rest = values.filter((v) => !run.includes(v)).reduce((acc, v) => acc + counts.get(v), 0);
          if (rest === n) return { type: "airplaneSingle", mainValue: run[run.length - 1], length: len, seqLength: n };
        }
        if (len === n * 5) {
          const leftovers = values.filter((v) => !run.includes(v));
          const ok = leftovers.length === n && leftovers.every((v) => counts.get(v) === 2);
          if (ok) return { type: "airplanePair", mainValue: run[run.length - 1], length: len, seqLength: n };
        }
      }
    }

    if (len === 6 && countValues.includes(4)) {
      return { type: "fourTwoSingles", mainValue: values.find((v) => counts.get(v) === 4), length: 6 };
    }

    if (len === 8 && countValues.filter((v) => v === 2).length === 2 && countValues.includes(4)) {
      return { type: "fourTwoPairs", mainValue: values.find((v) => counts.get(v) === 4), length: 8 };
    }

    return null;
  }

  isStraight(values, counts, repeat, needLen) {
    if (values.length !== needLen) return false;
    if (values.some((v) => v >= 15)) return false;
    if (values.some((v) => counts.get(v) !== repeat)) return false;
    for (let i = 1; i < values.length; i++) {
      if (values[i] !== values[i - 1] + 1) return false;
    }
    return true;
  }

  findConsecutiveRuns(values) {
    const runs = [];
    let current = [];
    for (const val of values) {
      if (!current.length || val === current[current.length - 1] + 1) current.push(val);
      else {
        if (current.length) runs.push([...current]);
        current = [val];
      }
    }
    if (current.length) runs.push(current);
    return runs;
  }

  canBeat(myPattern, targetPattern, samePlayerLead = false) {
    if (!targetPattern || samePlayerLead) return true;
    if (targetPattern.type === "rocket") return false;
    if (myPattern.type === "rocket") return true;
    if (myPattern.type === "bomb" && targetPattern.type !== "bomb") return true;
    if (myPattern.type !== targetPattern.type) return false;
    if ((myPattern.seqLength || 0) !== (targetPattern.seqLength || 0)) return false;
    if (myPattern.length !== targetPattern.length) return false;
    return myPattern.mainValue > targetPattern.mainValue;
  }

  describePattern(pattern) {
    const map = {
      single: "单张",
      pair: "对子",
      triple: "三张",
      tripleSingle: "三带一",
      triplePair: "三带二",
      straight: `顺子 · ${pattern.seqLength}连`,
      pairStraight: `连对 · ${pattern.seqLength}连`,
      airplane: `飞机 · ${pattern.seqLength}连`,
      airplaneSingle: `飞机带单 · ${pattern.seqLength}连`,
      airplanePair: `飞机带对 · ${pattern.seqLength}连`,
      fourTwoSingles: "四带二",
      fourTwoPairs: "四带两对",
      bomb: "炸弹",
      rocket: "王炸",
    };
    return map[pattern.type] || "牌型";
  }

  generateAllPlays(hand) {
    const cardsByRank = new Map();
    hand.forEach((card) => {
      if (!cardsByRank.has(card.rank)) cardsByRank.set(card.rank, []);
      cardsByRank.get(card.rank).push(card);
    });

    const ranks = [...cardsByRank.keys()].sort((a, b) => a - b);
    const plays = [];
    const seen = new Set();

    const addPlay = (cards) => {
      const key = cards.map((c) => c.id).sort().join("|");
      if (seen.has(key)) return;
      const pattern = this.identifyPattern(cards);
      if (!pattern) return;
      seen.add(key);
      plays.push({ cards: [...cards].sort((a, b) => a.rank - b.rank), pattern });
    };

    ranks.forEach((rank) => {
      addPlay([cardsByRank.get(rank)[0]]);
      if (cardsByRank.get(rank).length >= 2) addPlay(cardsByRank.get(rank).slice(0, 2));
      if (cardsByRank.get(rank).length >= 3) addPlay(cardsByRank.get(rank).slice(0, 3));
      if (cardsByRank.get(rank).length === 4) addPlay(cardsByRank.get(rank).slice(0, 4));
    });

    const tripleRanks = ranks.filter((r) => cardsByRank.get(r).length >= 3);
    const singleCards = ranks.flatMap((r) => cardsByRank.get(r).map((c) => ({ rank: r, card: c })));

    for (const tr of tripleRanks) {
      const triple = cardsByRank.get(tr).slice(0, 3);
      for (const item of singleCards) {
        if (item.rank === tr) continue;
        addPlay([...triple, item.card]);
      }
      for (const pr of ranks.filter((r) => r !== tr && cardsByRank.get(r).length >= 2)) {
        addPlay([...triple, ...cardsByRank.get(pr).slice(0, 2)]);
      }
    }

    const bombRanks = ranks.filter((r) => cardsByRank.get(r).length === 4);
    for (const br of bombRanks) {
      const bomb = cardsByRank.get(br).slice(0, 4);
      const others = hand.filter((c) => c.rank !== br);
      for (let i = 0; i < others.length; i++) {
        for (let j = i + 1; j < others.length; j++) {
          addPlay([...bomb, others[i], others[j]]);
        }
      }
      const pairRanks = ranks.filter((r) => r !== br && cardsByRank.get(r).length >= 2);
      for (let i = 0; i < pairRanks.length; i++) {
        for (let j = i + 1; j < pairRanks.length; j++) {
          addPlay([...bomb, ...cardsByRank.get(pairRanks[i]).slice(0, 2), ...cardsByRank.get(pairRanks[j]).slice(0, 2)]);
        }
      }
    }

    this.findSequences(hand, 1, 5).forEach((seq) => addPlay(seq));
    this.findSequences(hand, 2, 3).forEach((seq) => addPlay(seq));

    const tripleSeqs = this.findTripleSequences(hand);
    tripleSeqs.forEach((plane) => {
      addPlay(plane.tripCards);
      const planeIds = new Set(plane.tripCards.map((c) => c.id));
      const remaining = hand.filter((c) => !planeIds.has(c.id));

      if (remaining.length >= plane.length) {
        this.combine(remaining, plane.length).slice(0, 60).forEach((combo) => addPlay([...plane.tripCards, ...combo]));
      }

      const remByRank = new Map();
      remaining.forEach((c) => {
        if (!remByRank.has(c.rank)) remByRank.set(c.rank, []);
        remByRank.get(c.rank).push(c);
      });

      const pairPool = [...remByRank.values()].filter((arr) => arr.length >= 2).map((arr) => arr.slice(0, 2));
      this.combine(pairPool, plane.length).slice(0, 40).forEach((combo) => addPlay([...plane.tripCards, ...combo.flat()]));
    });

    plays.sort((a, b) => {
      if (a.pattern.type !== b.pattern.type) return a.pattern.length - b.pattern.length;
      return a.pattern.mainValue - b.pattern.mainValue;
    });

    return plays;
  }

  findSequences(hand, repeat, minLen) {
    const byRank = new Map();
    hand.forEach((card) => {
      if (!byRank.has(card.rank)) byRank.set(card.rank, []);
      byRank.get(card.rank).push(card);
    });

    const ranks = [...byRank.keys()].filter((r) => r < 15 && byRank.get(r).length >= repeat).sort((a, b) => a - b);
    const results = [];
    let run = [];

    const flush = () => {
      if (run.length >= minLen) {
        for (let len = minLen; len <= run.length; len++) {
          for (let start = 0; start + len <= run.length; start++) {
            const slice = run.slice(start, start + len);
            results.push(slice.flatMap((rank) => byRank.get(rank).slice(0, repeat)));
          }
        }
      }
      run = [];
    };

    for (const rank of ranks) {
      if (!run.length || rank === run[run.length - 1] + 1) run.push(rank);
      else {
        flush();
        run.push(rank);
      }
    }

    flush();
    return results;
  }

  findTripleSequences(hand) {
    const byRank = new Map();
    hand.forEach((card) => {
      if (!byRank.has(card.rank)) byRank.set(card.rank, []);
      byRank.get(card.rank).push(card);
    });

    const tripleRanks = [...byRank.keys()].filter((r) => r < 15 && byRank.get(r).length >= 3).sort((a, b) => a - b);
    const runs = this.findConsecutiveRuns(tripleRanks);
    const result = [];

    for (const run of runs) {
      if (run.length < 2) continue;
      for (let len = 2; len <= run.length; len++) {
        for (let start = 0; start + len <= run.length; start++) {
          const slice = run.slice(start, start + len);
          result.push({
            length: slice.length,
            tripCards: slice.flatMap((rank) => byRank.get(rank).slice(0, 3)),
          });
        }
      }
    }

    return result;
  }

  combine(arr, k) {
    const result = [];
    const path = [];

    const dfs = (start) => {
      if (path.length === k) {
        result.push([...path]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        path.push(arr[i]);
        dfs(i + 1);
        path.pop();
        if (result.length > 120) return;
      }
    };

    dfs(0);
    return result;
  }
}

function targetLead(player, targetPlay) {
  return !targetPlay || targetPlay.playerId === player.id;
}

new DouDizhuGame();
