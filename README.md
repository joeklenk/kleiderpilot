# KleiderPilot – Multi-Device 0.9.1

Diese Version basiert auf der fachlich getesteten 0.8 und ist für GitHub Pages/PWA auf PC, iPad und iPhone vorbereitet.

## Änderungen gegenüber 0.9

- Startdatei ist `index.html` (GitHub Pages/PWA).
- Button **10 Testartikel laden** entfernt.
- **Importieren** entfernt.
- **Exportieren** entfernt.
- PWA-Manifest und Service Worker auf `index.html` angepasst.
- Hinweis ergänzt, dass Fotos über den System-Dateidialog auch aus OneDrive ausgewählt werden können.

## OneDrive-Bilderordner

Unter Windows kann beim Auswählen von Bildern der synchronisierte Ordner genutzt werden, z. B. `OneDrive\Dokumente\Vinted\Bilder`. Auf iPhone/iPad kann derselbe Cloud-Ordner über die Dateien-App bzw. den Dateiauswahldialog und den Speicherort **OneDrive** geöffnet werden.

Wichtig: KleiderPilot speichert nach der Auswahl eine komprimierte Kopie des Fotos lokal in der Browser-Datenbank. Der Artikelbestand wird in 0.9.1 noch nicht automatisch zwischen Geräten synchronisiert.

## GitHub Pages

Repository-Inhalt direkt in den Root hochladen und unter **Settings → Pages → Deploy from a branch → main → /(root)** veröffentlichen.
