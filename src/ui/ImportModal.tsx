import { useEffect, useMemo, useState } from 'react';
import { compareMovieFields, type CurrentMovieValues, type FieldComparison } from '../domain/fieldComparison';
import { buildImportPlan, type ImportPlan, type PersonResolution } from '../domain/importPlanning';
import type { MovieFieldKey, NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import { matchPerson, type ExistingPersonRecord, type PersonMatchDecision } from '../domain/personMatching';
import type { TmdbSearchQuery, TmdbSearchResult } from '../providers/tmdbTypes';
import { defaultImageSelection } from '../providers/imageProvider';
import { ConfirmStep } from './ConfirmStep';
import { ReviewStep } from './ReviewStep';
import { SearchStep } from './SearchStep';

type Step = 'search' | 'review' | 'confirm';

export type ImportModalProps = {
  initialTitle: string;
  initialYear: number | null;
  initialTmdbId?: number | null;
  currentValues: CurrentMovieValues;
  mappedFields: MovieFieldKey[];
  searchMovies: (query: TmdbSearchQuery) => Promise<TmdbSearchResult[]>;
  loadMovie: (tmdbId: number) => Promise<NormalizedMovie>;
  resolvePeople?: (candidates: PersonCandidate[]) => Promise<ExistingPersonRecord[]>;
  tmdbIdFieldConfigured?: boolean;
  execute: (plan: ImportPlan) => Promise<void>;
};

export function ImportModal(props: ImportModalProps) {
  const [step, setStep] = useState<Step>('search');
  const [title, setTitle] = useState(props.initialTitle);
  const [year, setYear] = useState<number | null>(props.initialYear);
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [movie, setMovie] = useState<NormalizedMovie | null>(null);
  const [comparisons, setComparisons] = useState<FieldComparison[]>([]);
  const [people, setPeople] = useState<Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>>([]);
  const [imageSelection, setImageSelection] = useState({ poster: null as NormalizedImageCandidate | null, backdrops: [] as NormalizedImageCandidate[] });
  const [error, setError] = useState<string | null>(null);

  const loadSelectedMovie = async (tmdbId: number) => {
    try {
      setError(null);
      const loaded = await props.loadMovie(tmdbId);
      const records = await props.resolvePeople?.([...loaded.directors, ...loaded.actors]) ?? [];
      setMovie(loaded);
      setComparisons(compareMovieFields(props.currentValues, loaded, props.mappedFields));
      setPeople([...loaded.directors, ...loaded.actors].map((candidate) => ({ candidate, decision: matchPerson(candidate, records, props.tmdbIdFieldConfigured ?? true) })));
      setImageSelection(defaultImageSelection(props.currentValues, loaded.images));
      setStep('review');
    } catch {
      setError('Unable to load that TMDB movie. Search manually to continue.');
      setStep('search');
    }
  };

  useEffect(() => {
    if (props.initialTmdbId) {
      void loadSelectedMovie(props.initialTmdbId);
    }
  // The initial TMDB ID selects the refresh workflow once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = useMemo(() => buildImportPlan({
    fieldComparisons: comparisons,
    directors: movie?.directors ?? [],
    actors: movie?.actors ?? [],
    imageSelection,
    personResolutions: people.flatMap(({ candidate, decision }): PersonResolution[] => {
      if (decision.type === 'reuse') return [{ candidateTmdbId: candidate.tmdbId, action: 'reuse', recordId: decision.recordId, name: candidate.name }];
      if (decision.type === 'create') return [{ candidateTmdbId: candidate.tmdbId, action: 'create', name: decision.name }];
      return [];
    }),
  }), [comparisons, imageSelection, movie, people]);

  if (step === 'search') {
    return <><SearchStep title={title} year={year} results={results} onTitleChange={setTitle} onYearChange={setYear} onSearch={async () => setResults(await props.searchMovies({ title, year }))} onSelect={loadSelectedMovie} />{error ? <p role="alert">{error}</p> : null}</>;
  }

  if (step === 'review') {
    return <ReviewStep comparisons={comparisons} onToggle={(key) => setComparisons((items) => items.map((item) => item.key === key ? { ...item, selected: !item.selected } : item))} onSelectAll={() => setComparisons((items) => items.map((item) => ({ ...item, selected: item.available && item.changed })))} people={people} onResolvePerson={(candidate, value) => setPeople((items) => items.map((item) => {
      if (item.candidate.tmdbId !== candidate.tmdbId) return item;
      if (value === 'create') return { ...item, decision: { type: 'create', name: candidate.name, warning: null } };
      return { ...item, decision: { type: 'reuse', recordId: value.slice('reuse:'.length), warning: null } };
    }))} images={movie?.images ?? []} selectedImageIds={[...(imageSelection.poster ? [imageSelection.poster] : []), ...imageSelection.backdrops].map((image) => image.providerImageId)} onToggleImage={(providerImageId) => setImageSelection((selection) => {
      const image = movie?.images.find((candidate) => candidate.providerImageId === providerImageId);
      if (!image) return selection;
      if (image.type === 'poster') return { ...selection, poster: selection.poster?.providerImageId === providerImageId ? null : image };
      return { ...selection, backdrops: selection.backdrops.some((candidate) => candidate.providerImageId === providerImageId) ? selection.backdrops.filter((candidate) => candidate.providerImageId !== providerImageId) : [...selection.backdrops, image] };
    })} onContinue={() => setStep('confirm')} />;
  }

  return <ConfirmStep plan={plan} onConfirm={() => void props.execute(plan)} />;
}
