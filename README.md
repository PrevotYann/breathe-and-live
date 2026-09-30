# Breathe and Live Foundry VTT System

Version 0.3.0 — Foundry VTT 14.368

French Demon Slayer / Breathe and Live system with Slayer, Demonist, Demon and NPC sheets, breathing techniques, combat reactions, progression, equipment, and the 1934 supplement.

Build with `npm install` then `npm run build`. Copy the contents of `dist/` into Foundry's `Data/systems/breathe-and-live/` folder.

## Install from a manifest URL (Foundry v14)

After the first GitHub release is published, open **Game Systems → Install System** in Foundry Setup and paste this into **Manifest URL**:

```text
https://github.com/PrevotYann/breathe-and-live/releases/latest/download/manifest.json
```

Click **Install**. The same URL supports future updates. The repository and release assets must be publicly accessible to your Foundry server.

To publish a release, commit and push the changes, then push a tag matching the version in `system.json`:

```sh
git tag v0.3.0
git push origin v0.3.0
```

The GitHub Actions release workflow runs the tests, builds the system and compendiums, and publishes `manifest.json`, `system.json`, and `breathe-and-live.zip`. For later releases, increment `system.json`'s version and update its versioned `download` URL before tagging. The build generates `dist/manifest.json` from the packaged `system.json`, so no second manifest needs manual maintenance. The ZIP contains the built files at its root; GitHub's automatic source-code ZIP is not an installable build.

See [V14 migration and validation](resources/rules/foundry-v14-migration.md) for upgrading an existing V12 world and running the browser smoke tests. Back up the world before Foundry performs its core migration.

## Fiches 0.3.0

Navigation avec icônes, en-tête persistant, thème ardoise et panneaux clairs. Les fiches s'adaptent à leur propre largeur ; les onglets passent en barre horizontale sur une petite fenêtre. La progression, la création, la santé et les références sont séparées. Les explications secondaires restent accessibles dans des sections dépliables. Les objets, armes, souffles, techniques et véhicules partagent les mêmes contrôles contrastés.

Les données, champs et actions existants sont conservés, sans migration supplémentaire. Voir le [périmètre et les vérifications](resources/rules/sheet-redesign.md). `npm run test:sheets` vérifie les fiches sur le monde isolé `bl-v14-qa` et produit des captures dans `tmp/sheet-previews/`.

## Référentiel de règles (version physique)

La transcription texte complète des règles de la version physique est incluse dans :

- `resources/rules/regles-physiques-v1.1.txt`
- `resources/rules/checklist-couverture-regles.md` (checklist de couverture)
