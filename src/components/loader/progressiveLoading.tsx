import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
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
    <div className="flex flex-col items-center justify-center max-w-md mx-auto p-4 min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full rounded-lg p-4 shadow-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {/* Header with percentage */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-base" style={{ color: 'var(--text-primary)' }}>{t('Loading')}</h3>
          <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{displayProgress}%</span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full rounded-full h-2 mb-4" style={{ background: 'var(--bg-tertiary)' }}>
          <div 
            className="h-2 rounded-full transition-all duration-300 ease-out" 
            style={{ 
              width: `${displayProgress}%`,
              background: 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)'
            }}
          ></div>
        </div>
        
        {/* Loading message */}
        <div className="flex items-center mb-4">
          {!isComplete ? (
            <Loader2 className="animate-spin mr-2" size={16} style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <CheckCircle className="mr-2" size={16} style={{ color: 'var(--accent)' }} />
          )}
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t(currentMessage)}</p>
        </div>
        
        {/* Step indicators */}

      </div>
    </div>
  );
};

export default ProgressiveLoading;