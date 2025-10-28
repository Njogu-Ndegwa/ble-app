'use client'

import React, { useState, useRef } from 'react';
import { Upload, Download, Edit3, Trash2, File, FileText, Plus, Archive } from 'lucide-react';
import { useI18n } from '@/i18n';

interface FileItem {
  id: number;
  name: string;
  size: number;
  type: string;
  file: File;
  uploadDate: string;
}

const FileUploadPage = () => {
  const { t } = useI18n();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [editingFile, setEditingFile] = useState<number | null>(null);
  const [newFileName, setNewFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileType: string, fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'pdf') return <FileText className="w-6 h-6 text-red-500" />;
    if (extension === 'hex16') return <Archive className="w-6 h-6 text-purple-500" />;
    if (extension === 'doc' || extension === 'docx') return <FileText className="w-6 h-6 text-blue-500" />;
    if (extension === 'txt') return <FileText className="w-6 h-6 text-gray-500" />;
    if (extension === 'xls' || extension === 'xlsx') return <FileText className="w-6 h-6 text-green-500" />;
    if (extension === 'ppt' || extension === 'pptx') return <FileText className="w-6 h-6 text-orange-500" />;
    return <File className="w-6 h-6 text-gray-600" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return t('0 Bytes');
    const k = 1024;
    const sizes = [t('Bytes'), t('KB'), t('MB'), t('GB')];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File select triggered', event.target.files);
    const selectedFiles = Array.from(event.target.files || []);
    
    if (selectedFiles.length === 0) {
      console.log('No files selected');
      return;
    }

    console.log('Selected files:', selectedFiles);
    setIsUploading(true);

    // Simulate upload process
    setTimeout(() => {
      const newFiles: FileItem[] = selectedFiles.map((file: File) => ({
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
        uploadDate: new Date().toLocaleDateString()
      }));

      setFiles((prevFiles: FileItem[]) => [...prevFiles, ...newFiles]);
      setIsUploading(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, 1000);
  };

  const handleDownload = (fileItem: FileItem) => {
    try {
      const url = URL.createObjectURL(fileItem.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileItem.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = (fileId: number) => {
    setFiles(files.filter((file: FileItem) => file.id !== fileId));
  };

  const startEdit = (fileItem: FileItem) => {
    setEditingFile(fileItem.id);
    const nameWithoutExtension = fileItem.name.includes('.') 
      ? fileItem.name.substring(0, fileItem.name.lastIndexOf('.')) 
      : fileItem.name;
    setNewFileName(nameWithoutExtension);
  };

  const saveEdit = (fileId: number) => {
    if (!newFileName.trim()) return;

    setFiles(files.map((file: FileItem) => {
      if (file.id === fileId) {
        const extension = file.name.includes('.') ? file.name.split('.').pop() : '';
        const newName = extension ? `${newFileName.trim()}.${extension}` : newFileName.trim();
        return { ...file, name: newName };
      }
      return file;
    }));

    setEditingFile(null);
    setNewFileName('');
  };

  const cancelEdit = () => {
    setEditingFile(null);
    setNewFileName('');
  };

  const triggerFileSelect = () => {
    console.log('Triggering file select...');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, fileId: number) => {
    if (e.key === 'Enter') {
      saveEdit(fileId);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('Upload Documents')}</h1>
          <p className="text-gray-600">{t('Browse and upload PDF, HEX16, and other document files')}</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <input
            type="file"
            id="document-upload"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            className="hidden"
            accept=".pdf,.hex16,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.csv,.json,.xml,.zip,.rar,.7z"
          />
          
          <div
            className="block border-2 border-dashed border-blue-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors active:bg-blue-100"
            onClick={triggerFileSelect}
          >
            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-blue-600 font-medium">{t('Uploading files...')}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Plus className="w-12 h-12 text-blue-500 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">{t('Choose documents to upload')}</p>
                <p className="text-gray-500 mb-2">{t('Tap here to browse your device')}</p>
                <p className="text-sm text-gray-400">{t('Supports: PDF, HEX16, DOC, TXT, XLS, and more')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Files List */}
        {files.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('Uploaded Files')} ({files.length})
            </h2>
            <div className="space-y-3">
              {files.map((fileItem: FileItem) => (
                <div
                  key={fileItem.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4 flex-1 min-w-0 mb-3 sm:mb-0">
                    {getFileIcon(fileItem.type, fileItem.name)}
                    <div className="flex-1 min-w-0">
                      {editingFile === fileItem.id ? (
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                          <input
                            type="text"
                            value={newFileName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFileName(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-base"
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyPress(e, fileItem.id)}
                            placeholder={t('Enter new filename')}
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => saveEdit(fileItem.id)}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 active:bg-green-700 transition-colors text-sm font-medium min-w-0 touch-manipulation"
                            >
                              {t('Save')}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 active:bg-gray-700 transition-colors text-sm font-medium min-w-0 touch-manipulation"
                            >
                              {t('Cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900 truncate text-sm sm:text-base">{fileItem.name}</p>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-500">
                            <span>{formatFileSize(fileItem.size)}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{t('Uploaded')}: {fileItem.uploadDate}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {editingFile !== fileItem.id && (
                    <div className="flex items-center space-x-2 sm:ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleDownload(fileItem)}
                        className="flex-1 sm:flex-none p-3 text-blue-600 hover:bg-blue-100 active:bg-blue-200 rounded-lg transition-colors touch-manipulation"
                        title={t('Download')}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => startEdit(fileItem)}
                        className="flex-1 sm:flex-none p-3 text-green-600 hover:bg-green-100 active:bg-green-200 rounded-lg transition-colors touch-manipulation"
                        title={t('Rename')}
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(fileItem.id)}
                        className="flex-1 sm:flex-none p-3 text-red-600 hover:bg-red-100 active:bg-red-200 rounded-lg transition-colors touch-manipulation"
                        title={t('Delete')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length === 0 && !isUploading && (
          <div className="text-center py-12">
            <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t('No documents uploaded yet')}</p>
            <p className="text-gray-400">{t('Upload some files to get started')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploadPage;