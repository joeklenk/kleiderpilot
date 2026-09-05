# KleiderPilot 1.1.4 – Löschoptionen + Sammelimport

KleiderPilot 1.1.4 baut rückwärtskompatibel auf 1.1.3 auf. Sammelimport, Einzelimport, bestehende Artikel, Bilder, Preise, Status, Artikelnummern, Gerätekopplung und Supabase-Workspace bleiben erhalten.

## Neu in 1.1.4

Beim Klick auf **„Löschen“** gibt es jetzt zwei klar getrennte Varianten:

1. **Nur löschen & beibehalten**
   - entspricht der bisherigen Löschfunktion;
   - Status wird `Gelöscht`;
   - der Artikel bleibt durchgestrichen im Bestand;
   - die Artikelnummer bleibt belegt;
   - der Artikel kann über **„Wiederherstellen“** zurückgeholt werden.

2. **Endgültig löschen**
   - entfernt den Artikel aus dem lokalen Bestand;
   - entfernt den Datensatz mit seiner ID aus dem verbundenen Supabase-Bestand;
   - entfernt die zugehörigen Cloud-Bilder, soweit vorhanden;
   - die Artikelnummer wird anschließend wieder frei und kann bei einem neuen/importierten Artikel erneut vergeben werden;
   - kann nicht rückgängig gemacht werden.

Auch bei bereits durchgestrichenen Artikeln steht jetzt neben **„Wiederherstellen“** die Aktion **„Endgültig löschen“** zur Verfügung. Damit lassen sich insbesondere Testimporte vollständig entfernen.

### Schutz vor versehentlichem Löschen

- Die erste Löschabfrage zeigt beide Varianten und erklärt den Unterschied.
- Für **„Endgültig löschen“** folgt zusätzlich eine zweite Sicherheitsbestätigung.
- Endgültiges Löschen ist nur online möglich, damit lokaler Bestand und Cloud nicht auseinanderlaufen.
- Schlägt das Löschen in Supabase fehl, bleibt der Artikel lokal erhalten und KleiderPilot zeigt die Fehlermeldung an.

### Synchronisierung nach endgültigem Löschen

1.1.4 markiert erfolgreich synchronisierte lokale Artikel intern. Fehlt ein solcher Datensatz später in der Cloud, wird er auf einem zweiten Gerät nicht erneut hochgeladen, sondern auch dort entfernt. Für diesen Schutz sollten alle verbundenen Geräte auf **1.1.4** aktualisiert und mindestens einmal synchronisiert worden sein, bevor endgültige Löschungen durchgeführt werden.

## Sammelimport aus 1.1.3 bleibt erhalten

- Einzel- und Sammelimport funktionieren unverändert.
- Bis zu 100 Artikel pro Sammeldatei.
- Automatische Vergabe der nächsten freien Artikelnummern.
- Importübersicht mit Prüfung und Sammelspeicherung als Entwurf.
- Vinted bleibt manuell.

## Update auf 1.1.4

1. Inhalt von `KleiderPilot-1.1.4-DEPLOY` in das bestehende GitHub-Pages-Repository übernehmen.
2. Deployment abwarten.
3. Am PC KleiderPilot einmal mit `Strg + F5` neu laden.
4. Auf iPad/iPhone App bzw. Seite vollständig neu öffnen.
5. Auf **allen verbundenen Geräten** einmal prüfen, dass `☁ Synchronisiert` erscheint.
6. Erst danach die neue Funktion **„Endgültig löschen“** verwenden.

Für die Frontend-Datenstruktur ist kein Reset erforderlich. Die Funktion verwendet einen echten `DELETE` auf `kleiderpilot_items_shared`; die bestehende Supabase-RLS muss dem verbundenen Workspace das Löschen erlauben. Falls beim ersten Test eine Berechtigungsfehlermeldung erscheint, muss die DELETE-Policy einmalig ergänzt werden.

## Release-Stand

- Version: **1.1.4**
- Basis: KleiderPilot 1.1.3
- Sammelimport: ja
- Löschvarianten: Soft Delete + endgültiges Löschen
- Plattformen: PC / iPad / iPhone
- Synchronisierung: Supabase / bidirektional
- PWA-Cache: `kleiderpilot-1.1.4-shell-v1`
- Produktiv-Reset: nein
