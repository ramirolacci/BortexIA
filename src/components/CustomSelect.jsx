import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ value, options, onChange, placeholder = 'Seleccionar...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = useRef(null);

  const closeDropdown = () => {
    if (!isOpen) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsOpen(false);
    }, 160);
  };

  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown();
    } else {
      setIsOpen(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeDropdown();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value) || { label: value, value };

  const handleSelect = (val) => {
    onChange(val);
    closeDropdown();
  };

  return (
    <div className="custom-select-container" ref={containerRef}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen && !isClosing ? 'open' : ''}`}
        onClick={toggleDropdown}
      >
        <span className="custom-select-label">{selectedOption.label || placeholder}</span>
        <ChevronDown 
          size={15} 
          className={`custom-select-arrow ${isOpen && !isClosing ? 'rotated' : ''}`} 
        />
      </button>

      {(isOpen || isClosing) && (
        <div className={`custom-select-dropdown ${isClosing ? 'closing' : 'opening'}`}>
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
