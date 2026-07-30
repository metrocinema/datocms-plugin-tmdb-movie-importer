type ModalStepIndicatorProps = {
  activeStep: 'find' | 'review' | 'confirm';
};

const steps = [
  { id: 'find', label: 'Find movie' },
  { id: 'review', label: 'Review changes' },
  { id: 'confirm', label: 'Confirm import' },
] as const;

export function ModalStepIndicator({ activeStep }: ModalStepIndicatorProps) {
  const activeStepIndex = steps.findIndex((step) => step.id === activeStep);
  const activeStepDefinition = steps[activeStepIndex];

  return (
    <div className="movie-import-modal__step-progress">
      <div className="movie-import-modal__step-summary" aria-hidden="true">
        <span className="movie-import-modal__step-summary-position">Step {activeStepIndex + 1} of {steps.length}</span>
        <span className="movie-import-modal__step-summary-separator">·</span>
        <span className="movie-import-modal__step-summary-label">{activeStepDefinition.label}</span>
      </div>
      <ol aria-label="Import steps" className="movie-import-modal__steps">
        {steps.map((step, index) => {
          const state = index < activeStepIndex ? 'complete' : index === activeStepIndex ? 'current' : 'upcoming';
          const stateLabel = state === 'complete' ? 'completed' : state;

          return (
            <li
              key={step.id}
              className={`movie-import-modal__step movie-import-modal__step--${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
              aria-label={`Step ${index + 1} of ${steps.length}, ${step.label}, ${stateLabel}`}
            >
              <span className="movie-import-modal__step-marker" aria-hidden="true">
                {state === 'complete' ? '✓' : index + 1}
              </span>
              <span className="movie-import-modal__step-label" aria-hidden="true">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
