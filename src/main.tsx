import React from 'react';
import ReactDOM from 'react-dom/client';
import { connect } from 'datocms-plugin-sdk';
import { Canvas } from 'datocms-react-ui';
import 'datocms-react-ui/styles.css';
import { App, type PluginScreen } from './App';

function render(screen: PluginScreen, ctx: unknown) {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <Canvas ctx={ctx as never}>
        <App screen={screen} />
      </Canvas>
    </React.StrictMode>,
  );
}

connect({
  renderConfigScreen(ctx) {
    render(
      {
        type: 'config',
        parameters: ctx.plugin.attributes.parameters,
        onSave: async (params) => {
          await ctx.updatePluginParameters(params as Record<string, unknown>);
          ctx.notice('Configuration saved');
        },
      },
      ctx,
    );
  },
  renderFieldExtension(_fieldExtensionId, ctx) {
    render(
      {
        type: 'fieldAddon',
        tmdbId: ctx.formValues[ctx.fieldPath] as number | string | null,
        onOpen: async (mode) => {
          await ctx.openModal({
            id: 'tmdbMovieImport',
            title: mode === 'refresh' ? 'Refresh from TMDB' : 'Find movie',
            width: 'l',
            parameters: { mode },
          });
        },
      },
      ctx,
    );
  },
  renderModal(_modalId, ctx) {
    render({ type: 'modal' }, ctx);
  },
});
