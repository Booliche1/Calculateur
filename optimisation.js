const optSpells = (window.DOFUS_SPELLS || []).filter((spell) => spell.max !== null);

const optEls = {
  search: document.querySelector("#optSearchInput"),
  classFilter: document.querySelector("#optClassFilter"),
  scope: document.querySelector("#optScopeInput"),
  damageMode: document.querySelector("#optDamageMode"),
  spellList: document.querySelector("#optSpellList"),
  spellCount: document.querySelector("#optSpellCount"),
  selectedClass: document.querySelector("#optSelectedClass"),
  selectedName: document.querySelector("#optSelectedName"),
  spellNote: document.querySelector("#optSpellNote"),
  simpleMode: document.querySelector("#optSimpleMode"),
  advancedMode: document.querySelector("#optAdvancedMode"),
  advancedPanel: document.querySelector("#optAdvancedPanel"),
  addRotation: document.querySelector("#optAddRotation"),
  clearRotation: document.querySelector("#optClearRotation"),
  rotationList: document.querySelector("#optRotationList"),
  results: document.querySelector("#optResults"),
  equivalences: document.querySelector("#optEquivalences"),
  hitDetails: document.querySelector("#optHitDetails"),
  verdict: document.querySelector("#optVerdict"),
  verdictDetail: document.querySelector("#optVerdictDetail"),
  baseline: document.querySelector("#optBaseline"),
  inputs: {
    critChance: document.querySelector("#optCritChanceInput"),
    rangeType: document.querySelector("#optRangeTypeInput"),
  },
};

const optState = {
  selected: optSpells[0],
  rotation: [],
  advanced: false,
};

const optAttackElements = ["terre", "feu", "air", "eau"];
const optElementOrder = ["neutre", "terre", "feu", "eau", "air"];

function optNormalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function optNumber(input) {
  return Number.parseFloat(input?.value) || 0;
}

function optConfig() {
  const inputs = optEls.inputs;
  return {
    force: optNumber(inputs.force),
    intelligence: optNumber(inputs.intelligence),
    chance: optNumber(inputs.chance),
    agility: optNumber(inputs.agility),
    power: optNumber(inputs.power),
    flatDamage: optNumber(inputs.flatDamage),
    critDamage: optNumber(inputs.critDamage),
    critChance: Math.min(100, Math.max(0, optNumber(inputs.critChance))),
    spellDamage: optNumber(inputs.spellDamage),
    finalDamage: optNumber(inputs.finalDamage),
    distanceDamage: optNumber(inputs.distanceDamage),
    meleeDamage: optNumber(inputs.meleeDamage),
    neutralDamage: optNumber(inputs.neutralDamage),
    earthDamage: optNumber(inputs.earthDamage),
    fireDamage: optNumber(inputs.fireDamage),
    waterDamage: optNumber(inputs.waterDamage),
    airDamage: optNumber(inputs.airDamage),
    rangeType: inputs.rangeType?.value || "distance",
    neutralFlatRes: optNumber(inputs.neutralFlatRes),
    earthFlatRes: optNumber(inputs.earthFlatRes),
    fireFlatRes: optNumber(inputs.fireFlatRes),
    waterFlatRes: optNumber(inputs.waterFlatRes),
    airFlatRes: optNumber(inputs.airFlatRes),
    neutralPercentRes: optNumber(inputs.neutralPercentRes),
    earthPercentRes: optNumber(inputs.earthPercentRes),
    firePercentRes: optNumber(inputs.firePercentRes),
    waterPercentRes: optNumber(inputs.waterPercentRes),
    airPercentRes: optNumber(inputs.airPercentRes),
    critRes: optNumber(inputs.critRes),
    spellRes: optNumber(inputs.spellRes),
    weaponRes: optNumber(inputs.weaponRes),
    sufferedDamage: inputs.sufferedDamage ? optNumber(inputs.sufferedDamage) : 100,
    distanceRes: optNumber(inputs.distanceRes),
    meleeRes: optNumber(inputs.meleeRes),
  };
}

function optStatForElement(config, element) {
  const stats = {
    neutre: config.force,
    terre: config.force,
    feu: config.intelligence,
    eau: config.chance,
    air: config.agility,
  };
  return stats[element] || 0;
}

function optElementDamage(config, element) {
  const damages = {
    neutre: config.neutralDamage,
    terre: config.earthDamage,
    feu: config.fireDamage,
    eau: config.waterDamage,
    air: config.airDamage,
  };
  return damages[element] || 0;
}

function optFlatRes(config, element) {
  return {
    neutre: config.neutralFlatRes,
    terre: config.earthFlatRes,
    feu: config.fireFlatRes,
    eau: config.waterFlatRes,
    air: config.airFlatRes,
  }[element] || 0;
}

