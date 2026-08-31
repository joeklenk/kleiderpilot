# KleiderPilot 0.10.2 – Geräte-Synchronisierung ohne Login

Diese Version baut auf 0.10 auf, entfernt aber den sichtbaren E-Mail-/Passwort-Login. Jedes Gerät bekommt im Hintergrund eine anonyme Supabase-Sitzung. Mehrere Geräte werden einmalig über einen 16-stelligen Gerätecode mit demselben KleiderPilot-Bestand gekoppelt.

## Vor dem GitHub-Upload

1. In Supabase **Authentication → Settings / General configuration** die Option **Allow anonymous sign-ins** aktivieren.
2. Im **SQL Editor** die Datei `setup/supabase_setup.sql` vollständig ausführen.
3. Erst danach die Dateien dieser Version nach GitHub hochladen.

Das SQL ist nicht destruktiv: die Tabellen und der Storage-Bucket aus 0.10 bleiben bestehen. 0.10.2 nutzt neue, gemeinsame Workspace-Tabellen und einen neuen privaten Bilder-Bucket.

## Erstes Gerät

- KleiderPilot öffnen.
- `Dieses Gerät einrichten` wählen.
- Vorhandene lokale Artikel bleiben erhalten und werden beim ersten Sync hochgeladen.
- Danach wird automatisch ein Gerätecode angezeigt.

## iPad / iPhone / weiterer PC

- KleiderPilot öffnen.
- `Weiteres Gerät` wählen.
- Den Gerätecode vom bereits verbundenen Gerät eingeben.
- Danach wird der gemeinsame Artikelbestand geladen und automatisch synchronisiert.

## Im Alltag

Es gibt keinen sichtbaren Login mehr. KleiderPilot synchronisiert beim Speichern, beim erneuten Öffnen/Fokussieren, alle 30 Sekunden solange die App sichtbar ist und über den Button `Synchronisieren`.

Der Gerätecode kann jederzeit über `Gerät verbinden` angezeigt werden. Wer den Code kennt, kann ein weiteres Gerät mit dem Bestand koppeln. Deshalb den Code privat behandeln.

## OneDrive

Der OneDrive-Ordner kann weiterhin als Original-Bildarchiv genutzt werden. Für die geräteübergreifende Anzeige werden die ausgewählten Artikelbilder zusätzlich in den privaten Supabase-Storage hochgeladen.

## GitHub Pages / Cache

Der Service Worker arbeitet network-first und verwendet einen neuen Cache-Namen `kleiderpilot-0.10.2-shell-v1`, damit Updates auf PC/iPad/iPhone zuverlässiger geladen werden.
