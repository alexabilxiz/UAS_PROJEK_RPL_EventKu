import { useState } from 'react';
import FormField from './FormField';
import Icon from './Icon';

export default function PasswordField({ id, label = 'Kata sandi', error, hint, autoComplete = 'current-password', value, onChange, disabled }) {
  const [visible, setVisible] = useState(false);
  return <FormField id={id} label={label} error={error} hint={hint} required>
    {(field) => <div className="password-control">
      <input {...field} className="field-input" type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} disabled={disabled} required />
      <button className="password-toggle" type="button" aria-label={`${visible ? 'Sembunyikan' : 'Tampilkan'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name={visible ? 'eye-off' : 'eye'} /></button>
    </div>}
  </FormField>;
}
