import { useEffect, useMemo, useState } from 'react';
import { compareMovieFields, type CurrentMovieValues, type FieldComparison } from '../domain/fieldComparison';
import { buildImportPlan, type ImportPlan, type PersonResolution } from '../domain/importPlanning';
import type { MovieFieldKey, NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import { matchPerson, type ExistingPersonRecord, type PersonMatchDecision } from '../domain/personMatching';
import type { TmdbSearchQuery, TmdbSearchResult } from '../providers/tmdbTypes';
import { defaultImageSelection, type ImageSelection } from '../providers/imageProvider';
import { ConfirmStep } from './ConfirmStep';
import './ImportModal.css';
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
  const [tmdbId, setTmdbId] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [movie, setMovie] = useState<NormalizedMovie | null>(null);
  const [comparisons, setComparisons] = useState<FieldComparison[]>([]);
  const [people, setPeople] = useState<Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>>([]);
  const [imageSelection, setImageSelection] = useState<ImageSelection>({ poster: null, heroImage: null, backdrops: [] });
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMovie, setIsLoadingMovie] = useState(false);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

  const loadSelectedMovie = async (tmdbId: number) => {
    try {
      setError(null);
      setIsLoadingMovie(true);
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
    } finally {
      setIsLoadingMovie(false);
    }
  };

  const searchTmdb = async () => {
    try {
      setError(null);
      setIsSearching(true);
      setResults(await props.searchMovies({ title, year }));
    } catch {
      setError('Unable to search TMDB right now. Try again in a moment.');
    } finally {
      setIsSearching(false);
    }
  };

  const submitImportPlan = async () => {
    try {
      setError(null);
      setIsSubmittingPlan(true);
      await props.execute(plan);
    } catch {
      setError('Unable to start the import. If the import already began, some drafts or uploads may exist in DatoCMS.');
    } finally {
      setIsSubmittingPlan(false);
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
      if (decision.type === 'reuse') return [{ candidateTmdbId: candidate.tmdbId, candidateRole: candidate.role, action: 'reuse', recordId: decision.recordId, name: candidate.name, source: decision.source }];
      if (decision.type === 'create') return [{ candidateTmdbId: candidate.tmdbId, candidateRole: candidate.role, action: 'create', name: decision.name, source: decision.source }];
      return [];
    }),
  }), [comparisons, imageSelection, movie, people]);

  if (step === 'search') {
    return (
      <div className="movie-import-modal">
        <SearchStep title={title} year={year} results={results} onTitleChange={setTitle} onYearChange={setYear} onSearch={searchTmdb} onSelect={loadSelectedMovie} tmdbId={tmdbId} onTmdbIdChange={setTmdbId} isSearching={isSearching} isLoadingMovie={isLoadingMovie} onLoadTmdbId={() => {
          const parsed = Number(tmdbId);
          if (!Number.isSafeInteger(parsed) || parsed <= 0) {
            setError('Enter a valid TMDB ID.');
            return;
          }
          void loadSelectedMovie(parsed);
        }} />
        {error ? <p role="alert" className="movie-import-modal__warning">{error}</p> : null}
      </div>
    );
  }

  if (step === 'review') {
    return (
      <div className="movie-import-modal">
        <ReviewStep movie={movie!} comparisons={comparisons} onToggle={(key) => setComparisons((items) => items.map((item) => item.key === key ? { ...item, selected: !item.selected } : item))} onSelectAll={() => setComparisons((items) => items.map((item) => ({ ...item, selected: item.available && item.changed })))} onClearAll={() => setComparisons((items) => items.map((item) => ({ ...item, selected: false })))} onBack={() => setStep('search')} people={people} onResolvePerson={(candidate, value) => setPeople((items) => items.map((item) => {
          if (!samePersonCandidate(item.candidate, candidate)) return item;
          if (value === 'create') return { ...item, decision: { type: 'create', name: candidate.name, source: 'manual', warning: 'Selected manually. A new draft Person record will be created after confirmation.' } };
          return { ...item, decision: { type: 'reuse', recordId: value.slice('reuse:'.length), source: 'manual', warning: 'Selected manually from possible matches.' } };
        }))} images={movie?.images ?? []} imageSelection={imageSelection} onTogglePoster={(image) => setImageSelection((selection) => {
          return { ...selection, poster: selection.poster && sameImage(selection.poster, image) ? null : image };
        })} onSelectHeroImage={(image) => setImageSelection((selection) => {
          return { ...selection, heroImage: image };
        })} onToggleBackdrop={(image) => setImageSelection((selection) => {
          return { ...selection, backdrops: selection.backdrops.some((candidate) => sameImage(candidate, image)) ? selection.backdrops.filter((candidate) => !sameImage(candidate, image)) : [...selection.backdrops, image] };
        })} onContinue={() => setStep('confirm')} />
      </div>
    );
  }

  return (
    <div className="movie-import-modal">
      <ConfirmStep plan={plan} isSubmittingPlan={isSubmittingPlan} onBack={() => setStep('review')} onConfirm={() => void submitImportPlan()} />
      {error ? <p role="alert" className="movie-import-modal__warning">{error}</p> : null}
    </div>
  );
}

function sameImage(left: NormalizedImageCandidate, right: NormalizedImageCandidate) {
  return left.providerKey === right.providerKey && left.providerImageId === right.providerImageId;
}

function samePersonCandidate(left: PersonCandidate, right: PersonCandidate) {
  return left.role === right.role && left.tmdbId === right.tmdbId;
}
