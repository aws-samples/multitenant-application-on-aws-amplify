/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */
import React, { useState, useEffect } from 'react';
import { Storage } from 'aws-amplify';
import { StorageAccessLevel } from './types';

interface CreateS3FolderProps {
  level: StorageAccessLevel;
  fetchFolderNames: any
}
const CreateS3Folder: React.FC<CreateS3FolderProps> = ({ level, fetchFolderNames }) => {
  const [showInput, setShowInput] = useState(false);
  const [folderName, setFolderName] = useState('');

  useEffect(() => {
    setFolderName('');
    setShowInput(false);
  }, [level]);

  const handleCreateFolderClick = () => {
    setShowInput(true);
  };

  const handleFolderNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFolderName(event.target.value);
  };



  const handleCreateClick = async () => {
    try {
      if (!folderName) {
        console.log('Please enter a folder name.');
        return;
      }

      const folderKey = `${folderName}/`; // Specify the folder key/name
      await Storage.put(folderKey, '', {
        contentType: 'application/octet-stream',
        level: level,
      });
      console.log('Folder created successfully.');
      fetchFolderNames(); 
      setFolderName('');
      setShowInput(false);
    } catch (error) {
      console.log('Error creating folder: ', error);
    }
  };

  const handleCancelClick = () => {
    setShowInput(false);
    setFolderName('');
  };

  return (
    <div>
      {!showInput && (
        <button onClick={handleCreateFolderClick}>Create New Folder</button>
      )}
      {showInput && (
        <div>
          <input type="text" value={folderName} onChange={handleFolderNameChange} placeholder="Enter folder name" />
          <button onClick={handleCreateClick}>Create</button>
          <button onClick={handleCancelClick}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default CreateS3Folder;