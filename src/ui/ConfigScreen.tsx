import { Button, FieldGroup, TextField } from 'datocms-react-ui';
import { useState } from 'react';
import {
  parsePluginParameters,
  validatePluginParameters,
  type PluginParameters,
} from '../plugin/parameters';

type ConfigScreenProps = {
  parameters: PluginParameters;
  onSave: (params: PluginParameters) => Promise<void>;
};

export function ConfigScreen({ parameters, onSave }: ConfigScreenProps) {
  const [draft, setDraft] = useState(parameters);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const issues = validatePluginParameters(draft);

  async function handleSubmit() {
    if (isSaving) {
      return;
    }

    setSaveError(false);
    setIsSaving(true);

    try {
      await onSave(draft);
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <FieldGroup>
        <TextField
          id="tmdbReadToken"
          name="tmdbReadToken"
          label="TMDB read token"
          value={draft.tmdbReadToken}
          onChange={(value) =>
            setDraft(
              parsePluginParameters({ ...draft, tmdbReadToken: value }),
            )
          }
        />
      </FieldGroup>
      <p>
        Because this version is frontend-only, authenticated editors can inspect
        the TMDB read token in the browser.
      </p>
      {issues.map((issue) => (
        <p key={issue.code}>{issue.message}</p>
      ))}
      {saveError && <p>Unable to save configuration. Please try again.</p>}
      <Button type="submit" buttonType="primary" disabled={isSaving}>
        {isSaving ? 'Saving configuration' : 'Save configuration'}
      </Button>
    </form>
  );
}
