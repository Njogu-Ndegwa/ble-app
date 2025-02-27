import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';

interface ProgressiveLoadingProps {
  initialMessage?: string;
  completionMessage?: string;
  loadingSteps?: Array<{ percentComplete: number, message: string }>;
  onLoadingComplete?: () => void;
  autoProgress?: boolean;
  duration?: number;
  progress?: number;
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
  duration = 5000,
  progress
}) => {
  const [internalProgress, setInternalProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(initialMessage);
  const [isComplete, setIsComplete] = useState(false);
  
  const displayProgress = progress !== undefined ? progress : internalProgress;

  useEffect(() => {
    if (autoProgress) {
      const interval = setInterval(() => {
        setInternalProgress(prev => {
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
    }
  }, [autoProgress, duration, completionMessage, onLoadingComplete]);

  useEffect(() => {
    const step = loadingSteps.find(step => 
      displayProgress >= step.percentComplete &&
      displayProgress < (loadingSteps.find(s => s.percentComplete > step.percentComplete)?.percentComplete || 100)
    );

    if (step) {
      setCurrentMessage(step.message);
    } else if (displayProgress === 0) {
      setCurrentMessage(initialMessage);
    } else if (displayProgress === 100) {
      setCurrentMessage(completionMessage);
      setIsComplete(true);
      onLoadingComplete();
    }
  }, [displayProgress, loadingSteps, initialMessage, completionMessage, onLoadingComplete]);
  
  return (
    <div className="flex flex-col items-center justify-center max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] p-4 min-h-screen">
      <div className="w-full bg-[#2A2F33] rounded-lg p-4 shadow-lg">
        {/* Header with percentage */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium text-base">Loading</h3>
          <span className="text-white font-bold text-base">{displayProgress}%</span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-[#1c1f22] rounded-full h-2 mb-4">
          <div 
            className="bg-gradient-to-r from-[#2d4c6d] to-[#52545c] h-2 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${displayProgress}%` }}
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

      </div>
    </div>
  );
};

export default ProgressiveLoading;