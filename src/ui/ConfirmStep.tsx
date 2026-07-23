import type { ImportPlan } from '../domain/importPlanning';
import { countConfirmSummary } from './modalPresentation';

type ConfirmStepProps = {
  plan: ImportPlan;
  onConfirm: () => void;
};

export function ConfirmStep({ plan, onConfirm }: ConfirmStepProps) {
  const summary = countConfirmSummary(plan);

  return (
    <section>
      <ol>
        <li>Find movie</li>
        <li>Review changes</li>
        <li>Confirm import</li>
      </ol>
      <h2>Confirm import</h2>
      <h3>Import summary</h3>
      <dl>
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
      <p>The plugin applies values to the current unsaved DatoCMS movie form.</p>
      <p>It does not save or publish the movie.</p>
      <p>Created people and uploaded images may remain in DatoCMS if a later form update fails.</p>
      <button type="button" onClick={onConfirm}>
        Apply to unsaved movie
      </button>
    </section>
  );
}
