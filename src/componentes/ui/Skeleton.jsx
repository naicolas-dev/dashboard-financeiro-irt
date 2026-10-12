import React from 'react';

// `animate-pulse` já respeita a regra global de prefers-reduced-motion (index.css).
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-surface-hover ${className}`} aria-hidden="true" />
);

export default Skeleton;
