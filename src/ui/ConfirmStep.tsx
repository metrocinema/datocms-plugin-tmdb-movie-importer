import { Button, Section } from 'datocms-react-ui';
import { useEffect, useRef } from 'react';
import type { ImportPlan } from '../domain/importPlanning';
import type { NormalizedMovie } from '../domain/movie';
import { countConfirmSummary, movieFieldLabels } from './modalPresentation';
import { ModalStepIndicator } from './ModalStepIndicator';

type ConfirmStepProps = {
  plan: ImportPlan;
  movie: NormalizedMovie;
  onConfirm: () => void;
  onBack: () => void;
  isSubmittingPlan?: boolean;
};

export function ConfirmStep({ plan, movie, onConfirm, onBack, isSubmittingPlan = false }: ConfirmStepProps) {
  const summary = countConfirmSummary(plan);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fieldLabels = plan.fieldChanges.map((change) => movieFieldLabels[change.key]);
  const imageDestinations = formatImageDestinations(plan);

  useEffect(() => {
    const moveToStart = () => {
      const scrollRoot = document.scrollingElement;

      if (scrollRoot) {
        scrollRoot.scrollTop = 0;
        scrollRoot.scrollLeft = 0;
      }

      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
      headingRef.current?.focus({ preventScroll: true });
    };

    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(moveToStart);
      return () => window.cancelAnimationFrame(frame);
    }

    moveToStart();
  }, []);

  return (
    <section className="movie-import-modal__confirm-step movie-import-modal__step-frame">
      <div className="movie-import-modal__chrome-header">
        <ModalStepIndicator activeStep="confirm" />
        <header className="movie-import-modal__header">
          <p className="movie-import-modal__eyebrow">TMDB movie importer</p>
          <h2 ref={headingRef} tabIndex={-1} className="movie-import-modal__title movie-import-modal__title--focus-target">Confirm import</h2>
          <p className="movie-import-modal__intro">Start the reviewed TMDB import for this movie form. DatoCMS will run the selected creates, uploads, and form updates after this modal closes.</p>
        </header>
      </div>
      <div className="movie-import-modal__scroll-body">
        <Section title="Import summary">
          <div className="movie-import-modal__confirm-decision">
            <div className="movie-import-modal__confirm-target" aria-label="Movie receiving reviewed values">
              <span className="movie-import-modal__section-kicker">Movie form</span>
              <strong>{movie.title}</strong>
              <span>TMDB ID {movie.tmdbId}</span>
            </div>
            <dl className="movie-import-modal__confirm-summary">
              <ConfirmSummaryRow label={`${summary.fieldChanges} ${pluralize(summary.fieldChanges, 'field')} to update`} value={fieldLabels.length > 0 ? formatList(fieldLabels) : 'No field values selected'} />
              <ConfirmSummaryRow label={`${summary.peopleToCreate} draft ${pluralize(summary.peopleToCreate, 'Person record')} to create`} value={plan.peopleToCreate.length > 0 ? formatPeopleNames(plan.peopleToCreate) : 'No draft Person records'} />
              <ConfirmSummaryRow label={`${summary.peopleToReuse} existing ${pluralize(summary.peopleToReuse, 'Person record')} to link`} value={plan.peopleToReuse.length > 0 ? formatPeopleNames(plan.peopleToReuse) : 'No existing Person records'} />
              <ConfirmSummaryRow label={`${summary.imagesToUpload} unique ${pluralize(summary.imagesToUpload, 'image')} to upload`} value={imageDestinations} />
            </dl>
          </div>
        </Section>
        <div className="movie-import-modal__next-steps" aria-label="What happens after you start">
          <h3>What happens after you start</h3>
          <ol>
            <li>Create selected draft Person records in DatoCMS.</li>
            <li>Upload selected poster and backdrop images.</li>
            <li>Apply selected TMDB values to the unsaved movie form.</li>
          </ol>
          <p>The movie record will remain unsaved until you save it in DatoCMS.</p>
          <p className="movie-import-modal__next-warning">If something fails after people or images are created, those drafts or uploads may remain in DatoCMS.</p>
        </div>
      </div>
      <div className="movie-import-modal__actions movie-import-modal__actions--sticky movie-import-modal__actions--confirm">
        <Button type="button" onClick={onBack} disabled={isSubmittingPlan}>
          Back to review
        </Button>
        <Button buttonType="primary" type="button" onClick={onConfirm} disabled={isSubmittingPlan}>
          {isSubmittingPlan ? 'Preparing import' : 'Start import'}
        </Button>
      </div>
    </section>
  );
}

function ConfirmSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="movie-import-modal__confirm-summary-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatImageDestinations(plan: ImportPlan) {
  const posterCount = plan.assetsToUpload.filter((image) => image.type === 'poster').length;
  const parts = [
    posterCount > 0 ? `${posterCount} ${pluralize(posterCount, 'poster')}` : null,
    plan.heroImageToUpload ? '1 Hero image' : null,
    plan.otherImagesToUpload.length > 0 ? `${plan.otherImagesToUpload.length} Other ${pluralize(plan.otherImagesToUpload.length, 'image')} destination${plan.otherImagesToUpload.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? formatList(parts) : 'No images selected';
}

function formatPeopleNames(people: Array<{ name: string }>) {
  return formatList(people.map((person) => person.name));
}

function formatList(parts: Array<string | null>) {
  const values = parts.filter((part): part is string => Boolean(part));

  if (values.length <= 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}
