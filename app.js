const STORAGE_KEY = "cricket-crew-toss-state-v2";
const LOCAL_MATCHES_KEY = "cricket-crew-toss-matches-v2";
const FIREBASE_VERSION = "10.12.5";

const state = {
  players: [],
  result: null,
  toss: null,
  final: null,
  currentMatchId: null,
  installPrompt: null,
  matches: [],
  storeMode: "local",
  storeReady: false,
};

const els = {
  playerCountForm: document.querySelector("#playerCountForm"),
  playerCount: document.querySelector("#playerCount"),
  playersList: document.querySelector("#playersList"),
  fillNumbersButton: document.querySelector("#fillNumbersButton"),
  clearPlayersButton: document.querySelector("#clearPlayersButton"),
  generateButton: document.querySelector("#generateButton"),
  tossButton: document.querySelector("#tossButton"),
  tossResult: document.querySelector("#tossResult"),
  teamAList: document.querySelector("#teamAList"),
  teamBList: document.querySelector("#teamBList"),
  teamACount: document.querySelector("#teamACount"),
  teamBCount: document.querySelector("#teamBCount"),
  bothPlayerBox: document.querySelector("#bothPlayerBox"),
  scoreForm: document.querySelector("#scoreForm"),
  teamARuns: document.querySelector("#teamARuns"),
  teamBRuns: document.querySelector("#teamBRuns"),
  winnerSelect: document.querySelector("#winnerSelect"),
  submitScoreButton: document.querySelector("#submitScoreButton"),
  finalResultBox: document.querySelector("#finalResultBox"),
  shareStatsButton: document.querySelector("#shareStatsButton"),
  shareAppButton: document.querySelector("#shareAppButton"),
  copyStatsButton: document.querySelector("#copyStatsButton"),
  downloadStatsButton: document.querySelector("#downloadStatsButton"),
  sharePreview: document.querySelector("#sharePreview"),
  matchHistory: document.querySelector("#matchHistory"),
  syncDot: document.querySelector("#syncDot"),
  syncLabel: document.querySelector("#syncLabel"),
  syncDetail: document.querySelector("#syncDetail"),
  syncPanel: document.querySelector(".sync-panel"),
  summaryPlayers: document.querySelector("#summaryPlayers"),
  summaryTeams: document.querySelector("#summaryTeams"),
  summaryToss: document.querySelector("#summaryToss"),
  installButton: document.querySelector("#installButton"),
  toast: document.querySelector("#toast"),
};

const localStore = {
  async create(record) {
    const match = { ...record, id: record.id || `local-${Date.now()}-${secureIndex(100000)}` };
    const matches = readLocalMatches();
    matches.unshift(match);
    writeLocalMatches(matches);
    state.matches = matches;
    renderHistory();
    return match.id;
  },
  async update(matchId, patch) {
    const matches = readLocalMatches();
    const index = matches.findIndex((match) => match.id === matchId);
    if (index === -1) return;
    matches[index] = { ...matches[index], ...patch };
    writeLocalMatches(matches);
    state.matches = matches;
    renderHistory();
  },
  subscribe(onChange) {
    onChange(readLocalMatches());
    return () => {};
  },
};

let cloudStore = null;
let unsubscribeMatches = null;

