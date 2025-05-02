'use client'

import React, { useEffect, useReducer, useState } from 'react';
import { Image, Users, Fingerprint, FileSearch, Phone, MessageSquare, Signal } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

interface Contact {
  name: string;
  phoneNumber: string;
}

interface SettingsViewProps {
  onChooseImage: () => void;
  onReadContacts: () => void;
  onFingerprintVerification: () => void;
  onTextRecognition: () => void;
  onCallPhone: (phoneNumber: string) => void;
  onSendSms: (phoneNumber: string, message: string) => void;
  selectedImage: string | null;
  setSelectedImage: (image: string | null) => void;
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  onNetworkType: () => void; networkType: string | null; 
  setNetworkType: (networkType: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  onChooseImage,
  onReadContacts,
  onFingerprintVerification,
  onTextRecognition,
  onCallPhone,
  onSendSms,
  selectedImage,
  setSelectedImage,
  contacts,
  setContacts,
  onNetworkType,
  networkType,
  setNetworkType, 
}) => {
  

  useEffect(() => {
    console.info(`SettingsView received image: ${selectedImage ? 'Yes, length ' + selectedImage.length : 'No'}`);
  }, [selectedImage]);
 

useEffect(() => {
  if ( contacts.length > 0) {
    console.log(`Contacts loaded: ${contacts.length}`);
    // Force component to re-render
    const timer = setTimeout(() => {
      forceUpdate();
    }, 0);
    return () => clearTimeout(timer);
  }
}, [contacts]);

// Add this at the top of your component
const [, forceUpdate] = useReducer(x => x + 1, 0);
  
  const handleSaveImage = () => {
    if (!selectedImage) return;
    console.log('Saving image:', selectedImage);
    setSelectedImage(null);
    toast.success("Image saved successfully", { duration: 3000 });
  };

  const handleReadContactsClick = () => {
    toast.loading("Fetching contacts...", { id: 'contacts-loading' });
    onReadContacts();
  };

  const handleCallPhone = (phoneNumber: string) => {
    if (!phoneNumber) {
      toast.error("No phone number available");
      return;
    }
    // toast(`Calling: ${phoneNumber}`, { duration: 3000 });
    onCallPhone(phoneNumber);
  };

  const handleSendSms = (phoneNumber: string) => {
    if (!phoneNumber) {
      toast.error("No phone number available");
      return;
    }
    // toast(`Opening SMS for: ${phoneNumber}`, { duration: 3000 });
    onSendSms(phoneNumber, "");
  };
  const handleNetworkType = () => {
    toast.loading("Checking network type...", { id: 'network-loading' });
    onNetworkType();
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 bg-gradient-to-b from-[#24272C] to-[#0C0C0E] min-h-screen">
      <Toaster />
      {/* Network Type */}
      <div
        className="flex items-center p-4 bg-[#2A2F33] rounded-lg hover:bg-[#34393E] transition-colors duration-200 cursor-pointer"
        onClick={handleNetworkType}
      >
        <div className="w-8 h-8 flex items-center justify-center mr-3 text-gray-400">
          <Signal size={20} />
        </div>
        <div className="text-white text-lg font-medium">Check Network Type</div>
      </div>
      {networkType && (
        <div className="mt-2 p-4 bg-[#2A2F33] rounded-lg">
          <p className="text-white">
            Network Type: <span className="font-medium capitalize">{networkType}</span>
          </p>
          <button
            onClick={() => {
              setNetworkType("");
            //   toast.success("Network cleared");
            }}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear
          </button>
        </div>
      )}
      <div className="space-y-4 mt-2">
        {/* Image Selection */}
        <div
          className="flex items-center p-4 bg-[#2A2F33] rounded-lg hover:bg-[#34393E] transition-colors duration-200 cursor-pointer"
          onClick={onChooseImage}
        >
          <div className="w-8 h-8 flex items-center justify-center mr-3 text-gray-400">
            <Image size={20} />
          </div>
          <div className="text-white text-lg font-medium">Select Image</div>
        </div>

        {selectedImage ? (
          <div className="mb-4">
            <div className="p-4 bg-[#2A2F33] rounded-lg">
              <img
                src={selectedImage}
                alt="Selected Preview"
                className="w-full h-auto max-h-64 object-contain rounded-md"
                onError={(e) => {
                  toast.error(`Failed to render image: ${e.nativeEvent.type}`, { duration: 4000 });
                  setSelectedImage(null);
                }}
                onLoad={() => toast.success("Image preview loaded", { duration: 2000 })}
              />
              <div className="flex justify-between mt-2">
                <button
                  onClick={handleSaveImage}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save Image
                </button>
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    toast.error("Image selection cancelled", { duration: 4000 });
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 text-gray-400 text-center">No image selected</div>
        )}

        {/* Contacts */}
        <div
          className="flex items-center p-4 bg-[#2A2F33] rounded-lg hover:bg-[#34393E] transition-colors duration-200 cursor-pointer"
          onClick={handleReadContactsClick}
        >
          <div className="w-8 h-8 flex items-center justify-center mr-3 text-gray-400">
            <Users size={20} />
          </div>
          <div className="text-white text-lg font-medium">Read Contacts</div>
        </div>

        { contacts.length > 0 ? (
          <div className="bg-[#2A2F33] rounded-lg p-4">
            <h3 className="text-white text-lg font-medium mb-2">Contacts ({contacts.length})</h3>
            <div className="max-h-64 overflow-y-auto border border-gray-700">
              {contacts.map((contact, index) => (
                <div key={index} className="border-b border-gray-700 py-2 px-2 flex justify-between items-center">
                  <div>
                    <p className="text-white">{contact.name || 'Unknown'}</p>
                    <p className="text-gray-400 text-sm">{contact.phoneNumber || 'No number'}</p>
                  </div>
                  {contact.phoneNumber && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleCallPhone(contact.phoneNumber)}
                        className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        title="Call contact"
                      >
                        <Phone size={16} />
                      </button>
                      <button
                        onClick={() => handleSendSms(contact.phoneNumber)}
                        className="p-2 bg-green-500 text-white rounded hover:bg-green-600"
                        title="Send SMS"
                      >
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setContacts([]);
                // toast.success("Contacts cleared");
              }}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear Contacts
            </button>
          </div>
        ) : (
          <div className="text-gray-400 text-center">No contacts loaded</div>
        )}

        {/* Fingerprint */}
        <div
          className="flex items-center p-4 bg-[#2A2F33] rounded-lg hover:bg-[#34393E] transition-colors duration-200 cursor-pointer"
          onClick={onFingerprintVerification}
        >
          <div className="w-8 h-8 flex items-center justify-center mr-3 text-gray-400">
            <Fingerprint size={20} />
          </div>
          <div className="text-white text-lg font-medium">Verify Fingerprint</div>
        </div>

        {/* Text Recognition */}
        <div
          className="flex items-center p-4 bg-[#2A2F33] rounded-lg hover:bg-[#34393E] transition-colors duration-200 cursor-pointer"
          onClick={onTextRecognition}
        >
          <div className="w-8 h-8 flex items-center justify-center mr-3 text-gray-400">
            <FileSearch size={20} />
          </div>
          <div className="text-white text-lg font-medium">Text Recognition (OCR)</div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;