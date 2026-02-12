// Theme preset system for CodeDocs
// Each preset provides CSS custom properties that override the defaults

export interface ThemePreset {
  name: string;
  displayName: string;
  description: string;
  cssVariables: Record<string, string>;
  darkCssVariables: Record<string, string>;
}

export const defaultPreset: ThemePreset = {
  name: 'default',
  displayName: 'Default',
  description: 'Clean, modern documentation theme inspired by Docusaurus',
  cssVariables: {
    '--codedocs-primary': '#2e8555',
    '--codedocs-primary-light': '#4caf7c',
    '--codedocs-primary-dark': '#1a6b3f',
    '--codedocs-text': '#1c1e21',
    '--codedocs-text-secondary': '#606770',
    '--codedocs-bg': '#ffffff',
    '--codedocs-bg-secondary': '#f6f8fa',
    '--codedocs-sidebar-width': '280px',
    '--codedocs-content-max-width': '860px',
    '--codedocs-radius-sm': '4px',
    '--codedocs-radius-md': '6px',
    '--codedocs-radius-lg': '8px',
    '--codedocs-header-height': '56px',
  },
  darkCssVariables: {
    '--codedocs-primary': '#4caf7c',
    '--codedocs-primary-light': '#6dd09e',
    '--codedocs-primary-dark': '#2e8555',
    '--codedocs-text': '#e3e3e3',
    '--codedocs-text-secondary': '#b0b0b0',
    '--codedocs-bg': '#1b1b1d',
    '--codedocs-bg-secondary': '#242526',
  },
};

export const swaggerPreset: ThemePreset = {
  name: 'swagger',
  displayName: 'Swagger UI',
  description: 'Familiar Swagger UI look with green accent and wide API cards',
  cssVariables: {
    '--codedocs-primary': '#85ea2d',
    '--codedocs-primary-light': '#a3f04e',
    '--codedocs-primary-dark': '#6abf1a',
    '--codedocs-text': '#3b4151',
    '--codedocs-text-secondary': '#6b6b6b',
    '--codedocs-bg': '#fafafa',
    '--codedocs-bg-secondary': '#ffffff',
    '--codedocs-bg-tertiary': '#f0f0f0',
    '--codedocs-border': '#d8dde7',
    '--codedocs-border-light': '#e8e8e8',
    '--codedocs-sidebar-width': '260px',
    '--codedocs-sidebar-bg': '#1b1b1b',
    '--codedocs-header-height': '50px',
    '--codedocs-header-bg': '#1b1b1b',
    '--codedocs-method-get': '#61affe',
    '--codedocs-method-post': '#49cc90',
    '--codedocs-method-put': '#fca130',
    '--codedocs-method-delete': '#f93e3e',
    '--codedocs-method-patch': '#50e3c2',
    '--codedocs-code-bg': '#41444e',
    '--codedocs-code-border': '#3b4151',
    '--codedocs-content-max-width': '1140px',
    '--codedocs-radius-sm': '4px',
    '--codedocs-radius-md': '4px',
    '--codedocs-radius-lg': '4px',
    '--codedocs-shadow-sm': 'none',
    '--codedocs-shadow-md': '0 1px 2px rgba(0,0,0,0.1)',
  },
  darkCssVariables: {
    '--codedocs-primary': '#85ea2d',
    '--codedocs-text': '#ffffff',
    '--codedocs-text-secondary': '#b0b0b0',
    '--codedocs-bg': '#1b1b1b',
    '--codedocs-bg-secondary': '#252528',
    '--codedocs-bg-tertiary': '#2e2e31',
    '--codedocs-border': '#404040',
    '--codedocs-sidebar-bg': '#141414',
    '--codedocs-header-bg': '#141414',
  },
};

export const redocPreset: ThemePreset = {
  name: 'redoc',
  displayName: 'Redoc',
  description: 'Three-panel layout style inspired by Redoc with clean typography',
  cssVariables: {
    '--codedocs-primary': '#e53935',
    '--codedocs-primary-light': '#ef5350',
    '--codedocs-primary-dark': '#c62828',
    '--codedocs-text': '#333333',
    '--codedocs-text-secondary': '#666666',
    '--codedocs-text-muted': '#999999',
    '--codedocs-bg': '#ffffff',
    '--codedocs-bg-secondary': '#fafbfc',
    '--codedocs-bg-tertiary': '#f2f4f7',
    '--codedocs-border': '#e0e0e0',
    '--codedocs-border-light': '#eeeeee',
    '--codedocs-sidebar-width': '260px',
    '--codedocs-sidebar-bg': '#263238',
    '--codedocs-header-height': '60px',
    '--codedocs-header-bg': '#ffffff',
    '--codedocs-method-get': '#2196f3',
    '--codedocs-method-post': '#4caf50',
    '--codedocs-method-put': '#ff9800',
    '--codedocs-method-delete': '#f44336',
    '--codedocs-method-patch': '#9c27b0',
    '--codedocs-code-bg': '#263238',
    '--codedocs-code-border': '#37474f',
    '--codedocs-content-max-width': '960px',
    '--codedocs-radius-sm': '2px',
    '--codedocs-radius-md': '4px',
    '--codedocs-radius-lg': '4px',
    '--codedocs-shadow-sm': '0 1px 3px rgba(0,0,0,0.08)',
    '--codedocs-shadow-md': '0 2px 6px rgba(0,0,0,0.12)',
  },
  darkCssVariables: {
    '--codedocs-primary': '#ef5350',
    '--codedocs-text': '#e0e0e0',
    '--codedocs-text-secondary': '#a0a0a0',
    '--codedocs-bg': '#1a1a2e',
    '--codedocs-bg-secondary': '#16213e',
    '--codedocs-bg-tertiary': '#0f3460',
    '--codedocs-border': '#2a2a4a',
    '--codedocs-sidebar-bg': '#0f0f23',
    '--codedocs-code-bg': '#0d1117',
  },
};

