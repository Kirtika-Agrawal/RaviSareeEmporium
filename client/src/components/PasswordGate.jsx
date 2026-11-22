import { useState } from 'react';

export default function PasswordGate({ prompt = 'Enter the staff password to continue.', error, onSubmit, onCancel }) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (value.trim()) onSubmit(value);
  };

  return (
    <div className="modal-form">
      <p className="modal-text">{prompt}</p>
      <input
        className="input"
        type="password"
        placeholder="Password"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        autoFocus
      />
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={submit}>Unlock</button>
      </div>
    </div>
  );
}
