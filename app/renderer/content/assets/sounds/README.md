# Sound Assets

This directory contains all sound effects for Axes-Mundi.

## Required Files

- `single_button_click.wav` - Button click sound effect

## File Location

Place your sound files in this directory:
```
app/renderer/content/assets/sounds/
```

## Supported Formats

- WAV (recommended)
- MP3
- OGG

## Adding New Sounds

To add a new sound effect:

1. Place the audio file in this directory
2. Add the sound type to `SoundType` enum in `app/renderer/utils/soundManager.ts`
3. Load the sound in the `init()` method of `SoundManager`
4. Call `soundManager.play(SoundType.YOUR_SOUND)` where needed

## Sound Configuration

- **Default Volume**: 0.5 (50%)
- **Format**: Preloaded for instant playback
- **Overlap**: Sounds can overlap (cloned on play)

## Usage Example

```typescript
import { soundManager, SoundType } from '@/utils/soundManager';

// Initialize sound manager (usually in app initialization)
await soundManager.init();

// Play a sound
soundManager.play(SoundType.BUTTON_CLICK);

// Adjust volume (0.0 - 1.0)
soundManager.setVolume(0.7);

// Enable/disable sounds
soundManager.setEnabled(false);
```

## Performance

All sounds are preloaded during initialization to ensure instant playback without lag.
