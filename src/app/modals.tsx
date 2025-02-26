import React, { useState } from 'react';
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
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1D22] border border-gray-700 rounded-lg w-full max-w-md shadow-xl">
        <div className="flex justify-end p-2">
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white bg-gray-800 rounded-full p-1 transition-colors"
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

  const handleSubmit = () => {
    onSubmit(value);
    setValue('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-5">
        <h3 className="text-xl font-semibold text-white mb-4">{title}</h3>
        <div className="bg-[#23262E] border border-gray-700 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-300 mb-2">Please enter an ASCII string</p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full h-24 bg-[#16181D] border border-gray-700 rounded-lg p-3 text-white resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="Enter value here..."
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-800 transition-colors"
          >
            CANCEL
          </button>
          <button 
            onClick={handleSubmit}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors"
          >
            STRING
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

  const handleSubmit = () => {
    onSubmit(Number(value));
    setValue('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-5">
        <h3 className="text-xl font-semibold text-white mb-4">{title}</h3>
        <div className="bg-[#23262E] border border-gray-700 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-300 mb-2">{`Please enter a number between 0 & ${maxValue}`}</p>
          <input
            type="number"
            min="0"
            max={maxValue}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-[#16181D] border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="0"
          />
        </div>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-800 transition-colors"
          >
            CANCEL
          </button>
          <button 
            onClick={handleSubmit}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors"
          >
            SUBMIT
          </button>
        </div>
      </div>
    </Modal>
  );
};