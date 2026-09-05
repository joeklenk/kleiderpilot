# KleiderPilot 1.1.5 – Vollständiger Stand

KleiderPilot 1.1.5 ist ein **vollständiges Deploy-Paket** auf Basis der stabilen 1.1.1-Version. Die zwischenzeitlichen Versionen 1.1.2, 1.1.3 und 1.1.4 müssen **nicht** separat veröffentlicht werden. Du kannst den kompletten Inhalt dieses Ordners direkt über deinen aktuellen GitHub-Pages-Stand kopieren.

Bestehende Artikel, Bilder, Preise, Status, Artikelnummern, persönliche Anmerkungen, Gerätekopplung und Supabase-Workspace bleiben erhalten. Es ist **kein lokaler Reset** erforderlich.

## Enthaltene Funktionen

### Bestehende Funktionen aus 1.1.1
- Artikel anlegen und bearbeiten
- bis zu 20 Fotos je Artikel, Reihenfolge/Hauptbild ändern
- Vinted-Entwurf mit Titel, Beschreibung, Kategorie und Sendungsgröße
- persönliche Anmerkung direkt unter dem Titel
- Preislogik: Untergrenze ≤ Zielpreis ≤ Listenpreis
- Artikelstatus: Entwurf, Auf Vinted gestellt, Verkauft, Versendet, Gelöscht
- Einstelldatum und Verkaufsdaten
- Antwort-Assistent für Verhandlungen
- Artikelbestand, Suche, Filter und Sortierung
- Synchronisierung über Supabase zwischen PC, iPad und iPhone

### Einzelimport
- Startseite: **Artikel importieren**
- Artikelmaske: **Artikeldatei importieren**
- JSON-Datei wird in die normale Artikelmaske geladen
- Fotos und Felder werden übernommen
- nächste freie Artikelnummer wird automatisch vergeben
- der Artikel wird **nicht automatisch veröffentlicht**
- vor dem Speichern kann alles manuell geprüft und geändert werden

### Sammelimport
- eine JSON-Datei kann bis zu 100 Artikel enthalten
- automatische Reservierung fortlaufender freier Artikelnummern
- Importübersicht mit Bild, Nummer, Artikel und Prüfstatus
- jeder Artikel kann über **Prüfen** einzeln in der Artikelmaske geöffnet werden
- vollständige Artikel können gesammelt als **Entwurf** gespeichert werden
- unvollständige Artikel werden als **Prüfung nötig** markiert
- fehlende Artikelart führt nicht mehr zum Abbruch der kompletten Sammeldatei

### Zwei Löschvarianten
Beim Klick auf **Löschen** erscheint ein eigener KleiderPilot-Dialog mit zwei Varianten:

1. **Nur löschen & beibehalten**
   - Status wird `Gelöscht`
   - Artikel bleibt durchgestrichen im Bestand
   - Artikelnummer bleibt belegt
   - Artikel kann wiederhergestellt werden

2. **Endgültig löschen**
   - zweite Sicherheitsstufe innerhalb des KleiderPilot-Dialogs
   - kein Browser-`OK/Abbrechen`-Dialog mehr
   - Datensatz wird aus Supabase gelöscht
   - Cloud-Bilder werden entfernt
   - lokaler Artikel wird entfernt
   - ID verschwindet vollständig aus dem Bestand
   - Artikelnummer wird wieder frei

Bereits soft-gelöschte Artikel besitzen ebenfalls **Endgültig löschen**.

## Wichtig für endgültiges Löschen

Endgültiges Löschen wird absichtlich nur **online** ausgeführt. Damit wird verhindert, dass der lokale Bestand gelöscht wird, während der Cloud-Datensatz bestehen bleibt.

Die bestehende Supabase-RLS muss `DELETE` auf `kleiderpilot_items_shared` für Mitglieder des jeweiligen Workspaces erlauben. Falls Supabase beim Test eine Berechtigungsfehlermeldung meldet, muss die DELETE-Policy im vorhandenen Supabase-Projekt ergänzt werden. Am Frontend-Datenmodell selbst ist keine Tabellenänderung erforderlich.

Vor dem ersten endgültigen Löschen sollten alle verbundenen Geräte 1.1.5 geladen und mindestens einmal synchronisiert haben. So erkennen andere Geräte einen zuvor synchronisierten, inzwischen in der Cloud fehlenden Artikel als endgültig gelöscht und laden ihn nicht erneut hoch.

## Cache-/Deployment-Fix in 1.1.5

1.1.5 verwendet konsequentes Cache-Busting (`?v=1.1.5`) für CSS, JavaScript und Manifest sowie einen neuen PWA-Cache:

`kleiderpilot-1.1.5-shell-v1`

Damit soll insbesondere verhindert werden, dass nach einem GitHub-Pages-Update noch `dashboard.js` aus 1.1.1 ausgeführt wird, während bereits eine neue `index.html` sichtbar ist.

Der Dateiimport wurde zusätzlich robuster gemacht: Vor jeder Auswahl wird der File-Input zurückgesetzt und – wenn vom Browser unterstützt – `showPicker()` verwendet.

## Update direkt von 1.1.1 auf 1.1.5

1. Den **gesamten Inhalt** von `KleiderPilot-1.1.5-DEPLOY` in dein GitHub-Pages-Repository kopieren.
2. Vorhandene Dateien vollständig ersetzen, insbesondere:
   - `index.html`
   - `dashboard.js`
   - `dashboard.css`
   - `cloud.js`
   - `storage.js`
   - `rules.js`
   - `listing.js`
   - `images.js`
   - `article-import.js`
   - `sw.js`
   - `app.webmanifest`
3. Commit + Push.
4. GitHub-Pages-Deployment abwarten.
5. PC: Seite einmal mit `Strg + F5` neu laden.
6. iPad/iPhone: App/Seite vollständig schließen und neu öffnen.
7. Oben muss **KleiderPilot 1.1.5** sichtbar sein.
8. Auf allen Geräten einmal synchronisieren.

## Schnelltest nach dem Deployment

1. **Artikel importieren** anklicken → Dateiauswahl muss sofort erscheinen.
2. `BEISPIEL-ARTIKELIMPORT.json` wählen → Artikelmaske muss geöffnet werden.
3. `BEISPIEL-SAMMELIMPORT.json` wählen → Importübersicht mit 2 Artikeln muss erscheinen.
4. Einen Testartikel speichern.
5. Beim Testartikel **Löschen** wählen → KleiderPilot-Dialog muss beide Löschvarianten anzeigen.
6. **Nur löschen & beibehalten** testen → Artikel bleibt durchgestrichen und kann wiederhergestellt werden.
7. Einen zweiten Testartikel **Endgültig löschen** → zweite KleiderPilot-Sicherheitsstufe erscheint; nach Bestätigung verschwindet der Artikel vollständig und seine Nummer wird wieder frei.

## Release-Stand

- Version: **1.1.5**
- Direkte Update-Basis: **1.1.1**
- Einzelimport: ja
- Sammelimport: ja, bis 100 Artikel
- Löschvarianten: Soft Delete + endgültiges Löschen
- Native Browser-Löschabfrage: nein
- Plattformen: PC / iPad / iPhone
- Synchronisierung: Supabase / bidirektional
- PWA-Cache: `kleiderpilot-1.1.5-shell-v1`
- Produktiv-Reset: nein
