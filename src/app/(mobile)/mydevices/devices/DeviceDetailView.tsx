// 'use client'

// import React, { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
// import { Toaster, toast } from 'react-hot-toast';
// import { ArrowLeft, Share2, Clipboard, Check, RefreshCw } from 'lucide-react';
// import { AsciiStringModal } from '../../../modals';
// import { apiUrl } from '@/lib/apollo-client';
// import { useI18n } from '@/i18n';

// interface DeviceDetailProps {
//   device: {
//     macAddress: string;
//     name: string;
//     rssi: string;
//     imageUrl?: string;
//   };
//   attributeList: any[];
//   onBack?: () => void;
//   onRequestServiceData?: (serviceName: string) => void;
//   isLoadingService?: string | null;
//   serviceLoadingProgress?: number;
// }

// const DeviceDetailView: React.FC<DeviceDetailProps> = ({
//   device,
//   attributeList,
//   onBack,
//   onRequestServiceData,
//   isLoadingService,
//   serviceLoadingProgress = 0,
// }) => {
//   const { t } = useI18n();
//   const router = useRouter();
//   const [updatedValue, setUpdatedValue] = useState<string | null>(null);
//   const [updatedValues, setUpdatedValues] = useState<{ [key: string]: string }>({});
//   const [generatedCode, setGeneratedCode] = useState<string | null>(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [asciiModalOpen, setAsciiModalOpen] = useState(false);
//   const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
//   const [duration, setDuration] = useState<number | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [isRetrieving, setIsRetrieving] = useState(false);
//   const [itemId, setItemId] = useState<string | null>(null);

//   useEffect(() => {
//     const fetchItemId = async () => {
//       const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
//       if (!attService) {
//         console.log('ATT_SERVICE not yet loaded, skipping fetchItemId');
//         return;
//       }

//       const oemItemId = attService.characteristicList.find((char: any) => char.name === 'opid')?.realVal || null;
//       if (!oemItemId) {
//         // toast.error(t('OEM Item ID not available'), { duration: 1000 });
//         return;
//       }

//       try {
//         const authToken = localStorage.getItem('access_token');
//         if (!authToken) {
//           toast.error(t('Please sign in to fetch item data'), { duration: 5000 });
//           router.push('/signin');
//           return;
//         }

//         const query = `
//           query GetItemByOemItemId($oemItemId: ID!) {
//             getItembyOemItemId(oemItemId: $oemItemId) {
//               _id
//             }
//           }
//         `;

//         const response = await fetch(apiUrl, {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             Authorization: `Bearer ${authToken}`,
//           },
//           body: JSON.stringify({
//             query,
//             variables: { oemItemId },
//           }),
//         });

//         const result = await response.json();

//         if (!response.ok) {
//           throw new Error(`HTTP error! Status: ${response.status}, Message: ${JSON.stringify(result)}`);
//         }

//         if (result.errors) {
//           throw new Error(`GraphQL error: ${result.errors.map((e: { message: any }) => e.message).join(', ')}`);
//         }

//         const fetchedItemId = result.data.getItembyOemItemId._id;
//         if (fetchedItemId) {
//           setItemId(fetchedItemId);
//           console.log('Item ID fetched successfully:', fetchedItemId);
//           // toast.success(t('Item ID fetched successfully'), { duration: 1000 });
//         } else {
//           throw new Error('No item ID returned in response');
//         }
//       } catch (error) {
//         console.error('Error fetching item ID:', error);
//         // toast.error(t(`Failed to fetch item data: ${error instanceof Error ? error.message : 'Unknown error'}`));
//       }
//     };

//     fetchItemId();
//   }, [router, attributeList]);

//   // New useEffect to auto-load CMD service
//   useEffect(() => {
//     const cmdService = attributeList.find(
//       (service) => service.serviceNameEnum === 'CMD_SERVICE'
//     );
//     if (!cmdService && isLoadingService !== 'CMD' && onRequestServiceData) {
//       console.log('Auto-loading CMD service');
//       onRequestServiceData('CMD');
//     }
//   }, [attributeList, isLoadingService, onRequestServiceData]);

//   const cmdService = attributeList.find(
//     (service) => service.serviceNameEnum === 'CMD_SERVICE'
//   );
//   const pubkCharacteristic = cmdService?.characteristicList.find(
//     (char: any) => char.name.toLowerCase().includes('pubk')
//   );

//   const handleBack = () => (onBack ? onBack() : router.back());

//   const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setDuration(Number(e.target.value));
//   };

//   const handleSubmit = async () => {
//     if (!itemId) {
//       // toast.error(t('Item ID not available'));
//       return;
//     }
//     if (!duration) {
//       toast.error(t('Please select a duration'));
//       return;
//     }
//     if (!Number.isInteger(duration) || duration < 0) {
//       toast.error(t('Duration must be a positive integer'));
//       return;
//     }

//     setIsSubmitting(true);

//     try {
//       const authToken = localStorage.getItem('access_token');
//       if (!authToken) {
//         router.push('/signin');
//         return;
//       }

