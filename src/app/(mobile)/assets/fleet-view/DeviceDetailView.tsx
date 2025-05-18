
// 'use client'

// import React, { useState, useRef, useEffect, useMemo } from 'react';
// import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
// import { Toaster, toast } from 'react-hot-toast';
// import { AsciiStringModal, NumericModal } from '../../../modals';

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
//   handlePublish?: (attributeList: any, serviceType: string) => void;
// }

// const DeviceDetailView: React.FC<DeviceDetailProps> = ({
//   device,
//   attributeList,
//   onBack,
//   onRequestServiceData,
//   isLoadingService,
//   serviceLoadingProgress = 0,
//   handlePublish,
// }) => {
//   const [updatedValues, setUpdatedValues] = useState<Record<string, any>>({});
//   const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
//   const [asciiModalOpen, setAsciiModalOpen] = useState(false);
//   const [numericModalOpen, setNumericModalOpen] = useState(false);
//   const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
//   const [pubkValue, setPubkValue] = useState<string | null>(null);
//   const [rcrdValue, setRcrdValue] = useState<string | null>(null);


//   /* ------------------------------------------------------------------ */
//   /*        Memoised lookup for CMD_SERVICE/pubk & STS_SERVICE/rcrd      */
//   /* ------------------------------------------------------------------ */
//   const {
//     cmdService,
//     pubkCharacteristic,
//     stsService,
//     rcrdCharacteristic,
//   } = useMemo(() => {
//     const foundCmd = attributeList.find(
//       (service) => service.serviceNameEnum === 'CMD_SERVICE'
//     );

//     const foundSts = attributeList.find(
//       (service) => service.serviceNameEnum === 'STS_SERVICE'
//     );

//     const pubkChar =
//       foundCmd?.characteristicList?.find((c: any) => c.name.toLowerCase() === 'pubk') ??
//       null;

//     const rcrdChar =
//       foundSts?.characteristicList?.find((c: any) => c.name.toLowerCase() === 'rcrd') ??
//       null;

//     return {
//       cmdService: foundCmd ?? null,
//       pubkCharacteristic: pubkChar,
//       stsService: foundSts ?? null,
//       rcrdCharacteristic: rcrdChar,
//     };
//   }, [attributeList]);


//   useEffect(() => {
//     if (onRequestServiceData) {
//       onRequestServiceData('CMD');
//       onRequestServiceData('STS');
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);


//   useEffect(() => {
//     const servicesDone = isLoadingService === null && !loadingStates['CMD'] && !loadingStates['STS'];

//     if (servicesDone) {
//       if (pubkCharacteristic) setPubkValue(pubkCharacteristic.realVal);
//       if (rcrdCharacteristic) setRcrdValue(rcrdCharacteristic.realVal);
//     }
//   }, [isLoadingService, loadingStates, pubkCharacteristic, rcrdCharacteristic]);


//   const formatValue = (characteristic: any) => {
//     if (typeof characteristic?.realVal === 'number') {
//       switch (characteristic.valType) {
//         case 1:
//           return `${characteristic.realVal} mA`;
//         case 2:
//           return `${characteristic.realVal} mV`;
//         default:
//           return characteristic.realVal;
//       }
//     }
//     return characteristic?.realVal ?? 'N/A';
//   };


//   const handleRead = (
//     serviceUuid: string,
//     characteristicUuid: string,
//     name: string
//   ) => {
//     setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));

//     readBleCharacteristic(
//       serviceUuid,
//       characteristicUuid,
//       device.macAddress,
//       (data: any, error: any) => {
//         setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));

//         if (data) {
//           setUpdatedValues((prev) => ({ ...prev, [characteristicUuid]: data.realVal }));
//         } else {
//           toast.error(`Failed to read ${name}`);
//         }
//       }
//     );
//   };

//   const handleWriteClick = (characteristic: any) => {
//     setActiveCharacteristic(characteristic);

