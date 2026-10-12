import React, { useEffect, useMemo, useState } from 'react';
import { Combobox, Portal, createListCollection } from '@chakra-ui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';

// Lista pesquisável — digitar filtra as opções (categoria tem muitas opções e
// se beneficia disso; listas pequenas como Tipo usam `SelectField`, não este).
// Filtro feito na mão (substring, case-insensitive) em vez de depender da API
// de coleção mutável do Chakra — mais simples de garantir correto, e o
// resultado visual/funcional é o mesmo. `opcoes`: [{ valor, texto }].
const ComboboxField = ({ label, value, onChange, opcoes, placeholder = 'Buscar...', id, className = '' }) => {
  const [inputValue, setInputValue] = useState(() => opcoes.find((o) => o.valor === value)?.texto ?? '');

  useEffect(() => {
    setInputValue(opcoes.find((o) => o.valor === value)?.texto ?? '');
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const itensFiltrados = useMemo(() => {
    const termo = inputValue.trim().toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((o) => o.texto.toLowerCase().includes(termo));
  }, [opcoes, inputValue]);

  const collection = useMemo(
    () => createListCollection({ items: itensFiltrados, itemToString: (o) => o.texto, itemToValue: (o) => o.valor }),
    [itensFiltrados]
  );

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground-secondary block">
          {label}
        </label>
      )}
      <Combobox.Root
        collection={collection}
        value={value ? [value] : []}
        onValueChange={(details) => {
          const novoValor = details.value[0] ?? '';
          onChange(novoValor);
          setInputValue(opcoes.find((o) => o.valor === novoValor)?.texto ?? '');
        }}
        inputValue={inputValue}
        onInputValueChange={(details) => setInputValue(details.inputValue)}
        onOpenChange={(details) => {
          // Ao abrir, limpa o texto pra lista vir inteira (sem isso, o texto da seleção
          // atual já filtrava tudo de cara, sobrando só ela mesma na lista). Ao fechar
          // sem escolher nada novo, volta a mostrar o texto da seleção atual.
          if (details.open) {
            setInputValue('');
          } else {
            setInputValue(opcoes.find((o) => o.valor === value)?.texto ?? '');
          }
        }}
        openOnClick
      >
        <Combobox.Control className="relative">
          <Combobox.Input
            id={id}
            placeholder={placeholder}
            className={`focus-ring w-full h-11 px-3.5 pr-9 rounded-xl bg-surface-raised text-foreground placeholder:text-foreground-muted border border-border outline-none text-sm ${className}`}
          />
          <Combobox.IndicatorGroup className="absolute right-3 top-1/2 -translate-y-1/2">
            <Combobox.Trigger className="focus-ring cursor-pointer text-foreground-muted">
              <ChevronUpDownIcon className="h-4 w-4" />
            </Combobox.Trigger>
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Portal>
          <Combobox.Positioner>
            <Combobox.Content className="bg-surface-raised border border-border rounded-xl shadow-lg p-1 text-sm z-50 max-h-64 overflow-y-auto">
              <Combobox.Empty className="px-3 py-2 text-foreground-muted">Nenhum resultado</Combobox.Empty>
              {collection.items.map((item) => (
                <Combobox.Item
                  key={item.valor}
                  item={item}
                  className="focus-ring cursor-pointer flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-foreground data-[highlighted]:bg-surface-hover data-[state=checked]:bg-surface-active"
                >
                  <Combobox.ItemText>{item.texto}</Combobox.ItemText>
                  <Combobox.ItemIndicator>
                    <CheckIcon className="h-4 w-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              ))}
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </div>
  );
};

export default ComboboxField;
