import React from "react";
import { ScanLine } from "lucide-react";
import { toast } from "react-hot-toast";
import { useI18n } from '@/i18n';

interface AuthenticateProps {
  onScan: () => void;
  sessionToken: string | null;
  locationActions: any[];
  isBindingSuccessful: boolean;
  onProceedToService: () => void;
  onBindingResult: (result: { sessionToken?: string; locationActions?: any[]; success: boolean }) => void;
}

const Authenticate: React.FC<AuthenticateProps> = ({
  onScan,
  sessionToken,
  locationActions,
  isBindingSuccessful,
  onProceedToService,
  onBindingResult,
}) => {
  const { t } = useI18n();
  return (
    <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-4">{t('Scan Station QR Code')}</h1>
        <p className="text-gray-400 text-sm">
          {t('Position the QR code within the frame then scan below')}
        </p>
      </div>
      <button
        onClick={() => {
          console.info("Scan button clicked");
          onScan();
        }}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
      >
        <ScanLine className="w-5 h-5" />
        {t('Start Scan')}
      </button>
      {sessionToken && (
        <div className="mt-6">
          <h2 className="text-xl font-bold text-white mb-2">{t('Session Token')}</h2>
          <p className="text-gray-300">{sessionToken}</p>
          <h2 className="text-xl font-bold text-white mt-4 mb-2">{t('Location Actions')}</h2>
          <ul className="text-gray-300">
            {locationActions.map((action, index) => (
              <li key={index}>{JSON.stringify(action)}</li>
            ))}
          </ul>
        </div>
      )}
      {isBindingSuccessful && (
        <button
          onClick={() => {
            console.info("Proceed to Service button clicked");
            onProceedToService();
          }}
          className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
        >
          {t('Proceed to Service')}
        </button>
      )}
    </div>
  );
};

export default Authenticate;