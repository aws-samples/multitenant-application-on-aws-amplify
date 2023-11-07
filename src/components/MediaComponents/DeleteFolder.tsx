/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */
import React from 'react';

interface Folder {
  name: string;
  key: string;
}

interface FolderSelectorProps {
  folders: Folder[];
  selectedFolder: string | null;
  onFolderDelete: (folder: string) => void;
  onFolderSelect: (folder: Folder) => void;
}

const DeleteFolder: React.FC<FolderSelectorProps> = ({ selectedFolder, onFolderDelete, onFolderSelect }) => {

  return (
    <div>

      {selectedFolder && (
        <div>

          <button onClick={() => onFolderDelete(selectedFolder)}>Delete Selected Folder</button>
        </div>
      )}
    </div>
  );
};

export default DeleteFolder;