const combatSpells = window.DOFUS_SPELLS || [];

const combatState = {
  turn: 1,
  players: [
    { className: "Pandawa", cooldowns: new Map(), casts: [] },
    { className: "Iop", cooldowns: new Map(), casts: [] },
  ],
};

const combatEls = {
  turnInput: document.querySelector("#combatTurnInput"),
  prevTurn: document.querySelector("#combatPrevTurn"),
  nextTurn: document.querySelector("#combatNextTurn"),
  reset: document.querySelector("#combatReset"),
  clearLog: document.querySelector("#clearCombatLog"),
  journal: document.querySelector("#combatJournal"),
  playerNames: [document.querySelector("#playerName0"), document.querySelector("#playerName1")],
  searches: [document.querySelector("#playerSearch0"), document.querySelector("#playerSearch1")],
  classSelects: [document.querySelector("#playerClass0"), document.querySelector("#playerClass1")],
  spellLists: [document.querySelector("#playerSpellList0"), document.querySelector("#playerSpellList1")],
  spellCounts: [document.querySelector("#playerSpellCount0"), document.querySelector("#playerSpellCount1")],
  currentLists: [document.querySelector("#playerCurrent0"), document.querySelector("#playerCurrent1")],
  cooldownLists: [document.querySelector("#playerCooldowns0"), document.querySelector("#playerCooldowns1")],
  dropZones: [document.querySelector("#playerDrop0"), document.querySelector("#playerDrop1")],
};

function normalizeCombat(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function combatSpellKey(spell) {
  return `${spell.classe}:${spell.sourceId || spell.nom}`;
}

function playerName(playerIndex) {
  return combatEls.playerNames[playerIndex].value.trim() || `Joueur ${playerIndex + 1}`;
}

function combatElementClass(element) {
  const cleaned = normalizeCombat(element);
  if (cleaned.includes("air")) return "air";
  if (cleaned.includes("feu")) return "feu";
  if (cleaned.includes("eau")) return "eau";
  if (cleaned.includes("terre")) return "terre";
  return "other";
}

function combatDamageLabel(spell) {
  if (spell.min === null || spell.max === null) return "Utilitaire";
  return Array.isArray(spell.hits) ? `${spell.min}-${spell.max} total` : `${spell.min}-${spell.max}`;
}

function getSpellByKey(key) {
  return combatSpells.find((spell) => combatSpellKey(spell) === key);
}

function currentTurnCasts(playerIndex) {
  return combatState.players[playerIndex].casts.filter((cast) => cast.turn === combatState.turn);
}

function castsThisTurn(playerIndex, spell) {
  const key = combatSpellKey(spell);
  return currentTurnCasts(playerIndex).filter((cast) => cast.key === key).length;
}

function readyTurn(playerIndex, spell) {
  return combatState.players[playerIndex].cooldowns.get(combatSpellKey(spell)) || 0;
}

function recentlyReadyCasts(playerIndex) {
  return combatState.players[playerIndex].casts.filter((cast) =>
    cast.relance > 0 && cast.readyTurn === combatState.turn,
  );
}

function canCastCombat(playerIndex, spell) {
  const ready = readyTurn(playerIndex, spell);
  if (ready > combatState.turn) return false;
  if (!spell.parTour) return true;
  return castsThisTurn(playerIndex, spell) < spell.parTour;
}

function castCombatSpell(playerIndex, spellKeyValue) {
  const spell = getSpellByKey(spellKeyValue);
  if (!spell || !canCastCombat(playerIndex, spell)) return;

  const ready = spell.relance ? combatState.turn + spell.relance : combatState.turn;
  combatState.players[playerIndex].casts.push({
    key: spellKeyValue,
    name: spell.nom,
    turn: combatState.turn,
    readyTurn: ready,
    relance: spell.relance || 0,
  });

  if (spell.relance) {
    combatState.players[playerIndex].cooldowns.set(spellKeyValue, ready);
  }

  renderCombat();
}

function renderClassSelects() {
  const classes = [...new Set(combatSpells.map((spell) => spell.classe).filter(Boolean))].sort();
  combatEls.classSelects.forEach((select, playerIndex) => {
    select.innerHTML = "";
    classes.forEach((className) => {
      const option = document.createElement("option");
      option.value = className;
      option.textContent = className;
      select.append(option);
    });
    if (!classes.includes(combatState.players[playerIndex].className)) {
      combatState.players[playerIndex].className = classes[playerIndex] || classes[0] || "";
    }
    select.value = combatState.players[playerIndex].className;
  });
}

function renderCombatSpellList(playerIndex) {
  const player = combatState.players[playerIndex];
  const query = normalizeCombat(combatEls.searches[playerIndex].value);
  const spells = combatSpells
    .filter((spell) =>
      spell.classe === player.className &&
      Number(spell.relance || 0) > 0 &&
      normalizeCombat(spell.nom).includes(query)
    )
    .sort((a, b) => a.nom.localeCompare(b.nom));

  combatEls.spellCounts[playerIndex].textContent = `${spells.length} sorts`;
  combatEls.spellLists[playerIndex].innerHTML = "";

  spells.forEach((spell) => {
    const key = combatSpellKey(spell);
    const ready = readyTurn(playerIndex, spell);
    const available = canCastCombat(playerIndex, spell);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `combat-spell-card${available ? "" : " disabled"}`;
    button.draggable = available;
    button.dataset.spellKey = key;
    button.dataset.player = String(playerIndex);
    button.innerHTML = `
      <strong>${spell.nom}</strong>
      <span class="spell-meta">
        <span class="pill ${combatElementClass(spell.element)}">${spell.element || "-"}</span>
        <span>${combatDamageLabel(spell)}</span>
        <span>${spell.relance ? `Relance ${spell.relance}` : "Sans relance"}</span>
      </span>
      <small>${available ? "Glisser ou cliquer pour lancer" : `Disponible tour ${ready}`}</small>
    `;
    button.addEventListener("click", () => castCombatSpell(playerIndex, key));
    button.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", JSON.stringify({ playerIndex, key }));
      event.dataTransfer.effectAllowed = "copy";
    });
    combatEls.spellLists[playerIndex].append(button);
  });
}

