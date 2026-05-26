# Notes projet - Dofus relances et calculateur

## Structure actuelle

- `index.html` : page dediee au suivi des relances.
- `calculateur.html` : page dediee au calcul de degats.
- `app.js` : donnees Ecaflip actuelles, logique de relance et formule de degats.
- `styles.css` : theme sombre, navigation, tableaux et couleurs elementaires.

## Formule de degats retenue

1. Degats bruts :
   `floor(jet * (puissance + caracteristique + 100) / 100 + fixes)`

2. Fixes :
   `Dommages + Dommages elementaires + Dommages critiques si critique`

3. Resistances :
   `floor((degats bruts - res fixe elementaire - res fixe sort/arme - res crit si critique) * (100 - res % elementaire) / 100)`

4. Multiplicateurs finaux :
   `% dommages subis`, `% dommages finaux`, `% dommages sort/arme`, `% dommages distance/melee`, portail, redirection.

5. Zone :
   si `Sort de zone = Oui`, appliquer `(10 - eloignement) / 10`.

## Meilleur element

Si le sort est marque `Meilleur element` et que `Element calcule = Auto`, le calculateur teste Terre, Feu, Air et Eau, puis retient l'element qui donne le plus gros resultat final.

## Couleurs elementaires

- Air : vert
- Terre / Force : jaune
- Feu : rouge
- Eau : bleu
- Neutre : gris

La couleur est appliquee au bloc de resultat entier, pas seulement au texte.

## Donnees

- Ecaflip : importe depuis le Google Sheet initial.
- Feca : premier import depuis DofusDB via `tools/import-dofusdb.mjs`.
  - `breedSpellsId` donne 22 sorts.
  - Des sorts supplementaires sont rattaches au `spellBreed` technique `4237`.
  - Total actuellement trouve pour Feca : 28 sorts, dont des doublons de nom comme `Bulle` et `Bouclier Feca`.
- Un filtre de classe est disponible sur les deux pages.
- Les notes de sorts sont affichees quand elles existent.
- Les champs PA/PO sont presents dans les donnees Feca, mais pas encore affiches dans l'interface principale.

## Source DofusDB

Les donnees Feca viennent de DofusDB. Une attribution est affichee en bas des pages :
`Donnees issues de DofusDB. Utilisation soumise a la LPNC-IA 1.0.`

Attention : les sorts de glyphes Feca remontent souvent comme regles speciales/notes plutot que comme degats directs exploitables. Ils devront probablement etre traites a part.
