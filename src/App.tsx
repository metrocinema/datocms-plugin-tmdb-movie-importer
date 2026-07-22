import { parsePluginParameters } from './plugin/parameters';
import { ConfigScreen } from './ui/ConfigScreen';
import { FieldAddon } from './ui/FieldAddon';

export type PluginScreen =
  | { type: 'config'; parameters?: unknown; onSave?: (params: unknown) => Promise<void> }
  | { type: 'fieldAddon'; tmdbId?: number | string | null; onOpen?: (mode: 'find' | 'refresh') => void }
  | { type: 'modal' }
  | { type: 'unknown'; label: string };

type AppProps = {
  screen: PluginScreen;
};

export function App({ screen }: AppProps) {
  if (screen.type === 'config') {
    return <ConfigScreen parameters={parsePluginParameters(screen.parameters)} onSave={async (params) => screen.onSave?.(params)} />;
  }

  if (screen.type === 'fieldAddon') {
    return <FieldAddon tmdbId={screen.tmdbId ?? null} onOpen={(mode) => screen.onOpen?.(mode)} />;
  }

  if (screen.type === 'modal') {
    return <div>TMDB Movie Import</div>;
  }

  return <div>Unsupported plugin screen: {screen.label}</div>;
}