function secureIndex(max) {
  if (max <= 0) return 0;
  const cryptoApi = window.crypto || window.msCrypto;
  if (!cryptoApi?.getRandomValues) return Math.floor(Math.random() * max);

  const limit = Math.floor(0xffffffff / max) * max;
  const buffer = new Uint32Array(1);
  do {
    cryptoApi.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizePlayer(player, fallbackNumber) {
  const number = Number(player.number || fallbackNumber);
  const rawName = String(player.name || "").trim();
  return {
    number,
    name: rawName || `Player ${number}`,
  };
}

function makePlayers(count) {
  const safeCount = Math.max(2, Math.min(40, Number(count) || 2));
  state.players = Array.from({ length: safeCount }, (_, index) => {
    const previous = state.players[index];
    return normalizePlayer(previous || {}, index + 1);
  });
  state.result = null;
  state.toss = null;
  state.final = null;
  state.currentMatchId = null;
  saveState();
  render();
}

function collectPlayers() {
  const inputs = [...els.playersList.querySelectorAll("input[data-player-index]")];
  state.players = inputs.map((input, index) =>
    normalizePlayer({ number: index + 1, name: input.value }, index + 1),
  );
  saveState();
}

async function buildTeams() {
  collectPlayers();
  if (state.players.length < 2) {
    notify("Add at least 2 players.");
    return;
  }

  const draw = shuffle(state.players);
  const captains = draw.slice(0, 2);
  const rest = shuffle(draw.slice(2));
  const oddExtra = rest.length % 2 === 1 ? rest.pop() : null;
  const teamA = [captains[0]];
  const teamB = [captains[1]];

  rest.forEach((player, index) => {
    if (index % 2 === 0) teamA.push(player);
    else teamB.push(player);
  });

  state.result = {
    createdAt: new Date().toISOString(),
    teamA,
    teamB,
    bothPlayer: oddExtra,
    captains,
  };
  state.toss = null;
  state.final = null;
  state.currentMatchId = null;
  render();

  const match = makeMatchRecord("teams-created");
  state.currentMatchId = await activeStore().create(match);
  saveState();
  render();
  notify(state.storeMode === "cloud" ? "Teams saved online." : "Teams saved locally.");
}

async function runToss() {
  if (!state.result) {
    notify("Make teams first.");
    return;
  }
  if (state.final) {
    notify("This match is locked.");
    return;
  }

  const winner = secureIndex(2) === 0 ? "Team A" : "Team B";
  const choice = secureIndex(2) === 0 ? "Bat" : "Ball";
  state.toss = {
    winner,
    choice,
    loser: winner === "Team A" ? "Team B" : "Team A",
    createdAt: new Date().toISOString(),
  };

  if (!state.currentMatchId) {
    state.currentMatchId = await activeStore().create(makeMatchRecord("teams-created"));
  }
  await activeStore().update(state.currentMatchId, makeMatchPatch("tossed"));
  saveState();
  render();
  notify(`${winner} won the toss and chose to ${choice.toLowerCase()}.`);
}

async function submitFinalScore(event) {
  event.preventDefault();
  if (!state.result) {
    notify("Make teams before submitting a score.");
    return;
  }
  if (state.final) {
    notify("Final result is already locked.");
    return;
  }

  const teamARuns = Number(els.teamARuns.value);
  const teamBRuns = Number(els.teamBRuns.value);
  const winner = els.winnerSelect.value;

  if (!Number.isInteger(teamARuns) || !Number.isInteger(teamBRuns) || teamARuns < 0 || teamBRuns < 0) {
    notify("Enter valid runs for both teams.");
    return;
  }
  if (!winner) {
    notify("Select the winning team.");
    return;
  }

  state.final = {
    teamARuns,
    teamBRuns,
    winner,
    submittedAt: new Date().toISOString(),
    locked: true,
  };

  if (!state.currentMatchId) {
    state.currentMatchId = await activeStore().create(makeMatchRecord("teams-created"));
  }
  await activeStore().update(state.currentMatchId, makeMatchPatch("score-submitted"));
  saveState();
  render();
  notify("Final score saved and locked.");
}

function makeMatchRecord(eventType) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    createdAt: state.result?.createdAt || now,
    updatedAt: now,
    status: state.final ? "final" : "active",
    players: state.players,
    result: state.result,
    toss: state.toss,
    final: state.final,
    events: [{ type: eventType, at: now }],
  };
}

function makeMatchPatch(eventType) {
  const current = state.matches.find((match) => match.id === state.currentMatchId);
  const events = Array.isArray(current?.events) ? [...current.events] : [];
  events.push({ type: eventType, at: new Date().toISOString() });
  return {
    updatedAt: new Date().toISOString(),
    status: state.final ? "final" : "active",
    toss: state.toss,
    final: state.final,
    events,
  };
}

function activeStore() {
  return cloudStore || localStore;
}