function optPercentRes(config, element) {
  return {
    neutre: config.neutralPercentRes,
    terre: config.earthPercentRes,
    feu: config.firePercentRes,
    eau: config.waterPercentRes,
    air: config.airPercentRes,
  }[element] || 0;
}

function optPercent(value) {
  return 1 + value / 100;
}

function optBaseElement(spell) {
  const cleaned = optNormalize(spell.element);
  return optElementOrder.find((element) => cleaned.includes(element)) || "neutre";
}

function optDamageLine(base, element, config, crit) {
  const theoreticalMultiplier = (config.power + optStatForElement(config, element) + 100) / 100;
  const flatBonus = config.flatDamage + optElementDamage(config, element) + (crit ? config.critDamage : 0);
  const rawDamage = Math.floor(theoreticalMultiplier * base + flatBonus);
  const fixedRes = optFlatRes(config, element) + config.spellRes + (crit ? config.critRes : 0);
  const resistedDamage = Math.floor((rawDamage - fixedRes) * ((100 - optPercentRes(config, element)) / 100));
  const rangeBonus = config.rangeType === "distance" ? config.distanceDamage : config.meleeDamage;
  const rangeRes = config.rangeType === "distance" ? config.distanceRes : config.meleeRes;
  const multiplier =
    (config.sufferedDamage / 100) *
    optPercent(config.finalDamage) *
    optPercent(config.spellDamage) *
    optPercent(rangeBonus) *
    (1 - rangeRes / 100);
  return Math.max(0, Math.floor(resistedDamage * multiplier));
}

function optResolveDynamicElement(hit, config, crit) {
  const cleaned = optNormalize(hit.element);
  if (!cleaned.includes("meilleur") && !cleaned.includes("pire")) return hit.element;

  const min = crit ? hit.critMin ?? hit.min : hit.min;
  const max = crit ? hit.critMax ?? hit.max : hit.max;
  const ranked = optAttackElements
    .map((element) => ({
      element,
      value: (optDamageLine(min, element, config, crit) + optDamageLine(max, element, config, crit)) / 2,
    }))
    .sort((a, b) => b.value - a.value);

  return cleaned.includes("pire") ? ranked[ranked.length - 1].element : ranked[0].element;
}

function optHits(spell, config, crit) {
  if (Array.isArray(spell.hits) && spell.hits.length > 0) {
    return spell.hits.map((hit) => ({
      element: optResolveDynamicElement(hit, config, crit),
      min: crit ? hit.critMin ?? hit.min : hit.min,
      max: crit ? hit.critMax ?? hit.max : hit.max,
    }));
  }

  return [{
    element: optBaseElement(spell),
    min: crit ? spell.critMin ?? spell.min : spell.min,
    max: crit ? spell.critMax ?? spell.max : spell.max,
  }];
}

function optSpellDamage(spell, config, crit) {
  return optHits(spell, config, crit).reduce((total, hit) => {
    const minDamage = optDamageLine(hit.min, hit.element, config, crit);
    const maxDamage = optDamageLine(hit.max, hit.element, config, crit);
    return total + (minDamage + maxDamage) / 2;
  }, 0);
}

function optSpellExpected(spell, config) {
  const mode = optEls.damageMode.value;
  if (mode === "normal") return optSpellDamage(spell, config, false);
  if (mode === "crit") return optSpellDamage(spell, config, true);

  const critRate = config.critChance / 100;
  return optSpellDamage(spell, config, false) * (1 - critRate) + optSpellDamage(spell, config, true) * critRate;
}

function optTargetSpells() {
  if (optEls.scope.value === "rotation" && optState.rotation.length > 0) return optState.rotation;
  return optState.selected ? [optState.selected] : [];
}

function optTotalDamage(config) {
  return optTargetSpells().reduce((total, spell) => total + optSpellExpected(spell, config), 0);
}

function optWith(config, mutate) {
  const copy = { ...config };
  mutate(copy);
  return copy;
}

