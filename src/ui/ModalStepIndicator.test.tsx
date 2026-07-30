import { render, screen } from '@testing-library/react';
import { ModalStepIndicator } from './ModalStepIndicator';

describe('ModalStepIndicator', () => {
  it.each([
    ['find', 'Find movie'],
    ['review', 'Review changes'],
    ['confirm', 'Confirm import'],
  ] as const)('identifies only %s as the current import step', (activeStep, label) => {
    render(<ModalStepIndicator activeStep={activeStep} />);

    expect(screen.getByRole('list', { name: 'Import steps' })).toBeInTheDocument();
    const currentSteps = screen.getAllByRole('listitem').filter((step) => step.getAttribute('aria-current') === 'step');

    expect(currentSteps).toHaveLength(1);
    expect(currentSteps[0]).toHaveTextContent(label);
  });

  it('communicates completed, current, and upcoming progress on the review step', () => {
    render(<ModalStepIndicator activeStep="review" />);

    const [findStep, reviewStep, confirmStep] = screen.getAllByRole('listitem');

    expect(findStep).toHaveClass('movie-import-modal__step--complete');
    expect(findStep).toHaveAccessibleName('Step 1 of 3, Find movie, completed');
    expect(reviewStep).toHaveClass('movie-import-modal__step--current');
    expect(reviewStep).toHaveAccessibleName('Step 2 of 3, Review changes, current');
    expect(confirmStep).toHaveClass('movie-import-modal__step--upcoming');
    expect(confirmStep).toHaveAccessibleName('Step 3 of 3, Confirm import, upcoming');
  });

  it('shows one compact active-step summary for narrow layouts', () => {
    render(<ModalStepIndicator activeStep="confirm" />);

    expect(screen.getByText('Step 3 of 3')).toHaveClass('movie-import-modal__step-summary-position');
    expect(screen.getByText('·')).toHaveClass('movie-import-modal__step-summary-separator');
    expect(screen.getByText('Confirm import', { selector: '.movie-import-modal__step-summary-label' })).toBeInTheDocument();
  });
});
