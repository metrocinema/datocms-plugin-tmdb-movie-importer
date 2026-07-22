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
  const issues = validatePluginParameters(draft);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(draft);
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
      <Button type="submit" buttonType="primary">
        Save configuration
      </Button>
    </form>
  );
}
