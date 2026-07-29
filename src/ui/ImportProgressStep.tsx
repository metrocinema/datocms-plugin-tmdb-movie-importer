import { Button, Spinner } from 'datocms-react-ui';
import { useEffect, useRef, useState } from 'react';
import type { ImportPlan } from '../domain/importPlanning';
import type { ImportProgressEvent, ImportProgressPhase } from '../dato/importExecutor';
import { ModalStepIndicator } from './ModalStepIndicator';
import { countConfirmSummary } from './modalPresentation';

const phaseLabels: Record<ImportProgressPhase, string> = {
  people_lookup: 'Matching existing people',
  people_create: 'Creating draft people',
  images: 'Uploading images',
  fields_prepare: 'Preparing movie field values',
};

const phaseOrder: ImportProgressPhase[] = ['people_lookup', 'people_create', 'images', 'fields_prepare'];

type ImportProgressStepProps = {
  plan: ImportPlan;
  progressEvents: Record<ImportProgressPhase, ImportProgressEvent>;
  preparationFailure: string | null;
  onClose: () => void;
};

export function initialImportProgress(): Record<ImportProgressPhase, ImportProgressEvent> {
  return Object.fromEntries(
    Object.keys(phaseLabels).map((phase) => [phase, {
      phase,
      state: 'waiting',
      completed: 0,
      total: 0,
    }]),
  ) as Record<ImportProgressPhase, ImportProgressEvent>;
}

export function ImportProgressStep({ plan, progressEvents, preparationFailure, onClose }: ImportProgressStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousProgressEventsRef = useRef(progressEvents);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const summary = countConfirmSummary(plan);
  const impactSummary = [
    `${summary.fieldChanges} ${pluralize(summary.fieldChanges, 'field')} selected`,
    `${summary.imagesToUpload} ${pluralize(summary.imagesToUpload, 'image')} selected`,
    `${summary.peopleToCreate} new ${pluralize(summary.peopleToCreate, 'person', 'people')}`,
    `${summary.peopleToReuse} reused ${pluralize(summary.peopleToReuse, 'person', 'people')}`,
  ];

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const changedAnnouncements = phaseOrder.flatMap((phase) => {
      const currentEvent = progressEvents[phase];
      const previousEvent = previousProgressEventsRef.current[phase];

      if (!didProgressEventChange(previousEvent, currentEvent) || currentEvent.state === 'waiting') {
        return [];
      }

      return [`${phaseLabels[phase]}: ${progressDetail(currentEvent)}.`];
    });

    if (changedAnnouncements.length > 0) {
      setLiveAnnouncement(changedAnnouncements.join(' '));
    }

    previousProgressEventsRef.current = progressEvents;
  }, [progressEvents]);

  return (
    <section className="movie-import-modal__progress-step movie-import-modal__step-frame">
      <div className="movie-import-modal__chrome-header">
        <ModalStepIndicator activeStep="confirm" />
      </div>
      <div className="movie-import-modal__scroll-body">
        <header className="movie-import-modal__header">
          <p className="movie-import-modal__eyebrow">TMDB movie importer</p>
          <h2 ref={headingRef} tabIndex={-1} className="movie-import-modal__title movie-import-modal__title--focus-target">Importing movie</h2>
          <p className="movie-import-modal__intro">Preparing the selected people, images, and movie values before they are applied to this form.</p>
        </header>

        {preparationFailure ? (
          <div className="movie-import-modal__progress-failure" role="alert">
            <h3>Preparation failed</h3>
            <p>{preparationFailure}</p>
            <p>Draft people or uploaded images may already exist in DatoCMS.</p>
          </div>
        ) : (
          <div className="movie-import-modal__progress-status" role="status" aria-live="polite" aria-atomic="true">
            <Spinner size={48} />
            <p>Preparing your TMDB import</p>
            <span className="movie-import-modal__visually-hidden">{liveAnnouncement}</span>
          </div>
        )}

        <ol className="movie-import-modal__progress-phases" aria-label="Import preparation progress">
          {(Object.keys(phaseLabels) as ImportProgressPhase[]).map((phase) => {
            const event = progressEvents[phase];

            return (
              <li key={phase} className={`movie-import-modal__progress-phase movie-import-modal__progress-phase--${event.state}`}>
                <span className="movie-import-modal__progress-phase-label">{phaseLabels[phase]}</span>
                <span className="movie-import-modal__progress-phase-detail">{progressDetail(event)}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="movie-import-modal__actions movie-import-modal__actions--sticky movie-import-modal__actions--progress">
        <p className="movie-import-modal__action-summary" aria-label={`${summary.fieldChanges} ${pluralize(summary.fieldChanges, 'field')} selected, ${summary.imagesToUpload} ${pluralize(summary.imagesToUpload, 'image')} selected, ${summary.peopleToCreate} new ${pluralize(summary.peopleToCreate, 'person', 'people')}, ${summary.peopleToReuse} reused ${pluralize(summary.peopleToReuse, 'person', 'people')}`}>
          {impactSummary.map((item) => <span key={item}>{item}</span>)}
        </p>
        {preparationFailure ? (
          <div className="movie-import-modal__action-buttons">
            <Button buttonType="primary" type="button" onClick={onClose}>Close</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function didProgressEventChange(previousEvent: ImportProgressEvent, currentEvent: ImportProgressEvent) {
  return previousEvent.state !== currentEvent.state
    || previousEvent.completed !== currentEvent.completed
    || previousEvent.total !== currentEvent.total
    || previousEvent.message !== currentEvent.message;
}

function progressDetail(event: ImportProgressEvent) {
  if (event.state === 'waiting') return 'Waiting';
  if (event.state === 'failed') return event.message ?? 'Failed';
  if (event.phase === 'images') return `${event.completed} of ${event.total} ${event.completed === 1 ? 'image' : 'images'} uploaded`;
  if (event.total === 0) return 'No items to prepare';
  return `${event.completed} of ${event.total} complete`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}
