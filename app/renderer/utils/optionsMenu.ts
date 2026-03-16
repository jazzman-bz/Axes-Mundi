import { logger } from './logger';

export interface OptionsMenuConfig {
  musicVolume: number;
  sfxVolume: number;
  onMusicVolumeChange: (volume: number) => void;
  onSfxVolumeChange: (volume: number) => void;
  onReturn: () => void;
  onLeaveToMenu?: (() => void) | null;
  leaveToMenuLabel?: string;
  onLeaveApp: () => void;
}

export class OptionsMenu {
  private readonly root: HTMLDivElement;

  private readonly overlay: HTMLDivElement;

  private readonly gearButton: HTMLButtonElement;

  private readonly panel: HTMLDivElement;

  private readonly musicSlider: HTMLInputElement;

  private readonly sfxSlider: HTMLInputElement;

  private readonly config: OptionsMenuConfig;

  private isOpen = false;

  constructor(config: OptionsMenuConfig) {
    this.config = config;
    this.root = document.createElement('div');
    this.root.className = 'options-menu-root';

    const style = document.createElement('style');
    style.textContent = `
      .options-menu-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1200;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .options-gear {
        position: fixed;
        right: 18px;
        bottom: 18px;
        width: 56px;
        height: 56px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.92);
        color: #f6f3eb;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
        cursor: pointer;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
      }

      .options-gear:hover {
        background: rgba(20, 20, 20, 0.98);
        border-color: rgba(255, 255, 255, 0.32);
        transform: scale(1.05);
      }

      .options-gear svg {
        width: 46px;
        height: 46px;
        display: block;
        fill: currentColor;
      }

      .options-menu-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(6, 8, 12, 0.58);
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.18s ease, visibility 0.18s ease;
        pointer-events: none;
        padding: 24px;
      }

      .options-menu-overlay.open {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .options-menu-panel {
        width: min(420px, 100%);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        background:
          linear-gradient(180deg, rgba(35, 41, 51, 0.96) 0%, rgba(17, 20, 28, 0.98) 100%);
        color: #f6f3eb;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
        padding: 24px;
      }

      .options-menu-title {
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.04em;
        margin-bottom: 6px;
      }

      .options-menu-subtitle {
        color: rgba(246, 243, 235, 0.68);
        font-size: 13px;
        margin-bottom: 20px;
      }

      .options-menu-group {
        display: grid;
        gap: 14px;
        margin-bottom: 24px;
      }

      .options-menu-label {
        display: grid;
        gap: 6px;
        font-size: 13px;
        color: rgba(246, 243, 235, 0.8);
      }

      .options-menu-label span {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .options-menu-slider {
        width: 100%;
        accent-color: #d6bf7b;
        cursor: pointer;
      }

      .options-menu-actions {
        display: grid;
        gap: 10px;
      }

      .options-menu-button {
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.04);
        color: #f6f3eb;
        padding: 12px 14px;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
        transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
      }

      .options-menu-button:hover {
        background: rgba(255, 255, 255, 0.09);
        border-color: rgba(255, 255, 255, 0.28);
        transform: translateY(-1px);
      }

      .options-menu-button[data-variant="danger"] {
        color: #ffd7d7;
        border-color: rgba(210, 95, 95, 0.32);
        background: rgba(124, 37, 37, 0.18);
      }

      .options-menu-button[data-variant="danger"]:hover {
        background: rgba(154, 48, 48, 0.28);
      }
    `;

    this.root.appendChild(style);

    this.gearButton = document.createElement('button');
    this.gearButton.className = 'options-gear';
    this.gearButton.type = 'button';
    this.gearButton.setAttribute('aria-label', 'Open options');
    this.gearButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.18 7.18 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/>
      </svg>
    `;

    this.overlay = document.createElement('div');
    this.overlay.className = 'options-menu-overlay';

    this.panel = document.createElement('div');
    this.panel.className = 'options-menu-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-label', 'Options menu');

    const title = document.createElement('div');
    title.className = 'options-menu-title';
    title.textContent = 'Options';

    const subtitle = document.createElement('div');
    subtitle.className = 'options-menu-subtitle';
    subtitle.textContent = 'ESC toggles this menu.';

    const group = document.createElement('div');
    group.className = 'options-menu-group';

    this.musicSlider = this.createSlider('Music Volume', config.musicVolume, (value) => {
      this.config.onMusicVolumeChange(value);
    });

    this.sfxSlider = this.createSlider('SFX Volume', config.sfxVolume, (value) => {
      this.config.onSfxVolumeChange(value);
    });

    group.appendChild(this.musicSlider.closest('label') as HTMLElement);
    group.appendChild(this.sfxSlider.closest('label') as HTMLElement);

    const actions = document.createElement('div');
    actions.className = 'options-menu-actions';

    actions.appendChild(this.createActionButton('Return', () => {
      this.config.onReturn();
      this.close();
    }));

    if (this.config.onLeaveToMenu) {
      actions.appendChild(this.createActionButton(this.config.leaveToMenuLabel || 'Leave Game to Menu', () => {
        this.close();
        this.config.onLeaveToMenu?.();
      }));
    }

    actions.appendChild(this.createActionButton('Leave Axes-Mundi', () => {
      this.close();
      this.config.onLeaveApp();
    }, 'danger'));

    this.panel.append(title, subtitle, group, actions);
    this.overlay.appendChild(this.panel);
    this.root.append(this.gearButton, this.overlay);

    document.body.appendChild(this.root);

    this.gearButton.addEventListener('click', () => {
      this.toggle();
    });

    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) {
        this.close();
      }
    });

    this.panel.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      this.toggle();
    });
  }

  isMenuOpen(): boolean {
    return this.isOpen;
  }

  setMusicVolume(volume: number): void {
    this.musicSlider.value = String(Math.round(volume * 100));
    this.updateSliderValueLabel(this.musicSlider);
  }

  setSfxVolume(volume: number): void {
    this.sfxSlider.value = String(Math.round(volume * 100));
    this.updateSliderValueLabel(this.sfxSlider);
  }

  open(): void {
    if (this.isOpen) {
      return;
    }

    this.isOpen = true;
    this.overlay.classList.add('open');
    logger.info({ scope: 'options-menu', msg: 'menu opened' });
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.overlay.classList.remove('open');
    logger.info({ scope: 'options-menu', msg: 'menu closed' });
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
      return;
    }

    this.open();
  }

  private createSlider(
    label: string,
    initialValue: number,
    onChange: (value: number) => void,
  ): HTMLInputElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'options-menu-label';

    const header = document.createElement('span');
    const text = document.createElement('strong');
    text.textContent = label;
    const value = document.createElement('span');
    value.dataset.role = 'value';
    header.append(text, value);

    const slider = document.createElement('input');
    slider.className = 'options-menu-slider';
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(Math.round(initialValue * 100));
    slider.addEventListener('input', () => {
      this.updateSliderValueLabel(slider);
      onChange(Number.parseInt(slider.value, 10) / 100);
    });

    wrapper.append(header, slider);
    this.updateSliderValueLabel(slider);
    return slider;
  }

  private updateSliderValueLabel(slider: HTMLInputElement): void {
    const wrapper = slider.closest('label');
    const valueElement = wrapper?.querySelector<HTMLElement>('[data-role="value"]');
    if (valueElement) {
      valueElement.textContent = `${slider.value}%`;
    }
  }

  private createActionButton(
    label: string,
    onClick: () => void,
    variant?: 'danger',
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'options-menu-button';
    button.type = 'button';
    button.textContent = label;
    if (variant) {
      button.dataset.variant = variant;
    }
    button.addEventListener('click', onClick);
    return button;
  }
}
