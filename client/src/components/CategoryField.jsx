import { SUGGESTED_CATEGORIES, knownCategoryCounts, normalizeCategory } from '../utils/categories';

export default function CategoryField({ value, onChange }) {
  const inUse = (knownCategoryCounts() || []).map(c => c.name);
  const options = [...new Set([...inUse, ...SUGGESTED_CATEGORIES])].slice(0, 14);
  const current = normalizeCategory(value);

  return (
    <div>
      <label className="label">
        Category<span className="label-optional">optional</span>
      </label>
      <input
        className="input"
        placeholder="e.g. Banarasi"
        value={value}
        maxLength={40}
        onChange={e => onChange(e.target.value)}
      />
      <div className="chip-row chip-row-wrap" style={{ marginTop: 10 }}>
        {options.map(name => (
          <button
            key={name}
            type="button"
            className={`chip chip-sm ${current === name ? 'active' : ''}`}
            onClick={() => onChange(current === name ? '' : name)}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="field-hint">Shoppers can browse the catalogue by category.</p>
    </div>
  );
}
