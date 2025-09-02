import React from 'react';
import { useToast } from './Toast';

interface FileSelectorProps {
  saveFilePath: string;
  onFileSelected: (path: string) => void;
}

const FileSelector: React.FC<FileSelectorProps> = ({ saveFilePath, onFileSelected }) => {
  const toast = useToast();
  const handleSelectFile = async () => {
    try {
      const path = await window.electronAPI.selectSaveFile();
      if (path) {
        onFileSelected(path);
      }
    } catch (error) {
      console.error('Failed to select save file:', error);
      toast('Failed to select save file', { kind: 'error' });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Save File</h2>
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Selected file:</p>
          <p className="font-mono text-sm bg-gray-50 dark:bg-gray-700 p-3 rounded-md border border-gray-200 dark:border-gray-600">
            {saveFilePath || 'No save file selected'}
          </p>
        </div>
        <button onClick={handleSelectFile} className="btn btn-primary">
          Select File
        </button>
      </div>
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Choose your Lockdown Protocol save file (Save_BanList.sav) to manage bans.
      </p>
    </div>
  );
};

export default FileSelector;
