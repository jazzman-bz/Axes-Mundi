# 🔊 Sound Assets Setup Instructions

## Required Sound Files

Please place the following sound files in this directory:

1. ✅ **button_single_click.wav** - Button click sound effect
2. ✅ **card_shuffle_peak.wav** - Card shuffle/dealing sound effect

## Current Status

- ✅ `button_single_click.wav` - Installed
- ✅ `card_shuffle_peak.wav` - Installed

## Sound Implementation Details

### Button Click Sound
- **File**: `button_single_click.wav`
- **Usage**: Played on every button click in the landing page
- **Locations**: 
  - Avatar selection
  - Game mode selection
  - Options selection
  - Difficulty selection
  - Deck selection
  - Form submissions
  - Back buttons

### Card Shuffle Sound
- **File**: `card_shuffle_peak.wav`
- **Usage**: Played when cards are dealt or drawn
- **Locations**:
  - **Initial deal**: Multiple sounds in sequence (one per card)
  - **Single card draw**: Single sound when player draws a card
  - **All game modes**: Singleplayer AI, Learning Mode, Hotseat, LAN Multiplayer

## How Sounds Are Played

### Sequence (Multiple Cards)
When multiple cards are dealt at the start of a game:
```typescript
soundManager.playSequence(SoundType.CARD_SHUFFLE, totalCards, 200);
```
- Plays one sound per card
- 200ms delay between each sound
- Example: 10 cards = 10 sounds over 2 seconds

### Single Sound
When a single card is drawn:
```typescript
soundManager.play(SoundType.CARD_SHUFFLE);
```
- Plays immediately when card is drawn

## Testing

To test the sounds:
1. Start the development server: `npm run dev`
2. Open the app (port 5179)
3. Click any button to hear button_single_click.wav
4. Start a game to hear card_shuffle_peak.wav during card dealing
5. Draw a card during gameplay to hear card_shuffle_peak.wav

## Troubleshooting

If sounds don't play:
1. Check browser console for errors
2. Verify files are in `app/renderer/content/assets/sounds/`
3. Check file names match exactly (case-sensitive)
4. Ensure files are valid WAV format
5. Check browser allows audio playback (some browsers require user interaction first)

## Technical Details

- **Format**: WAV (recommended)
- **Volume**: 50% by default (adjustable)
- **Overlap**: Sounds can overlap
- **Preloading**: All sounds are preloaded at app startup
- **Performance**: Sounds are cloned for overlapping playback

## Future Sounds (Optional)

You can add more sounds by:
1. Adding the sound file to this directory
2. Adding a new `SoundType` enum value in `soundManager.ts`
3. Loading the sound in the `init()` method
4. Playing it where needed

Example future sounds:
- `card_flip.wav` - Card flipping animation
- `success.wav` - Correct placement
- `error.wav` - Incorrect placement
- `victory.wav` - Game won
