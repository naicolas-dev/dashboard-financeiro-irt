import React, { useMemo, useState } from 'react';
import { FunnelIcon, XCircleIcon } from '@heroicons/react/24/outline';

const presetsDeData = [
  { id: 'este_mes', texto: 'Este Mês' },
  { id: 'ultimo_mes', texto: 'Mês Passado' },
  { id: 'ultimos_3_meses', texto: 'Últimos 3 Meses' },
  { id: 'este_ano', texto: 'Este Ano' },
];

function Filtros({ transacoes, filtros, setters, onLimparFiltros }) {
  const { dataInicio, dataFim, filtroCategoria, filtroTipo } = filtros;
  const { setDataInicio, setDataFim, setFiltroCategoria, setFiltroTipo } = setters;

  const [presetAtivo, setPresetAtivo] = useState(null);

  const categorias = useMemo(() => {
    const categoriasUnicas = new Set();
    transacoes.forEach(t => categoriasUnicas.add(t.categoria));
    return [...categoriasUnicas].sort();
  }, [transacoes]);

  const handlePresetClick = (presetId) => {
    const hoje = new Date();
    let inicio = new Date();
    let fim = new Date();

    switch (presetId) {
      case 'este_mes':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        break;
      case 'ultimo_mes':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        break;
      case 'ultimos_3_meses':
        inicio.setMonth(hoje.getMonth() - 3);
        fim = hoje;
        break;
      case 'este_ano':
        inicio = new Date(hoje.getFullYear(), 0, 1);
        fim = hoje;
        break;
      default:
        break;
    }

    setDataInicio(inicio.toISOString().slice(0, 10));
    setDataFim(fim.toISOString().slice(0, 10));
    setPresetAtivo(presetId);
  };

  const handleDataManualChange = (setter, valor) => {
    setter(valor);
    setPresetAtivo(null);
  };

  const handleLimparTudo = () => {
    onLimparFiltros();
    setPresetAtivo(null);
  };

  const inputStyle = "w-full p-2 bg-slate-100 text-slate-900 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600";
  const labelStyle = "text-sm font-medium text-slate-600 dark:text-slate-200 mb-1 block";
  const presetButtonStyle = "px-3 py-1 text-sm rounded-full cursor-pointer transition-colors";
  const presetActiveStyle = "bg-indigo-600 text-white font-semibold";
  const presetInactiveStyle = "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 border border-slate-200 dark:border-slate-700 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <FunnelIcon className="h-5 w-5 text-slate-500 dark:text-slate-300" />
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-100">Filtros</h2>
        </div>
        <button
          onClick={handleLimparTudo}
          className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 font-semibold"
        >
          <XCircleIcon className="h-5 w-5" />
          <span>Limpar Filtros</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-200">Períodos Rápidos:</p>
        {presetsDeData.map(preset => (
          <button
            key={preset.id}
            onClick={() => handlePresetClick(preset.id)}
            className={`${presetButtonStyle} ${presetAtivo === preset.id ? presetActiveStyle : presetInactiveStyle}`}
          >
            {preset.texto}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 border-t border-slate-200 dark:border-slate-700 pt-4">
        <div>
          <label htmlFor="data-inicio" className={labelStyle}>De:</label>
          <input
            type="date"
            id="data-inicio"
            value={dataInicio || ''}
            onChange={(e) => handleDataManualChange(setDataInicio, e.target.value)}
            className={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="data-fim" className={labelStyle}>Até:</label>
          <input
            type="date"
            id="data-fim"
            value={dataFim || ''}
            onChange={(e) => handleDataManualChange(setDataFim, e.target.value)}
            className={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="categoria" className={labelStyle}>Categoria</label>
          <select id="categoria" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={inputStyle}>
            <option value="todas">Todas as categorias</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tipo" className={labelStyle}>Tipo</label>
          <select id="tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className={inputStyle}>
            <option value="todos">Receitas e Despesas</option>
            <option value="receita">Apenas Receitas</option>
            <option value="despesa">Apenas Despesas</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default Filtros;
