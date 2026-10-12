import React from 'react';

const Input = React.forwardRef(function Input(
  { label, erro, id, className = '', ...props },
  ref
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground-secondary block">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`focus-ring w-full h-11 px-3.5 rounded-xl bg-surface-raised text-foreground placeholder:text-foreground-muted border ${erro ? 'border-negative' : 'border-border'} outline-none text-sm ${className}`}
        aria-invalid={!!erro}
        {...props}
      />
      {erro && <p className="text-sm text-negative">{erro}</p>}
    </div>
  );
});

export default Input;
