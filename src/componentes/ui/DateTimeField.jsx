import React, { useMemo } from 'react';
import { DatePicker, Portal } from '@chakra-ui/react';
import { CalendarDate } from '@internationalized/date';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';

function paraCalendarDate(dataParte) {
  const [ano, mes, dia] = dataParte.split('-').map(Number);
  return new CalendarDate(ano, mes, dia);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Adapter isolado: por fora, a mesma string "YYYY-MM-DDTHH:mm" que o
// datetime-local nativo sempre devolveu (nenhum outro lugar do app aprende o
// formato do @internationalized/date — só este arquivo). Por dentro, o Chakra
// DatePicker cuida só da data (ele não tem noção de hora) + um input nativo
// type="time" cuida do minuto exato — perder a hora era o risco real desta
// peça da migração, por isso a hora nunca passa pelo DatePicker.
const DateTimeField = ({ label, value, onChange, id }) => {
  const [dataParte, horaParte] = value.split('T');

  const dataSelecionada = useMemo(() => [paraCalendarDate(dataParte)], [dataParte]);

  const aoMudarData = (details) => {
    const nova = details.value[0];
    if (!nova) return;
    onChange(`${nova.year}-${pad(nova.month)}-${pad(nova.day)}T${horaParte}`);
  };

  const aoMudarHora = (e) => {
    const novaHora = e.target.value;
    if (!novaHora) return;
    onChange(`${dataParte}T${novaHora}`);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground-secondary block">
          {label}
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <DatePicker.Root value={dataSelecionada} onValueChange={aoMudarData} closeOnSelect>
          <DatePicker.Control className="relative">
            <DatePicker.Input
              id={id}
              className="focus-ring w-full h-11 px-3.5 pr-9 rounded-xl bg-surface-raised text-foreground border border-border outline-none text-sm"
            />
            <DatePicker.IndicatorGroup className="absolute right-3 top-1/2 -translate-y-1/2">
              <DatePicker.Trigger className="focus-ring cursor-pointer text-foreground-muted">
                <CalendarDaysIcon className="h-4 w-4" />
              </DatePicker.Trigger>
            </DatePicker.IndicatorGroup>
          </DatePicker.Control>
          <Portal>
            <DatePicker.Positioner>
              <DatePicker.Content className="bg-surface-raised border border-border rounded-xl shadow-lg p-2 z-50 text-foreground">
                <DatePicker.View view="day">
                  <DatePicker.Header />
                  <DatePicker.DayTable />
                </DatePicker.View>
                <DatePicker.View view="month">
                  <DatePicker.Header />
                  <DatePicker.MonthTable />
                </DatePicker.View>
                <DatePicker.View view="year">
                  <DatePicker.Header />
                  <DatePicker.YearTable />
                </DatePicker.View>
              </DatePicker.Content>
            </DatePicker.Positioner>
          </Portal>
        </DatePicker.Root>

        <input
          type="time"
          value={horaParte}
          onChange={aoMudarHora}
          aria-label="Hora"
          className="focus-ring w-full h-11 px-3.5 rounded-xl bg-surface-raised text-foreground border border-border outline-none text-sm"
        />
      </div>
    </div>
  );
};

export default DateTimeField;
