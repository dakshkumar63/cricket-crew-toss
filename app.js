const STORAGE_KEY = "cricket-crew-toss-state-v1";

const state = {
  players: [],
  result: null,
  toss: null,
  installPrompt: null,
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
  shareStatsButton: document.querySelector("#shareStatsButton"),
  shareAppButton: document.querySelector("#shareAppButton"),
  copyStatsButton: document.querySelector("#copyStatsButton"),
  downloadStatsButton: document.querySelector("#downloadStatsButton"),
  sharePreview: document.querySelector("#sharePreview"),
  summaryPlayers: document.querySelector("#summaryPlayers"),
  summaryTeams: document.querySelector("#summaryTeams"),
  summaryToss: document.querySelector("#summaryToss"),
  installButton: document.querySelector("#installButton"),
  toast: document.querySelector("#toast"),
};

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

function buildTeams() {
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
    if (index % 2 === 0) {
      teamA.push(player);
    } else {
      teamB.push(player);
    }
  });

  state.result = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    teamA,
    teamB,
    bothPlayer: oddExtra,
    captains,
  };
  state.toss = null;
  saveState();
  render();
  notify("Captains and teams are ready.");
}

function runToss() {
  if (!state.result) {
    notify("Make teams first.");
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
  saveState();
  render();
  notify(`${winner} won the toss and chose to ${choice.toLowerCase()}.`);
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
  if (!state.result) return "Cricket Crew Toss: make fair random cricket teams, captains, and toss offline.";

  const both = state.result.bothPlayer
    ? `\n\nBoth / Extra Player\n${playerLine(state.result.bothPlayer)}`
    : "";
  const toss = state.toss
    ? `\n\nToss\n${state.toss.winner} won and chose to ${state.toss.choice}.`
    : "\n\nToss\nNot done yet.";
  const stamp = new Date(state.result.createdAt).toLocaleString();

  return `Cricket Crew Toss\n${stamp}\n\n${teamText("Team A", state.result.teamA)}\n\n${teamText(
    "Team B",
    state.result.teamB,
  )}${both}${toss}`;
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
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cricket-teams-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      players: state.players,
      result: state.result,
      toss: state.toss,
    }),
  );
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.players = Array.isArray(saved.players) && saved.players.length ? saved.players : [];
    state.result = saved.result || null;
    state.toss = saved.toss || null;
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

function renderSummary() {
  els.summaryPlayers.textContent = `${state.players.length} player${state.players.length === 1 ? "" : "s"}`;
  els.summaryTeams.textContent = state.result
    ? `${state.result.teamA.length} vs ${state.result.teamB.length}`
    : "Teams waiting";
  els.summaryToss.textContent = state.toss ? `${state.toss.winner}: ${state.toss.choice}` : "Toss waiting";
}

function render() {
  renderPlayers();
  renderResults();
  renderSummary();
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
    saveState();
    render();
  });

  els.clearPlayersButton.addEventListener("click", () => {
    state.players = state.players.map((player) => ({ ...player, name: "" }));
    state.result = null;
    state.toss = null;
    saveState();
    render();
  });

  els.generateButton.addEventListener("click", buildTeams);
  els.tossButton.addEventListener("click", runToss);
  els.copyStatsButton.addEventListener("click", copyStats);
  els.downloadStatsButton.addEventListener("click", downloadStats);
  els.shareStatsButton.addEventListener("click", () => shareToWhatsApp(shareText(), "Cricket teams"));
  els.shareAppButton.addEventListener("click", () => {
    shareToWhatsApp(
      `Use Cricket Crew Toss for random teams and toss: ${window.location.href}`,
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

loadState();
bindEvents();
render();
registerServiceWorker();
