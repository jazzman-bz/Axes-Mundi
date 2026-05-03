

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
- Zod – Validierung für Deck-Import, IPC und LAN-Protokoll  
- WS (WebSockets) – LAN-Multiplayer  
- Vitest – Unit-Tests für Rendering, State, Scoring und neue Sicherheits-/Protokoll-Helfer  

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
  /shared      # gemeinsame Schemas und Sicherheits-Helfer  
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

## Aktueller Fokus
	
- Deck-Importe werden jetzt über Zod validiert und auf sichere IDs/Pfade begrenzt.
- Importierte Deck-Kacheln werden im Renderer jetzt über sichere DOM-Erzeugung statt HTML-Interpolation aufgebaut.
- LAN-Nachrichten und IPC-Payloads werden zentral über gemeinsame Schemas geprüft.
- Ein zentraler `sessionStore` bündelt den wichtigsten Renderer-Session-State fuer LAN und wird jetzt auch von `lan-client` und `GameScene` genutzt.
- Eine Regression im LAN-Client wurde behoben, sodass `cardPlacement`-Nachrichten nicht mehr doppelt an den Renderer-Callback weitergereicht werden.
- LAN- und GameScene-Hotspots verwenden jetzt strukturierte Logger-Pfade statt direkter `console.*`-Ausgaben.
- Die aktiven Lint-Hotspots in `app/main/websocket-server.ts` und `app/renderer/lan-client.ts` wurden bereinigt; dort verbleiben aktuell nur noch wenige Warnungen statt blockierender Fehler.
- Aktuell abgesichert durch `npm run typecheck` und `npm test` mit 26 Testdateien / 472 Tests.

## Beispiel-Deck (JSON)

```json
{
  "id": "buildings-height-de",
  "name": "Gebäude – Höhe",
  "description": "Ordne berühmte Bauwerke nach ihrer Höhe von kleinen Wahrzeichen bis zu gewaltigen Wolkenkratzern.",
  "axis": "height",
  "theme": "architecture",
  "locale": "de",
  "version": "1.0.0",
  "imageFolder": "Buildings JPG",
  "cards": [
    {
      "id": "great-wall-watchtower",
      "title": "Chinesische Mauer (Wachturm)",
      "axis": "height",
      "value": 10,
      "unit": "m",
      "displayValue": "10 m",
      "image": "Great Wall of China (Watchtower) – China – 10",
      "facts": ["Wachtürme der Chinesischen Mauer erreichten Höhen von 8-12 Metern."],
      "sources": [
        { "label": "UNESCO", "url": "https://whc.unesco.org/en/list/438/" }
      ],
      "difficulty": "easy"
    }
  ]
}
```

## Deck-Import (ZIP)

Importierbare Decks werden als ZIP-Paket mit folgendem Aufbau erwartet:

```text
my-deck.zip
  deck.json
  images/
    image-1.png
    image-2.jpg
```

Empfohlene Felder in `deck.json`:
- `id`
- `name`
- `description`
- `axis`
- `theme`
- `locale`
- `version`
- `imageFolder`
- `cards`

`description` ist optional, wird aber empfohlen. Wenn sie fehlt, erzeugt die App fuer importierte Deck-Kacheln einen generischen Fallback-Text.

## Versionierung

Die Landing Page zeigt die aktuell laufende Software-Version unten rechts an.

- Release-Version kommt aus `package.json`
- Build-Identitaet kommt aus Git:
  - Commit-Kurzhash
  - Branch
  - Build-Zeitpunkt
  - `dirty`-Status bei uncommitteten Aenderungen

Anzeigeformat:

```text
v1.0.0 (2a953e1)
v1.0.0 (2a953e1, dirty)
```

Die Build-Metadaten werden vor `dev`, `build`, `build:main`, `build:preload` und `vite:build` automatisch durch `scripts/generate-version.js` erzeugt und in `app/generated/version.ts` geschrieben.

Wichtig fuer Electron-Packages:
- `electron:build` muss `build:main` und `build:preload` vor `vite:build` und `electron-builder` ausfuehren
- sonst landet ein aktueller Renderer-Build zusammen mit veralteten Versionsmetadaten aus `dist/main` oder `dist/preload` im Paket
- `dirty` ist nur dann `false`, wenn beim Build keine uncommitteten Git-Aenderungen im Arbeitsbaum liegen

Regel fuer die Pflege:
- `package.json` nur bei echten Releases erhoehen
- jeder Build bleibt ueber den Commit-Hash einem konkreten Stand zuordenbar
- lokale Builds mit offenen Aenderungen werden als `dirty` markiert

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
