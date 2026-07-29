import { Button } from 'datocms-react-ui';
import { useState } from 'react';

export type FieldAddonStatusReporter = (
  status: 'opening' | 'applying',
) => void;

type FieldAddonProps = {
  tmdbId: number | string | null;
  onOpen: (
    mode: 'find' | 'refresh',
    reportStatus: FieldAddonStatusReporter,
  ) => void | Promise<void>;
  configurationIssues?: string[];
};

export function FieldAddon({ tmdbId, onOpen, configurationIssues = [] }: FieldAddonProps) {
  const [workingStatus, setWorkingStatus] =
    useState<'opening' | 'applying' | null>(null);
  const hasTmdbId =
    tmdbId !== null && (typeof tmdbId !== 'string' || tmdbId.trim() !== '');
  const mode = hasTmdbId ? 'refresh' : 'find';
  const openImporter = async () => {
    setWorkingStatus('opening');

    try {
      await onOpen(mode, setWorkingStatus);
    } finally {
      setWorkingStatus(null);
    }
  };

  return (
    <div className="movie-import-field-addon">
      <Button type="button" buttonSize="s" onClick={() => void openImporter()} disabled={configurationIssues.length > 0 || workingStatus !== null}>
        {hasTmdbId ? 'Refresh from TMDB' : 'Find movie'}
      </Button>
      {workingStatus === 'applying' ? (
        <p role="status" className="movie-import-field-addon__alert">
          Applying imported values… Keep this entry open until DatoCMS confirms
          the update.
        </p>
      ) : null}
      {configurationIssues.length > 0 ? <p role="alert" className="movie-import-field-addon__alert">Finish plugin configuration before using TMDB import: {configurationIssues.join(' ')}</p> : null}
    </div>
  );
}