export const mintlifyPreset: ThemePreset = {
  name: 'mintlify',
  displayName: 'Mintlify',
  description: 'Modern, sleek documentation theme with subtle gradients and rounded elements',
  cssVariables: {
    '--codedocs-primary': '#0d9373',
    '--codedocs-primary-light': '#16b890',
    '--codedocs-primary-dark': '#0a7d62',
    '--codedocs-text': '#0f172a',
    '--codedocs-text-secondary': '#475569',
    '--codedocs-text-muted': '#94a3b8',
    '--codedocs-bg': '#ffffff',
    '--codedocs-bg-secondary': '#f8fafc',
    '--codedocs-bg-tertiary': '#f1f5f9',
    '--codedocs-border': '#e2e8f0',
    '--codedocs-border-light': '#f1f5f9',
    '--codedocs-sidebar-width': '272px',
    '--codedocs-sidebar-bg': '#ffffff',
    '--codedocs-header-height': '64px',
    '--codedocs-header-bg': 'rgba(255,255,255,0.8)',
    '--codedocs-method-get': '#3b82f6',
    '--codedocs-method-post': '#22c55e',
    '--codedocs-method-put': '#f59e0b',
    '--codedocs-method-delete': '#ef4444',
    '--codedocs-method-patch': '#a855f7',
    '--codedocs-code-bg': '#f8fafc',
    '--codedocs-code-border': '#e2e8f0',
    '--codedocs-content-max-width': '820px',
    '--codedocs-radius-sm': '6px',
    '--codedocs-radius-md': '8px',
    '--codedocs-radius-lg': '12px',
    '--codedocs-shadow-sm': '0 1px 2px rgba(0,0,0,0.04)',
    '--codedocs-shadow-md': '0 4px 12px rgba(0,0,0,0.06)',
  },
  darkCssVariables: {
    '--codedocs-primary': '#16b890',
    '--codedocs-primary-light': '#34d399',
    '--codedocs-primary-dark': '#0d9373',
    '--codedocs-text': '#f8fafc',
    '--codedocs-text-secondary': '#94a3b8',
    '--codedocs-text-muted': '#64748b',
    '--codedocs-bg': '#0f172a',
    '--codedocs-bg-secondary': '#1e293b',
    '--codedocs-bg-tertiary': '#334155',
    '--codedocs-border': '#1e293b',
    '--codedocs-border-light': '#334155',
    '--codedocs-sidebar-bg': '#0f172a',
    '--codedocs-header-bg': 'rgba(15,23,42,0.8)',
    '--codedocs-code-bg': '#1e293b',
    '--codedocs-code-border': '#334155',
  },
};

/**
 * All available presets
 */
export const presets: Record<string, ThemePreset> = {
  default: defaultPreset,
  swagger: swaggerPreset,
  redoc: redocPreset,
  mintlify: mintlifyPreset,
};

/**
 * Get a preset by name, falling back to default
 */
export function getPreset(name: string): ThemePreset {
  return presets[name] || defaultPreset;
}

/**
 * Generate CSS string from a preset, merging with optional user overrides
 */
export function generatePresetCss(
  presetName: string,
  userColors?: Record<string, string>,
): string {
  const preset = getPreset(presetName);

  const lightVars = { ...preset.cssVariables };
  const darkVars = { ...preset.darkCssVariables };

  // Apply user color overrides
  if (userColors) {
    if (userColors.primary) {
      lightVars['--codedocs-primary'] = userColors.primary;
      darkVars['--codedocs-primary'] = userColors.primary;
    }
    if (userColors.secondary) {
      lightVars['--codedocs-primary-light'] = userColors.secondary;
      darkVars['--codedocs-primary-light'] = userColors.secondary;
    }
  }

  const formatVars = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n');

  return `:root {\n${formatVars(lightVars)}\n}\n\nhtml.dark {\n${formatVars(darkVars)}\n}\n`;
}

/**
 * List all available preset names
 */
export function listPresets(): { name: string; displayName: string; description: string }[] {
  return Object.values(presets).map((p) => ({
    name: p.name,
    displayName: p.displayName,
    description: p.description,
  }));
}