//       const query = `
//         mutation GenerateDaysCode($itemId: ID!, $codeDays: Int!) {
//           generateDaysCode(generateDaysCodeInput: {
//             itemId: $itemId,
//             codeDays: $codeDays
//           }) {
//             codeType
//             codeHex
//             codeDec
//           }
//         }
//       `;

//       const response = await fetch(apiUrl, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${authToken}`,
//         },
//         body: JSON.stringify({
//           query,
//           variables: { itemId, codeDays: duration },
//         }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(`HTTP error ${response.status}: ${errorText}`);
//       }

//       const responseData = await response.json();

//       if (responseData.errors) {
//         const errorMessages = responseData.errors
//           .map((error: { message: string }) => error.message)
//           .join(', ');
//         throw new Error(`GraphQL error: ${errorMessages}`);
//       }

//       const { generateDaysCode } = responseData.data;
//       if (!generateDaysCode) {
//         throw new Error('No data returned from generateDaysCode');
//       }

//       const { codeDec } = generateDaysCode;
//       setGeneratedCode(codeDec);
//       toast.success(t(`Code: ${codeDec} generated successfully`), { duration: 1000 });

//       console.info('attributeList:', attributeList);
//       const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
//       if (cmdService) {
//         console.info('cmdService:', cmdService);
//         const pubkCharacteristic = cmdService.characteristicList.find(
//           (char: any) => char.name.toLowerCase() === 'pubk'
//         );
//         console.info('pubkCharacteristic:', pubkCharacteristic?.name);
//         if (pubkCharacteristic) {
//           setUpdatedValues((prev) => ({
//             ...prev,
//             [pubkCharacteristic.uuid]: codeDec,
//           }));
//           setActiveCharacteristic(pubkCharacteristic);
//           setUpdatedValue(codeDec);
//         } else {
//           toast.error(t('pubk characteristic not found in CMD service'));
//         }
//       } else {
//         toast.error(t('CMD service not available'));
//       }
//     } catch (error) {
//       console.error('Error generating code:', error);
//       const message = error instanceof Error ? error.message : 'Unknown error occurred';
//       toast.error(t(`Failed to generate code: ${message}`));
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleRetrieveCodes = async () => {
//     if (!itemId) {
//       // toast.error(t('Item ID not available'));
//       return;
//     }

//     const distributorId = localStorage.getItem('distributorId');
//     if (!distributorId) {
//       toast.error(t('Distributor ID not available. Please sign in.'));
//       router.push('/signin');
//       return;
//     }

//     setIsRetrieving(true);

//     try {
//       const authToken = localStorage.getItem('access_token');
//       if (!authToken) {
//         toast.error(t('Please sign in to retrieve codes'));
//         router.push('/signin');
//         return;
//       }

//       const query = `
//         query GetAllCodeEventsForSpecificItemByDistributor($itemId: ID!, $distributorId: ID!, $first: Int!) {
//           getAllCodeEventsForSpecificItemByDistributor(itemId: $itemId, distributorId: $distributorId, first: $first) {
//             page {
//               edges {
//                 node {
//                   codeDecString
//                 }
//               }
//             }
//           }
//         }
//       `;

//       const response = await fetch(apiUrl, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${authToken}`,
//         },
//         body: JSON.stringify({
//           query,
//           variables: { itemId, distributorId, first: 1 },
//         }),
//       });

//       if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(`HTTP error ${response.status}: ${errorText}`);
//       }

//       const responseData = await response.json();

//       if (responseData.errors) {
//         const errorMessages = responseData.errors
//           .map((error: { message: string }) => error.message)
//           .join(', ');
//         throw new Error(`GraphQL error: ${errorMessages}`);
//       }

//       const codeEventsData = responseData.data?.getAllCodeEventsForSpecificItemByDistributor?.page?.edges || [];
//       if (codeEventsData.length > 0) {
//         const codeDec = codeEventsData[0].node.codeDecString;
//         setGeneratedCode(codeDec);
//         toast.success(t(`Code: ${codeDec} retrieved successfully`), { duration: 1000 });

//         const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
//         if (cmdService) {
//           const pubkCharacteristic = cmdService.characteristicList.find(
//             (char: any) => char.name.toLowerCase() === 'pubk'
//           );
//           if (pubkCharacteristic) {
//             setUpdatedValues((prev) => ({
//               ...prev,
//               [pubkCharacteristic.uuid]: codeDec,
//             }));
//             setActiveCharacteristic(pubkCharacteristic);
//             setUpdatedValue(codeDec);
//           } else {
//             toast.error(t('pubk characteristic not found in CMD service'));
//           }
//         } else {
//           toast.error(t('CMD service not available'));
//         }
//       } else {
//         toast.error(t('No codes found for this device'));
//       }
//     } catch (error) {
//       const message = error instanceof Error ? error.message : 'Unknown error occurred';
//       toast.error(t(`Failed to retrieve code: ${message}`));
//     } finally {
//       setIsRetrieving(false);
//     }
//   };

//   const handleRead = () => {
//     if (!cmdService || !pubkCharacteristic) return;
//     setIsLoading(true);
//     readBleCharacteristic(
//       cmdService.uuid,
//       pubkCharacteristic.uuid,
//       device.macAddress,
//       (data: any, error: any) => {
//         setIsLoading(false);
//         if (data) {
//           toast.success(t(`${pubkCharacteristic.name} read successfully`));
//           setUpdatedValue(data.realVal);
//           setUpdatedValues((prev) => ({
//             ...prev,
//             [pubkCharacteristic.uuid]: data.realVal,
//           }));
//         } else {
//           console.error('Error Reading Characteristics');
//           toast.error(t(`Failed to read ${pubkCharacteristic.name}`));
//         }
//       }
//     );
//   };

//   const handleWriteClick = () => {
//     if (!pubkCharacteristic) return;
//     setActiveCharacteristic(pubkCharacteristic);
//     setAsciiModalOpen(true);
//   };

//   const handleWrite = (value: string) => {
//     if (!activeCharacteristic || !cmdService) return;
//     writeBleCharacteristic(
//       cmdService.uuid,
//       activeCharacteristic.uuid,
//       value,
//       device.macAddress,
//       (data: any, error: any) => {
//         if (data) {
//           toast.success(t(`Value written to ${activeCharacteristic.name}`));
//           setTimeout(() => {
//             handleRead();
//           }, 1000);
//         } else {
//           console.error('Error Writing Characteristics');
//           toast.error(t(`Failed to write ${activeCharacteristic.name}`));
//         }
//       }
//     );
//   };

//   const handleRefreshService = () => {
//     if (onRequestServiceData) {
//       onRequestServiceData('CMD');
//     }
//   };
// const translateDescription = (desc: string): string => {
//     // Check if the description contains specific patterns
//     if (desc.includes('Public Key / Last Code')) {
//       if (desc.includes('GPRS Carrier APN Name')) {
//         return t('Public Key / Last Code / GPRS Carrier APN Name');
//       }
//       return t('Public Key / Last Code');
//     }

    
//     return t(desc);
//   };

//   return (
//     <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
//       <Toaster />
//       <AsciiStringModal
//         isOpen={asciiModalOpen}
//         onClose={() => setAsciiModalOpen(false)}
//         onSubmit={(value) => handleWrite(value)}
//         title={activeCharacteristic?.name || t('Public Key / Last Code / GPRS Carrier APN Name')}
//       />
//       <div className="p-4 flex items-center" style={{ borderBottom: '1px solid var(--border)' }}>
//         <button 
//           onClick={handleBack} 
//           className="mr-4 transition-colors"
//           style={{ color: 'var(--text-secondary)' }}
//           onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
//           onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
//         >
//           <ArrowLeft className="w-6 h-6" />
//         </button>
//         <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{t('Device Details')}</h1>
//         <Share2 className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
//       </div>
//       <div className="flex flex-col items-center p-6 pb-2">
//         <img
//           src={device.imageUrl}
//           alt={device.name || 'Device'}
//           className="w-40 h-40 object-contain mb-4"
//         />
//         <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{device.name || t('Unknown Device')}</h2>
//         <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{device.macAddress || t('Unknown MAC')}</p>
//         <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{device.rssi || t('Unknown RSSI')}</p>
//       </div>
//       <div className="p-4 max-w-md mx-auto">
//         <div className="mb-6">
//           <div className="flex items-center space-x-2 mb-3">
//             <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('Duration')}</label>
//           </div>
//           <div className="grid grid-cols-2 gap-3">
//             {[
//               { value: 1, label: t('1 Day') },
//               { value: 3, label: t('3 Days') },
//             ].map((option) => (
//               <label
//                 key={option.value}
//                 className={`relative cursor-pointer transition-all duration-200 ${
//                   duration === option.value
//                     ? 'transform scale-105'
//                     : 'hover:scale-102'
//                 }`}
//               >
//                 <input
//                   type="radio"
//                   name="duration"
//                   value={option.value}
//                   checked={duration === option.value}
//                   onChange={handleDurationChange}
//                   className="sr-only"
//                 />
//                 <div
//                   className="p-4 rounded-xl border-2 transition-all duration-200"
//                   style={{
//                     border: duration === option.value ? '2px solid var(--accent)' : '2px solid var(--border)',
//                     background: duration === option.value ? 'var(--accent-soft)' : 'var(--bg-secondary)',
//                     boxShadow: duration === option.value ? '0 0 20px -5px var(--accent-glow)' : 'none',
//                   }}
//                 >
//                   <div className="text-center">
//                     <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{option.label}</div>
//                   </div>
//                   {duration === option.value && (
//                     <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
//                       <Check className="w-3 h-3 text-white" />
//                     </div>
//                   )}
//                 </div>
//               </label>
//             ))}
//           </div>
//         </div>
//         <div className="space-y-3 mb-6">
//           <button
//             className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
//               isSubmitting || !duration
//                 ? 'cursor-not-allowed'
//                 : 'cursor-pointer'
//             }`}
//             style={{
//               background: isSubmitting || !duration
//                 ? 'var(--bg-tertiary)'
//                 : 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)',
//               color: '#ffffff',
//               opacity: isSubmitting || !duration ? 0.5 : 1,
//               border: isSubmitting || !duration ? '1px solid var(--border)' : 'none',
//             }}
//             onMouseEnter={(e) => {
//               if (!isSubmitting && duration) {
//                 e.currentTarget.style.transform = 'translateY(-2px)';
//                 e.currentTarget.style.boxShadow = '0 8px 24px -8px var(--accent-glow)';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!isSubmitting && duration) {
//                 e.currentTarget.style.transform = 'translateY(0)';
//                 e.currentTarget.style.boxShadow = 'none';
//               }
//             }}
//             onClick={handleSubmit}
//             disabled={isSubmitting || !duration}
//           >
//             {isSubmitting ? (
//               <div className="flex items-center justify-center space-x-2">
//                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//                 <span>{t('Generating...')}</span>
//               </div>
//             ) : (
//               t('Generate Code')
//             )}
//           </button>
//           <button
//             className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
//               isRetrieving
//                 ? 'cursor-not-allowed'
//                 : 'cursor-pointer'
//             }`}
//             style={{
//               background: isRetrieving
//                 ? 'var(--bg-tertiary)'
//                 : 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)',
//               color: '#ffffff',
//               opacity: isRetrieving ? 0.5 : 1,
//               border: isRetrieving ? '1px solid var(--border)' : 'none',
//             }}
//             onMouseEnter={(e) => {
//               if (!isRetrieving) {
//                 e.currentTarget.style.transform = 'translateY(-2px)';
//                 e.currentTarget.style.boxShadow = '0 8px 24px -8px var(--accent-glow)';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!isRetrieving) {
//                 e.currentTarget.style.transform = 'translateY(0)';
//                 e.currentTarget.style.boxShadow = 'none';
//               }
//             }}
//             onClick={handleRetrieveCodes}
//             disabled={isRetrieving}
//           >
//             {isRetrieving ? (
//               <div className="flex items-center justify-center space-x-2">
//                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
//                 <span>{t('Retrieving...')}</span>
//               </div>
//             ) : (
//               t('Retrieve Last Code')
//             )}
//           </button>
//         </div>
//         {isLoadingService === 'CMD' && (
//           <div className="w-full h-1 mb-4 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
//             <div
//               className="h-full transition-all duration-300 ease-in-out"
//               style={{ 
//                 width: `${serviceLoadingProgress}%`,
//                 background: 'var(--accent)',
//               }}
//             ></div>
//           </div>
//         )}
//         <div className="flex justify-between items-center mb-4">
//           <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('CMD Service')}</h3>
//           <div
//             onClick={handleRefreshService}
//             className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
//               isLoadingService ? 'animate-spin' : ''
//             }`}
//             style={{
//               background: 'var(--bg-secondary)',
//               border: '1px solid var(--border)',
//               color: 'var(--text-secondary)',
//               cursor: isLoadingService ? 'not-allowed' : 'pointer',
//               opacity: isLoadingService ? 0.5 : 1,
//             }}
//             onMouseEnter={(e) => {
//               if (!isLoadingService) {
//                 e.currentTarget.style.background = 'var(--bg-tertiary)';
//                 e.currentTarget.style.color = 'var(--accent)';
//                 e.currentTarget.style.borderColor = 'var(--accent)';
//               }
//             }}
//             onMouseLeave={(e) => {
//               if (!isLoadingService) {
//                 e.currentTarget.style.background = 'var(--bg-secondary)';
//                 e.currentTarget.style.color = 'var(--text-secondary)';
//                 e.currentTarget.style.borderColor = 'var(--border)';
//               }
//             }}
//           >
//             <RefreshCw size={16} />
//           </div>
//         </div>
//         {cmdService && pubkCharacteristic ? (
//           <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
//             <div className="flex justify-between items-center px-4 py-2" style={{ background: 'var(--bg-tertiary)' }}>
//               <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pubkCharacteristic.name}</span>
//               <div className="flex space-x-2">
//                 <button
//                   className="btn btn-secondary text-xs"
//                   style={{ padding: '6px 12px', fontSize: '13px' }}
//                   onClick={handleRead}
//                   disabled={isLoading}
//                 >
//                   {isLoading ? t('Reading...') : t('Read')}
//                 </button>
//                 <button
//                   className="btn btn-primary text-xs"
//                   style={{ padding: '6px 12px', fontSize: '13px' }}
//                   onClick={handleWriteClick}
//                 >
//                   Write
//                 </button>
//               </div>
//             </div>
//             <div className="p-4 space-y-2">
//               <div>
//                 <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Description')}</p>
//                 <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{translateDescription(pubkCharacteristic.desc)}</p>
//               </div>
//               <div className="flex items-center justify-between group">
//                 <div className="flex-grow">
//                   <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Current Value')}</p>
//                   <p className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
//                     {updatedValues[pubkCharacteristic.uuid] || updatedValue || pubkCharacteristic.realVal || 'N/A'}
//                   </p>
//                 </div>
//                 <button
//                   className="p-2 transition-colors"
//                   style={{ color: 'var(--text-secondary)' }}
//                   onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
//                   onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
//                   onClick={() => {
//                     const valueToCopy = updatedValues[pubkCharacteristic.uuid] || updatedValue || pubkCharacteristic.realVal || 'N/A';
//                     navigator.clipboard.writeText(String(valueToCopy));
//                     toast.success(t('Value copied to clipboard'));
//                   }}
//                   aria-label="Copy to clipboard"
//                 >
//                   <Clipboard size={16} />
//                 </button>
//               </div>
//             </div>
//           </div>
//         ) : (
//           <div className="p-6 text-center" style={{ color: 'var(--text-secondary)' }}>
//             {isLoadingService === 'CMD' ? (
//               <p>{t('Loading CMD service data...')}</p>
//             ) : (
//               <p>{t('No data available for CMD service')}</p>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default DeviceDetailView;
'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, Clipboard, Check, RefreshCw } from 'lucide-react';
import { AsciiStringModal } from '../../../modals';
import { apiUrl } from '@/lib/apollo-client';
import { useI18n } from '@/i18n';

interface DeviceDetailProps {
  device: {
    macAddress: string;
    name: string;
    rssi: string;
    imageUrl?: string;
  };
  attributeList: any[];
  onBack?: () => void;
  onRequestServiceData?: (serviceName: string) => void;
  isLoadingService?: string | null;
  serviceLoadingProgress?: number;
}

const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
  serviceLoadingProgress = 0,
}) => {
  const { t } = useI18n();
  const router = useRouter();
  const [updatedValue, setUpdatedValue] = useState<string | null>(null);
  const [updatedValues, setUpdatedValues] = useState<{ [key: string]: string }>({});
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);

  useEffect(() => {
    const fetchItemId = async () => {
      const attService = attributeList.find((service) => service.serviceNameEnum === 'ATT_SERVICE');
      if (!attService) {
        console.log('ATT_SERVICE not yet loaded, skipping fetchItemId');
        return;
      }

      const oemItemId = attService.characteristicList.find((char: any) => char.name === 'opid')?.realVal || null;
      if (!oemItemId) {
        // toast.error(t('OEM Item ID not available'), { duration: 1000 });
        return;
      }

      try {
        const authToken = localStorage.getItem('access_token');
        if (!authToken) {
          toast.error(t('Please sign in to fetch item data'), { duration: 5000 });
          router.push('/signin');
          return;
        }

        const query = `
          query GetItemByOemItemId($oemItemId: ID!) {
            getItembyOemItemId(oemItemId: $oemItemId) {
              _id
            }
          }
        `;

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            query,
            variables: { oemItemId },
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${JSON.stringify(result)}`);
        }

        if (result.errors) {
          throw new Error(`GraphQL error: ${result.errors.map((e: { message: any }) => e.message).join(', ')}`);
        }

        const fetchedItemId = result.data.getItembyOemItemId._id;
        if (fetchedItemId) {
          setItemId(fetchedItemId);
          console.log('Item ID fetched successfully:', fetchedItemId);
          // toast.success(t('Item ID fetched successfully'), { duration: 1000 });
        } else {
          throw new Error('No item ID returned in response');
        }
      } catch (error) {
        console.error('Error fetching item ID:', error);
        // toast.error(t(`Failed to fetch item data: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    fetchItemId();
  }, [router, attributeList]);

  // New useEffect to auto-load CMD service
  useEffect(() => {
    const cmdService = attributeList.find(
      (service) => service.serviceNameEnum === 'CMD_SERVICE'
    );
    if (!cmdService && isLoadingService !== 'CMD' && onRequestServiceData) {
      console.log('Auto-loading CMD service');
      onRequestServiceData('CMD');
    }
  }, [attributeList, isLoadingService, onRequestServiceData]);

  const cmdService = attributeList.find(
    (service) => service.serviceNameEnum === 'CMD_SERVICE'
  );
  const pubkCharacteristic = cmdService?.characteristicList.find(
    (char: any) => char.name.toLowerCase().includes('pubk')
  );

  const handleBack = () => (onBack ? onBack() : router.back());

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDuration(Number(e.target.value));
  };

  const handleSubmit = async () => {
    if (!itemId) {
      // toast.error(t('Item ID not available'));
      return;
    }
    if (!duration) {
      toast.error(t('Please select a duration'));
      return;
    }
    if (!Number.isInteger(duration) || duration < 0) {
      toast.error(t('Duration must be a positive integer'));
      return;
    }

    setIsSubmitting(true);

    try {
      const authToken = localStorage.getItem('access_token');
      if (!authToken) {
        router.push('/signin');
        return;
      }

      const query = `
        mutation GenerateDaysCode($itemId: ID!, $codeDays: Int!) {
          generateDaysCode(generateDaysCodeInput: {
            itemId: $itemId,
            codeDays: $codeDays
          }) {
            codeType
            codeHex
            codeDec
          }
        }
      `;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query,
          variables: { itemId, codeDays: duration },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      if (responseData.errors) {
        const errorMessages = responseData.errors
          .map((error: { message: string }) => error.message)
          .join(', ');
        throw new Error(`GraphQL error: ${errorMessages}`);
      }

      const { generateDaysCode } = responseData.data;
      if (!generateDaysCode) {
        throw new Error('No data returned from generateDaysCode');
      }

      const { codeDec } = generateDaysCode;
      setGeneratedCode(codeDec);
      toast.success(t(`Code: ${codeDec} generated successfully`), { duration: 1000 });

      console.info('attributeList:', attributeList);
      const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
      if (cmdService) {
        console.info('cmdService:', cmdService);
        const pubkCharacteristic = cmdService.characteristicList.find(
          (char: any) => char.name.toLowerCase() === 'pubk'
        );
        console.info('pubkCharacteristic:', pubkCharacteristic?.name);
        if (pubkCharacteristic) {
          setUpdatedValues((prev) => ({
            ...prev,
            [pubkCharacteristic.uuid]: codeDec,
          }));
          setActiveCharacteristic(pubkCharacteristic);
          setUpdatedValue(codeDec);
          
          // Verify device is still connected before attempting write
          const connectedMac = sessionStorage.getItem('connectedDeviceMac');
          if (!connectedMac || connectedMac !== device.macAddress) {
            toast.error(t('Device not connected. Please reconnect and try again.'), { duration: 3000 });
            return;
          }
          
          // Automatically write the generated code to the device
          console.info('Writing generated code to device:', codeDec);
          writeBleCharacteristic(
            cmdService.uuid,
            pubkCharacteristic.uuid,
            codeDec,
            device.macAddress,
            (responseData: any, error: any) => {
              console.info('Write response:', responseData);
              
              // Parse response to check if write succeeded
              let writeSuccess = false;
              let errorMessage: string | null = null;
              
              try {
                let response: any;
                
                if (typeof responseData === 'string') {
                  try {
                    response = JSON.parse(responseData);
                  } catch (e) {
                    if (responseData.toLowerCase() === 'success' || responseData.toLowerCase() === 'ok') {
                      writeSuccess = true;
                    } else {
                      errorMessage = responseData;
                    }
                  }
                } else {
                  response = responseData;
                }
                
                if (response) {
                  if (response.respCode === '200' || response.respCode === 200) {
                    writeSuccess = true;
                  } else if (response.respData === true || response.respData === 'success') {
                    writeSuccess = true;
                  } else if (response.success === true) {
                    writeSuccess = true;
                  } else if (response.respDesc) {
                    errorMessage = response.respDesc;
                  } else if (response.error) {
                    errorMessage = response.error;
                  } else if (response.message) {
                    errorMessage = response.message;
                  }
                }
              } catch (e) {
                console.error('Error parsing write response:', e);
                errorMessage = 'Unknown write response format';
              }
              
              if (writeSuccess) {
                toast.success(t(`Code written to device successfully`), { duration: 2000 });
                // Read back the value after a delay to confirm it was written
                setTimeout(() => {
                  const stillConnected = sessionStorage.getItem('connectedDeviceMac');
                  if (stillConnected === device.macAddress) {
                    handleRead();
                  } else {
                    toast.error(t('Device disconnected. Please reconnect.'), { duration: 2000 });
                  }
                }, 2000);
              } else {
                console.error('Write failed:', errorMessage || 'Unknown error');
                toast.error(t(`Failed to write code to device: ${errorMessage || 'Write operation failed'}`), { duration: 3000 });
              }
            }
          );
        } else {
          toast.error(t('pubk characteristic not found in CMD service'));
        }
      } else {
        toast.error(t('CMD service not available'));
      }
    } catch (error) {
      console.error('Error generating code:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(t(`Failed to generate code: ${message}`));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetrieveCodes = async () => {
    if (!itemId) {
      // toast.error(t('Item ID not available'));
      return;
    }

    const distributorId = localStorage.getItem('distributorId');
    if (!distributorId) {
      toast.error(t('Distributor ID not available. Please sign in.'));
      router.push('/signin');
      return;
    }

    setIsRetrieving(true);

    try {
      const authToken = localStorage.getItem('access_token');
      if (!authToken) {
        toast.error(t('Please sign in to retrieve codes'));
        router.push('/signin');
        return;
      }

      const query = `
        query GetAllCodeEventsForSpecificItemByDistributor($itemId: ID!, $distributorId: ID!, $first: Int!) {
          getAllCodeEventsForSpecificItemByDistributor(itemId: $itemId, distributorId: $distributorId, first: $first) {
            page {
              edges {
                node {
                  codeDecString
                }
              }
            }
          }
        }
      `;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query,
          variables: { itemId, distributorId, first: 1 },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      if (responseData.errors) {
        const errorMessages = responseData.errors
          .map((error: { message: string }) => error.message)
          .join(', ');
        throw new Error(`GraphQL error: ${errorMessages}`);
      }

      const codeEventsData = responseData.data?.getAllCodeEventsForSpecificItemByDistributor?.page?.edges || [];
      if (codeEventsData.length > 0) {
        const codeDec = codeEventsData[0].node.codeDecString;
        setGeneratedCode(codeDec);
        toast.success(t(`Code: ${codeDec} retrieved successfully`), { duration: 1000 });

        const cmdService = attributeList.find((service) => service.serviceNameEnum === 'CMD_SERVICE');
        if (cmdService) {
          const pubkCharacteristic = cmdService.characteristicList.find(
            (char: any) => char.name.toLowerCase() === 'pubk'
          );
          if (pubkCharacteristic) {
            setUpdatedValues((prev) => ({
              ...prev,
              [pubkCharacteristic.uuid]: codeDec,
            }));
            setActiveCharacteristic(pubkCharacteristic);
            setUpdatedValue(codeDec);
            
            // Verify device is still connected before attempting write
            const connectedMac = sessionStorage.getItem('connectedDeviceMac');
            if (!connectedMac || connectedMac !== device.macAddress) {
              toast.error(t('Device not connected. Please reconnect and try again.'), { duration: 3000 });
              return;
            }
            
            // Automatically write the retrieved code to the device
            console.info('Writing retrieved code to device:', codeDec);
            writeBleCharacteristic(
              cmdService.uuid,
              pubkCharacteristic.uuid,
              codeDec,
              device.macAddress,
              (responseData: any, error: any) => {
                console.info('Write response:', responseData);
                
                // Parse response to check if write succeeded
                let writeSuccess = false;
                let errorMessage: string | null = null;
                
                try {
                  let response: any;
                  
                  if (typeof responseData === 'string') {
                    try {
                      response = JSON.parse(responseData);
                    } catch (e) {
                      if (responseData.toLowerCase() === 'success' || responseData.toLowerCase() === 'ok') {
                        writeSuccess = true;
                      } else {
                        errorMessage = responseData;
                      }
                    }
                  } else {
                    response = responseData;
                  }
                  
                  if (response) {
                    if (response.respCode === '200' || response.respCode === 200) {
                      writeSuccess = true;
                    } else if (response.respData === true || response.respData === 'success') {
                      writeSuccess = true;
                    } else if (response.success === true) {
                      writeSuccess = true;
                    } else if (response.respDesc) {
                      errorMessage = response.respDesc;
                    } else if (response.error) {
                      errorMessage = response.error;
                    } else if (response.message) {
                      errorMessage = response.message;
                    }
                  }
                } catch (e) {
                  console.error('Error parsing write response:', e);
                  errorMessage = 'Unknown write response format';
                }
                
                if (writeSuccess) {
                  toast.success(t(`Code written to device successfully`), { duration: 2000 });
                  // Read back the value after a delay to confirm it was written
                  setTimeout(() => {
                    const stillConnected = sessionStorage.getItem('connectedDeviceMac');
                    if (stillConnected === device.macAddress) {
                      handleRead();
                    } else {
                      toast.error(t('Device disconnected. Please reconnect.'), { duration: 2000 });
                    }
                  }, 2000);
                } else {
                  console.error('Write failed:', errorMessage || 'Unknown error');
                  toast.error(t(`Failed to write code to device: ${errorMessage || 'Write operation failed'}`), { duration: 3000 });
                }
              }
            );
          } else {
            toast.error(t('pubk characteristic not found in CMD service'));
          }
        } else {
          toast.error(t('CMD service not available'));
        }
      } else {
        toast.error(t('No codes found for this device'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(t(`Failed to retrieve code: ${message}`));
    } finally {
      setIsRetrieving(false);
    }
  };

  const handleRead = () => {
    if (!cmdService || !pubkCharacteristic) return;
    setIsLoading(true);
    readBleCharacteristic(
      cmdService.uuid,
      pubkCharacteristic.uuid,
      device.macAddress,
      (data: any, error: any) => {
        setIsLoading(false);
        if (data) {
          toast.success(t(`${pubkCharacteristic.name} read successfully`));
          setUpdatedValue(data.realVal);
          setUpdatedValues((prev) => ({
            ...prev,
            [pubkCharacteristic.uuid]: data.realVal,
          }));
        } else {
          console.error('Error Reading Characteristics');
          toast.error(t(`Failed to read ${pubkCharacteristic.name}`));
        }
      }
    );
  };

  const handleWriteClick = () => {
    if (!pubkCharacteristic) return;
    setActiveCharacteristic(pubkCharacteristic);
    setAsciiModalOpen(true);
  };

  const handleWrite = (value: string) => {
    if (!activeCharacteristic || !cmdService) return;
    writeBleCharacteristic(
      cmdService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      (data: any, error: any) => {
        if (data) {
          toast.success(t(`Value written to ${activeCharacteristic.name}`));
          setTimeout(() => {
            handleRead();
          }, 1000);
        } else {
          console.error('Error Writing Characteristics');
          toast.error(t(`Failed to write ${activeCharacteristic.name}`));
        }
      }
    );
  };

  const handleRefreshService = () => {
    if (onRequestServiceData) {
      onRequestServiceData('CMD');
    }
  };
const translateDescription = (desc: string): string => {
    // Check if the description contains specific patterns
    if (desc.includes('Public Key / Last Code')) {
      if (desc.includes('GPRS Carrier APN Name')) {
        return t('Public Key / Last Code / GPRS Carrier APN Name');
      }
      return t('Public Key / Last Code');
    }

    
    return t(desc);
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ position: 'relative', zIndex: 1 }}>
      <Toaster />
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={(value) => handleWrite(value)}
        title={activeCharacteristic?.name || t('Public Key / Last Code / GPRS Carrier APN Name')}
      />
      <div className="p-4 flex items-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <button 
          onClick={handleBack} 
          className="mr-4 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{t('Device Details')}</h1>
        <Share2 className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
      </div>
      <div className="flex flex-col items-center p-6 pb-2">
        <img
          src={device.imageUrl}
          alt={device.name || 'Device'}
          className="w-40 h-40 object-contain mb-4"
        />
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{device.name || t('Unknown Device')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{device.macAddress || t('Unknown MAC')}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{device.rssi || t('Unknown RSSI')}</p>
      </div>
      <div className="p-4 max-w-md mx-auto">
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('Duration')}</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 1, label: t('1 Day') },
              { value: 3, label: t('3 Days') },
            ].map((option) => (
              <label
                key={option.value}
                className={`relative cursor-pointer transition-all duration-200 ${
                  duration === option.value
                    ? 'transform scale-105'
                    : 'hover:scale-102'
                }`}
              >
                <input
                  type="radio"
                  name="duration"
                  value={option.value}
                  checked={duration === option.value}
                  onChange={handleDurationChange}
                  className="sr-only"
                />
                <div
                  className="p-4 rounded-xl border-2 transition-all duration-200"
                  style={{
                    border: duration === option.value ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: duration === option.value ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                    boxShadow: duration === option.value ? '0 0 20px -5px var(--accent-glow)' : 'none',
                  }}
                >
                  <div className="text-center">
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{option.label}</div>
                  </div>
                  {duration === option.value && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3 mb-6">
          <button
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
              isSubmitting || !duration
                ? 'cursor-not-allowed'
                : 'cursor-pointer'
            }`}
            style={{
              background: isSubmitting || !duration
                ? 'var(--bg-tertiary)'
                : 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)',
              color: '#ffffff',
              opacity: isSubmitting || !duration ? 0.5 : 1,
              border: isSubmitting || !duration ? '1px solid var(--border)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting && duration) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px -8px var(--accent-glow)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting && duration) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
            onClick={handleSubmit}
            disabled={isSubmitting || !duration}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{t('Generating...')}</span>
              </div>
            ) : (
              t('Generate Code')
            )}
          </button>
          <button
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
              isRetrieving
                ? 'cursor-not-allowed'
                : 'cursor-pointer'
            }`}
            style={{
              background: isRetrieving
                ? 'var(--bg-tertiary)'
                : 'linear-gradient(135deg, var(--accent) 0%, #00a0a0 100%)',
              color: '#ffffff',
              opacity: isRetrieving ? 0.5 : 1,
              border: isRetrieving ? '1px solid var(--border)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isRetrieving) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px -8px var(--accent-glow)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRetrieving) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
            onClick={handleRetrieveCodes}
            disabled={isRetrieving}
          >
            {isRetrieving ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{t('Retrieving...')}</span>
              </div>
            ) : (
              t('Retrieve Last Code')
            )}
          </button>
        </div>
        {isLoadingService === 'CMD' && (
          <div className="w-full h-1 mb-4 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div
              className="h-full transition-all duration-300 ease-in-out"
              style={{ 
                width: `${serviceLoadingProgress}%`,
                background: 'var(--accent)',
              }}
            ></div>
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{t('CMD Service')}</h3>
          <div
            onClick={handleRefreshService}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              isLoadingService ? 'animate-spin' : ''
            }`}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: isLoadingService ? 'not-allowed' : 'pointer',
              opacity: isLoadingService ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoadingService) {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoadingService) {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }
            }}
          >
            <RefreshCw size={16} />
          </div>
        </div>
        {cmdService && pubkCharacteristic ? (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div className="flex justify-between items-center px-4 py-2" style={{ background: 'var(--bg-tertiary)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pubkCharacteristic.name}</span>
              <div className="flex space-x-2">
                <button
                  className="btn btn-secondary text-xs"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  onClick={handleRead}
                  disabled={isLoading}
                >
                  {isLoading ? t('Reading...') : t('Read')}
                </button>
                <button
                  className="btn btn-primary text-xs"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  onClick={handleWriteClick}
                >
                  Write
                </button>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Description')}</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{translateDescription(pubkCharacteristic.desc)}</p>
              </div>
              <div className="flex items-center justify-between group">
                <div className="flex-grow">
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('Current Value')}</p>
                  <p className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                    {updatedValues[pubkCharacteristic.uuid] || updatedValue || pubkCharacteristic.realVal || 'N/A'}
                  </p>
                </div>
                <button
                  className="p-2 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onClick={() => {
                    const valueToCopy = updatedValues[pubkCharacteristic.uuid] || updatedValue || pubkCharacteristic.realVal || 'N/A';
                    navigator.clipboard.writeText(String(valueToCopy));
                    toast.success(t('Value copied to clipboard'));
                  }}
                  aria-label="Copy to clipboard"
                >
                  <Clipboard size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center" style={{ color: 'var(--text-secondary)' }}>
            {isLoadingService === 'CMD' ? (
              <p>{t('Loading CMD service data...')}</p>
            ) : (
              <p>{t('No data available for CMD service')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceDetailView;