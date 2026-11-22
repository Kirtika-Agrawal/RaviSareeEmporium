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
            <p className="upload-hint">Tap or drag to replace</p>
          </div>
        ) : (
          <div>
            <p className="upload-title">Tap to add a photo</p>
            <p className="upload-hint">JPG, PNG or WEBP · camera or gallery</p>
          </div>
        )}
      </div>
    </div>
  );
}
