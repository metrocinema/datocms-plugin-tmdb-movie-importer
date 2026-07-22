export type PluginScreen =
  | { type: 'config' }
  | { type: 'fieldAddon' }
  | { type: 'modal' }
  | { type: 'unknown'; label: string };

type AppProps = {
  screen: PluginScreen;
};

export function App({ screen }: AppProps) {
  if (screen.type === 'config') {
    return <div>Configure TMDB Movie Import</div>;
  }

  if (screen.type === 'fieldAddon') {
    return <button type="button">Find movie</button>;
  }

  if (screen.type === 'modal') {
    return <div>TMDB Movie Import</div>;
  }

  return <div>Unsupported plugin screen: {screen.label}</div>;
}
