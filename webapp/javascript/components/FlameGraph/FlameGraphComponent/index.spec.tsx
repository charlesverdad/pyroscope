import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { Option } from 'prelude-ts';
import FlamegraphComponent from './index';
import TestData from './testData';
import { BAR_HEIGHT } from './constants';

// the leaves have already been tested
// this is just to guarantee code is compiling
// and the callbacks are being called correctly
describe('FlamegraphComponent', () => {
  const ExportData = () => <div>ExportData</div>;

  it('renders', () => {
    const onZoom = jest.fn();
    const onReset = jest.fn();
    const isDirty = jest.fn();
    const onFocusOnNode = jest.fn();

    render(
      <FlamegraphComponent
        fitMode="HEAD"
        zoom={Option.none()}
        focusedNode={Option.none()}
        highlightQuery=""
        onZoom={onZoom}
        onFocusOnNode={onFocusOnNode}
        onReset={onReset}
        isDirty={isDirty}
        flamebearer={TestData.SimpleTree}
        ExportData={ExportData}
      />
    );
  });

  it('resizes correctly', () => {
    const onZoom = jest.fn();
    const onReset = jest.fn();
    const isDirty = jest.fn();
    const onFocusOnNode = jest.fn();

    render(
      <FlamegraphComponent
        fitMode="HEAD"
        zoom={Option.none()}
        focusedNode={Option.none()}
        highlightQuery=""
        onZoom={onZoom}
        onFocusOnNode={onFocusOnNode}
        onReset={onReset}
        isDirty={isDirty}
        flamebearer={TestData.SimpleTree}
        ExportData={ExportData}
      />
    );

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });

    window.dispatchEvent(new Event('resize'));

    // there's nothing much to assert here
    expect(window.innerWidth).toBe(800);
  });

  it('zooms on click', () => {
    const onZoom = jest.fn();
    const onReset = jest.fn();
    const isDirty = jest.fn();
    const onFocusOnNode = jest.fn();

    render(
      <FlamegraphComponent
        fitMode="HEAD"
        zoom={Option.none()}
        focusedNode={Option.none()}
        highlightQuery=""
        onZoom={onZoom}
        onFocusOnNode={onFocusOnNode}
        onReset={onReset}
        isDirty={isDirty}
        flamebearer={TestData.SimpleTree}
        ExportData={ExportData}
      />
    );

    userEvent.click(screen.getByTestId('flamegraph-canvas'), {
      clientX: 0,
      clientY: BAR_HEIGHT * 3,
    });

    expect(onZoom).toHaveBeenCalled();
  });

  describe('context menu', () => {
    it(`enables "reset view" menuitem when it's dirty`, async () => {
      const onZoom = jest.fn();
      const onReset = jest.fn();
      const isDirty = jest.fn();
      const onFocusOnNode = jest.fn();

      const { rerender } = render(
        <FlamegraphComponent
          fitMode="HEAD"
          zoom={Option.none()}
          focusedNode={Option.none()}
          highlightQuery=""
          onZoom={onZoom}
          onFocusOnNode={onFocusOnNode}
          onReset={onReset}
          isDirty={isDirty}
          flamebearer={TestData.SimpleTree}
          ExportData={ExportData}
        />
      );

      userEvent.click(screen.getByTestId('flamegraph-canvas'), {
        button: 2,
        clientX: 1,
        clientY: 1,
      });

      // should not be available unless we zoom
      await waitFor(() =>
        expect(
          screen.queryByRole('menuitem', { name: /Reset View/ })
        ).toHaveAttribute('aria-disabled', 'true')
      );

      // it's dirty now
      isDirty.mockReturnValue(true);

      rerender(
        <FlamegraphComponent
          fitMode="HEAD"
          zoom={Option.none()}
          focusedNode={Option.none()}
          highlightQuery=""
          onZoom={onZoom}
          onFocusOnNode={onFocusOnNode}
          onReset={onReset}
          isDirty={isDirty}
          flamebearer={TestData.SimpleTree}
          ExportData={ExportData}
        />
      );

      userEvent.click(screen.getByTestId('flamegraph-canvas'), {
        button: 2,
      });

      // should be enabled now
      expect(
        screen.queryByRole('menuitem', { name: /Reset View/ })
      ).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('triggers a highlight', () => {
      const onZoom = jest.fn();
      const onReset = jest.fn();
      const isDirty = jest.fn();
      const onFocusOnNode = jest.fn();

      render(
        <FlamegraphComponent
          fitMode="HEAD"
          zoom={Option.none()}
          focusedNode={Option.none()}
          highlightQuery=""
          onZoom={onZoom}
          onFocusOnNode={onFocusOnNode}
          onReset={onReset}
          isDirty={isDirty}
          flamebearer={TestData.SimpleTree}
          ExportData={ExportData}
        />
      );

      // initially the context highlight is not visible
      expect(
        screen.getByTestId('flamegraph-highlight-contextmenu')
      ).not.toBeVisible();

      // then we click
      userEvent.click(screen.getByTestId('flamegraph-canvas'), { button: 2 });

      // should be visible now
      expect(
        screen.getByTestId('flamegraph-highlight-contextmenu')
      ).toBeVisible();
    });
  });

  describe('header', () => {
    const onZoom = jest.fn();
    const onReset = jest.fn();
    const isDirty = jest.fn();
    const onFocusOnNode = jest.fn();

    it('renders when type is single', () => {
      render(
        <FlamegraphComponent
          fitMode="HEAD"
          zoom={Option.none()}
          focusedNode={Option.none()}
          highlightQuery=""
          onZoom={onZoom}
          onFocusOnNode={onFocusOnNode}
          onReset={onReset}
          isDirty={isDirty}
          flamebearer={TestData.SimpleTree}
          ExportData={ExportData}
        />
      );

      expect(screen.queryByRole('heading', { level: 2 })).toHaveTextContent(
        'Frame width represents CPU time per function'
      );
      expect(screen.getByText('ExportData')).toBeInTheDocument();
    });

    it('renders when type is "double"', () => {
      const flamebearer = TestData.DiffTree;
      render(
        <FlamegraphComponent
          fitMode="HEAD"
          zoom={Option.none()}
          focusedNode={Option.none()}
          highlightQuery=""
          onZoom={onZoom}
          onFocusOnNode={onFocusOnNode}
          onReset={onReset}
          isDirty={isDirty}
          flamebearer={flamebearer}
          ExportData={ExportData}
        />
      );

      expect(screen.queryByRole('heading', { level: 2 })).toHaveTextContent(
        'Base graph: left - Comparison graph: right'
      );

      expect(screen.getByTestId('flamegraph-legend')).toBeInTheDocument();
      expect(screen.getByText('ExportData')).toBeInTheDocument();
    });
  });
});