function renderCurrentCasts(playerIndex) {
  const casts = currentTurnCasts(playerIndex);
  combatEls.currentLists[playerIndex].innerHTML = "";
  if (casts.length === 0) {
    combatEls.currentLists[playerIndex].innerHTML = `<p class="empty-state">Aucun sort lance ce tour.</p>`;
    return;
  }

  casts.forEach((cast) => {
    const item = document.createElement("div");
    item.className = "cast-item";
    item.innerHTML = `
      <strong>${cast.name}</strong>
      <span>${cast.relance ? `Relance tour ${cast.readyTurn}` : "Disponible immediatement"}</span>
    `;
    combatEls.currentLists[playerIndex].append(item);
  });
}

function renderCooldowns(playerIndex) {
  const active = [...combatState.players[playerIndex].cooldowns.entries()]
    .map(([key, turn]) => ({ spell: getSpellByKey(key), turn, remaining: turn - combatState.turn }))
    .filter((item) => item.spell && item.remaining > 0)
    .sort((a, b) => a.turn - b.turn || a.spell.nom.localeCompare(b.spell.nom));
  const readyNow = recentlyReadyCasts(playerIndex)
    .filter((cast, index, casts) => casts.findIndex((candidate) => candidate.key === cast.key) === index)
    .sort((a, b) => a.name.localeCompare(b.name));

  combatEls.cooldownLists[playerIndex].innerHTML = "";
  if (readyNow.length === 0 && active.length === 0) {
    combatEls.cooldownLists[playerIndex].innerHTML = `<p class="empty-state">Aucune relance active.</p>`;
    return;
  }

  readyNow.forEach((cast) => {
    const item = document.createElement("div");
    item.className = "cooldown-item ready-alert";
    item.innerHTML = `
      <strong>${cast.name}</strong>
      <span>Relancable maintenant</span>
    `;
    combatEls.cooldownLists[playerIndex].append(item);
  });

  active.forEach(({ spell, turn, remaining }) => {
    const item = document.createElement("div");
    item.className = "cooldown-item";
    item.innerHTML = `
      <strong>${spell.nom}</strong>
      <span>Tour ${turn} · ${remaining} restant${remaining > 1 ? "s" : ""}</span>
    `;
    combatEls.cooldownLists[playerIndex].append(item);
  });
}

