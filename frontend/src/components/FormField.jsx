import { cloneElement, isValidElement } from 'react';

export default function FormField({ id, label, error, hint, children, required = false, className = '', ...rest }) {
  const description = [hint ? `${id}-hint` : '', error ? `${id}-error` : '', rest['aria-describedby'] ?? ''].filter(Boolean).join(' ');
  const fieldProps = {
    ...rest,
    id,
    required,
    className: `field-input${className ? ` ${className}` : ''}`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': description || undefined,
  };
  let field;
  if (typeof children === 'function') {
    field = children(fieldProps);
  } else if (isValidElement(children) && ['input', 'select', 'textarea'].includes(children.type)) {
    field = cloneElement(children, { ...fieldProps, ...children.props, id, 'aria-invalid': fieldProps['aria-invalid'], 'aria-describedby': description || undefined });
  } else {
    field = children ?? <input {...fieldProps} />;
  }

  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id} className="field-label">{label}</label>
      {field}
      {hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}
