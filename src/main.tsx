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
    render({ type: 'config' }, ctx);
  },
  renderFieldExtension(_fieldExtensionId, ctx) {
    render({ type: 'fieldAddon' }, ctx);
  },
  renderModal(_modalId, ctx) {
    render({ type: 'modal' }, ctx);
  },
});
