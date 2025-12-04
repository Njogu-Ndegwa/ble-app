import React, { useState } from 'react';
import { useI18n } from '@/i18n';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

// Modal Component
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.75)' }}>
      <div className="rounded-lg w-full max-w-md shadow-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <div className="flex justify-end p-2">
          <button 
            onClick={onClose} 
            className="rounded-full p-1 transition-colors"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-tertiary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ASCII String Input Modal
export const AsciiStringModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (value: string) => void; 
  title: string;
}) => {
  const [value, setValue] = useState('');
  const { t } = useI18n();

  const handleSubmit = () => {
    onSubmit(value);
    setValue('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-5">
        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <div className="rounded-lg p-4 mb-6" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('Please enter an ASCII string')}</p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full h-24 rounded-lg p-3 resize-none focus:outline-none transition-colors"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            placeholder={t('Enter value here...')}
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="btn btn-secondary"
          >
            {t('Cancel')}
          </button>
          <button 
            onClick={handleSubmit}
            className="btn btn-primary"
          >
            {t('Submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Numeric Input Modal
export const NumericModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title,
  maxValue = 65535
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (value: number) => void; 
  title: string;
  maxValue?: number;
}) => {
  const [value, setValue] = useState('');
  const { t } = useI18n();

  const handleSubmit = () => {
    onSubmit(Number(value));
    setValue('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-5">
        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <div className="rounded-lg p-4 mb-6" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{t('Please enter a number between 0 &')}{` ${maxValue}`}</p>
          <input
            type="number"
            min="0"
            max={maxValue}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg p-3 focus:outline-none transition-colors"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            placeholder="0"
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="btn btn-secondary"
          >
            {t('Cancel')}
          </button>
          <button 
            onClick={handleSubmit}
            className="btn btn-primary"
          >
            {t('Submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
};