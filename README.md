# KleiderPilot – Multi-Device 0.9

Version 0.9 basiert fachlich auf dem final getesteten Prototyp 0.8. Die Kernlogik für Artikel, Bilder, Preise, Status und Antwortvorschläge bleibt erhalten. Die Chrome-spezifische Speicherung wurde für die Web-/PWA-Nutzung um IndexedDB erweitert.

## Zielgeräte

- Windows / macOS im Browser
- iPad und iPhone über Safari
- Installation als PWA über „Zum Home-Bildschirm“

## Datenübernahme aus 0.8

1. In KleiderPilot 0.8 auf **Exportieren** klicken.
2. Die erzeugte JSON-Sicherung auf OneDrive oder iCloud Drive speichern.
3. KleiderPilot 0.9 öffnen.
4. **Importieren** wählen und die JSON-Datei auswählen.
5. Import bestätigen.

Die Speicherung ist lokal pro Gerät. OneDrive kann Quellcode, ZIPs und Sicherungen speichern, synchronisiert aber nicht automatisch den laufenden Artikelbestand zwischen Geräten.

## iPad / iPhone

Eine PWA muss über HTTPS bereitgestellt werden. Nach dem Deployment die URL in Safari öffnen und **Teilen → Zum Home-Bildschirm** wählen. Anschließend startet KleiderPilot wie eine eigenständige App.

## Lokal testen

Zum Testen am PC kann ein einfacher lokaler Webserver verwendet werden, z. B. mit Python:

```powershell
cd KleiderPilot-0.9-MultiDevice
python -m http.server 8080
```

Dann `http://localhost:8080/dashboard.html` öffnen.

## Entwickler-Tests

```powershell
npm test
```
