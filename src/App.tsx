import { parsePluginParameters } from './plugin/parameters';
import type { ValidationIssue } from './domain/movie';
import { ConfigScreen } from './ui/ConfigScreen';
import { FieldAddon } from './ui/FieldAddon';
import { ImportModal, type ImportModalProps } from './ui/ImportModal';

export type PluginScreen =
  | { type: 'config'; parameters?: unknown; onSave?: (params: unknown) => Promise<void> }
  | { type: 'fieldAddon'; tmdbId?: number | string | null; onOpen?: (mode: 'find' | 'refresh') => void; configurationIssues?: ValidationIssue[] }
  | ({ type: 'modal'; configurationIssues?: ValidationIssue[] } & ImportModalProps)
  | { type: 'unknown'; label: string };

type AppProps = {
  screen: PluginScreen;
};

export function App({ screen }: AppProps) {
  if (screen.type === 'config') {
    return <ConfigScreen parameters={parsePluginParameters(screen.parameters)} onSave={async (params) => screen.onSave?.(params)} />;
  }

  if (screen.type === 'fieldAddon') {
    return <FieldAddon tmdbId={screen.tmdbId ?? null} onOpen={(mode) => screen.onOpen?.(mode)} configurationIssues={screen.configurationIssues?.map((issue) => issue.message)} />;
  }

  if (screen.type === 'modal') {
    if (screen.configurationIssues?.length) {
      return <p role="alert">Configure the importer before using it: {screen.configurationIssues.map((issue) => issue.message).join(' ')}</p>;
    }
    return <ImportModal {...screen} />;
  }

  return <div>Unsupported plugin screen: {screen.label}</div>;
}
