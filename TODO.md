# Axes-Mundi TODO

**Last Updated:** 2026-03-15
**Purpose:** Bereinigte, verifizierte Aufgabenliste auf Basis von Code-Stand, Tests und Tooling-Checks

## Verifiziert erledigt

- Landing-Page-Flow mit Spielerprofil, Avatarwahl, Spielmodus-Auswahl und Deck-Auswahl
- Spielmodi Singleplayer, Learning Mode, Hotseat und LAN
- Deck-Import aus ZIP und Laden von User-Decks
- Versionsanzeige auf der Landing Page
- Modulare Renderer-Architektur mit den Refactoring-Schritten 1-16
- Umfangreiche Unit-Test-Abdeckung fuer Core-Module
- Sound-Integration fuer Landing Page, Spiel und Dialoge

## Sofort angehen

### 1. Baseline wieder gruen bekommen
- [x] `npm run typecheck` reparieren
  - Renderer-/LAN-Typfehler, doppelte Implementierungen und offensichtliche API-Brueche bereinigt
  - `unknown`-/Timer-/Property-Probleme im akuten Fehlerpfad entfernt
- [x] Test-Suite wieder voll gruen machen
  - `tests/unit/gameInitializer.test.ts` an die `localStorage`-Nutzung in [`gameInitializer.ts`](/Users/jazzman/Code/Axes-Mundi/app/renderer/utils/gameInitializer.ts#L226) angepasst
  - Ziel erreicht: `npm test` ist wieder voll gruen
- [ ] Lint-Strategie bereinigen
  - [x] Generated File [`version.ts`](/Users/jazzman/Code/Axes-Mundi/app/generated/version.ts) generator-konform schreiben und aus globalem Lint-Rauschen nehmen
  - [x] `vitest.config.ts` aus dem fehlerhaften typed-lint-Pfad nehmen
  - [ ] CRLF/LF-Problem in betroffenen Dateien vereinheitlichen
  - [ ] echten Lint-Restbestand in `app/main/index.ts`, `app/main/websocket-server.ts` und Legacy-Renderer-Dateien priorisieren

### 2. LAN-Code stabilisieren
- [x] Doppelte Methoden und API-Brueche im LAN-Stack beheben
  - doppelte `isConnected()`-Implementierung in [`lan-client.ts`](/Users/jazzman/Code/Axes-Mundi/app/renderer/lan-client.ts#L530) entfernt
  - fehlende `disconnect()`-API fuer [`lan-game-main.ts`](/Users/jazzman/Code/Axes-Mundi/app/renderer/lan-game-main.ts) nachgezogen
- [ ] Debug-Logging im LAN-Pfad reduzieren
  - [x] Startup-/Connection-Lifecycle in `lan-game.ts`, `lan-game-main.ts` und `lan-client.ts` auf strukturierten Logger umstellen
  - [ ] verbleibende Gameplay-/Sync-Diagnosepunkte in `lan-game-main.ts` und `websocket-server.ts` gezielt abbauen
  - [ ] nur gezielte Diagnosepunkte behalten
- [ ] LAN-Flows durch Integrations- oder E2E-Tests absichern
  - Join
  - Deck-Verteilung
  - Zugwechsel
  - Spiel-Neustart

### 3. Dokumentation und Planung korrigieren
- [ ] `Readme.txt`, `ARCHITECTURE.md` und `COMPLETED.md` gegen den realen Stand angleichen
  - TypeScript ist zwar `strict`, aber die Codebasis ist aktuell nicht typecheck-clean
  - "alle Tests gruen" ist veraltet
  - XState ist als Dependency vorhanden, aber aktuell nicht produktiv im App-Code verankert
- [ ] Historische Bugs verifizieren und danach schliessen oder neu formulieren
  - Electron White Screen
  - Port-5179-Konflikte

## Kurzfristig sinnvoll

### UX und Bedienbarkeit
- [ ] Tastaturbedienung systematisch einfuehren
  - aktuell gibt es praktisch nur Enter-Support fuer das Server-IP-Feld in [`landing.js`](/Users/jazzman/Code/Axes-Mundi/app/renderer/landing.js#L309)
  - Navigationskarten, Avatar-Auswahl und Deck-Auswahl brauchen Keyboard- und Focus-Handling
- [ ] Sprachkonsistenz herstellen
  - UI ist derzeit gemischt deutsch/englisch
  - `lang="en"` in [`index.html`](/Users/jazzman/Code/Axes-Mundi/app/renderer/index.html#L2) passt nicht zur tatsaechlichen UI-Sprache
  - vor voller i18n-Einfuehrung erst eine klare Primarsprache definieren
- [ ] Responsive Verhalten nicht nur fuer Landing Page, sondern fuer das eigentliche Spiel pruefen
  - Landing Page hat bereits Media Queries in [`main.css`](/Users/jazzman/Code/Axes-Mundi/app/renderer/styles/main.css#L696)
  - fuer Canvas-/Spielansicht fehlt eine verifizierte Mobile-/Tablet-Abnahme
- [ ] Benutzerfreundliche Fehlermeldungen fuer Import-, LAN- und Startfehler vereinheitlichen

### Qualitaet und Wartbarkeit
- [ ] `any`-Hotspots priorisiert abbauen
  - zuerst Main/Preload/LAN-Grenzen
  - dann Renderer-State und Protokollnachrichten
- [ ] `main.ts` weiter entkoppeln
  - Datei ist trotz Refactoring noch gross und enthaelt viel Orchestrierung plus Legacy-Zustand
- [ ] Package-Manager-Entscheidung treffen
  - sowohl `package-lock.json` als auch `pnpm-lock.yaml` liegen im Repo
  - einen Weg festlegen und Doku/Skripte darauf ausrichten

## Danach

### Produkt-Features mit echtem Mehrwert
- [ ] Progress Tracking fuer Spielerstand einfuehren
- [ ] Spielerstatistiken sichtbar machen
- [ ] Settings-Menue fuer Sound und allgemeine Optionen bauen
- [ ] Accessibility-Verbesserungen nach einer echten Tastatur-/Screenreader-Pruefung umsetzen

### Performance und Beobachtbarkeit
- [ ] Echte Performance-Messung einfuehren
  - das Feld `fps` in [`main.ts`](/Users/jazzman/Code/Axes-Mundi/app/renderer/main.ts#L59) ist aktuell nur Ziel-/Loop-Steuerung, kein Monitoring
  - FPS, Startzeit und Speicherverbrauch messbar machen
- [ ] Speicher- und Cleanup-Audit machen
  - Event-Listener
  - Timer
  - Asset-Caches
- [ ] Produktionsrelevante Logs und Fehlerpfade definieren

## Vorerst nicht als aktive High-Priority fuehren

- State-Machine-Integration mit XState
  - erst wieder aufnehmen, wenn ein konkreter Fluss davon profitiert
- "React-style Error Boundaries"
  - die App ist hier nicht React-zentriert aufgebaut; Fehlerstrategie lieber passend zur aktuellen Architektur formulieren
- Achievements, Retention-Metriken und grosse Analytics-Ziele
  - erst sinnvoll, wenn Build-Stabilitaet, Tests und Kern-UX sauber sind

## Referenz: Stand der letzten lokalen Pruefung

### Checks
- `npm run typecheck` -> erfolgreich
- `npm test` -> 452 Tests bestanden, 0 Fehltests
- `npm run lint` -> fehlgeschlagen, sehr viele Bestandsprobleme

### Wichtigste Befunde
- TypeScript `strict` ist aktiv und die Codebasis ist lokal wieder `typecheck`-clean
- E2E-Script ist in `package.json` vorhanden, aber es gibt aktuell keine verifizierte Playwright-Konfiguration oder E2E-Suite im Repo
- Deck-Import ist bereits implementiert und sollte nicht mehr als offener Grundpunkt gefuehrt werden
- Responsive Design ist fuer die Landing Page teilweise vorhanden, fuer die eigentliche Spielansicht aber nicht belastbar abgeschlossen
- Lint ist weiterhin kein verlaesslicher Release-Gate; groesste Restbloecke liegen aktuell in `app/main/index.ts` und `app/main/websocket-server.ts`
