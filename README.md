# KleiderPilot 1.1.1 – Formatierungs-Patch

KleiderPilot 1.1.1 baut rückwärtskompatibel auf der freigegebenen 1.1-Produktivversion auf. Artikelbestand, Bilder, Preise, Status, Artikelnummern, persönliche Anmerkungen, Geräte-Kopplung und Supabase-Workspace bleiben vollständig erhalten.

## Neu in 1.1.1

Die Vinted-Beschreibung wird übersichtlicher gegliedert:

- Basisdaten (Marke, Artikelart, Modell/Besonderheit, Größe, Farbe, Material) stehen zusammen.
- Danach folgt – falls vorhanden – **„Weitere Details“** als eigener Block mit Leerzeile davor und danach.
- **Zustand** und **Mängel/Besonderheiten** bilden anschließend einen gemeinsamen Block.
- Bei **„Mängel/Besonderheiten“** wird kein Punkt automatisch am Ende gesetzt.
- Die Maße-Überschrift lautet nur noch **„MAẞE“**.
- Maße werden nicht als Satz behandelt und erhalten keinen automatisch gesetzten Punkt.
- Bei Maßeinheiten wird ein Leerzeichen zwischen Zahl und Einheit sichergestellt, z. B. `50cm` → `50 cm`.
- Die persönliche Anmerkung bleibt direkt unter dem Titel.

## Update von 1.1 auf 1.1.1

1. Den Inhalt des Deploy-Pakets in das bestehende GitHub-Pages-Repository hochladen.
2. Commit abwarten.
3. Am PC KleiderPilot öffnen und einmal `Strg + F5` ausführen.
4. Auf iPad/iPhone die App bzw. Seite neu öffnen.
5. Prüfen, dass oben `☁ Synchronisiert` erscheint.

**Kein Produktiv-Reset:** 1.1.1 löscht oder verändert keine vorhandenen Artikel automatisch.

## Supabase

Für 1.1.1 ist **keine SQL-Änderung** erforderlich. Das Datenmodell bleibt unverändert.

## Release-Stand

- Version: **1.1.1**
- Basis: KleiderPilot 1.1 Produktivversion
- Plattformen: PC / iPad / iPhone
- Synchronisierung: Supabase / bidirektional
- PWA-Cache: `kleiderpilot-1.1.1-shell-v1`
- Sichtbarer Login: nein
