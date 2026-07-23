import React from 'react';

export default function DevTools() {
  return null;
}

DevTools.instrument = function() {
  return next => next;
};