function optBonusDefinitions(config) {
  return [
    { label: "+5 Force", shortLabel: "Force", type: "stat", statName: "force", unit: 5, apply: (draft) => { draft.force += 5; } },
    { label: "+5 Intelligence", shortLabel: "Intelligence", type: "stat", statName: "intelligence", unit: 5, apply: (draft) => { draft.intelligence += 5; } },
    { label: "+5 Chance", shortLabel: "Chance", type: "stat", statName: "chance", unit: 5, apply: (draft) => { draft.chance += 5; } },
    { label: "+5 Agilite", shortLabel: "Agilite", type: "stat", statName: "agilite", unit: 5, apply: (draft) => { draft.agility += 5; } },
    { label: "+5 Puissance", shortLabel: "Puissance", type: "power", unit: 5, apply: (draft) => { draft.power += 5; } },
    { label: "+1 dommage fixe", type: "flat", unit: 1, apply: (draft) => { draft.flatDamage += 1; } },
    { label: "+1 dommage critique", type: "crit", unit: 1, apply: (draft) => { draft.critDamage += 1; } },
    { label: "+1% dommages sorts", type: "percent", unit: 1, apply: (draft) => { draft.spellDamage += 1; } },
    { label: "+1% dommages distance", type: "percent", unit: 1, apply: (draft) => { draft.distanceDamage += 1; } },
    { label: "+1% dommages melee", type: "percent", unit: 1, apply: (draft) => { draft.meleeDamage += 1; } },
    { label: "+1 dommage terre", type: "elemental", unit: 1, apply: (draft) => { draft.earthDamage += 1; } },
    { label: "+1 dommage feu", type: "elemental", unit: 1, apply: (draft) => { draft.fireDamage += 1; } },
    { label: "+1 dommage eau", type: "elemental", unit: 1, apply: (draft) => { draft.waterDamage += 1; } },
    { label: "+1 dommage air", type: "elemental", unit: 1, apply: (draft) => { draft.airDamage += 1; } },
  ].filter((bonus) => config.critChance > 0 || optEls.damageMode.value === "crit" || bonus.type !== "crit");
}

function optBonusResults() {
  const config = optConfig();
  const baseline = optTotalDamage(config);
  return {
    baseline,
    config,
    results: optBonusDefinitions(config)
      .map((bonus) => ({
        ...bonus,
        gain: optTotalDamage(optWith(config, bonus.apply)) - baseline,
      }))
      .sort((a, b) => b.gain - a.gain),
  };
}

