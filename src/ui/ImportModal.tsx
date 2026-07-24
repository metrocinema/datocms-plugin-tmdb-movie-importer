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
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMovie, setIsLoadingMovie] = useState(false);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);

  const loadSelectedMovie = async (tmdbId: number) => {
    try {
      setError(null);
      setIsLoadingMovie(true);
      const loaded = await props.loadMovie(tmdbId);
      const peopleCandidates = peopleCandidatesForMappedFields(loaded, props.mappedFields);
      const records = await props.resolvePeople?.(peopleCandidates) ?? [];
      setMovie(loaded);
      setComparisons(compareMovieFields(props.currentValues, loaded, props.mappedFields));
      setPeople(peopleCandidates.map((candidate) => ({ candidate, decision: matchPerson(candidate, records, props.tmdbIdFieldConfigured ?? true) })));
      setImageSelection(imageSelectionForMappedFields(defaultImageSelection(props.currentValues, loaded.images), props.mappedFields));
      setStep('review');
    } catch {
      setError('The TMDB movie could not be loaded. Search by title and year, or try a different TMDB ID.');
      setStep('search');
    } finally {
      setIsLoadingMovie(false);
    }
  };

  const searchTmdb = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('Enter a movie title before searching, or load a known TMDB ID.');
      setResults([]);
      setHasSearched(false);
      return;
    }

    if (year !== null && (!Number.isSafeInteger(year) || year < 0)) {
      setError('Enter a positive whole-number year, or leave Year blank.');
      return;
    }

    try {
      setError(null);
      setIsSearching(true);
      setResults(await props.searchMovies({ title: trimmedTitle, year }));
      setHasSearched(true);
    } catch {
      setError('TMDB search is unavailable right now. Try again in a moment, or load a known TMDB ID.');
    } finally {
      setIsSearching(false);
    }
  };

  const submitImportPlan = async () => {
    if (isSubmittingPlan) {
      return;
    }

    try {
      setError(null);
      setIsSubmittingPlan(true);
      await props.execute(plan);
    } catch {
      setError('The import could not start from the modal. Nothing was saved or published from this confirmation step.');
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
    mappedFields: props.mappedFields,
  }), [comparisons, imageSelection, movie, people, props.mappedFields]);

  if (step === 'search') {
    return (
      <div className="movie-import-modal">
        <SearchStep title={title} year={year} results={results} hasSearched={hasSearched} onTitleChange={setTitle} onYearChange={setYear} onSearch={searchTmdb} onSelect={loadSelectedMovie} tmdbId={tmdbId} onTmdbIdChange={setTmdbId} isSearching={isSearching} isLoadingMovie={isLoadingMovie} onLoadTmdbId={() => {
          const trimmedTmdbId = tmdbId.trim();
          const parsed = Number(trimmedTmdbId);

          if (!/^\d+$/.test(trimmedTmdbId) || !Number.isSafeInteger(parsed) || parsed <= 0) {
            setError('Enter a positive whole-number TMDB ID.');
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
        <ReviewStep movie={movie!} comparisons={comparisons} mappedFields={props.mappedFields} onToggle={(key) => setComparisons((items) => items.map((item) => item.key === key ? { ...item, selected: !item.selected } : item))} onSelectAll={() => setComparisons((items) => items.map((item) => ({ ...item, selected: item.available && item.changed })))} onClearAll={() => setComparisons((items) => items.map((item) => ({ ...item, selected: false })))} onBack={() => setStep('search')} people={people} onResolvePerson={(candidate, value) => setPeople((items) => items.map((item) => {
          if (!samePersonCandidate(item.candidate, candidate)) return item;
          if (value === 'create') return { ...item, decision: { type: 'create', name: candidate.name, source: 'manual', warning: 'You chose to create a new draft Person after confirmation.' } };
          return { ...item, decision: { type: 'reuse', recordId: value.slice('reuse:'.length), source: 'manual', warning: 'You chose to reuse an existing Person record.' } };
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
      <ConfirmStep movie={movie!} plan={plan} isSubmittingPlan={isSubmittingPlan} onBack={() => setStep('review')} onConfirm={() => void submitImportPlan()} />
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

function peopleCandidatesForMappedFields(movie: NormalizedMovie, mappedFields: MovieFieldKey[]) {
  return [
    ...(mappedFields.includes('directors') ? movie.directors : []),
    ...(mappedFields.includes('actors') ? movie.actors : []),
  ];
}

function imageSelectionForMappedFields(selection: ImageSelection, mappedFields: MovieFieldKey[]): ImageSelection {
  return {
    poster: mappedFields.includes('poster') ? selection.poster : null,
    heroImage: mappedFields.includes('heroImage') ? selection.heroImage : null,
    backdrops: mappedFields.includes('backdrops') ? selection.backdrops : [],
  };
}
