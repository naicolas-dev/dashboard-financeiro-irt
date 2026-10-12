import React, { useMemo } from 'react';
import { Select, Portal, createListCollection } from '@chakra-ui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';

// Lista curta/fechada, sem pesquisa — substitui o `<select>` nativo (dropdown
// azul do navegador em dark). `opcoes`: [{ valor, texto }]. `value`/`onChange`
// na mesma forma simples que o `<select>` nativo tinha (string, não array) —
// o array de 1 item que o Chakra usa por dentro fica escondido aqui.
const SelectField = ({ label, value, onChange, opcoes, placeholder = 'Selecionar', id, className = '' }) => {
  const collection = useMemo(
    () => createListCollection({ items: opcoes, itemToString: (o) => o.texto, itemToValue: (o) => o.valor }),
    [opcoes]
  );

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground-secondary block">
          {label}
        </label>
      )}
      <Select.Root
        collection={collection}
        value={value ? [value] : []}
        onValueChange={(details) => onChange(details.value[0] ?? '')}
      >
        <Select.HiddenSelect />
        <Select.Control>
          <Select.Trigger
            id={id}
            className={`focus-ring cursor-pointer w-full h-11 px-3.5 rounded-xl bg-surface-raised text-foreground border border-border outline-none text-sm flex items-center justify-between gap-2 ${className}`}
          >
            <Select.ValueText placeholder={placeholder} className="truncate" />
            <ChevronUpDownIcon className="h-4 w-4 text-foreground-muted shrink-0" />
          </Select.Trigger>
        </Select.Control>
        <Portal>
          <Select.Positioner>
            <Select.Content className="bg-surface-raised border border-border rounded-xl shadow-lg p-1 text-sm z-50 max-h-64 overflow-y-auto">
              {collection.items.map((item) => (
                <Select.Item
                  key={item.valor}
                  item={item}
                  className="focus-ring cursor-pointer flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-foreground data-[highlighted]:bg-surface-hover data-[state=checked]:bg-surface-active"
                >
                  <Select.ItemText>{item.texto}</Select.ItemText>
                  <Select.ItemIndicator>
                    <CheckIcon className="h-4 w-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.Root>
    </div>
  );
};

export default SelectField;