function optFilteredSpells() {
  const query = optNormalize(optEls.search.value);
  const className = optEls.classFilter.value;
  return optSpells
    .filter((spell) => optNormalize(spell.nom).includes(query))
    .filter((spell) => className === "all" || spell.classe === className)
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

function optRenderClassOptions() {
  [...new Set(optSpells.map((spell) => spell.classe))].sort().forEach((className) => {
    const option = document.createElement("option");
    option.value = className;
    option.textContent = className;
    optEls.classFilter.append(option);
  });
}

function optRenderSpellList() {
  const visible = optFilteredSpells();
  optEls.spellCount.textContent = `${visible.length} sorts`;
  optEls.spellList.innerHTML = "";

  visible.forEach((spell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `spell-card${spell === optState.selected ? " active" : ""}`;
    button.innerHTML = `
      <strong>${spell.nom}</strong>
      <span class="spell-meta">
        <span class="pill ${optNormalize(spell.element)}">${spell.element || "-"}</span>
        <span>${spell.min}-${spell.max}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      optState.selected = spell;
      optRender();
    });
    optEls.spellList.append(button);
  });
}

function optRankClass(gain, bestGain) {
  if (bestGain <= 0) return "low";
  if (gain === bestGain) return "best";
  if (gain >= bestGain * 0.8) return "near";
  return "low";
}

function optFormat(value) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function optRenderResults() {
  const { baseline, results } = optBonusResults();
  const best = results[0];
  const bestGain = Math.max(0, best?.gain || 0);

  optEls.baseline.textContent = `Base analysee : ${optFormat(baseline)} degats moyens`;
  optEls.verdict.textContent = best ? best.label : "-";
  optEls.verdictDetail.textContent = best
    ? `${best.label} est le meilleur choix theorique pour ce sort ou cette rotation : il ajoute +${optFormat(best.gain)} degats moyens par rapport au jet de base.`
    : "Aucun sort analysable.";

  optEls.results.innerHTML = results.map((result) => `
    <div class="opt-result-row ${optRankClass(result.gain, bestGain)}">
      <span>${result.label}</span>
      <strong>+${optFormat(result.gain)}</strong>
      <small>${result.unit > 1 ? `gain total pour ${result.unit}` : "gain pour 1"}</small>
    </div>
  `).join("");

  optRenderEquivalences(results);
}

function optRenderEquivalences(results) {
  const fixed = results.find((item) => item.label === "+1 dommage fixe");
  const statRows = results.filter((item) => item.type === "stat");
  const percentRows = results.filter((item) => item.type === "percent");
  const lines = [];

  if (fixed) {
    statRows.forEach((stat) => {
      const oneStatGain = stat.gain / stat.unit;
      if (oneStatGain > 0) lines.push(`1 dommage fixe ≈ ${optFormat(fixed.gain / oneStatGain)} ${stat.shortLabel.toLowerCase()}`);
    });
  }

  percentRows.forEach((percentBonus) => {
    statRows.forEach((stat) => {
      const oneStatGain = stat.gain / stat.unit;
      if (oneStatGain > 0) lines.push(`${percentBonus.label.replace("+1", "1")} ≈ ${optFormat(percentBonus.gain / oneStatGain)} ${stat.shortLabel.toLowerCase()}`);
    });
    if (fixed?.gain > 0) lines.push(`${percentBonus.label.replace("+1", "1")} ≈ ${optFormat(percentBonus.gain / fixed.gain)} dommage fixe`);
  });

  if (fixed) {
    const bestStat = statRows.slice().sort((a, b) => b.gain - a.gain)[0];
    if (bestStat?.gain > 0) {
      const oneStatGain = bestStat.gain / bestStat.unit;
      const threshold = fixed.gain / oneStatGain;
      lines.push(`Lecture rapide : sur cette analyse, 1 dommage fixe vaut environ ${optFormat(threshold)} ${bestStat.shortLabel.toLowerCase()}.`);
    }
  }

  const averageLineBase = optAverageLineBase();
  lines.push(`Repere theorique : sur une ligne de base ${optFormat(averageLineBase)}, +5 stat vaut environ +${optFormat(averageLineBase / 20)} avant resistances.`);
  lines.push("Les dommages fixes ne baissent pas avec tes stats : ils sont surtout meilleurs sur les petits jets et les sorts multi-lignes.");

  optEls.equivalences.innerHTML = lines.map((line) => `<p>${line}</p>`).join("");
}

function optAverageLineBase() {
  const config = optConfig();
  const mode = optEls.damageMode.value === "crit";
  const bases = optTargetSpells().flatMap((spell) => optHits(spell, config, mode).map((hit) => (hit.min + hit.max) / 2));
  if (!bases.length) return 0;
  return bases.reduce((total, value) => total + value, 0) / bases.length;
}

function optRenderRotation() {
  optEls.rotationList.innerHTML = "";
  if (optState.rotation.length === 0) {
    optEls.rotationList.innerHTML = `<p class="empty-state">Aucun sort dans la rotation.</p>`;
    return;
  }

  optState.rotation.forEach((spell, index) => {
    const row = document.createElement("div");
    row.className = "rotation-item";
    row.innerHTML = `<span>${index + 1}. ${spell.nom}</span><button type="button">Retirer</button>`;
    row.querySelector("button").addEventListener("click", () => {
      optState.rotation.splice(index, 1);
      optRender();
    });
    optEls.rotationList.append(row);
  });
}

function optRenderHitDetails() {
  const config = optConfig();
  const crit = optEls.damageMode.value === "crit";
  optEls.hitDetails.innerHTML = optTargetSpells().map((spell) => {
    const rows = optHits(spell, config, crit).map((hit) => `<li>${hit.min}-${hit.max} ${hit.element}</li>`).join("");
    return `<article><strong>${spell.nom}</strong><ul>${rows}</ul></article>`;
  }).join("");
}

function optRenderSelected() {
  const spell = optState.selected;
  optEls.selectedClass.textContent = spell?.classe || "-";
  optEls.selectedName.textContent = spell?.nom || "-";
  optEls.spellNote.textContent = spell?.note || "";
  optEls.spellNote.hidden = !spell?.note;
}

function optRender() {
  optRenderSpellList();
  optRenderSelected();
  optRenderResults();
  optRenderRotation();
  optRenderHitDetails();
  optEls.advancedPanel.hidden = !optState.advanced;
  optEls.simpleMode.classList.toggle("active", !optState.advanced);
  optEls.advancedMode.classList.toggle("active", optState.advanced);
}

function optWire() {
  optRenderClassOptions();
  optRender();

  optEls.search.addEventListener("input", optRenderSpellList);
  optEls.classFilter.addEventListener("change", () => {
    const visible = optFilteredSpells();
    if (visible.length && !visible.includes(optState.selected)) optState.selected = visible[0];
    optRender();
  });
  optEls.scope.addEventListener("change", optRender);
  optEls.damageMode.addEventListener("change", optRender);
  optEls.simpleMode.addEventListener("click", () => {
    optState.advanced = false;
    optRender();
  });
  optEls.advancedMode.addEventListener("click", () => {
    optState.advanced = true;
    optRender();
  });
  optEls.addRotation.addEventListener("click", () => {
    if (optState.selected) {
      optState.rotation.push(optState.selected);
      optEls.scope.value = "rotation";
      optState.advanced = true;
      optRender();
    }
  });
  optEls.clearRotation.addEventListener("click", () => {
    optState.rotation = [];
    optRender();
  });
  Object.values(optEls.inputs).forEach((input) => {
    if (!input) return;
    input.addEventListener("input", optRender);
    input.addEventListener("change", optRender);
  });
}

if (optSpells.length > 0) optWire();