async function setupStore() {
  state.matches = readLocalMatches();
  const config = window.CRICKET_FIREBASE_CONFIG || {};
  const isConfigured = Boolean(config.apiKey && config.projectId && config.appId);

  if (!isConfigured) {
    state.storeMode = "local";
    state.storeReady = true;
    setSyncStatus("local", "Local mode", "Add Firebase config to share saved matches with everyone.");
    unsubscribeMatches = localStore.subscribe(updateMatches);
    return;
  }

  try {
    const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
    const firestoreModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
    const app = appModule.initializeApp(config);
    const db = firestoreModule.getFirestore(app);
    const matchesCollection = firestoreModule.collection(db, "matches");

    cloudStore = {
      async create(record) {
        const ref = firestoreModule.doc(matchesCollection);
        await firestoreModule.setDoc(ref, { ...record, id: ref.id });
        return ref.id;
      },
      async update(matchId, patch) {
        await firestoreModule.updateDoc(firestoreModule.doc(db, "matches", matchId), patch);
      },
      subscribe(onChange) {
        const q = firestoreModule.query(
          matchesCollection,
          firestoreModule.orderBy("createdAt", "desc"),
          firestoreModule.limit(40),
        );
        return firestoreModule.onSnapshot(q, (snapshot) => {
          onChange(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        });
      },
    };

    state.storeMode = "cloud";
    state.storeReady = true;
    setSyncStatus("online", "Online mode", "Shared match history is live for everyone.");
    unsubscribeMatches = cloudStore.subscribe(updateMatches);
  } catch (error) {
    console.error(error);
    state.storeMode = "local";
    state.storeReady = true;
    setSyncStatus("error", "Local fallback", "Firebase did not connect. Matches are saved on this device only.");
    unsubscribeMatches = localStore.subscribe(updateMatches);
  }
}

function updateMatches(matches) {
  state.matches = [...matches].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  renderHistory();
}

function setSyncStatus(mode, label, detail) {
  els.syncPanel.classList.toggle("online", mode === "online");
  els.syncPanel.classList.toggle("error", mode === "error");
  els.syncLabel.textContent = label;
  els.syncDetail.textContent = detail;
}

function playerLine(player, captain = false) {
  return `${player.number}. ${player.name}${captain ? " (Captain)" : ""}`;
}

function teamText(label, players) {
  return `${label}\n${players
    .map((player, index) => playerLine(player, index === 0))
    .join("\n")}`;
}

function shareText() {
  if (!state.result) return "Cricket Crew Toss: make fair random cricket teams, captains, toss, and scores online.";

  const both = state.result.bothPlayer
    ? `\n\nBoth / Extra Player\n${playerLine(state.result.bothPlayer)}`
    : "";
  const toss = state.toss
    ? `\n\nToss\n${state.toss.winner} won and chose to ${state.toss.choice}.`
    : "\n\nToss\nNot done yet.";
  const final = state.final
    ? `\n\nFinal Score\nTeam A: ${state.final.teamARuns}\nTeam B: ${state.final.teamBRuns}\nWinner: ${state.final.winner}`
    : "";
  const stamp = new Date(state.result.createdAt).toLocaleString();

  return `Cricket Crew Toss\n${stamp}\n\n${teamText("Team A", state.result.teamA)}\n\n${teamText(
    "Team B",
    state.result.teamB,
  )}${both}${toss}${final}`;
}

async function shareToWhatsApp(text, title = "Cricket Crew Toss") {
  const shareData = { title, text };
  if (navigator.share && navigator.canShare?.(shareData)) {
    await navigator.share(shareData);
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

async function copyStats() {
  const text = shareText();
  try {
    await navigator.clipboard.writeText(text);
    notify("Stats copied.");
  } catch {
    els.sharePreview.select();
    document.execCommand("copy");
    notify("Stats copied.");
  }
}

function downloadStats() {
  const data = {
    app: "Cricket Crew Toss",
    exportedAt: new Date().toISOString(),
    players: state.players,
    result: state.result,
    toss: state.toss,
    final: state.final,
    currentMatchId: state.currentMatchId,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cricket-match-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function readLocalMatches() {
  try {
    const matches = JSON.parse(localStorage.getItem(LOCAL_MATCHES_KEY) || "[]");
    return Array.isArray(matches) ? matches : [];
  } catch {
    return [];
  }
}

function writeLocalMatches(matches) {
  localStorage.setItem(LOCAL_MATCHES_KEY, JSON.stringify(matches.slice(0, 40)));
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      players: state.players,
      result: state.result,
      toss: state.toss,
      final: state.final,
      currentMatchId: state.currentMatchId,
    }),
  );
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.players = Array.isArray(saved.players) && saved.players.length ? saved.players : [];
    state.result = saved.result || null;
    state.toss = saved.toss || null;
    state.final = saved.final || null;
    state.currentMatchId = saved.currentMatchId || null;
  } catch {
    state.players = [];
  }

  if (!state.players.length) {
    state.players = Array.from({ length: 12 }, (_, index) => normalizePlayer({}, index + 1));
  }
  els.playerCount.value = state.players.length;
}

function renderPlayers() {
  els.playersList.innerHTML = "";
  state.players.forEach((player, index) => {
    const row = document.createElement("label");
    row.className = "player-input";
    row.innerHTML = `
      <span>${player.number}</span>
      <input data-player-index="${index}" type="text" value="${escapeHtml(player.name)}" aria-label="Player ${player.number} name" />
    `;
    els.playersList.appendChild(row);
  });
}

function renderTeam(container, players) {
  container.innerHTML = "";
  container.classList.toggle("empty", !players.length);
  if (!players.length) {
    container.textContent = "No players yet";
    return;
  }

  players.forEach((player, index) => {
    const chip = document.createElement("div");
    chip.className = "player-chip";
    chip.innerHTML = `
      <span class="number">${player.number}</span>
      <span class="name">${escapeHtml(player.name)}</span>
      ${index === 0 ? '<span class="captain-tag">Captain</span>' : ""}
    `;
    container.appendChild(chip);
  });
}

function renderResults() {
  const teamA = state.result?.teamA || [];
  const teamB = state.result?.teamB || [];
  renderTeam(els.teamAList, teamA);
  renderTeam(els.teamBList, teamB);
  els.teamACount.textContent = teamA.length;
  els.teamBCount.textContent = teamB.length;

  if (state.result?.bothPlayer) {
    els.bothPlayerBox.hidden = false;
    els.bothPlayerBox.textContent = `Both / extra player: ${state.result.bothPlayer.number}. ${state.result.bothPlayer.name}`;
  } else {
    els.bothPlayerBox.hidden = true;
    els.bothPlayerBox.textContent = "";
  }

  if (state.toss) {
    els.tossResult.innerHTML = `<strong>Toss</strong><span>${state.toss.winner} chose to ${state.toss.choice}.</span>`;
  } else if (state.result) {
    els.tossResult.innerHTML = "<strong>Toss</strong><span>Teams ready. Toss now.</span>";
  } else {
    els.tossResult.innerHTML = "<strong>Toss</strong><span>Ready when teams are made.</span>";
  }
}

function renderScore() {
  const isLocked = Boolean(state.final);
  els.scoreForm.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = isLocked;
  });

  if (state.final) {
    els.teamARuns.value = state.final.teamARuns;
    els.teamBRuns.value = state.final.teamBRuns;
    els.winnerSelect.value = state.final.winner;
    els.finalResultBox.hidden = false;
    els.finalResultBox.textContent = `Locked result: Team A ${state.final.teamARuns}, Team B ${state.final.teamBRuns}. Winner: ${state.final.winner}.`;
  } else {
    els.finalResultBox.hidden = true;
    els.finalResultBox.textContent = "";
  }
}

