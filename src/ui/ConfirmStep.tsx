import type { ImportPlan } from '../domain/importPlanning';

type ConfirmStepProps = {
  plan: ImportPlan;
  onConfirm: () => void;
};

export function ConfirmStep({ plan, onConfirm }: ConfirmStepProps) {
  return (
    <section>
      <h2>Confirm import</h2>
      <p>{plan.fieldChanges.length} field changes</p>
      <p>{plan.peopleToCreate.length} draft people to create</p>
      <p>{plan.assetsToUpload.length} images to upload</p>
      <button type="button" onClick={onConfirm}>
        Apply to unsaved movie
      </button>
    </section>
  );
}
