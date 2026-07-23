import { Button, Section } from 'datocms-react-ui';
import type { ImportPlan } from '../domain/importPlanning';
import { countConfirmSummary } from './modalPresentation';
import { ModalStepIndicator } from './ModalStepIndicator';

type ConfirmStepProps = {
  plan: ImportPlan;
  onConfirm: () => void;
};

export function ConfirmStep({ plan, onConfirm }: ConfirmStepProps) {
  const summary = countConfirmSummary(plan);

  return (
    <section>
      <ModalStepIndicator activeStep="confirm" />
      <header className="movie-import-modal__header">
        <p className="movie-import-modal__eyebrow">TMDB movie importer</p>
        <h2 className="movie-import-modal__title">Confirm import</h2>
        <p className="movie-import-modal__intro">Review the planned side effects before applying values to the unsaved DatoCMS form.</p>
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
        <p>The plugin applies values to the current unsaved DatoCMS movie form.</p>
        <p>It does not save or publish the movie.</p>
        <p>Created people and uploaded images may remain in DatoCMS if a later form update fails.</p>
      </div>
      <div className="movie-import-modal__actions">
        <Button buttonType="primary" type="button" onClick={onConfirm}>
          Apply to unsaved movie
        </Button>
      </div>
    </section>
  );
}
