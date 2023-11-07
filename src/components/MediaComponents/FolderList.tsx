/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */
import React from 'react';

interface Folder {
  name: string;
  key: string;
}

interface FolderListProps {
  folders: Folder[];
  selectedFolder: string | null;
}

const FolderList: React.FC<FolderListProps> = ({ folders, selectedFolder }) => {
  return (
    <div>
      <h2>Folder List</h2>
      <ul>
        {folders.map((folder) => (
          <li key={folder.key} className={selectedFolder === folder.key ? 'selected' : ''}>
            {folder.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FolderList;