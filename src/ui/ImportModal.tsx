import { useEffect, useMemo, useRef, useState } from 'react';
import type { ImportProgressEvent, ImportProgressPhase, PreparedImport, PrepareImportResult } from '../dato/importExecutor';
import { compareMovieFields, type CurrentMovieValues, type FieldComparison } from '../domain/fieldComparison';
import { buildImportPlan, type ImportPlan, type PersonResolution } from '../domain/importPlanning';
import type { MovieFieldKey, NormalizedImageCandidate, NormalizedMovie, PersonCandidate } from '../domain/movie';
import type { NormalizedTrailerCandidate } from '../domain/trailer';
import { matchPerson, type ExistingPersonRecord, type PersonMatchDecision } from '../domain/personMatching';
import type { TmdbSearchQuery, TmdbSearchResult } from '../providers/tmdbTypes';
import { TmdbError } from '../providers/tmdbClient';
import { defaultImageSelection, selectHeroImage, toggleOtherImage, type ImageSelection } from '../providers/imageProvider';
import { prepareSelectableImages } from '../providers/imagePreparation';
import { ImportConfigurationError } from '../plugin/runtimeValidation';
import { ConfirmStep } from './ConfirmStep';
import './ImportModal.css';
import { ImportProgressStep, initialImportProgress } from './ImportProgressStep';
import { ReviewStep } from './ReviewStep';
import { SearchStep, type SearchActivity } from './SearchStep';

type Step = 'search' | 'review' | 'confirm' | 'progress';

type PreparationLifecycleProps = {
  prepare: (
    plan: ImportPlan,
    onProgress: (event: ImportProgressEvent) => void,
  ) => Promise<PrepareImportResult>;
  resolve: (prepared: PreparedImport | null) => Promise<void>;
};

export type ImportModalProps = {
  initialTitle: string;
  initialYear: number | null;
  initialTmdbId?: number | null;
  currentValues: CurrentMovieValues;
  mappedFields: MovieFieldKey[];
  searchMovies: (query: TmdbSearchQuery) => Promise<TmdbSearchResult[]>;
  loadMovie: (tmdbId: number) => Promise<NormalizedMovie>;
  resolvePeople?: (candidates: PersonCandidate[]) => Promise<ExistingPersonRecord[]>;
  prepareImages?: (images: NormalizedImageCandidate[]) => Promise<NormalizedImageCandidate[]>;
  tmdbIdFieldConfigured?: boolean;
} & PreparationLifecycleProps;

