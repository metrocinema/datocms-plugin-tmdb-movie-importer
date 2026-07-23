type ModalStepIndicatorProps = {
  activeStep: 'find' | 'review' | 'confirm';
};

const steps = [
  { id: 'find', label: 'Find movie' },
  { id: 'review', label: 'Review changes' },
  { id: 'confirm', label: 'Confirm import' },
] as const;

export function ModalStepIndicator({ activeStep }: ModalStepIndicatorProps) {
  return (
    <ol aria-label="Import steps" className="movie-import-modal__steps">
      {steps.map((step) => (
        <li
          key={step.id}
          className={step.id === activeStep ? 'movie-import-modal__step movie-import-modal__step--active' : 'movie-import-modal__step'}
          aria-current={step.id === activeStep ? 'step' : undefined}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}
