/**
 * BAG CHARM PRESET = 54×54 (owner doctrine 10-26: the charm floor is 54×54).
 *
 * The server floors every charm grid to 54×54, but the Designer's Bag Charm
 * preset still started at 2″ × 14ct = 28×28 — so picking it immediately tripped
 * the "a bag charm needs at least 54×54 stitches" panel on the user's OWN first
 * click, telling them off for a canvas the app had just made.
 *
 * This suite drives the real Designer:
 *  (a) picking Bag Charm lands on a 54×54 canvas, says 54×54 on the button and
 *      shows NO steering panel — Generate is live;
 *  (b) the below-floor path is untouched: a grid below its mask's floor still
 *      gets the plain-words warning, the one-click resize and Create-Your-Own,
 *      and Generate stays disabled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Designer } from '../pages/Designer';

const renderDesigner = () =>
  render(
    <BrowserRouter>
      <Designer />
    </BrowserRouter>,
  );

/** The Custom Size W/H inputs, found by the value the canvas currently has. */
function typeCustomSize(currentW: string, nextW: string, nextH: string) {
  const inputs = screen.getAllByDisplayValue(currentW) as HTMLInputElement[];
  fireEvent.change(inputs[0], { target: { value: nextW } });
  fireEvent.change(inputs[1], { target: { value: nextH } });
}

const generateButton = () => screen.getByRole('button', { name: /^Generate/ });

describe('Bag Charm preset starts at the 54×54 charm floor', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows 54×54 on the preset and needs no warning when it is picked', () => {
    renderDesigner();

    fireEvent.click(screen.getByRole('button', { name: /^Bag Charm/ }));

    // The button says what the canvas really is.
    const presetButton = screen.getByRole('button', { name: /^Bag Charm/ });
    expect(presetButton.textContent).toContain('54×54 st');
    expect(presetButton.textContent).not.toContain('28×28');

    // …and the canvas is 54×54, so the charm floor is already met.
    const inputs = screen.getAllByDisplayValue('54') as HTMLInputElement[];
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    // No "needs at least 54×54" panel on the user's own first click.
    expect(screen.queryByTestId('mask-min-grid-steering')).not.toBeInTheDocument();
    expect(screen.queryByText(/needs at least 54×54/)).not.toBeInTheDocument();

    // Generate is live (the only gate left is the empty prompt).
    fireEvent.change(screen.getByPlaceholderText(/Describe your pattern in detail/), {
      target: { value: 'a red rose' },
    });
    expect(generateButton()).not.toBeDisabled();
  });

  it('still warns, resizes and offers Create-Your-Own for a grid below the floor', () => {
    renderDesigner();

    // A prompt that names a masked product, then a grid typed far too small.
    fireEvent.change(screen.getByPlaceholderText(/Describe your pattern in detail/), {
      target: { value: 'a red rose ornament' },
    });
    typeCustomSize('100', '28', '28');

    const panel = screen.getByTestId('mask-min-grid-steering');
    expect(panel).toBeInTheDocument();
    // The plain-words warning…
    expect(panel.textContent).toContain('needs at least 42×42 stitches');
    expect(panel.textContent).toContain('Your canvas is 28×28');
    // …both routes out of it…
    expect(screen.getByRole('button', { name: 'Use 42×42' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create it yourself' })).toBeInTheDocument();
    // …and Generate stays paused until one of them is taken.
    expect(generateButton()).toBeDisabled();
  });

  it('the one-click resize really lands on the floor', () => {
    renderDesigner();

    fireEvent.change(screen.getByPlaceholderText(/Describe your pattern in detail/), {
      target: { value: 'a red rose ornament' },
    });
    typeCustomSize('100', '28', '28');
    fireEvent.click(screen.getByRole('button', { name: 'Use 42×42' }));

    expect(screen.queryByTestId('mask-min-grid-steering')).not.toBeInTheDocument();
    expect((screen.getAllByDisplayValue('42') as HTMLInputElement[]).length).toBeGreaterThanOrEqual(2);
    expect(generateButton()).not.toBeDisabled();
  });
});
