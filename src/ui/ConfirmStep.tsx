import { Button, Section } from 'datocms-react-ui';
import type { ImportPlan } from '../domain/importPlanning';
import { countConfirmSummary } from './modalPresentation';
import { ModalStepIndicator } from './ModalStepIndicator';

type ConfirmStepProps = {
  plan: ImportPlan;
  onConfirm: () => void;
  onBack: () => void;
  isSubmittingPlan?: boolean;
};

export function ConfirmStep({ plan, onConfirm, onBack, isSubmittingPlan = false }: ConfirmStepProps) {
  const summary = countConfirmSummary(plan);

  return (
    <section>
      <ModalStepIndicator activeStep="confirm" />
      <header className="movie-import-modal__header">
        <p className="movie-import-modal__eyebrow">TMDB movie importer</p>
        <h2 className="movie-import-modal__title">Confirm import</h2>
        <p className="movie-import-modal__intro">Check what will be created or applied. The movie stays unsaved until you save it in DatoCMS.</p>
      </header>
      <Section title="Import summary">
        <dl className="movie-import-modal__counts">
          <div>
            <dt>Field changes</dt>
            <dd>{summary.fieldChanges}</dd>
          </div>
          <div>
            <dt>People to create</dt>
            <dd>{summary.peopleToCreate}</dd>
          </div>
          <div>
            <dt>People to reuse</dt>
            <dd>{summary.peopleToReuse}</dd>
          </div>
          <div>
            <dt>Images to upload</dt>
            <dd>{summary.imagesToUpload}</dd>
          </div>
        </dl>
      </Section>
      <div className="movie-import-modal__safety">
        <p>After confirmation, the plugin applies selected values to the current unsaved DatoCMS movie form.</p>
        <p>It does not save or publish the movie.</p>
        <p>If the import fails after creating people or uploading images, those drafts or uploads may remain in DatoCMS.</p>
      </div>
      <div className="movie-import-modal__actions">
        <Button type="button" onClick={onBack} disabled={isSubmittingPlan}>
          Back to review
        </Button>
        <Button buttonType="primary" type="button" onClick={onConfirm} disabled={isSubmittingPlan}>
          {isSubmittingPlan ? 'Preparing import' : 'Apply to unsaved movie'}
        </Button>
      </div>
    </section>
  );
}
