import React from 'react';
import EmptyState from './ui/EmptyState';

// Reaproveitado 3x (Movimentações, Cartões, Metas) — não depende de nada do
// código legado, só de EmptyState/Heroicons/tokens.
const PlaceholderSecao = ({ icone, titulo, descricao }) => (
  <div className="max-w-md mx-auto px-4 py-16">
    <EmptyState icone={icone} titulo={titulo} descricao={descricao} />
  </div>
);

export default PlaceholderSecao;
