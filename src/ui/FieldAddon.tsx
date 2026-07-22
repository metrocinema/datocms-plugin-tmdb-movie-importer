type FieldAddonProps = {
  tmdbId: number | string | null;
  onOpen: (mode: 'find' | 'refresh') => void;
};

export function FieldAddon({ tmdbId, onOpen }: FieldAddonProps) {
  const hasTmdbId =
    tmdbId !== null && (typeof tmdbId !== 'string' || tmdbId.trim() !== '');
  const mode = hasTmdbId ? 'refresh' : 'find';

  return (
    <button type="button" onClick={() => onOpen(mode)}>
      {hasTmdbId ? 'Refresh from TMDB' : 'Find movie'}
    </button>
  );
}
