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

const movieFieldLabels = {
  title: 'Title',
  yearReleased: 'Year released',
  mpaaRating: 'MPAA rating',
  runtime: 'Runtime',
  tmdbId: 'TMDB ID',
  tagline: 'Tagline',
  description: 'Description',
  poster: 'Poster',
  backdrops: 'Backdrops',
  directors: 'Directors',
  actors: 'Actors',
} as const;

export function ConfigScreen({ parameters, onSave }: ConfigScreenProps) {
  const [draft, setDraft] = useState(parameters);
  const [actorLimitInput, setActorLimitInput] = useState(String(parameters.actorLimit));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const issues = validatePluginParameters(draft);

  function updateParameter<Key extends keyof PluginParameters>(key: Key, value: PluginParameters[Key]) {
    setDraft(parsePluginParameters({ ...draft, [key]: value }));
  }

  function updateMovieField(key: keyof typeof movieFieldLabels, value: string) {
    setDraft(parsePluginParameters({
      ...draft,
      movieFields: { ...draft.movieFields, [key]: value },
    }));
  }

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
          onChange={(value) => updateParameter('tmdbReadToken', value)}
        />
        <TextField id="movieModelApiKey" name="movieModelApiKey" label="Movie model API key" value={draft.movieModelApiKey} onChange={(value) => updateParameter('movieModelApiKey', value)} />
        {Object.entries(movieFieldLabels).map(([key, label]) => (
          <TextField
            key={key}
            id={`movieField-${key}`}
            name={`movieField-${key}`}
            label={`${label} field API key`}
            value={draft.movieFields[key as keyof typeof movieFieldLabels] ?? ''}
            onChange={(value) => updateMovieField(key as keyof typeof movieFieldLabels, value)}
          />
        ))}
        <TextField id="personModelApiKey" name="personModelApiKey" label="Person model API key" value={draft.personModelApiKey} onChange={(value) => updateParameter('personModelApiKey', value)} />
        <TextField id="personNameFieldApiKey" name="personNameFieldApiKey" label="Person name field API key" value={draft.personNameFieldApiKey} onChange={(value) => updateParameter('personNameFieldApiKey', value)} />
        <TextField id="personTmdbIdFieldApiKey" name="personTmdbIdFieldApiKey" label="Person TMDB ID field API key" value={draft.personTmdbIdFieldApiKey ?? ''} onChange={(value) => updateParameter('personTmdbIdFieldApiKey', value || null)} />
        <TextField
          id="actorLimit"
          name="actorLimit"
          label="Actor limit"
          value={actorLimitInput}
          onChange={(value) => {
            setActorLimitInput(value);
            const actorLimit = Number(value);
            if (Number.isInteger(actorLimit) && actorLimit > 0) {
              updateParameter('actorLimit', actorLimit);
            }
          }}
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
