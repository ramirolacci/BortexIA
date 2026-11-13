import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ value, options, onChange, placeholder = 'Seleccionar...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || { label: value, value };

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className="custom-select-container" ref={containerRef}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="custom-select-label">{selectedOption.label || placeholder}</span>
        <ChevronDown size={15} className={`custom-select-arrow ${isOpen ? 'rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(option.value)}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={14} className="custom-select-check" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

