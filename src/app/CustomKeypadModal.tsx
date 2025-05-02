import React, { useState, useEffect, useRef } from 'react';

export const CustomKeypadModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title = 'Input Pad'
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (value: string) => void; 
  title?: string;
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const MAX_LENGTH = 23;
  
  // Reset input value when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setIsLoading(false);
    }
  }, [isOpen]);

  // Prevent mobile keyboard from showing when input is focused
  useEffect(() => {
    if (!isOpen) return;
    
    const inputElement = inputRef.current;
    if (!inputElement) return;

    const preventKeyboard = (e: Event) => {
      e.preventDefault();
      inputElement.blur();
      // Keep focus state for visual indication without keyboard
      setTimeout(() => {
        if (inputElement) {
          inputElement.focus({ preventScroll: true });
        }
      }, 10);
    };

    inputElement.addEventListener('click', preventKeyboard);
    inputElement.addEventListener('focus', preventKeyboard);

    return () => {
      inputElement.removeEventListener('click', preventKeyboard);
      inputElement.removeEventListener('focus', preventKeyboard);
    };
  }, [isOpen]);
  
  // Effect for managing text size and scrolling
  useEffect(() => {
    if (!isOpen || !inputRef.current || !inputContainerRef.current) return;
    
    const inputElement = inputRef.current;
    const containerElement = inputContainerRef.current;
    
    // Check if text overflows container and adjust if needed
    const adjustTextSize = () => {
      // Reset to default size first
      inputElement.style.fontSize = "1.25rem"; // text-xl
      
      // Check if scrolling would be needed
      const isOverflowing = inputElement.scrollWidth > containerElement.clientWidth;
      
      if (isOverflowing) {
        // Calculate the ratio to shrink text proportionally
        const ratio = (containerElement.clientWidth - 16) / inputElement.scrollWidth;
        const newSize = Math.max(0.875, Math.min(1.25, 1.25 * ratio));
        inputElement.style.fontSize = `${newSize}rem`;
      }
      
      // Always scroll to end to ensure latest digits are visible
      inputElement.scrollLeft = inputElement.scrollWidth;
    };
    
    adjustTextSize();
    
    // Set a resize observer to check for text overflow when content changes
    const resizeObserver = new ResizeObserver(adjustTextSize);
    resizeObserver.observe(inputElement);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [inputValue, isOpen]);

  const formatInput = (value: string): string => {
    const cleanValue = value.replace(/\s/g, '');
    let formatted = '';
    for (let i = 0; i < cleanValue.length; i++) {
      // Add space after first 4 characters (at index 4)
      if (i === 4) {
        formatted += ' ';
      }
      // Add space after every 3 characters for the next 5 groups (at indices 7, 10, 13, 16, 19)
      else if (i > 4 && i <= 19 && (i - 4) % 3 === 0) {
        formatted += ' ';
      }
      formatted += cleanValue[i];
    }
    return formatted;
  };

  const addToInput = (value: string) => {
    setInputValue(prev => {
      // Remove spaces to check the actual length
      const cleanPrev = prev.replace(/\s/g, '');
      
      // Only add if under max length
      if (cleanPrev.length < MAX_LENGTH) {
        const newValue = cleanPrev + value;
        return formatInput(newValue);
      }
      return prev;
    });
  };

  const clearInput = () => {
    setInputValue(prev => {
      // If empty, do nothing
      if (prev.length === 0) return prev;
      
      // Remove the last character and reformat
      const cleanPrev = prev.replace(/\s/g, '');
      const newValue = cleanPrev.slice(0, -1);
      return formatInput(newValue);
    });
  };

  const submitInput = async () => {
    // Check if input exists
    if (!inputValue) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Pass the formatted input value (with spaces) to the parent component
      onSubmit(inputValue);
      // Clear the input value
      setInputValue('');
    } catch (error) {
      console.error('Error processing input:', error);
    } finally {
      setIsLoading(false);
      onClose();
    }
  };


  // Create keypad buttons
  const renderKey = (value: string, isFunction: boolean = false) => {
    const handleClick = () => {
      if (value === '←') {
        clearInput();
      } else if (value === 'OK') {
        submitInput();
      } else {
        addToInput(value);
      }
    };

    return (
      <div
        className={`h-14 w-14 flex items-center justify-center rounded ${
          isFunction ? 'bg-gray-600' : 'bg-gray-700'
        } text-white text-2xl cursor-pointer active:bg-gray-500`}
        onClick={handleClick}
      >
        {value}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1D22] border border-gray-700 rounded-lg w-full max-w-md shadow-xl p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-white text-xl font-bold mb-2">{title}</h1>
          <p className="text-gray-400 text-sm">Enter access code</p>
        </div>
        
        {/* Input Field - Enhanced with container for overflow control */}
        <div className="relative mb-6">
          <div 
            ref={inputContainerRef}
            className="w-full border border-gray-700 bg-gray-800 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 overflow-x-auto"
          >
            <input
              ref={inputRef}
              type="text"
              className="w-full px-4 py-3 bg-transparent focus:outline-none text-white text-center text-xl tracking-wider"
              placeholder="Input Code"
              value={inputValue}
              onChange={() => {}} // Empty handler to prevent React warnings
              readOnly
            />
          </div>
          <p className="text-center text-xs text-gray-400 mt-1">Max 23 characters (*, #, 0-9)</p>
        </div>
        
        {/* Custom Keypad */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          {/* Row 1 */}
          <div className="flex justify-between mb-4">
            {renderKey('1')}
            {renderKey('2')}
            {renderKey('3')}
          </div>
          
          {/* Row 2 */}
          <div className="flex justify-between mb-4">
            {renderKey('4')}
            {renderKey('5')}
            {renderKey('6')}
          </div>
          
          {/* Row 3 */}
          <div className="flex justify-between mb-4">
            {renderKey('7')}
            {renderKey('8')}
            {renderKey('9')}
          </div>
          
          {/* Row 4 */}
          <div className="flex justify-between mb-4">
            {renderKey('*', true)}
            {renderKey('0')}
            {renderKey('#', true)}
          </div>
          
          {/* Row 5 */}
          <div className="flex justify-between">
            <div 
              className="h-14 flex-1 mr-4 flex items-center justify-center rounded bg-gray-600 text-white text-xl cursor-pointer active:bg-gray-500"
              onClick={clearInput}
            >
              ←
            </div>
            <div 
              className="h-14 flex-1 flex items-center justify-center rounded bg-blue-600 text-white text-xl cursor-pointer active:bg-blue-500"
              onClick={submitInput}
            >
              OK
            </div>
          </div>
        </div>
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="text-center text-gray-300">
            <div className="flex justify-center mb-2">
              <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p>Processing...</p>
          </div>
        )}
        
        {/* Cancel button */}
        <div className="flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-800 transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};