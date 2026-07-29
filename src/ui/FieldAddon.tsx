import { Button } from 'datocms-react-ui';
import { useState } from 'react';

type FieldAddonProps = {
  tmdbId: number | string | null;
  onOpen: (mode: 'find' | 'refresh') => void | Promise<void>;
  configurationIssues?: string[];
};

export function FieldAddon({ tmdbId, onOpen, configurationIssues = [] }: FieldAddonProps) {
  const [isWorking, setIsWorking] = useState(false);
  const hasTmdbId =
    tmdbId !== null && (typeof tmdbId !== 'string' || tmdbId.trim() !== '');
  const mode = hasTmdbId ? 'refresh' : 'find';
  const openImporter = async () => {
    setIsWorking(true);

    try {
      await onOpen(mode);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="movie-import-field-addon">
      <Button type="button" buttonSize="s" onClick={() => void openImporter()} disabled={configurationIssues.length > 0 || isWorking}>
        {hasTmdbId ? 'Refresh from TMDB' : 'Find movie'}
      </Button>
      {isWorking ? <p role="status" className="movie-import-field-addon__alert">Importing from TMDB… Keep this entry open while DatoCMS prepares the selected changes.</p> : null}
      {configurationIssues.length > 0 ? <p role="alert" className="movie-import-field-addon__alert">Finish plugin configuration before using TMDB import: {configurationIssues.join(' ')}</p> : null}
    </div>
  );
}
