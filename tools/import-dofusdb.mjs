const API = "https://api.dofusdb.fr";
const damageEffectIds = new Set([85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 108, 109, 110, 111, 112]);
const elementNames = {
  0: "Neutre",
  1: "Terre",
  2: "Feu",
  3: "Eau",
  4: "Air",
};
const pushbackEffectIds = new Set([5]);
const spellOverrides = {
  13108: {
    element: "Meilleur element",
    min: 8,
    max: 10,
    critMin: 11,
    critMax: 13,
  },
  24039: {
    element: "Meilleur element",
    min: 70,
    max: 70,
    critMin: 100,
    critMax: 100,
    note: "70 dommages du meilleur élément.\nCritique : 100 dommages du meilleur élément.",
  },
};
async function get(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
}

function bestLevel(spell) {
  return spell.spellLevels[spell.spellLevels.length - 1];
}

function damageEffects(effects = []) {
  return effects.filter((effect) => {
    const hasDice = Number(effect.diceSide) > 0 || Number(effect.diceNum) > 0;
    const hasElement = elementNames[effect.effectElement];
    return hasDice && hasElement && damageEffectIds.has(effect.effectId);
  });
}

function summarizeDamage(effects) {
  const damage = damageEffects(effects);
  if (damage.length === 0) return null;

  const min = Math.min(...damage.map((effect) => Number(effect.diceNum) || Number(effect.diceSide)));
  const max = Math.max(...damage.map((effect) => Number(effect.diceSide) || Number(effect.diceNum)));
  const uniqueElements = [...new Set(damage.map((effect) => elementNames[effect.effectElement]))];

  return {
    element: uniqueElements.length === 1 ? uniqueElements[0] : uniqueElements.join(" / "),
    min,
    max,
  };
}

function pushbackDistance(effects = []) {
  return Math.max(
    0,
    ...effects
      .filter((effect) => pushbackEffectIds.has(effect.effectId))
      .map((effect) => Number(effect.diceNum) || Number(effect.value) || Number(effect.diceSide) || 0),
  );
}

function toSpellRecord(className, spell, level) {
  const normal = summarizeDamage(level.effects);
  const critical = summarizeDamage(level.criticalEffect) || normal;
  const zoneEffects = [...(level.effects || []), ...(level.criticalEffect || [])].filter((effect) => effect.zoneDescr?.damageDecreaseStepPercent > 0);
  const pushback = Math.max(pushbackDistance(level.effects), pushbackDistance(level.criticalEffect));
  const override = spellOverrides[spell.id] || {};

  return {
    classe: className,
    nom: spell.name.fr,
    element: override.element || normal?.element || "-",
    min: override.min ?? normal?.min ?? null,
    max: override.max ?? normal?.max ?? null,
    critMin: override.critMin ?? critical?.min ?? null,
    critMax: override.critMax ?? critical?.max ?? null,
    parTour: level.maxCastPerTurn || null,
    relance: level.minCastInterval || level.initialCooldown || 0,
    poussee: pushback,
    pa: level.apCost,
    poMin: level.minRange,
    poMax: level.range,
    zone: zoneEffects.length > 0,
    sourceId: spell.id,
    note: override.note ? `${override.note}\n\n${spell.description?.fr || ""}` : spell.description?.fr || "",
  };
}

async function importBreed(breedId) {
  const breed = await get(`/breeds/${breedId}`);
  const variants = await get(`/spell-variants?$limit=100&breedId=${breedId}`);
  const spells = variants.data
    .flatMap((variant) => variant.spells || [])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const records = [];

  for (const spell of spells) {
    const level = await get(`/spell-levels/${bestLevel(spell)}`);
    records.push(toSpellRecord(breed.shortName.fr, spell, level));
  }

  return records;
}

async function importBreeds(breedIds) {
  const records = [];
  for (const breedId of breedIds) {
    records.push(...await importBreed(breedId));
  }
  return records;
}

const classBreedIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];
const requestedBreed = process.argv[2] || "1";
const records = requestedBreed === "all"
  ? await importBreeds(classBreedIds)
  : await importBreed(Number(requestedBreed));

console.log(JSON.stringify(records, null, 2));
