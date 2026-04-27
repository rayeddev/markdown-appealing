import type { Memento } from 'vscode';

const AVAILABLE_THEMES = ['clean', 'editorial', 'terminal'] as const;
export type ThemeName = (typeof AVAILABLE_THEMES)[number];

const THEME_KEY = 'markdownAppealing.theme';
const DARK_MODE_KEY = 'markdownAppealing.darkMode';

export class ThemeManager {
  private theme: ThemeName = 'clean';
  private darkMode: boolean | null = null; // null = follow system
  private storage?: Memento;

  constructor(storage?: Memento) {
    this.storage = storage;
    if (!storage) return;

    const savedTheme = storage.get<string>(THEME_KEY);
    if (savedTheme && AVAILABLE_THEMES.includes(savedTheme as ThemeName)) {
      this.theme = savedTheme as ThemeName;
    }
    const savedDark = storage.get<boolean | null>(DARK_MODE_KEY, null);
    if (savedDark === true || savedDark === false || savedDark === null) {
      this.darkMode = savedDark;
    }
  }

  getTheme(): ThemeName {
    return this.theme;
  }

  setTheme(name: string) {
    if (AVAILABLE_THEMES.includes(name as ThemeName)) {
      this.theme = name as ThemeName;
      this.storage?.update(THEME_KEY, this.theme);
    }
  }

  isDark(): boolean | null {
    return this.darkMode;
  }

  setDarkMode(value: boolean | null) {
    this.darkMode = value;
    this.storage?.update(DARK_MODE_KEY, this.darkMode);
  }

  toggleDarkMode(): boolean | null {
    if (this.darkMode === null) {
      this.darkMode = true;
    } else if (this.darkMode) {
      this.darkMode = false;
    } else {
      this.darkMode = null; // cycle back to system
    }
    this.storage?.update(DARK_MODE_KEY, this.darkMode);
    return this.darkMode;
  }
}
