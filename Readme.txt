

# Axes-Mundi

Ein edukatives Sortierspiel, inspiriert von Timeline, erweitert um verschiedene Achsen (Zeit, Höhe, Masse, Distanz, Temperatur, Komplexität …).  
Entwickelt mit Electron + Vite + PixiJS + GSAP.

## Spielidee

- Ziel: Karten richtig entlang einer Achse einsortieren.
- Achsen: Zeit, Höhe, Masse, Distanz, Temperatur, Komplexität, …
- Spielmodi:
  - Singleplayer (gegen die Uhr)
  - Hotseat (lokal, Zug-wechselnd)
  - LAN-Multiplayer
  - Lernmodus (ohne Zeitdruck, mit Erklärungen)
- Bewertung:
  - korrekt → Punkte & Zeitbonus
  - knapp daneben → halbe Punkte
  - falsch → Zeitverlust & Fehlerzähler
- Extras:
  - Lerninfos & Quellenlinks
  - Power-Ups (Multiplayer)
  - Highscores, Medaillen, Trophäen

## Techstack

- Electron – Cross-Plattform Desktop-App (Windows, macOS, Linux)  
- Vite – ultraschnelles Dev- & Build-Tool  
- PixiJS – 2D WebGL Renderer für Spielbrett, Karten & Animationen  
- GSAP – Tweening & Animationen (z. B. Karten-Flip, Einfügen, Shake bei Fehlern)  
- TypeScript – Striktes Typensystem  
- State Machine (XState) – sauberer Spielfluss  
- WS (WebSockets) – LAN-Multiplayer  
- Vitest + Playwright – Testing  

## Projektstruktur

/app  
  /main        # Electron main process (Host, LAN)  
  /preload     # sichere Bridges (IPC)  
  /renderer    # Vite-Projekt mit Pixi, GSAP, UI  
    /game      # Szenen, FSM  
    /ui        # Menüs, HUD, Dialoge  
    /data      # Models & Normalizer  
    /content   # Decks (JSON), Lokalisierungen  
    /net       # Multiplayer-Client  
    /utils  
/tests         # Vitest + Playwright  


## Entwicklungsregeln

- Clean Code: TypeScript strict, ESLint, Prettier  
- PR-Workflow: Feature-Branches → Pull Request → Review  
- Kleine PRs: < 300 Zeilen, mit GIF/Screenshot im PR  
- State-First: Spiellogik als Events & States, nicht in der UI verstecken  
- Tests:
  - Vitest (Unit für Scoring, Insert-Checks)
  - Playwright (E2E für Game Flow)
- Content-Qualität:
  - Decks als JSON, Schema-Validierung
  - Jede Karte mit Quelle(n)
  - Fakten-Check im Review-Prozess  

## Beispiel-Deck (JSON)

```json
{
  "id": "space-height-de",
  "name": "Raumfahrt – Höhe",
  "axis": "height",
  "theme": "tech",
  "locale": "de",
  "version": "1.0.0",
  "cards": [
    {
      "id": "saturn-v",
      "title": "Saturn V",
      "axis": "height",
      "value": 110.6,
      "unit": "m",
      "displayValue": "110,6 m",
      "image": "saturn_v",
      "facts": ["Trug Apollo 11 zum Mond."],
      "sources": [
        { "label": "NASA", "url": "https://www.nasa.gov/" }
      ],
      "difficulty": "easy"
    }
  ]
}

Roadmap (MVP → Final)

Sprint 1: Singleplayer, Karten einsortieren, Reveal & Scoring

Sprint 2: Lernmodus, Highscores, Hotseat

Sprint 3: LAN-Multiplayer, Power-Ups, Medaillen

Sprint 4: Custom Deck Builder, Modding-Support

Lizenz

MIT License – frei nutzbar & erweiterbar.

Credits

Projektidee & Umsetzung: Jochen Hagen
Engine: PixiJS, GSAP, Electron, Vite
Inspiration: Timeline (Asmodee)