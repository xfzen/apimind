import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { extractHeadings } from './markdownHeadings';

export default function MarkdownOutline({ value, rootSelector, activeId, onActiveChange, onJump }) {
  const headings = useMemo(() => extractHeadings(value || ''), [value]);
  const [innerActiveId, setInnerActiveId] = useState('');
  const selectedActiveId = activeId || innerActiveId;

  const setSelectedActiveId = nextActiveId => {
    setInnerActiveId(nextActiveId);
    if (onActiveChange) onActiveChange(nextActiveId);
  };

  useEffect(() => {
    if (!headings.some(heading => heading.id === selectedActiveId)) {
      setSelectedActiveId('');
    }
  }, [headings, selectedActiveId]);

  useEffect(() => {
    if (!headings.length || onJump) return undefined;

    let rafId = 0;
    const root = rootSelector ? document.querySelector(rootSelector) : document;
    const rootScrollable = root && root !== document && root.scrollHeight > root.clientHeight + 1;
    const scrollTargets = rootScrollable ? [root, window] : [window];
    const getHeadingElements = () => headings
      .map(heading => ({ heading, element: document.getElementById(heading.id) }))
      .filter(item => item.element);

    const updateActiveHeading = () => {
      rafId = 0;
      const headingElements = getHeadingElements();
      if (!headingElements.length) return;

      const anchorTop = rootScrollable
        ? root.getBoundingClientRect().top + 24
        : 190;
      let nextActiveId = headingElements[0].heading.id;

      headingElements.forEach(item => {
        if (item.element.getBoundingClientRect().top <= anchorTop) {
          nextActiveId = item.heading.id;
        }
      });

      setSelectedActiveId(nextActiveId);
    };

    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateActiveHeading);
    };

    scheduleUpdate();
    scrollTargets.forEach(target => target.addEventListener('scroll', scheduleUpdate, { passive: true }));
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      scrollTargets.forEach(target => target.removeEventListener('scroll', scheduleUpdate));
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [headings, onJump, rootSelector]);

  if (!headings.length) {
    return null;
  }

  const jumpTo = id => {
    const heading = headings.find(item => item.id === id);
    setSelectedActiveId(id);
    if (heading && onJump) {
      onJump(heading);
      return;
    }
    const root = rootSelector ? document.querySelector(rootSelector) : document;
    const target = root && root.querySelector ? root.querySelector(`#${id}`) : document.getElementById(id);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  return (
    <nav className="apimind-doc-outline">
      <div className="outline-title">目录</div>
      {headings.map(heading => (
        <button
          key={heading.id}
          type="button"
          className={`outline-item level-${heading.level}${heading.id === selectedActiveId ? ' is-active' : ''}`}
          onClick={() => jumpTo(heading.id)}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );
}

MarkdownOutline.propTypes = {
  value: PropTypes.string,
  rootSelector: PropTypes.string,
  activeId: PropTypes.string,
  onActiveChange: PropTypes.func,
  onJump: PropTypes.func
};
