/**
 * Tests for the Designer AI prompt bar descriptive-prompt guidance (owner 09-14).
 *
 * Owner direction: add guidance in the Designer AI prompt area asking users to be
 * descriptive with their AI request, so the AI artwork system works properly
 * without constant need for fixes (ships with the AI fast-path fixes #172/#173).
 *
 * Covers:
 * 1. The AI prompt input renders in the Designer studio
 * 2. Descriptive-prompt guidance (Tip: Be descriptive …) renders below the input
 * 3. The tip includes a concrete example so users know the expected detail level
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Designer } from '../pages/Designer';

const renderDesigner = () => render(
  <BrowserRouter>
    <Designer />
  </BrowserRouter>
);

describe('Designer AI prompt bar — descriptive-prompt guidance (owner 09-14)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the AI prompt input', () => {
    renderDesigner();
    expect(screen.getByPlaceholderText(/Describe a pattern/)).toBeInTheDocument();
  });

  it('shows the descriptive-prompt tip below the input', () => {
    renderDesigner();
    expect(
      screen.getByText(/Be descriptive — include the subject, colors, and details/i)
    ).toBeInTheDocument();
  });

  it('the tip includes a concrete example prompt', () => {
    renderDesigner();
    expect(
      screen.getByText(/brown teddy bear wearing a red sweater/i)
    ).toBeInTheDocument();
  });
});