import { useMemo, useState } from 'react';
import { compareMovieFields, type CurrentMovieValues, type FieldComparison } from '../domain/fieldComparison';
import { buildImportPlan, type ImportPlan } from '../domain/importPlanning';
import type { MovieFieldKey, NormalizedMovie } from '../domain/movie';
import type { TmdbSearchQuery, TmdbSearchResult } from '../providers/tmdbTypes';
import { defaultImageSelection } from '../providers/imageProvider';
import { ConfirmStep } from './ConfirmStep';
import { ReviewStep } from './ReviewStep';
import { SearchStep } from './SearchStep';

type Step = 'search' | 'review' | 'confirm';

export type ImportModalProps = {
  initialTitle: string;
  initialYear: number | null;
  currentValues: CurrentMovieValues;
  mappedFields: MovieFieldKey[];
  searchMovies: (query: TmdbSearchQuery) => Promise<TmdbSearchResult[]>;
  loadMovie: (tmdbId: number) => Promise<NormalizedMovie>;
  execute: (plan: ImportPlan) => Promise<void>;
};

export function ImportModal(props: ImportModalProps) {
  const [step, setStep] = useState<Step>('search');
  const [title, setTitle] = useState(props.initialTitle);
  const [year, setYear] = useState<number | null>(props.initialYear);
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [movie, setMovie] = useState<NormalizedMovie | null>(null);
  const [comparisons, setComparisons] = useState<FieldComparison[]>([]);

  const plan = useMemo(() => buildImportPlan({
    fieldComparisons: comparisons,
    directors: movie?.directors ?? [],
    actors: movie?.actors ?? [],
    imageSelection: movie ? defaultImageSelection(props.currentValues, movie.images) : { poster: null, backdrops: [] },
    personResolutions: [],
  }), [comparisons, movie, props.currentValues]);

  if (step === 'search') {
    return <SearchStep title={title} year={year} results={results} onTitleChange={setTitle} onYearChange={setYear} onSearch={async () => setResults(await props.searchMovies({ title, year }))} onSelect={async (id) => {
      const loaded = await props.loadMovie(id);
      setMovie(loaded);
      setComparisons(compareMovieFields(props.currentValues, loaded, props.mappedFields));
      setStep('review');
    }} />;
  }

  if (step === 'review') {
    return <ReviewStep comparisons={comparisons} onToggle={(key) => setComparisons((items) => items.map((item) => item.key === key ? { ...item, selected: !item.selected } : item))} onSelectAll={() => setComparisons((items) => items.map((item) => ({ ...item, selected: item.available && item.changed })))} onContinue={() => setStep('confirm')} />;
  }

  return <ConfirmStep plan={plan} onConfirm={() => void props.execute(plan)} />;
}