function renderCombatJournal() {
  const allCasts = combatState.players.flatMap((player, playerIndex) =>
    player.casts.map((cast) => ({ ...cast, playerIndex })),
  );
  const turns = [...new Set(allCasts.map((cast) => cast.turn))].sort((a, b) => b - a);

  combatEls.journal.innerHTML = "";
  if (turns.length === 0) {
    combatEls.journal.innerHTML = `<p class="empty-state">Le journal est vide.</p>`;
    return;
  }

  turns.forEach((turn) => {
    const section = document.createElement("section");
    section.className = "journal-turn";
    const casts = allCasts.filter((cast) => cast.turn === turn);
    section.innerHTML = `<h3>Tour ${turn}</h3>`;
    casts.forEach((cast) => {
      const row = document.createElement("div");
      row.className = "journal-row";
      row.innerHTML = `
        <strong>${playerName(cast.playerIndex)}</strong>
        <span>${cast.name}</span>
        <em>${cast.relance ? `relance tour ${cast.readyTurn}` : "sans relance"}</em>
      `;
      section.append(row);
    });
    combatEls.journal.append(section);
  });
}

function renderEnemyAlerts() {
  [0, 1].forEach((viewerIndex) => {
    const enemyIndex = viewerIndex === 0 ? 1 : 0;
    const board = document.querySelector(`.combat-board[data-player="${viewerIndex}"]`);
    const existing = board.querySelector(".enemy-ready-alert");
    existing?.remove();

    const readySpells = recentlyReadyCasts(enemyIndex)
      .filter((cast, index, casts) => casts.findIndex((candidate) => candidate.key === cast.key) === index);
    if (readySpells.length === 0) return;

    const alert = document.createElement("div");
    alert.className = "enemy-ready-alert";
    alert.innerHTML = `
      <span>Attention ${playerName(enemyIndex)}</span>
      <strong>${readySpells.map((cast) => cast.name).join(", ")}</strong>
      <em>peut etre relance ce tour</em>
    `;
    board.prepend(alert);
  });
}

function renderCombat() {
  combatEls.turnInput.value = combatState.turn;
  [0, 1].forEach((playerIndex) => {
    renderCombatSpellList(playerIndex);
    renderCurrentCasts(playerIndex);
    renderCooldowns(playerIndex);
  });
  renderEnemyAlerts();
  renderCombatJournal();
}

function setCombatTurn(turn) {
  combatState.turn = Math.max(1, Number.parseInt(turn, 10) || 1);
  renderCombat();
}

combatEls.classSelects.forEach((select, playerIndex) => {
  select.addEventListener("change", () => {
    combatState.players[playerIndex].className = select.value;
    renderCombat();
  });
});

combatEls.playerNames.forEach((input) => {
  input.addEventListener("input", renderCombat);
});

combatEls.searches.forEach((input) => {
  input.addEventListener("input", renderCombat);
});

combatEls.dropZones.forEach((zone, playerIndex) => {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("drag-over");
    const payload = JSON.parse(event.dataTransfer.getData("text/plain") || "{}");
    if (payload.playerIndex === playerIndex) castCombatSpell(playerIndex, payload.key);
  });
});

combatEls.prevTurn.addEventListener("click", () => setCombatTurn(combatState.turn - 1));
combatEls.nextTurn.addEventListener("click", () => setCombatTurn(combatState.turn + 1));
combatEls.turnInput.addEventListener("change", () => setCombatTurn(combatEls.turnInput.value));
combatEls.turnInput.addEventListener("input", () => setCombatTurn(combatEls.turnInput.value));
combatEls.reset.addEventListener("click", () => {
  combatState.turn = 1;
  combatState.players.forEach((player) => {
    player.cooldowns.clear();
    player.casts = [];
  });
  renderCombat();
});
combatEls.clearLog.addEventListener("click", () => {
  combatState.players.forEach((player) => {
    player.cooldowns.clear();
    player.casts = [];
  });
  renderCombat();
});

renderClassSelects();
renderCombat();