export function ImportModal(props: ImportModalProps) {
  const prepareImages = props.prepareImages ?? prepareSelectableImages;
  const [step, setStep] = useState<Step>('search');
  const [title, setTitle] = useState(props.initialTitle);
  const [year, setYear] = useState<number | null>(props.initialYear);
  const [tmdbId, setTmdbId] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [movie, setMovie] = useState<NormalizedMovie | null>(null);
  const [selectedTrailer, setSelectedTrailer] = useState<NormalizedTrailerCandidate | null>(null);
  const [comparisons, setComparisons] = useState<FieldComparison[]>([]);
  const [people, setPeople] = useState<Array<{ candidate: PersonCandidate; decision: PersonMatchDecision }>>([]);
  const [imageSelection, setImageSelection] = useState<ImageSelection>({ poster: null, heroImage: null, backdrops: [] });
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchActivity, setSearchActivity] = useState<SearchActivity>(null);
  const [progressEvents, setProgressEvents] = useState<Record<ImportProgressPhase, ImportProgressEvent>>(initialImportProgress);
  const [preparationFailure, setPreparationFailure] = useState<string | null>(null);
  const [preparationMayHaveSideEffects, setPreparationMayHaveSideEffects] = useState(false);
  const isPreparingRef = useRef(false);

  const loadSelectedMovie = async (tmdbId: number) => {
    try {
      setError(null);
      setSearchActivity('loading_movie');
      const loaded = await props.loadMovie(tmdbId);
      const peopleCandidates = peopleCandidatesForMappedFields(loaded, props.mappedFields);
      let peoplePending = true;
      const peoplePromise = (props.resolvePeople?.(peopleCandidates) ?? Promise.resolve([]))
        .then(
          (value) => {
            peoplePending = false;
            return { status: 'fulfilled' as const, value };
          },
          (reason: unknown) => {
            peoplePending = false;
            return { status: 'rejected' as const, reason };
          },
        );

      setSearchActivity('checking_artwork');
      const preparedImages = await prepareImages(loaded.images).catch((reason) => {
        console.error(
          'Movie Importer artwork preparation failed',
          tokenSafeErrorDetails(reason),
        );
        return loaded.images;
      });

      if (peoplePending) {
        setSearchActivity('matching_people');
      }
      const peopleResult = await peoplePromise;
      if (peopleResult.status === 'rejected') {
        console.error('Movie Importer person matching failed', tokenSafeErrorDetails(peopleResult.reason));
        setError('The TMDB movie loaded, but Person matching failed. Check that this editor can list Person records, then try again.');
        setStep('search');
        return;
      }

      const preparedMovie = { ...loaded, images: preparedImages };
      setMovie(preparedMovie);
      setSelectedTrailer(null);
      setComparisons(compareMovieFields(props.currentValues, preparedMovie, props.mappedFields));
      setPeople(peopleCandidates.map((candidate) => ({ candidate, decision: matchPerson(candidate, peopleResult.value, props.tmdbIdFieldConfigured ?? true) })));
      setImageSelection(defaultImageSelection(
        props.currentValues,
        preparedImages,
        imageDestinationAvailabilityForMappedFields(props.mappedFields),
      ));
      setStep('review');
    } catch (error) {
      console.error('Movie Importer TMDB movie load failed', tokenSafeErrorDetails(error));
      setError(messageForTmdbMovieLoadError(error));
      setStep('search');
    } finally {
      setSearchActivity(null);
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
      setResults([]);
      setHasSearched(false);
      setSearchActivity('searching');
      setResults(await props.searchMovies({ title: trimmedTitle, year }));
      setHasSearched(true);
    } catch (error) {
      console.error('Movie Importer TMDB search failed', tokenSafeErrorDetails(error));
      setError(messageForTmdbSearchError(error));
    } finally {
      setSearchActivity(null);
    }
  };

  const submitImportPlan = async () => {
    if (isPreparingRef.current) {
      return;
    }

    isPreparingRef.current = true;
    setPreparationFailure(null);
    setPreparationMayHaveSideEffects(false);
    setProgressEvents(initialImportProgress());
    setStep('progress');

    try {
      const result = await props.prepare(plan, (event) => {
        setProgressEvents((current) => ({
          ...current,
          [event.phase]: event,
        }));
      });

      if (result.status === 'success') {
        await props.resolve(result.prepared);
        return;
      }

      setProgressEvents((current) => ({
        ...current,
        [result.failedPhase]: {
          ...current[result.failedPhase],
          phase: result.failedPhase,
          state: 'failed',
        },
      }));
      setPreparationMayHaveSideEffects(result.sideEffectsPossible);
      setPreparationFailure(result.message);
    } catch (error) {
      setPreparationMayHaveSideEffects(
        !isControlledConfigurationError(error),
      );
      setPreparationFailure(messageForPreparationError(error));
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

  const toggleComparison = (key: FieldComparison['key']) => {
    setComparisons((items) => items.map((item) => item.key === key ? { ...item, selected: !item.selected } : item));
  };

  const selectAllScalarComparisons = () => {
    setComparisons((items) => items.map((item) => item.key === 'trailer' ? item : { ...item, selected: item.available && item.changed }));
  };

  const clearScalarComparisons = () => {
    setComparisons((items) => items.map((item) => item.key === 'trailer' ? item : { ...item, selected: false }));
  };

  const selectTrailer = (trailer: NormalizedTrailerCandidate | null) => {
    setSelectedTrailer(trailer);
    const nextTrailerComparison = compareMovieFields(
      props.currentValues,
      movie!,
      ['trailer'],
      trailer,
    )[0];
    setComparisons((items) => items.map((item) => item.key === 'trailer' ? nextTrailerComparison : item));
  };

  if (step === 'search') {
    return (
      <div className="movie-import-modal">
        <SearchStep title={title} year={year} results={results} hasSearched={hasSearched} onTitleChange={setTitle} onYearChange={setYear} onSearch={searchTmdb} onSelect={loadSelectedMovie} tmdbId={tmdbId} onTmdbIdChange={setTmdbId} searchActivity={searchActivity} onLoadTmdbId={() => {
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
        <ReviewStep movie={movie!} comparisons={comparisons} mappedFields={props.mappedFields} onToggle={toggleComparison} onSelectAll={selectAllScalarComparisons} onClearAll={clearScalarComparisons} onBack={() => setStep('search')} people={people} onResolvePerson={(candidate, value) => setPeople((items) => items.map((item) => {
          if (!samePersonCandidate(item.candidate, candidate)) return item;
          if (value === 'create') return { ...item, decision: { type: 'create', name: candidate.name, source: 'manual', warning: 'You chose to create a new draft Person after confirmation.' } };
          return { ...item, decision: { type: 'reuse', recordId: value.slice('reuse:'.length), source: 'manual', warning: 'You chose to reuse an existing Person record.' } };
        }))} selectedTrailer={selectedTrailer} onSelectTrailer={selectTrailer} images={movie?.images ?? []} imageSelection={imageSelection} onTogglePoster={(image) => setImageSelection((selection) => {
          return { ...selection, poster: image };
        })} onSelectHeroImage={(image) => setImageSelection((selection) => {
          return selectHeroImage(selection, image);
        })} onToggleBackdrop={(image) => setImageSelection((selection) => {
          return toggleOtherImage(selection, image);
        })} onContinue={() => setStep('confirm')} />
      </div>
    );
  }

  if (step === 'progress') {
    return (
      <div className="movie-import-modal">
        <ImportProgressStep plan={plan} progressEvents={progressEvents} preparationFailure={preparationFailure} preparationMayHaveSideEffects={preparationMayHaveSideEffects} onClose={() => void props.resolve(null)} />
      </div>
    );
  }

  return (
    <div className="movie-import-modal">
      <ConfirmStep movie={movie!} plan={plan} onBack={() => setStep('review')} onConfirm={() => void submitImportPlan()} />
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

function imageDestinationAvailabilityForMappedFields(mappedFields: MovieFieldKey[]) {
  return {
    poster: mappedFields.includes('poster'),
    heroImage: mappedFields.includes('heroImage'),
    backdrops: mappedFields.includes('backdrops'),
  };
}

function messageForTmdbSearchError(error: unknown) {
  if (error instanceof TmdbError) {
    if (error.code === 'auth') return 'TMDB read token is invalid or not allowed. Check the plugin settings and try again.';
    if (error.code === 'rate_limit') return 'TMDB rate limit reached. Try again shortly, or load a known TMDB ID.';
    if (error.code === 'network') return 'TMDB search could not be reached from this browser. Check your connection and try again.';
  }

  return 'TMDB search is unavailable right now. Try again in a moment, or load a known TMDB ID.';
}

function messageForTmdbMovieLoadError(error: unknown) {
  if (error instanceof TmdbError) {
    if (error.code === 'auth') return 'TMDB read token is invalid or not allowed. Check the plugin settings and try again.';
    if (error.code === 'not_found') return 'No TMDB movie was found for that ID. Check the ID and try again.';
    if (error.code === 'rate_limit') return 'TMDB rate limit reached. Try again shortly.';
    if (error.code === 'network') return 'TMDB could not be reached from this browser. Check your connection and try again.';
  }

  return 'The TMDB movie could not be loaded. Search by title and year, or try a different TMDB ID.';
}

function messageForPreparationError(error: unknown) {
  const genericMessage = 'The import could not finish while creating people or uploading images.';

  if (isControlledConfigurationError(error)) {
    return error.message;
  }

  return genericMessage;
}

function isControlledConfigurationError(
  error: unknown,
): error is ImportConfigurationError {
  return error instanceof ImportConfigurationError;
}

function tokenSafeErrorDetails(error: unknown) {
  if (error instanceof TmdbError) {
    return { name: error.name, code: error.code, message: error.message, details: error.details };
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { message: String(error) };
}
