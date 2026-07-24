import { Button, FieldError, FieldGroup, FieldHint, Form, Section, TextField } from 'datocms-react-ui';
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
  heroImage: 'Hero image',
  backdrops: 'Other images',
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
    <Form
      onSubmit={() => {
        void handleSubmit();
      }}
    >
      <Section title="TMDB access">
        <FieldGroup>
          <TextField
            id="tmdbReadToken"
            name="tmdbReadToken"
            label="TMDB read token"
            value={draft.tmdbReadToken}
            onChange={(value) => updateParameter('tmdbReadToken', value)}
          />
        </FieldGroup>
        <FieldHint>
          This frontend-only version stores the TMDB token in plugin settings. Editors who can use the plugin may inspect it in browser tools.
        </FieldHint>
      </Section>
      <Section title="Movie model and fields">
        <FieldGroup>
          <TextField id="movieModelApiKey" name="movieModelApiKey" label="Movie model API name" value={draft.movieModelApiKey} onChange={(value) => updateParameter('movieModelApiKey', value)} />
          {Object.entries(movieFieldLabels).map(([key, label]) => (
            <TextField
              key={key}
              id={`movieField-${key}`}
              name={`movieField-${key}`}
              label={`${label} field API name`}
              value={draft.movieFields[key as keyof typeof movieFieldLabels] ?? ''}
              onChange={(value) => updateMovieField(key as keyof typeof movieFieldLabels, value)}
            />
          ))}
        </FieldGroup>
      </Section>
      <Section title="Person matching">
        <FieldGroup>
          <TextField id="personModelApiKey" name="personModelApiKey" label="Person model API name" value={draft.personModelApiKey} onChange={(value) => updateParameter('personModelApiKey', value)} />
          <TextField id="personNameFieldApiKey" name="personNameFieldApiKey" label="Person name field API name" value={draft.personNameFieldApiKey} onChange={(value) => updateParameter('personNameFieldApiKey', value)} />
          <TextField id="personTmdbIdFieldApiKey" name="personTmdbIdFieldApiKey" label="Person TMDB ID field API name" value={draft.personTmdbIdFieldApiKey ?? ''} onChange={(value) => updateParameter('personTmdbIdFieldApiKey', value || null)} />
        </FieldGroup>
      </Section>
      <Section title="Import behavior">
        <FieldGroup>
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
            textInputProps={{ type: 'number', min: 1 }}
          />
        </FieldGroup>
      </Section>
      {issues.length > 0 ? (
        <FieldError>
          {issues.map((issue) => (
            <p key={issue.code}>{issue.message}</p>
          ))}
        </FieldError>
      ) : null}
      {saveError ? <FieldError>The plugin settings could not be saved. Try again.</FieldError> : null}
      <Button type="submit" buttonType="primary" disabled={isSaving}>
        {isSaving ? 'Saving configuration' : 'Save configuration'}
      </Button>
    </Form>
  );
}
