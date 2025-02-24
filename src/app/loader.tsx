import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';

interface ProgressiveLoadingProps {
  initialMessage?: string;
  completionMessage?: string;
  loadingSteps?: Array<{ percentComplete: number, message: string }>;
  onLoadingComplete?: () => void;
  autoProgress?: boolean;
  duration?: number;
}

 const ProgressiveLoading: React.FC<ProgressiveLoadingProps> = ({
  initialMessage = "Initializing...",
  completionMessage = "Loading complete!",
  loadingSteps = [
    { percentComplete: 10, message: "Scanning for devices..." },
    { percentComplete: 30, message: "Connecting to device..." },
    { percentComplete: 50, message: "Retrieving device information..." },
    { percentComplete: 70, message: "Synchronizing data..." },
    { percentComplete: 90, message: "Finalizing connection..." }
  ],
  onLoadingComplete = () => {},
  autoProgress = true,
  duration = 5000
}) => {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(initialMessage);
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (!autoProgress) return;
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsComplete(true);
          setCurrentMessage(completionMessage);
          onLoadingComplete();
          return 100;
        }
        return prev + 1;
      });
    }, duration / 100);
    
    return () => clearInterval(interval);
  }, [autoProgress, duration, completionMessage, onLoadingComplete]);
  
  useEffect(() => {
    // Update message based on current progress percentage
    const step = loadingSteps.find(step => 
      progress >= step.percentComplete &&
      progress < (loadingSteps.find(s => s.percentComplete > step.percentComplete)?.percentComplete || 100)
    );
    
    if (step) {
      setCurrentMessage(step.message);
    } else if (progress === 0) {
      setCurrentMessage(initialMessage);
    } else if (progress === 100) {
      setCurrentMessage(completionMessage);
    }
  }, [progress, loadingSteps, initialMessage, completionMessage]);
  
  // Manual progress update function that can be called from parent
  const updateProgress = (newProgress: number) => {
    if (newProgress >= 0 && newProgress <= 100) {
      setProgress(newProgress);
      if (newProgress === 100) {
        setIsComplete(true);
        setCurrentMessage(completionMessage);
        onLoadingComplete();
      }
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] p-4 min-h-screen">
      <div className="w-full bg-[#2A2F33] rounded-lg p-4 shadow-lg">
        {/* Header with percentage */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium text-base">Loading</h3>
          <span className="text-white font-bold text-base">{progress}%</span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-[#1c1f22] rounded-full h-2 mb-4">
          <div 
            className="bg-gradient-to-r from-[#2d4c6d] to-[#52545c] h-2 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        {/* Loading message */}
        <div className="flex items-center mb-4">
          {!isComplete ? (
            <Loader2 className="animate-spin text-gray-400 mr-2" size={16} />
          ) : (
            <CheckCircle className="text-gray-400 mr-2" size={16} />
          )}
          <p className="text-gray-400 text-sm">{currentMessage}</p>
        </div>
        
        {/* Step indicators */}
        {/* <div className="flex justify-between mt-4 px-1">
          {loadingSteps.map((step, index) => (
            <div 
              key={index}
              className="flex flex-col items-center"
            >
              <div 
                className={`w-2 h-2 rounded-full mb-1 ${
                  progress >= step.percentComplete 
                    ? 'bg-gray-400' 
                    : 'bg-[#52545c]'
                }`}
              ></div>
              {index < loadingSteps.length - 1 && (
                <div className="w-8 h-0.5 bg-[#52545c]"></div>
              )}
            </div>
          ))}
        </div> */}
        
        {/* Cancel button */}
        <div className="mt-6 text-center">
          <button 
            className="text-gray-400 text-xs border border-gray-700 rounded-lg px-4 py-2 hover:bg-gray-800"
            onClick={() => {
              if (!isComplete) {
                setProgress(0);
                setCurrentMessage(initialMessage);
              }
            }}
          >
            {isComplete ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgressiveLoading;