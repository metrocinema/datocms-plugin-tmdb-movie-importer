import { renderIntoRoot } from './reactRoot';

describe('renderIntoRoot', () => {
  it('reuses the existing React root for repeated SDK render callbacks', () => {
    const container = document.createElement('div');
    const render = vi.fn();
    const createRoot = vi.fn(() => ({ render, unmount: vi.fn() }));

    renderIntoRoot(container, 'first', createRoot);
    renderIntoRoot(container, 'second', createRoot);

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenNthCalledWith(1, 'first');
    expect(render).toHaveBeenNthCalledWith(2, 'second');
  });
});
