import { useState, useRef } from 'react';

export default function ImageUpload({ onFileSelect, preview, label = 'Upload Image' }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (file && /\.(jpe?g|png|webp)$/i.test(file.name)) {
      onFileSelect(file);
    }
  };

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div
        className={`upload-zone ${dragOver ? 'dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"

          onChange={e => handleFile(e.target.files[0])}
        />
        {preview ? (
          <div>
            <img src={preview} alt="Preview" className="img-preview" />
            <p style={{ color: 'var(--gold)', fontSize: '0.8rem', marginTop: 8 }}>
              Click or drag to replace
            </p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📷</div>
            <p style={{ color: 'var(--gold)', fontWeight: 700, marginBottom: 4 }}>
              Tap to upload photo
            </p>
            <p style={{ color: 'rgba(250,243,224,0.5)', fontSize: '0.8rem' }}>
              JPG, PNG, or WEBP · Camera or gallery
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
