const AVAILABLE_THEMES = ['clean', 'simple', 'terminal'] as const;
export type ThemeName = (typeof AVAILABLE_THEMES)[number];

export class ThemeManager {
  private theme: ThemeName = 'clean';
  private darkMode: boolean | null = null; // null = follow system

  getTheme(): ThemeName {
    return this.theme;
  }

  setTheme(name: string) {
    if (AVAILABLE_THEMES.includes(name as ThemeName)) {
      this.theme = name as ThemeName;
    }
  }

  isDark(): boolean | null {
    return this.darkMode;
  }

  toggleDarkMode(): boolean | null {
    if (this.darkMode === null) {
      this.darkMode = true;
    } else if (this.darkMode) {
      this.darkMode = false;
    } else {
      this.darkMode = null; // cycle back to system
    }
    return this.darkMode;
  }
}
