"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, QrCode, MessageSquare, RefreshCw, Check, Copy, AlertCircle, Clipboard, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import QRCode from "qrcode";
import { useI18n } from '@/i18n';
import { useBridge } from "@/app/context/bridgeContext";

interface PaymentQRProps {
  customer: {
    id: number;
    partner_id?: number;
  } | null;
}

interface SMSMessage {
  sender: string;
  body: string;
  timestamp: number;
}

interface ParsedTransaction {
  transactionId: string;
  amount?: string;
  sender?: string;
  timestamp: number;
  rawMessage: string;
}

// Common patterns for extracting transaction IDs from different payment providers
const TRANSACTION_PATTERNS = [
  // M-Pesa patterns
  /(?:Transaction|Trans|TXN|Txn|Ref|Reference|Receipt|Conf)[\s.:]*(?:ID|No|Number|Code)?[\s.:]*([A-Z0-9]{8,20})/i,
  /\b([A-Z]{2,3}[A-Z0-9]{6,15})\b/i, // e.g., MPESA codes like QBH7Y5KPLZ
  // Generic patterns
  /(?:confirmed|received|sent)[\s\S]*?([A-Z0-9]{8,15})/i,
  // Pattern for codes at end of message
  /\b([A-Z0-9]{10,14})\b(?:\s*$|[.\s])/,
  // Pattern for codes after "ID" or similar
  /(?:id|ref|code)[:\s]+([A-Z0-9]{6,20})/i,
];

// Patterns to identify payment-related SMS
const PAYMENT_SMS_PATTERNS = [
  /(?:received|sent|confirmed|transaction|payment|transfer|deposit)/i,
  /(?:mpesa|m-pesa|mobile money|momo|flooz|t-money)/i,
  /(?:ksh|kes|xof|fcfa|ugx|tzs|\$|usd)/i,
];

const PaymentQR: React.FC<PaymentQRProps> = ({ customer }) => {
  const { t } = useI18n();
  const { bridge } = useBridge();
  const bridgeInitRef = useRef(false);
  
  const [subscriptionCode, setSubscriptionCode] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string>("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isFetchingSubscription, setIsFetchingSubscription] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  
  // SMS reading state
  const [smsFeatureAvailable, setSmsFeatureAvailable] = useState<boolean>(false);
  const [isListeningForSMS, setIsListeningForSMS] = useState<boolean>(false);
  const [recentTransactions, setRecentTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<ParsedTransaction | null>(null);
  const [smsPermissionGranted, setSmsPermissionGranted] = useState<boolean | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<number>(Date.now());
  
  // Clipboard paste functionality
  const [isPasting, setIsPasting] = useState<boolean>(false);

  // Extract transaction ID from SMS body
  const extractTransactionId = useCallback((smsBody: string): string | null => {
    for (const pattern of TRANSACTION_PATTERNS) {
      const match = smsBody.match(pattern);
      if (match && match[1]) {
        // Validate that it looks like a transaction ID (alphanumeric, reasonable length)
        const potentialId = match[1].toUpperCase();
        if (potentialId.length >= 6 && potentialId.length <= 20) {
          return potentialId;
        }
      }
    }
    return null;
  }, []);

  // Check if SMS is payment-related
  const isPaymentSMS = useCallback((smsBody: string): boolean => {
    return PAYMENT_SMS_PATTERNS.some(pattern => pattern.test(smsBody));
  }, []);

  // Parse SMS message to extract transaction details
  const parseSMSMessage = useCallback((sms: SMSMessage): ParsedTransaction | null => {
    if (!isPaymentSMS(sms.body)) {
      return null;
    }

    const transactionId = extractTransactionId(sms.body);
    if (!transactionId) {
      return null;
    }

    // Try to extract amount
    const amountMatch = sms.body.match(/(?:Ksh|KES|XOF|FCFA|UGX|TZS|\$|USD)?[\s.]?([0-9,]+\.?[0-9]*)/i);
    const amount = amountMatch ? amountMatch[1].replace(/,/g, '') : undefined;

    return {
      transactionId,
      amount,
      sender: sms.sender,
      timestamp: sms.timestamp,
      rawMessage: sms.body,
    };
  }, [extractTransactionId, isPaymentSMS]);

  // Setup bridge handlers for SMS reading
  useEffect(() => {
    if (!bridge || bridgeInitRef.current) return;

    const setupBridge = () => {
      bridgeInitRef.current = true;

      const reg = (name: string, handler: any) => {
        bridge.registerHandler(name, handler);
        return () => bridge.registerHandler(name, () => {});
      };

      // Handler for incoming SMS messages
      const offSmsCallback = reg(
        "smsReceivedCallBack",
        (data: string, responseCallback: (response: any) => void) => {
          try {
            console.log("SMS received callback:", data);
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            
            const sms: SMSMessage = {
              sender: parsedData.sender || parsedData.address || "",
              body: parsedData.body || parsedData.message || "",
              timestamp: parsedData.timestamp || Date.now(),
            };

            const transaction = parseSMSMessage(sms);
            if (transaction) {
              console.log("Parsed transaction from SMS:", transaction);
              setRecentTransactions(prev => {
                // Avoid duplicates
                const exists = prev.some(t => t.transactionId === transaction.transactionId);
                if (exists) return prev;
                return [transaction, ...prev].slice(0, 10); // Keep last 10
              });
              
              // Auto-select if no transaction is selected
              if (!transactionId) {
                setTransactionId(transaction.transactionId);
                setSelectedTransaction(transaction);
                toast.success(t("Payment SMS detected! Transaction ID auto-filled."));
              }
            }

            responseCallback({ success: true });
          } catch (error) {
            console.error("Error processing SMS callback:", error);
            responseCallback({ success: false, error: String(error) });
          }
        }
      );

      // Handler for SMS permission result
      const offPermissionCallback = reg(
        "smsPermissionResultCallBack",
        (data: string, responseCallback: (response: any) => void) => {
          try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            const granted = parsedData.granted || parsedData.respCode === "200";
            setSmsPermissionGranted(granted);
            
            if (granted) {
              toast.success(t("SMS permission granted"));
            } else {
              toast.error(t("SMS permission denied. You can enter the transaction ID manually."));
            }
            
            responseCallback({ success: true });
          } catch (error) {
            console.error("Error processing SMS permission callback:", error);
            responseCallback({ success: false, error: String(error) });
          }
        }
      );

      // Handler for reading existing SMS messages
      const offReadSmsCallback = reg(
        "readSmsResultCallBack",
        (data: string, responseCallback: (response: any) => void) => {
          try {
            console.log("Read SMS result callback:", data);
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            const messages = parsedData.messages || parsedData.data || [];
            
            const transactions: ParsedTransaction[] = [];
            for (const msg of messages) {
              const sms: SMSMessage = {
                sender: msg.sender || msg.address || "",
                body: msg.body || msg.message || "",
                timestamp: msg.timestamp || msg.date || Date.now(),
              };
              
              const transaction = parseSMSMessage(sms);
              if (transaction) {
                transactions.push(transaction);
              }
            }

            if (transactions.length > 0) {
              setRecentTransactions(prev => {
                const combined = [...transactions, ...prev];
                // Remove duplicates
                const unique = combined.filter((t, index, self) => 
                  index === self.findIndex(s => s.transactionId === t.transactionId)
                );
                return unique.slice(0, 10);
              });
              toast.success(t(`Found ${transactions.length} payment transaction(s)`));
            } else {
              toast(t("No payment transactions found in recent messages"));
            }
            
            responseCallback({ success: true });
          } catch (error) {
            console.error("Error processing read SMS callback:", error);
            responseCallback({ success: false, error: String(error) });
          }
        }
      );

      return () => {
        offSmsCallback();
        offPermissionCallback();
        offReadSmsCallback();
        bridgeInitRef.current = false;
      };
    };

    return setupBridge();
  }, [bridge, parseSMSMessage, transactionId, t]);

  // Request SMS permission and start listening
  const requestSMSPermission = useCallback(() => {
    if (!bridge) {
      toast.error(t("Bridge not initialized. Using manual entry mode."));
      return;
    }

    setIsListeningForSMS(true);
    
    bridge.callHandler(
      "requestSmsPermission",
      {},
      (response: string) => {
        try {
          const parsedResponse = typeof response === 'string' ? JSON.parse(response) : response;
          console.log("SMS permission request response:", parsedResponse);
          
          if (parsedResponse.respCode === "200" || parsedResponse.granted) {
            setSmsPermissionGranted(true);
            // Start listening for SMS
            startSMSListener();
          } else {
            setSmsPermissionGranted(false);
            setIsListeningForSMS(false);
          }
        } catch (error) {
          console.error("Error parsing SMS permission response:", error);
          setIsListeningForSMS(false);
        }
      }
    );
  }, [bridge, t]);

  // Start SMS listener
  const startSMSListener = useCallback(() => {
    if (!bridge) return;

    bridge.callHandler(
      "startSmsListener",
      { filterPayment: true },
      (response: string) => {
        try {
          const parsedResponse = typeof response === 'string' ? JSON.parse(response) : response;
          console.log("Start SMS listener response:", parsedResponse);
          
          if (parsedResponse.respCode === "200") {
            setIsListeningForSMS(true);
            toast.success(t("Listening for payment SMS..."));
          }
        } catch (error) {
          console.error("Error starting SMS listener:", error);
        }
      }
    );
  }, [bridge, t]);

  // Read recent SMS messages to find payment transactions
  const readRecentSMS = useCallback(() => {
    if (!bridge) {
      toast.error(t("Bridge not initialized"));
      return;
    }

    setLastCheckedTime(Date.now());
    
    bridge.callHandler(
      "readRecentSms",
      { 
        count: 20, // Read last 20 messages
        sinceTimestamp: lastCheckedTime - (24 * 60 * 60 * 1000) // Last 24 hours
      },
      (response: string) => {
        console.log("Read recent SMS response:", response);
      }
    );
  }, [bridge, lastCheckedTime, t]);

  // Fetch subscription code on mount
  useEffect(() => {
    if (customer?.partner_id || customer?.id) {
      fetchSubscription();
    }
  }, [customer]);

  // Get authToken from localStorage
  useEffect(() => {
    const token = localStorage.getItem("authToken_rider");
    setAuthToken(token);
  }, []);

  const fetchSubscription = useCallback(async () => {
    if (!customer?.partner_id && !customer?.id) {
      toast.error(t("Customer data not available"));
      return;
    }

    setIsFetchingSubscription(true);
    try {
      const partnerId = customer.partner_id || customer.id;
      const token = localStorage.getItem("authToken_rider");
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "X-API-KEY": "abs_connector_secret_key_2024",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const url = `https://crm-omnivoltaic.odoo.com/api/customers/${partnerId}/subscriptions?page=1&limit=20`;
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.subscriptions) && data.subscriptions.length > 0) {
        // Get the first active subscription or the first one available
        const activeSubscription = data.subscriptions.find(
          (sub: any) => sub.status === "active"
        ) || data.subscriptions[0];
        
        if (activeSubscription?.subscription_code) {
          setSubscriptionCode(activeSubscription.subscription_code);
        } else {
          toast.error(t("No subscription code found"));
        }
      } else {
        toast.error(t("No subscriptions found"));
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
      toast.error(t("Failed to fetch subscription"));
    } finally {
      setIsFetchingSubscription(false);
    }
  }, [customer, t]);

  const handleGenerateQR = useCallback(async () => {
    if (!subscriptionCode || !transactionId.trim() || !authToken) {
      toast.error(t("Please ensure all fields are filled"));
      return;
    }

    setIsGeneratingQr(true);
    try {
      const qrData = {
        subscription_code: subscriptionCode,
        transaction_id: transactionId.trim(),
        authToken_rider: authToken,
        timestamp: Date.now(),
      };

      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQrDataUrl(qrDataUrl);
      toast.success(t("Payment QR code generated successfully"));
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error(t("Failed to generate QR code"));
    } finally {
      setIsGeneratingQr(false);
    }
  }, [subscriptionCode, transactionId, authToken, t]);

  const handleSelectTransaction = useCallback((transaction: ParsedTransaction) => {
    setTransactionId(transaction.transactionId);
    setSelectedTransaction(transaction);
    setQrDataUrl(null); // Clear existing QR code
  }, []);

  const handleCopyTransactionId = useCallback(() => {
    if (transactionId) {
      navigator.clipboard.writeText(transactionId);
      toast.success(t("Transaction ID copied"));
    }
  }, [transactionId, t]);

  const canGenerateQR = subscriptionCode && transactionId.trim() && authToken;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* SMS Reading Section */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--info-soft)' }}>
            <MessageSquare className="w-5 h-5" style={{ color: 'var(--info)' }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t("Auto-detect Payment SMS")}</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t("We can read your payment SMS to auto-fill the transaction ID")}</p>
          </div>
        </div>

        {/* Permission/Listen Button */}
        {smsPermissionGranted === null && (
          <button
            onClick={requestSMSPermission}
            className="btn btn-secondary w-full"
            style={{ padding: '12px 20px' }}
          >
            <Phone className="w-5 h-5" />
            <span>{t("Enable SMS Reading")}</span>
          </button>
        )}

        {smsPermissionGranted === false && (
          <div className="p-4 rounded-lg flex items-start gap-3" style={{ background: 'var(--error-soft)', border: '1px solid var(--error)' }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--error)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--error)' }}>{t("SMS Permission Denied")}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--error)' }}>{t("You can still enter the transaction ID manually below.")}</p>
            </div>
          </div>
        )}

        {smsPermissionGranted && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={readRecentSMS}
                className="btn btn-secondary flex-1"
                style={{ padding: '10px 16px' }}
                disabled={!bridge}
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t("Check Recent SMS")}</span>
              </button>
              
              <button
                onClick={startSMSListener}
                className={`btn flex-1 ${isListeningForSMS ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '10px 16px' }}
                disabled={!bridge}
              >
                {isListeningForSMS ? (
                  <>
                    <div className="loading-spinner" style={{ width: 16, height: 16, marginBottom: 0, borderWidth: 2 }}></div>
                    <span>{t("Listening...")}</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    <span>{t("Start Listening")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Recent Transactions */}
            {recentTransactions.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t("Recent Payment Transactions:")}</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recentTransactions.map((tx, index) => (
                    <button
                      key={`${tx.transactionId}-${index}`}
                      onClick={() => handleSelectTransaction(tx)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedTransaction?.transactionId === tx.transactionId
                          ? ''
                          : ''
                      }`}
                      style={{
                        background: selectedTransaction?.transactionId === tx.transactionId 
                          ? 'var(--accent-soft)' 
                          : 'var(--bg-tertiary)',
                        border: selectedTransaction?.transactionId === tx.transactionId 
                          ? '1px solid var(--accent)' 
                          : '1px solid var(--border)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{tx.transactionId}</p>
                          {tx.amount && (
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t("Amount")}: {tx.amount}</p>
                          )}
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            {new Date(tx.timestamp).toLocaleString()}
                          </p>
                        </div>
                        {selectedTransaction?.transactionId === tx.transactionId && (
                          <Check className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Entry & QR Generation */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {/* Subscription Code */}
        <div>
          <label className="form-label">{t("Subscription Code")}</label>
          {isFetchingSubscription ? (
            <div className="flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("Fetching subscription...")}</span>
            </div>
          ) : subscriptionCode ? (
            <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)' }}>
              <p className="font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{subscriptionCode}</p>
            </div>
          ) : (
            <div className="rounded-lg p-3" style={{ background: 'var(--error-soft)', border: '1px solid var(--error)' }}>
              <p className="text-sm" style={{ color: 'var(--error)' }}>{t("No subscription found")}</p>
              <button
                onClick={fetchSubscription}
                className="mt-2 text-sm underline"
                style={{ color: 'var(--error)' }}
              >
                {t("Retry")}
              </button>
            </div>
          )}
        </div>

        {/* Transaction ID Input */}
        <div>
          <label className="form-label">{t("Transaction ID")}</label>
          <div className="relative">
            <input
              type="text"
              value={transactionId}
              onChange={(e) => {
                setTransactionId(e.target.value.toUpperCase());
                setQrDataUrl(null); // Clear QR when ID changes
              }}
              placeholder={t("Enter or select transaction ID")}
              className="form-input font-mono"
              style={{ paddingRight: 44 }}
            />
            {transactionId && (
              <button
                onClick={handleCopyTransactionId}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label={t("Copy")}
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {t("Enter the transaction ID from your payment confirmation SMS")}
          </p>
        </div>

        {/* Generate QR Button */}
        <button
          onClick={handleGenerateQR}
          disabled={!canGenerateQR || isGeneratingQr}
          className="btn btn-primary w-full"
          style={{ padding: '14px 20px' }}
        >
          {isGeneratingQr ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t("Generating...")}</span>
            </>
          ) : (
            <>
              <QrCode className="w-5 h-5" />
              <span>{t("Generate Payment QR")}</span>
            </>
          )}
        </button>

        {/* QR Code Display */}
        {qrDataUrl && (
          <div className="mt-6 text-center space-y-4">
            <div className="inline-block rounded-2xl shadow-lg p-4" style={{ background: '#FFFFFF' }}>
              <img
                src={qrDataUrl}
                alt={t("Payment QR Code")}
                className="w-64 h-64 object-contain"
              />
            </div>
            <div className="space-y-2">
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {t("Show this QR code to the attendant")}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t("They will scan it to complete your payment confirmation")}
              </p>
              <div className="inline-block px-4 py-2 rounded-lg" style={{ background: 'var(--success-soft)' }}>
                <p className="text-sm font-mono" style={{ color: 'var(--success)' }}>
                  {t("Transaction ID")}: {transactionId}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t("How it works")}</h4>
        <ol className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>1</span>
            <span>{t("Make your payment through mobile money (M-Pesa, T-Money, etc.)")}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>2</span>
            <span>{t("Once you receive the confirmation SMS, the transaction ID will be auto-detected or you can enter it manually")}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>3</span>
            <span>{t("Generate the QR code and show it to the salesperson or attendant")}</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>4</span>
            <span>{t("The attendant will scan your QR code to verify and complete the transaction")}</span>
          </li>
        </ol>
      </div>
    </div>
  );
};

export default PaymentQR;