function renderHistory() {
  els.matchHistory.innerHTML = "";
  if (!state.matches.length) {
    els.matchHistory.innerHTML = '<div class="history-empty">No matches saved yet.</div>';
    return;
  }

  state.matches.forEach((match, index) => {
    const card = document.createElement("article");
    card.className = "history-card";
    const created = match.createdAt ? new Date(match.createdAt) : new Date();
    const teamA = match.result?.teamA || [];
    const teamB = match.result?.teamB || [];
    const both = match.result?.bothPlayer ? `Both: ${match.result.bothPlayer.name}` : "No extra player";
    const toss = match.toss ? `${match.toss.winner} chose ${match.toss.choice}` : "Toss pending";
    const final = match.final
      ? `<div class="history-score"><strong>${escapeHtml(match.final.winner)} won</strong><span>Team A ${match.final.teamARuns} - Team B ${match.final.teamBRuns}</span></div>`
      : '<div class="history-score"><strong>Result pending</strong><span>Score not submitted</span></div>';

    card.innerHTML = `
      <div class="history-head">
        <strong>Match ${state.matches.length - index}</strong>
        <time>${created.toLocaleString()}</time>
      </div>
      <div class="history-meta">
        <span>${teamA.length} vs ${teamB.length}</span>
        <span>${escapeHtml(toss)}</span>
        <span>${escapeHtml(both)}</span>
        <span>${match.status === "final" ? "Locked" : "Active"}</span>
      </div>
      ${final}
      <div class="history-teams">
        <div>
          <h3>Team A</h3>
          <p>${escapeHtml(teamA.map((player, playerIndex) => playerLine(player, playerIndex === 0)).join(", "))}</p>
        </div>
        <div>
          <h3>Team B</h3>
          <p>${escapeHtml(teamB.map((player, playerIndex) => playerLine(player, playerIndex === 0)).join(", "))}</p>
        </div>
      </div>
    `;
    els.matchHistory.appendChild(card);
  });
}