//     // Determine which modal to open based on characteristic name
//     if (characteristic.name.toLowerCase().includes('pubk')) {
//       setAsciiModalOpen(true);
//     } else {
//       setNumericModalOpen(true);
//     }
//   };

//   const handleWrite = (value: string | number) => {
//     if (!activeCharacteristic || !cmdService) return;

//     writeBleCharacteristic(
//       cmdService.uuid,
//       activeCharacteristic.uuid,
//       value,
//       device.macAddress,
//       () => {
//         toast.success(`Value written to ${activeCharacteristic.name}`);
//         // Refresh value after write
//         // setTimeout(() =>
//         //   handleRead(cmdService.uuid, activeCharacteristic.uuid, device.name)
//         //   handleRead(stsService.uuid, rcrdCharacteristic.uuid, device.name)
//         // 1000);
//         setTimeout(() => {
//           handleRead(cmdService.uuid, activeCharacteristic.uuid, device.name);
//           handleRead(stsService.uuid, rcrdCharacteristic.uuid, device.name);
//         }, 1000);
//       }
//     );
//   };


//   return (
//     <div className="max-w-md mx-auto bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen text-white">
//       <Toaster />

//       {/* ---------- Modals ---------- */}
//       <AsciiStringModal
//         isOpen={asciiModalOpen}
//         onClose={() => setAsciiModalOpen(false)}
//         onSubmit={handleWrite}
//         title={activeCharacteristic?.name || 'Public Key / Last Code'}
//       />
//       <NumericModal
//         isOpen={numericModalOpen}
//         onClose={() => setNumericModalOpen(false)}
//         onSubmit={handleWrite}
//         title={activeCharacteristic?.name || 'Write'}
//       />

//       {/* ---------- Credentials block ---------- */}
//       {(pubkCharacteristic || rcrdCharacteristic) && (
//         <div className="p-4">
//           <h3 className="text-lg font-medium mb-2">Device Credentials</h3>
//           <div className="grid grid-cols-2 gap-4 text-sm font-mono break-all">
//             {pubkCharacteristic && (
//               <div>
//                 <span className="font-semibold">pubk: </span>
//                 {updatedValues[pubkCharacteristic.uuid] ?? formatValue(pubkCharacteristic)}
//               </div>
//             )}
//             {rcrdCharacteristic && (
//               <div>
//                 <span className="font-semibold">rcrd: </span>
//                 {updatedValues[rcrdCharacteristic.uuid] ?? formatValue(rcrdCharacteristic)}
//               </div>
//             )}
//           </div>

//           {/* Optional write / read buttons for pubk (rcrd is read‑only) */}
//           {pubkCharacteristic && (
//             <div className="flex gap-2 mt-2">
//               <button
//                 onClick={() => handleWriteClick(pubkCharacteristic)}
//                 className="bg-blue-600 px-4 py-2 rounded-md"
//               >
//                 Write pubk
//               </button>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ---------- Rest of the component: tabs, characteristics, etc. ---------- */}
//       {/* ... existing rendering for tabs, HeartbeatView, other characteristics ... */}
//     </div>
//   );
// };

// export default DeviceDetailView;


// 'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { ArrowLeft, Share2, Clipboard } from 'lucide-react';
import { readBleCharacteristic, writeBleCharacteristic } from '../../../utils';
import { AsciiStringModal, NumericModal } from '../../../modals';

interface DeviceDetailProps {
  device: {
    macAddress: string;
    name: string;
    rssi?: string;
    imageUrl?: string;
  };
  attributeList: any[];
  onBack?: () => void;
  onRequestServiceData?: (serviceName: string) => void;
  isLoadingService?: string | null;
  serviceLoadingProgress?: number;
  handlePublish?: (attributeList: any, serviceType: string) => void;
}

/* ------------------------------------------------------------------ */
/*                    Main component implementation                   */
/* ------------------------------------------------------------------ */
const DeviceDetailView: React.FC<DeviceDetailProps> = ({
  device,
  attributeList,
  onBack,
  onRequestServiceData,
  isLoadingService,
}) => {
  /* ----------------------------- state ----------------------------- */
  const [updatedValues, setUpdatedValues] = useState<Record<string, any>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [asciiModalOpen, setAsciiModalOpen] = useState(false);
  const [numericModalOpen, setNumericModalOpen] = useState(false);
  const [activeCharacteristic, setActiveCharacteristic] = useState<any>(null);
  const [inputCode, setInputCode] = useState('');

  /* Values we may want to display although they have their own cards  */
  const [pubkValue, setPubkValue] = useState<string | null>(null);
  const [rcrdValue, setRcrdValue] = useState<string | null>(null);

  /* ---------------------- locate services/chars -------------------- */
  const {
    cmdService,
    pubkCharacteristic,
    stsService,
    rcrdCharacteristic,
  } = useMemo(() => {
    const foundCmd = attributeList.find(
      (service) => service.serviceNameEnum === 'CMD_SERVICE'
    );
    const foundSts = attributeList.find(
      (service) => service.serviceNameEnum === 'STS_SERVICE'
    );

    const pubkChar =
      foundCmd?.characteristicList?.find(
        (c: any) => c.name.toLowerCase() === 'pubk'
      ) ?? null;

    const rcrdChar =
      foundSts?.characteristicList?.find(
        (c: any) => c.name.toLowerCase() === 'rcrd'
      ) ?? null;

    return {
      cmdService: foundCmd ?? null,
      pubkCharacteristic: pubkChar,
      stsService: foundSts ?? null,
      rcrdCharacteristic: rcrdChar,
    };
  }, [attributeList]);

  /* ------------------ ensure CMD & STS are fetched ----------------- */
  useEffect(() => {
    if (onRequestServiceData) {
      if (!cmdService) onRequestServiceData('CMD');
      if (!stsService) onRequestServiceData('STS');
    }
    // eslint‑disable‑next‑line react-hooks/exhaustive-deps
  }, []);

  /* ----------------- hydrate initial pubk / rcrd ------------------- */
  useEffect(() => {
    const done =
      isLoadingService === null && !loadingStates['CMD'] && !loadingStates['STS'];
    if (!done) return;

    if (pubkCharacteristic) setPubkValue(pubkCharacteristic.realVal);
    if (rcrdCharacteristic) setRcrdValue(rcrdCharacteristic.realVal);
  }, [isLoadingService, loadingStates, pubkCharacteristic, rcrdCharacteristic]);

  /* ------------------------------------------------------------------ */
  /*                        Helper / util functions                     */
  /* ------------------------------------------------------------------ */
  const formatValue = (characteristic: any) => {
    if (!characteristic) return 'N/A';
    if (typeof characteristic.realVal === 'number') {
      switch (characteristic.valType) {
        case 1:
          return `${characteristic.realVal} mA`;
        case 2:
          return `${characteristic.realVal} mV`;
        default:
          return characteristic.realVal;
      }
    }
    return characteristic.realVal ?? 'N/A';
  };

  const getDisplayValue = (char: any) => {
    if (!char) return 'N/A';
    return updatedValues[char.uuid] !== undefined
      ? updatedValues[char.uuid]
      : formatValue(char);
  };

  /* ----------------------------- BLE I/O ---------------------------- */
  // const handleRead = (
  //   serviceUuid: string,
  //   characteristicUuid: string,
  //   name: string
  // ) => {
  //   setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));
  //   readBleCharacteristic(serviceUuid, characteristicUuid, device.macAddress, (data) => {
  //     setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));
  //     if (data) {
  //       setUpdatedValues((prev) => ({ ...prev, [characteristicUuid]: data.realVal }));
  //       toast.success(`${name} read successfully`);
  //     } else {
  //       toast.error(`Failed to read ${name}`);
  //     }
  //   });
  // };

    const handleRead = (
    serviceUuid: string,
    characteristicUuid: string,
    name: string
  ) => {
    setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: true }));

    readBleCharacteristic(
      serviceUuid,
      characteristicUuid,
      device.macAddress,
      (data: any, error: any) => {
        setLoadingStates((prev) => ({ ...prev, [characteristicUuid]: false }));

        if (data) {
          setUpdatedValues((prev) => ({ ...prev, [characteristicUuid]: data.realVal }));
        } else {
          toast.error(`Failed to read ${name}`);
        }
      }
    );
  };


  // const handleWriteClick = (characteristic: any) => {
  //   setActiveCharacteristic(characteristic);
  //   characteristic.name.toLowerCase().includes('pubk')
  //     ? setAsciiModalOpen(true)
  //     : setNumericModalOpen(true);
  // };

  const writeCharacteristic = (
    char: any,
    value: string | number,
    afterWrite?: () => void
  ) => {
    if (!char || !cmdService) return;
    writeBleCharacteristic(cmdService.uuid, char.uuid, value, device.macAddress, () => {
      toast.success(`Value written to ${char.name}`);
      afterWrite?.();
    });
  };

  const handleWrite = (value: string | number) => {
    if (!activeCharacteristic || !cmdService) return;

    writeBleCharacteristic(
      cmdService.uuid,
      activeCharacteristic.uuid,
      value,
      device.macAddress,
      () => {
        toast.success(`Value written to ${activeCharacteristic.name}`);
        // Refresh value after write
        // setTimeout(() =>
        //   handleRead(cmdService.uuid, activeCharacteristic.uuid, device.name)
        //   handleRead(stsService.uuid, rcrdCharacteristic.uuid, device.name)
        // 1000);
        setTimeout(() => {
          handleRead(cmdService.uuid, pubkCharacteristic.uuid, device.name);
          handleRead(stsService.uuid, rcrdCharacteristic.uuid, device.name);
        }, 1000);
      }
    );
  };

  /* ------------------------------------------------------------------ */
  /*                        Keypad / input logic                        */
  /* ------------------------------------------------------------------ */
  const keypad: string[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  const formatInputCode = (code: string) => {
    const raw = code.replace(/\s/g, '');
    if (!raw) return '';
    const segs: string[] = [];
    if (raw.length > 0) segs.push(raw.slice(0, 4));
    if (raw.length > 4) segs.push(raw.slice(4, 7));
    if (raw.length > 7) segs.push(raw.slice(7, 10));
    if (raw.length > 10) segs.push(raw.slice(10, 13));
    if (raw.length > 13) segs.push(raw.slice(13, 16));
    if (raw.length > 16) segs.push(raw.slice(16, 19));
    if (raw.length > 19) segs.push(raw.slice(19, 23));
    return segs.join(' ');
  };

  const handleNumpadClick = (key: string) => {
    setInputCode((prev) => {
      const raw = prev.replace(/\s/g, '');
      if (key === 'backspace') {
        return formatInputCode(raw.slice(0, -1));
      }

      if (raw.length >= 23) return prev;
      if (raw.length === 0 && key !== '*') return prev;
      if (raw.length === 22 && key !== '#') return prev;
      if (raw.length >= 1 && raw.length < 22 && !/^[0-9]$/.test(key)) return prev;

      return formatInputCode(raw + key);
    });
  };

  const clearInput = () => handleNumpadClick('backspace');

  const submitInput = () => {
    if (isLoadingService) return toast.error('Service is loading, please wait');
    const raw = inputCode.replace(/\s/g, '');
    if (raw.length !== 23) return toast.error('Code must be 23 characters');
    if (!pubkCharacteristic) return toast.error('Public key characteristic not found');

    writeCharacteristic(pubkCharacteristic, formatInputCode(inputCode), () => {
      setTimeout(() =>
        handleRead(cmdService!.uuid, pubkCharacteristic.uuid, pubkCharacteristic.name),
      1000);
    });
    setInputCode('');
  };

  /* ------------------------------------------------------------------ */
  /*                              Render                                */
  /* ------------------------------------------------------------------ */
  const header = (
    <div className="p-4 flex items-center">
      <button onClick={onBack} className="mr-4" aria-label="Back">
        <ArrowLeft className="w-6 h-6 text-gray-400" />
      </button>
      <h1 className="text-lg font-semibold flex-1 truncate">{device.name ?? 'Device'}</h1>
      <Share2 className="w-5 h-5 text-gray-400" />
    </div>
  );

  const credentialsCards = (
    <div className="flex space-x-4">
      {/* pubk card */}
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-800 w-3/4">
        <div className="text-sm text-gray-400 mb-2">Current PUBK Value</div>
        {pubkCharacteristic ? (
          <div className="min-h-8 flex items-center">
            <div className="font-mono text-sm overflow-hidden overflow-ellipsis w-5/6 whitespace-nowrap">
              {getDisplayValue(pubkCharacteristic)}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(String(getDisplayValue(pubkCharacteristic)));
                toast.success('Value copied');
              }}
              className="ml-1 p-1 text-gray-400 hover:text-blue-500"
            >
              <Clipboard size={16} />
            </button>
          </div>
        ) : (
          <div className="w-full flex justify-center py-2 animate-pulse text-sm text-gray-500">
            Loading ...
          </div>
        )}
      </div>

      {/* rcrd days card */}
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-800 w-1/4 flex flex-col">
        <div className="text-sm text-gray-400 mb-2 text-center">Days</div>
        <div className="flex items-center justify-center min-h-8">
          {rcrdCharacteristic ? (
            <span className="text-xl font-medium">{getDisplayValue(rcrdCharacteristic)}</span>
          ) : (
            <div className="w-full flex justify-center py-2 animate-pulse text-sm text-gray-500">
              Loading ...
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const inputDisplay = (
    <div className="border border-gray-700 rounded-lg p-3 bg-gray-800">
      <p className="text-sm text-gray-400 mb-1">Input Code:</p>
      <p
        className="font-mono h-8 mt-1 truncate p-1 bg-gray-900 rounded flex items-center"
        style={{
          fontSize:
            inputCode.length > 20 ? '0.75rem' : inputCode.length > 15 ? '0.875rem' : '1rem',
        }}
      >
        {inputCode ? formatInputCode(inputCode) : <span className="text-gray-500 italic">(*...#)</span>}
      </p>
    </div>
  );

  const keypadGrid = (
    <>
      <div className="grid grid-cols-3 gap-2">
        {keypad.map((row, i) =>
          row.map((key) => (
            <button
              key={`${i}-${key}`}
              className="bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold rounded-lg py-3"
              onClick={() => handleNumpadClick(key)}
            >
              {key}
            </button>
          ))
        )}
      </div>
      <div className="flex space-x-4 mt-2">
        <div
          className="h-14 flex-1 flex items-center justify-center rounded bg-gray-600 text-white text-xl cursor-pointer active:bg-gray-500"
          onClick={clearInput}
        >
          ←
        </div>
        <div
          className={`h-14 flex-1 flex items-center justify-center rounded ${isLoadingService ? 'bg-gray-500' : 'bg-blue-600 active:bg-blue-500'} text-white text-xl cursor-pointer`}
          onClick={submitInput}
        >
          OK
        </div>
      </div>
    </>
  );

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-[#171923] to-[#0C0C0E] min-h-screen text-white">
      <Toaster />

      {/* ---------- header ---------- */}
      {header}

      {/* ---------- modals ---------- */}
      <AsciiStringModal
        isOpen={asciiModalOpen}
        onClose={() => setAsciiModalOpen(false)}
        onSubmit={handleWrite}
        title={activeCharacteristic?.name || 'Public Key / Last Code'}
      />
      <NumericModal
        isOpen={numericModalOpen}
        onClose={() => setNumericModalOpen(false)}
        onSubmit={handleWrite}
        title={activeCharacteristic?.name || 'Write'}
      />

      {/* ---------- main content ---------- */}
      <div className="p-4 space-y-6">
        {credentialsCards}
        {inputDisplay}
        {keypadGrid}
      </div>
    </div>
  );
};

export default DeviceDetailView;
