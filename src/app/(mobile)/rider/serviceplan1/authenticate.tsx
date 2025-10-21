// //working in debug mode
// import React from "react";
// import { ScanLine, AlertCircle } from "lucide-react";
// import { toast } from "react-hot-toast";

// interface AuthenticateProps {
//   onScan: () => void;
//   sessionToken: string | null;
//   locationActions: any[];
//   isBindingSuccessful: boolean;
//   onProceedToService: () => void;
//   bridge: any; // WebViewJavascriptBridge
//   onHandleQrCode: (code: string) => string | null;
//   onBindingResult: (result: { sessionToken?: string; locationActions?: any[]; success: boolean }) => void;
// }

// const Authenticate: React.FC<AuthenticateProps> = ({
//   onScan,
//   sessionToken,
//   locationActions,
//   isBindingSuccessful,
//   onProceedToService,
//   bridge,
//   onHandleQrCode,
//   onBindingResult,
// }) => {
//   const bindCustomerToLocation = (locationId: string) => {
//     console.info("Starting bindCustomerToLocation with locationId:", locationId);

//     if (!bridge || !window.WebViewJavascriptBridge) {
//       console.error("WebViewJavascriptBridge is not initialized.");
//       toast.error("Cannot connect to service: Bridge not initialized");
//       onBindingResult({ success: false });
//       return;
//     }

//     console.info("Bridge is available, proceeding with MQTT setup");

//     const requestTopic = "call/abs/service/plan/service-plan-basic-latest-a/bind_customer";
//     const responseTopic = "rtrn/abs/service/plan/service-plan-basic-latest-a/bind_customer";

//     const content = {
//       timestamp: "2025-01-15T09:45:00Z",
//       plan_id: "service-plan-basic-latest-a",
//       correlation_id: "test-binding-001",
//       actor: {
//         type: "customer",
//         id: "CUST-RIDER-001",
//       },
//       data: {
//         action: "BIND_CUSTOMER_TO_LOCATION",
//         location_id: locationId,
//         requested_services: ["battery_swap"],
//         authentication_method: "mobile_app",
//       },
//     };

//     const dataToPublish = {
//       topic: requestTopic,
//       qos: 0,
//       content,
//     };

//     console.info("Prepared MQTT publish message:", JSON.stringify(dataToPublish, null, 2));

//     const reg = (name: string, handler: any) => {
//       console.info(`Registering handler for ${name}`);
//       bridge.registerHandler(name, handler);
//       return () => {
//         console.info(`Unregistering handler for ${name}`);
//         bridge.registerHandler(name, () => {});
//       };
//     };

//     const offResponseHandler = reg(
//       "mqttMsgArrivedCallBack",
//       (data: string, responseCallback: (response: any) => void) => {
//         console.info("Received mqttMsgArrivedCallBack with data:", data);
//         try {
//           const parsedData = JSON.parse(data);
//           console.info("Parsed MQTT callback data:", JSON.stringify(parsedData, null, 2));

//           const message = parsedData;
//           const topic = message.topic;
//           const rawMessageContent = message.message;

//           if (topic === responseTopic) {
//             console.info("Response matches topic:", responseTopic);
//             let responseData;
//             try {
//               responseData = typeof rawMessageContent === 'string' ? JSON.parse(rawMessageContent) : rawMessageContent;
//               console.info("Parsed MQTT message content:", JSON.stringify(responseData, null, 2));
//             } catch (parseErr) {
//               console.error("Error parsing MQTT message content:", parseErr);
//               responseData = rawMessageContent;
//             }

//             if (responseData?.data?.success) {
//               const sessionToken = responseData.data.metadata?.session_token;
//               const locationActions = responseData.data.metadata?.location_actions || [];
//               if (sessionToken) {
//                 console.info("Binding successful - Session Token:", sessionToken, "Location Actions:", locationActions);
//                 onBindingResult({ sessionToken, locationActions, success: true });
//                 toast.success("Binding successful! Session token received.");
//               } else {
//                 console.error("No session token in response:", responseData);
//                 onBindingResult({ success: false });
//                 toast.error("No session token received");
//               }
//             } else {
//               const errorReason = responseData?.data?.metadata?.reason || 
//                                   responseData?.data?.signals?.[0] || 
//                                   "Unknown error";
//               console.error("MQTT binding failed:", errorReason);
//               onBindingResult({ success: false });
//               toast.error(`Binding failed: ${errorReason}`);
//             }
//             responseCallback({ success: true });
//           } else {
//             console.info("Message topic does not match:", topic);
//           }
//         } catch (err) {
//           console.error("Error processing MQTT callback:", err);
//           toast.error("Error processing response");
//           onBindingResult({ success: false });
//           responseCallback({ success: false, error: String(err) });
//         }
//       }
//     );

//     console.info("Subscribing to MQTT response topic:", responseTopic);
//     window.WebViewJavascriptBridge.callHandler(
//       "mqttSubTopic",
//       { topic: responseTopic, qos: 0 },
//       (subscribeResponse) => {
//         console.info("MQTT subscribe response:", subscribeResponse);
//         try {
//           const subResp = typeof subscribeResponse === 'string' ? JSON.parse(subscribeResponse) : subscribeResponse;
//           if (subResp.respCode === "200") {
//             console.info("Successfully subscribed to:", responseTopic);
//           } else {
//             console.error("Subscribe failed:", subResp.respDesc || subResp.error || "Unknown error");
//             toast.error("Failed to subscribe to response topic");
//             onBindingResult({ success: false });
//           }
//         } catch (err) {
//           console.error("Error parsing subscribe response:", err);
//           toast.error("Error subscribing to response topic");
//           onBindingResult({ success: false });
//         }
//       }
//     );

//     console.info("Publishing MQTT message to:", requestTopic);
//     try {
//       window.WebViewJavascriptBridge.callHandler(
//         "mqttPublishMsg",
//         JSON.stringify(dataToPublish),
//         (response) => {
//           console.info("MQTT publish response:", response);
//           try {
//             const responseData = typeof response === 'string' ? JSON.parse(response) : response;
//             if (responseData.error || responseData.respCode !== "200") {
//               console.error("MQTT publish error:", responseData.respDesc || responseData.error || "Unknown error");
//               toast.error("Failed to publish binding request");
//               onBindingResult({ success: false });
//             } else {
//               console.info("Successfully published MQTT message to:", requestTopic);
//             }
//           } catch (err) {
//             console.error("Error parsing MQTT publish response:", err);
//             toast.error("Error publishing request");
//             onBindingResult({ success: false });
//           }
//         }
//       );
//     } catch (err) {
//       console.error("Error calling mqttPublishMsg:", err);
//       toast.error("Error publishing request");
//       onBindingResult({ success: false });
//     }

//     setTimeout(() => {
//       console.info("Cleaning up MQTT response handler and subscription for:", responseTopic);
//       offResponseHandler();
//       bridge.callHandler(
//         "mqttUnSubTopic",
//         { topic: responseTopic, qos: 0 },
//         (unsubResponse: any) => {
//           console.info("MQTT unsubscribe response:", unsubResponse);
//         }
//       );
//     }, 15000);
//   };

//   const handleScanResult = (data: string) => {
//     console.info("Handling QR scan result:", data);
//     try {
//       const locationId = onHandleQrCode(data);
//       if (locationId) {
//         console.info("Location ID extracted, calling bindCustomerToLocation:", locationId);
//         bindCustomerToLocation(locationId);
//       } else {
//         console.error("No valid locationId extracted from QR code");
//         toast.error("No valid location ID found");
//         onBindingResult({ success: false });
//       }
//     } catch (err) {
//       console.error("Error handling scan result:", err);
//       toast.error("Failed to process QR code");
//       onBindingResult({ success: false });
//     }
//   };

//   // Check if bridge is initialized
//   if (!bridge || !window.WebViewJavascriptBridge) {
//     return (
//       <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
//         <div className="text-center mb-8">
//           <h1 className="text-2xl font-bold text-white mb-4">Connection Error</h1>
//           <p className="text-red-400 text-sm flex items-center justify-center gap-2">
//             <AlertCircle className="w-5 h-5" />
//             Unable to connect to service. Please ensure the app is running in a supported environment.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
//       <div className="text-center mb-8">
//         <h1 className="text-2xl font-bold text-white mb-4">Scan Station QR Code</h1>
//         <p className="text-gray-400 text-sm">
//           Position the QR code within the frame then scan below
//         </p>
//       </div>
//       <button
//         onClick={() => {
//           console.info("Scan button clicked");
//           onScan();
//         }}
//         className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
//       >
//         <ScanLine className="w-5 h-5" />
//         Start Scan
//       </button>
//       {sessionToken && (
//         <div className="mt-6">
//           <h2 className="text-xl font-bold text-white mb-2">Session Token</h2>
//           <p className="text-gray-300">{sessionToken}</p>
//           <h2 className="text-xl font-bold text-white mt-4 mb-2">Location Actions</h2>
//           <ul className="text-gray-300">
//             {locationActions.map((action, index) => (
//               <li key={index}>{JSON.stringify(action)}</li>
//             ))}
//           </ul>
//         </div>
//       )}
//       {isBindingSuccessful && (
//         <button
//           onClick={() => {
//             console.info("Proceed to Service button clicked");
//             onProceedToService();
//           }}
//           className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 flex items-center justify-center gap-2 transition-all duration-200 transform hover:scale-[1.02]"
//         >
//           Proceed to Service
//         </button>
//       )}
//     </div>
//   );
// };

// export default Authenticate;
import React from "react";
import { ScanLine } from "lucide-react";
import { toast } from "react-hot-toast";

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
  return (
    <div className="bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-gray-700 w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-4">Scan Station QR Code</h1>
        <p className="text-gray-400 text-sm">
          Position the QR code within the frame then scan below
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
        Start Scan
      </button>
      {sessionToken && (
        <div className="mt-6">
          <h2 className="text-xl font-bold text-white mb-2">Session Token</h2>
          <p className="text-gray-300">{sessionToken}</p>
          <h2 className="text-xl font-bold text-white mt-4 mb-2">Location Actions</h2>
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
          Proceed to Service
        </button>
      )}
    </div>
  );
};

export default Authenticate;