function renderSummary() {
  els.summaryPlayers.textContent = `${state.players.length} player${state.players.length === 1 ? "" : "s"}`;
  els.summaryTeams = els.summaryTeams || document.querySelector("#summaryTeams");
  els.summaryTeams.textContent = state.result
    ? `${state.result.teamA.length} vs ${state.result.teamB.length}`
    : "Teams waiting";
  els.summaryToss.textContent = state.toss ? `${state.toss.winner}: ${state.toss.choice}` : "Toss waiting";
}

function render() {
  renderPlayers();
  renderResults();
  renderScore();
  renderSummary();
  renderHistory();
  els.sharePreview.value = shareText();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function notify(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function bindEvents() {
  els.playerCountForm.addEventListener("submit", (event) => {
    event.preventDefault();
    makePlayers(els.playerCount.value);
  });

  els.playersList.addEventListener("input", () => {
    collectPlayers();
    renderSummary();
  });

  els.fillNumbersButton.addEventListener("click", () => {
    state.players = state.players.map((player) => ({ ...player, name: `Player ${player.number}` }));
    state.result = null;
    state.toss = null;
    state.final = null;
    state.currentMatchId = null;
    saveState();
    render();
  });

  els.clearPlayersButton.addEventListener("click", () => {
    state.players = state.players.map((player) => ({ ...player, name: "" }));
    state.result = null;
    state.toss = null;
    state.final = null;
    state.currentMatchId = null;
    saveState();
    render();
  });

  els.generateButton.addEventListener("click", () => buildTeams());
  els.tossButton.addEventListener("click", () => runToss());
  els.scoreForm.addEventListener("submit", submitFinalScore);
  els.copyStatsButton.addEventListener("click", copyStats);
  els.downloadStatsButton.addEventListener("click", downloadStats);
  els.shareStatsButton.addEventListener("click", () => shareToWhatsApp(shareText(), "Cricket match"));
  els.shareAppButton.addEventListener("click", () => {
    shareToWhatsApp(
      `Use Cricket Crew Toss for random teams, toss, and match history: ${window.location.href}`,
      "Cricket Crew Toss app",
    );
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    els.installButton.hidden = false;
  });

  els.installButton.addEventListener("click", async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    els.installButton.hidden = true;
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("sw.js");
  } catch {
    notify("Offline install needs a hosted or local server.");
  }
}

window.addEventListener("beforeunload", () => {
  if (typeof unsubscribeMatches === "function") unsubscribeMatches();
});

loadState();
bindEvents();
render();
setupStore();
registerServiceWorker();
