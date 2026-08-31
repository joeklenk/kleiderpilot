# KleiderPilot – Cloud Sync 0.10

Diese Version basiert auf der fachlich getesteten 0.8/0.9.1 und ergänzt eine gemeinsame Supabase-Cloud für PC, iPad und iPhone.

## Was 0.10 synchronisiert

- Artikelbestand und Status
- Preise und Vinted-Daten
- Beschreibungen und alle Artikelfelder
- Artikelfotos (privater Supabase Storage)
- Änderungen zwischen PC, iPad und iPhone

Die lokale IndexedDB bleibt als Geräte-Kopie erhalten. Beim ersten Login werden vorhandene lokale Artikel mit der Cloud zusammengeführt. Danach wird nach Änderungen, beim Öffnen/Fokussieren und regelmäßig synchronisiert.

## 1. Supabase vorbereiten

1. Supabase-Projekt `KleiderPilot` öffnen.
2. Links **SQL Editor** öffnen.
3. **New query** wählen.
4. Inhalt aus `setup/supabase_setup.sql` vollständig einfügen.
5. **Run** ausführen.

Das Skript erstellt:
- Tabelle `kleiderpilot_items`
- Row Level Security (RLS)
- privaten Bucket `kleiderpilot-images`
- Zugriffsregeln, damit jeder eingeloggte Nutzer nur seine eigenen Daten und Bilder sehen kann.

## 2. Benutzerkonto anlegen

In Supabase:

**Authentication → Users → Add user**

E-Mail und Passwort festlegen. Für die persönliche Nutzung kann derselbe Benutzer anschließend auf PC, iPad und iPhone verwendet werden.

Keinen Secret-/service_role-Key in KleiderPilot eintragen oder veröffentlichen.

## 3. GitHub Pages aktualisieren

Den Inhalt dieses Ordners in den Root des bestehenden GitHub-Repositories `kleiderpilot` hochladen und **Commit changes** ausführen.

GitHub Pages bleibt:

- Deploy from a branch
- Branch: `main`
- Ordner: `/(root)`

## 4. Erster Sync – Reihenfolge empfohlen

Wenn auf dem PC bereits dein wichtigster Artikelbestand liegt:

1. Zuerst 0.10 am PC öffnen.
2. Mit dem Supabase-Benutzer anmelden.
3. Warten, bis oben `☁ Synchronisiert` erscheint.
4. Erst danach iPad/iPhone öffnen.
5. Dort mit demselben Benutzer anmelden.

So wird der PC-Bestand zuerst in die Cloud geladen und anschließend auf die anderen Geräte gezogen.

## 5. Bilder aus OneDrive

Der Ordner `OneDrive\Dokumente\Vinted\Bilder` kann weiterhin als Original-Bildarchiv genutzt werden. Beim Artikel-Anlegen wählst du die Fotos über den Dateidialog aus OneDrive aus. KleiderPilot speichert eine komprimierte App-Kopie lokal und zusätzlich im privaten Supabase-Bucket, damit sie auf anderen Geräten sichtbar ist.

## Updates / Cache

0.10 verwendet für die App-Dateien eine Network-first-Strategie. Dadurch sollten neue GitHub-Versionen künftig deutlich zuverlässiger automatisch geladen werden. Falls ein Gerät noch 0.9.1 zeigt, Browser-/PWA-Cache einmal löschen bzw. den alten Service Worker entfernen und neu öffnen.
