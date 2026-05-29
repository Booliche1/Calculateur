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
    nameSuffix: " (Sobre)",
    sourceId: "24039-sobre",
    note: "70 dommages du meilleur élément.\nCritique : 100 dommages du meilleur élément.",
  },
  12784: {
    element: "Air",
    min: 28,
    max: 32,
    critMin: 34,
    critMax: 38,
    nameSuffix: " (Sobre)",
    sourceId: "12784-sobre",
    note: "État Sobre : 28 à 32 dommages Air, repousse de 2 cases.\nCritique : 34 à 38 dommages Air, repousse de 2 cases.",
  },
  12803: {
    element: "Terre",
    min: 24,
    max: 27,
    critMin: 29,
    critMax: 32,
    sourceId: "12803-normal",
    note: "24 a 27 dommages Terre.\nCritique : 29 a 32 dommages Terre.\n\nRend le lanceur Sobre.",
  },
  12794: {
    element: "Eau",
    min: 36,
    max: 40,
    critMin: 43,
    critMax: 48,
    nameSuffix: " (Sobre)",
    sourceId: "12794-sobre",
    note: "Etat Sobre : 36 a 40 dommages Eau et repousse les cibles en zone.\nCritique : 43 a 48 dommages Eau.\nLa poussee est appliquee uniquement si le lanceur est Sobre.",
  },
  12796: {
    element: "Feu",
    min: 18,
    max: 20,
    critMin: 22,
    critMax: 24,
    nameSuffix: " (Sobre)",
    sourceId: "12796-sobre",
    note: "Etat Sobre : 18 a 20 dommages Feu en zone.\nCritique : 22 a 24 dommages Feu.\nN'affecte pas le lanceur.",
  },
  12797: {
    element: "Terre",
    min: 38,
    max: 42,
    critMin: 46,
    critMax: 50,
    nameSuffix: " (Sobre)",
    sourceId: "12797-sobre",
    note: "Etat Sobre : 38 a 42 dommages Terre en zone.\nCritique : 46 a 50 dommages Terre.",
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
    nom: `${spell.name.fr}${override.nameSuffix || ""}`,
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
    sourceId: override.sourceId || spell.id,
    note: override.note ? `${override.note}\n\n${spell.description?.fr || ""}` : spell.description?.fr || "",
  };
}

function extraSpellRecords(className, spell, baseRecord) {
  const extraVariants = {
    12803: [{
      nom: "Gueule de Bois (Sortie Saoul)",
      element: "Terre",
      min: 34,
      max: 37,
      critMin: 39,
      critMax: 42,
      sourceId: "12803-sortie-saoul",
      note: "34 a 37 dommages Terre si le lanceur est sorti de l'etat Saoul pendant le tour.\nCritique : 39 a 42 dommages Terre.",
    }],
    12794: [{
      nom: "Vague a Lame (Saoul)",
      element: "Eau",
      min: 44,
      max: 48,
      critMin: 51,
      critMax: 56,
      poussee: 0,
      sourceId: "12794-saoul",
      note: "Etat Saoul : 44 a 48 dommages Eau.\nCritique : 51 a 56 dommages Eau.\nLa portee du sort est reduite de moitie et la poussee ne s'applique pas.",
    }],
    12796: [{
      nom: "Flasque Explosive (Saoul)",
      element: "Feu",
      min: 22,
      max: 25,
      critMin: 26,
      critMax: 30,
      sourceId: "12796-saoul",
      note: "Etat Saoul : 22 a 25 dommages Feu en zone.\nCritique : 26 a 30 dommages Feu.\nLa portee du sort est reduite de moitie.",
    }],
    12797: [{
      nom: "Pandatak (Saoul)",
      element: "Terre",
      min: 46,
      max: 50,
      critMin: 54,
      critMax: 58,
      sourceId: "12797-saoul",
      note: "Etat Saoul : 46 a 50 dommages Terre en zone.\nCritique : 54 a 58 dommages Terre.\nLa portee du sort est reduite de moitie.",
    }],
  };

  if (extraVariants[spell.id]) {
    return extraVariants[spell.id].map((variant) => ({
      ...baseRecord,
      ...variant,
      poussee: variant.poussee ?? baseRecord.poussee,
    }));
  }

  if (spell.id === 12784) {
    return [{
      ...baseRecord,
      nom: "Souffle Alcoolisé (Saoul)",
      element: "Air",
      min: 34,
      max: 38,
      critMin: 40,
      critMax: 44,
      sourceId: "12784-saoul",
      note: "État Saoul : 34 à 38 dommages Air, repousse de 2 cases.\nCritique : 40 à 44 dommages Air, repousse de 2 cases.",
    }];
  }

  const poisonVariants = {
    13064: {
      nom: "Fleche de Tourment (poison)",
      sourceId: "13064-poison",
      note: "Ligne poison Air de fin de tour de Fleche de Tourment. Les degats directs du vol de vie restent sur Fleche de Tourment.",
    },
    12815: {
      nom: "Distillation (poison)",
      sourceId: "12815-poison",
      note: "Ligne poison Eau de debut de tour de Distillation. Les degats du sort et du poison sont augmentes pour chaque poison du sort declenche sur une cible (cumulable 4 fois).",
    },
    14584: {
      nom: "Affliction (poison)",
      sourceId: "14584-poison",
      note: "Ligne poison Eau de debut de tour d'Affliction, appliquee si le sort est projete dans un portail.",
    },
    14594: {
      nom: "Extinction (poison)",
      sourceId: "14594-poison",
      note: "Ligne poison Feu de fin de tour d'Extinction, appliquee si le sort est projete dans un portail.",
    },
  };

  if (poisonVariants[spell.id]) {
    return [{
      ...baseRecord,
      ...poisonVariants[spell.id],
    }];
  }

  if (spell.id !== 24039) return [];

  return [{
    ...baseRecord,
    nom: "Main de Pandawa (Saoul)",
    element: "Neutre / Terre / Feu / Eau / Air",
    min: 35,
    max: 35,
    critMin: 50,
    critMax: 50,
    hits: [
      { element: "neutre", min: 7, max: 7, critMin: 10, critMax: 10 },
      { element: "terre", min: 7, max: 7, critMin: 10, critMax: 10 },
      { element: "feu", min: 7, max: 7, critMin: 10, critMax: 10 },
      { element: "eau", min: 7, max: 7, critMin: 10, critMax: 10 },
      { element: "air", min: 7, max: 7, critMin: 10, critMax: 10 },
    ],
    sourceId: "24039-saoul",
    note: "Additionne 5 lignes de dégâts : Neutre, Terre, Feu, Eau et Air.\nNormal : 7 dommages par élément, 35 de base au total.\nCritique : 10 dommages par élément, 50 de base au total.",
  }];
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
    const record = toSpellRecord(breed.shortName.fr, spell, level);
    records.push(record, ...extraSpellRecords(breed.shortName.fr, spell, record));
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
