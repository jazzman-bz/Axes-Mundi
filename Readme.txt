

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
  - Richtig gelegte Karten bringen je nach Kartenschwierigkeit 10 (easy), 20 (medium), 30 (hard) oder 40 (expert) Basispunkte.
  - Fehlzüge und Zeitablauf bringen keine Punkte. Wer zuerst alle Handkarten loswird, gewinnt.
- Extras:
  - Lerninfos & Quellenlinks
  - Power-Ups (Multiplayer)
  - Highscores, Medaillen, Trophäen

### Gegen KI

| Stufe | Zugzeit | Startkarten der KI | Fehlerchance pro KI-Zug | Punktemultiplikator |
| --- | ---: | ---: | ---: | ---: |
| Leicht | 30 s | 7 | 20 % | ×1,00 |
| Mittel | 20 s | 6 | 10 % | ×1,20 |
| Schwer | 10 s | 5 | 5 % | ×1,50 |

Bei jeder richtig gelegten Karte werden ihre Basispunkte sofort mit der gewählten KI-Stufe multipliziert. Eine schwere Karte bringt zum Beispiel 30 Punkte auf Leicht, 36 auf Mittel und 45 auf Schwer. Der während der Partie angezeigte Punktestand wird am Ende auch bei einer Niederlage dem Profil gutgeschrieben. Im Hotseat gelten die Basispunkte. Der Lernmodus vergibt keine Punkte.

Der Mensch beginnt mit fünf Karten. Die KI wählt eine Handkarte zufällig und zieht pro Zug erneut das Los für einen Fehler. Bei einem Fehler nimmt sie eine benachbarte falsche Lücke. Gleichwertige Lücken zählen als richtig. Gibt es keine falsche Lücke, spielt die KI korrekt.

Eine falsch gelegte Karte wird rot markiert und abgelegt. Die KI zieht eine Ersatzkarte, bei Bedarf aus dem wiederverwendeten Ablagestapel, und gibt den Zug an den Menschen zurück. Ein Fehlzug kann die KI-Hand nicht leeren und keinen Sieg auslösen.

Die Kacheln und die Spiellogik lesen dieselben Werte aus `app/renderer/data/aiDifficulty.ts`.

## Techstack

- Electron – Cross-Plattform Desktop-App (Windows, macOS, Linux)
- Electron Main/Preload/Renderer – Prozessgrenzen mit sicherer `contextBridge`-API
- Vite – ultraschnelles Dev- & Build-Tool
- PixiJS – 2D WebGL Renderer für Spielbrett, Karten & Animationen
- GSAP – Tweening & Animationen (z. B. Karten-Flip, Einfügen, Shake bei Fehlern)
- TypeScript – Striktes Typensystem  
- Zod – Validierung für Deck-Import, IPC und LAN-Protokoll  
- WS (WebSockets) – LAN-Multiplayer  
- Pino – strukturierte Logs
- Vitest – Unit-Tests für Rendering, State, Scoring und neue Sicherheits-/Protokoll-Helfer  
- Playwright – E2E-/UI-Tests für zentrale Flows
- Electron Builder – Packaging für Desktop-Releases

## Projektstruktur

```text
app/
  generated/       # generierte Versionsmetadaten
  main/            # Electron main process: Fenster, IPC, Deck-Import, LAN-Server
  preload/         # sichere Bridge als window.AXM
  renderer/        # Vite-Projekt mit Landing Page, Spiel, LAN-Views, Assets
    data/          # Deck-Loader, Scoring, Datenmodelle
    game/          # Card und GameScene
    content/       # gebündelte Decks, Sounds, Musik, Bilder
    styles/        # CSS
    utils/         # Rendering, Input, State, Audio, Session, Dialoge, Helpers
  shared/          # gemeinsame Schemas und Sicherheits-Helfer
tests/unit/        # Vitest Unit-Tests
```

## Architektur

- `app/main/index.ts` erstellt das Electron-Fenster, registriert IPC-Handler, importiert Deck-ZIPs, stellt User-Deck-Bilder über `user-deck-image://` bereit und startet den LAN-WebSocket-Server.
- `app/preload/index.ts` kapselt `ipcRenderer` und gibt dem Renderer nur die typisierte `window.AXM`-API.
- `app/renderer/main.ts` enthält `AxesMundiApp` als Orchestrator für die Spielmodule. Die Spiellogik ist in fokussierte Manager ausgelagert, z. B. `GameRenderer`, `InputHandler`, `GameStateManager`, `CardPlacementHandler`, `CardDealerManager`, `TurnTimerManager`, `UIDialogManager`, `LearningModeManager` und `BoardNavigationManager`.
- `app/shared/deckSecurity.ts` und `app/shared/lanProtocol.ts` validieren Deck-Importe, Asset-Pfade, LAN-Nachrichten und IPC-/State-Payloads mit Zod.
- `app/renderer/utils/sessionStore.ts` bündelt zentrale Renderer-Session-/LAN-Werte statt verteilter `localStorage`-Zugriffe.
- `app/renderer/utils/accountScoreStore.ts` speichert Account-Scores im Browser-/localhost-Fallback mit derselben Score-Transaktionslogik wie der Electron-IPC-Pfad.


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
- Karten der Schwierigkeit `expert` zählen jetzt 40 Basispunkte statt des Fallbacks von 10; das Import-Schema akzeptiert `expert`.
- Erfolgsmeldung und Lade-Overlay der Landing Page werden ohne `innerHTML` aufgebaut, damit importierte Deck-Namen kein HTML einschleusen können.
- Die ungenutzte Deck-Kopie unter `app/renderer/assets/decks` wurde entfernt (sechs Dateien identisch, das deutsche Gebäude-Deck dort veraltet); Decks liegen nur noch in `app/renderer/content/decks`.
- Hotseat-Hände werden bei einer Fenstergrößenänderung jetzt mitskaliert und neu angeordnet.
- Importierte Deck-Kacheln werden im Renderer jetzt über sichere DOM-Erzeugung statt HTML-Interpolation aufgebaut.
- LAN-Nachrichten und IPC-Payloads werden zentral über gemeinsame Schemas geprüft.
- Ein zentraler `sessionStore` bündelt den wichtigsten Renderer-Session-State fuer LAN und wird jetzt auch von `lan-client` und `GameScene` genutzt.
- Account-Scores werden im Electron-Betrieb über IPC gespeichert und im Browser-/localhost-Fallback über `accountScoreStore`, damit Tests und In-App-Browser-Flows denselben Fortschritt anzeigen.
- Eine Regression im LAN-Client wurde behoben, sodass `cardPlacement`-Nachrichten nicht mehr doppelt an den Renderer-Callback weitergereicht werden.
- LAN- und GameScene-Hotspots verwenden jetzt strukturierte Logger-Pfade statt direkter `console.*`-Ausgaben.
- Der Repo-Lint laeuft jetzt ohne Fehler und ohne Warnungen durch.
- Die ESLint-Regeln wurden dabei auf signalstarke Checks fuer diese Canvas-/Electron-Codebasis zugeschnitten, statt Legacy-Hotspots nur formell umzuschreiben.
- Aktuell abgesichert durch `npm run lint`, `npm run typecheck` und `npm test` mit 32 Testdateien / 514 Tests.
- Der gebaute Electron-Bundle wurde zusaetzlich Ende-zu-Ende ueber den Singleplayer-Kernfluss bis ins Spiel gestartet und per Screenshot verifiziert.

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

Karten können `difficulty` auf `easy`, `medium`, `hard` oder `expert` setzen (10/20/30/40 Basispunkte); ohne Angabe gelten 10 Punkte.

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
