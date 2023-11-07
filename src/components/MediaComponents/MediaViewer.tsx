/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */
import React, { useEffect, useState, useRef } from 'react';
import { Auth, Storage } from 'aws-amplify';
import { S3ProviderListOutput } from '@aws-amplify/storage';
import { Link } from 'react-router-dom';
import VideoPlayer from './VideoPlayer'
import CreateS3Folder from './CreateS3Folder';
import { StorageAccessLevel } from './types';
import DeleteFolder from './DeleteFolder';
import './MediaViewer.css';


interface Option {
  value: string;
  label: string;
}

const levelOptions: Option[] = [
  { value: 'private', label: 'Private' },
  { value: 'protected', label: 'Protected' },
  { value: 'public', label: 'Public' },
];


const PAGE_SIZE = 10;

interface MediaProps {
  tenantId: string;
  user: any;
  isTenantAdmin: any
}

interface Folder {
  name: string;
  key: string;
}

const MediaViewer: React.FC<MediaProps> = ({ user, tenantId, isTenantAdmin }) => {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [level, setLevel] = useState<StorageAccessLevel>('public');
  const [folderNames, setFolderNames] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);


  useEffect(() => {  
    async function fetchImages() {
      let imageList: S3ProviderListOutput | null = await Storage.list(selectedFolder, {
        level,
        pageSize: PAGE_SIZE,

      });


      let urls: string[] = [];
      while (imageList && imageList.results.length > 0) {
        const currentUrls = await Promise.all(
          imageList.results
            .filter(item => item.size! > 0) 
            .map(async (item) => {
              const url = await Storage.get(item.key!, { level });
              return url;
            })
        );
        urls = urls.concat(currentUrls);

        if (imageList.hasNextToken) {
          imageList = await Storage.list(selectedFolder, { nextToken: imageList.nextToken });
        } else {
          imageList = null;
        }
      }
      setImageUrls(urls);
    }

    fetchImages();
  }, [level, selectedFolder]);


  useEffect(() => {
    fetchFolderNames();
    //console.log(isTenantAdmin)
  }, [level]);

  const fetchFolderNames = async () => {
    try {
      const listResult = await Storage.list('', { level });
      const folders = listResult.results.filter((item) => item.key!.endsWith('/') && !item.key!.endsWith('//'));
      const folderList = folders.map((folder) => ({
        name: folder.key!.split('/').filter(Boolean).pop() || '',
        key: folder.key,
      }));
      setFolderNames(folderList as Folder[]);
      if (folderList.length > 0) {
        setSelectedFolder(folderList[0].name);
      }
   // console.log("delete folders function: ", folderList)
    } catch (error) {
      console.log('Error fetching folder names: ', error);
    }
  };
  

   // Handle link click
   const handleLinkClick = (name: string) => {
    setSelectedFolder(name);
  };


 const handleFolderDelete = async (folder: string) => {
    try {
    const results =  await Storage.remove(`${folder}/`, { level });
      const updatedFolders = folderNames.filter((f) => f.key !== folder);
      setFolderNames(updatedFolders);

      // If the deleted folder was selected, clear the selectedFolder state
      if (selectedFolder && selectedFolder === folder) {
        fetchFolderNames();
      }
    } catch (error) {
      console.log('Error deleting folder: ', error);
    }
  };

  const handleFolderSelect = (folder: Folder) => {
    setSelectedFolder(folder.name);
  };


     const renderLinks = () => {
      return (
        <div style={{ display: 'flex' }}>
          {folderNames.map((folderNameItem) => (
            <a
              key={folderNameItem.key}
              href="#"
              onClick={() => handleLinkClick(folderNameItem.name)}
              style={{ marginRight: '10px' }}
            >
              {folderNameItem.name}
            </a>
          ))}
        </div>
      );
    }; 
  
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const fileURL = URL.createObjectURL(selectedFile);
      if (isVideoFile(selectedFile)) {
        setVideoUrl(fileURL);
        setImageUrl(null); 
      } else {
        resizeImage(selectedFile, 800, 800, (resizedImage) => {
          setImageUrl(URL.createObjectURL(resizedImage));
          setVideoUrl(null); 
        });
      }
    }
  };
  


  const handleClick = () => {
    fileInputRef.current!.click();
  };

  const resizeImage = (file: File, maxWidth: number, maxHeight: number, callback: (resizedImage: File) => void) => {
    const image = new Image();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    image.onload = function () {
      let width = image.width;
      let height = image.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (context) {
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(function (blob) {
          if (blob) {
            const resizedFile = new File([blob], file.name, { type: file.type });
            callback(resizedFile);
          }
        }, file.type);
      }
    };

    image.src = URL.createObjectURL(file);
  };


  async function fetchIdenId() {
    const user = await Auth.currentUserCredentials()
    return user.identityId
  }

 
  const handleDelete = async (url: string, index?: number) => {
    const IdWRegion = await fetchIdenId();
    const id = IdWRegion.split(':');
    let prefix = (level === 'private' || level === 'protected') ? `${id[1]}/` : `${level}/`;
  
    const questionMarkIndex = url.indexOf('?');
    const searchKey = prefix;
  
    if (url.includes(searchKey) && questionMarkIndex !== -1) {
      const start = url.indexOf(searchKey) + searchKey.length;
      const end = questionMarkIndex;
      const result = url.slice(start, end).trim();
  
      try {
        const key = decodeURIComponent(result); 
        await Storage.remove(key, { level });
        const urls = [...imageUrls];

        if(index !== undefined || index === 0){
          if(index === 0){
            const newUrls: string[] = [];
            setImageUrls(newUrls);
          }else {
            const newUrls = urls.splice(index,1);
            setImageUrls(newUrls);
          }
        }
      } catch (error) {
        console.error('Error deleting file: ', error);
      }
    }
  };

  const handleLevelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setLevel(event.target.value as StorageAccessLevel);
  };


  const clearPreview = () => {
    setFile(null);
    setImageUrl(null);
    setVideoUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

      

  const handleFileUpload = async () => {
    if (file) {
      try {
        clearPreview();
        const extension = file.name.split('.').pop();
        const contentType = getContentTypeFromExtension(extension);

        if (contentType === null) {
          throw new Error('Unsupported file type');
        }

        const storedFile = await Storage.put(selectedFolder + file.name, file, {
          level,
          contentType,
          metadata: { tenantId: tenantId },
          tagging: `tenantId=${tenantId}&sub=${user.attributes!['sub']}&costcenter=${tenantId}`,
        });

        let newUrl = await Storage.get(storedFile.key, { level });
        setImageUrls(imageUrls.concat(newUrl));
        setFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }


      } catch (error) {
        console.error('Error uploading file: ', error);
      }
    }
  };



  const getFileExtension = (fileUrl: string) => {
    let extension = '';

    if (fileUrl.startsWith(`https://${process.env.REACT_APP_storageBucketName}.s3.${process.env.REACT_APP_stackRegion}.amazonaws.com`)) {
      // File is on S3
      const questionMarkIndex = fileUrl.indexOf('?');
      const dotIndex = fileUrl.lastIndexOf('.', questionMarkIndex);

      if (dotIndex !== -1) {
        extension = fileUrl.slice(dotIndex + 1, questionMarkIndex).toLowerCase();
      }
    } else {
      // File is on local disk
      console.log("file is on disk: ", fileUrl )
      const dotIndex = fileUrl.lastIndexOf('.');

      if (dotIndex !== -1) {
        extension = fileUrl.slice(dotIndex + 1).toLowerCase();
      }
    }

    return extension;
  };



  const getContentTypeFromExtension = (extension: string | undefined) => {
    switch (extension?.toLocaleLowerCase()) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'mp4':
        return 'video/mp4';
      // Add more file extensions and their corresponding content types as needed
      default:
        return null; 
    }
  };

  const isVideoFile = (fileUrl: any) => {
    if (typeof fileUrl !== "string") {
      const extension = fileUrl.name.split('.').pop()?.toLowerCase();
      const contentType = getContentTypeFromExtension(extension);
      return contentType && contentType.startsWith('video/');
    }
    const extension = getFileExtension(fileUrl);
    const contentType = getContentTypeFromExtension(extension);
    return contentType && contentType.startsWith('video/');
  };

 // const s3prefix = `${level}/${selectedFolder}`;

  return (
    <div id="MediaViewer-container">
      <h1>{tenantId} Media</h1>
     
        <Link to="/home">Return Home</Link>
  
        <div className="outer-container-header">
              <h4 className="header">Manage Folders</h4>

              <div id='manage-folder-container'>
                <div id="select-container">
                  <label htmlFor="levelSelect">Select Share level:</label>
                  <select id="levelSelect" onChange={handleLevelChange} value={level}>
                    {levelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {isTenantAdmin && 
                  <div id="align-folder-buttons">
                    <CreateS3Folder level={level} fetchFolderNames={fetchFolderNames}/>
                    <DeleteFolder folders={folderNames} selectedFolder={selectedFolder} onFolderDelete={handleFolderDelete} onFolderSelect={handleFolderSelect} />
                  </div>
                }
              </div>
        </div>


  
    <div id="folder-list"> 
          <br/>
      {renderLinks()}
      <p>Selected Folder: <b>{selectedFolder} </b></p>
    </div>



      <div className="outer-container-header">
            <h4 className="header">Add New Content</h4>
            <div id='add-new-content-container'>
            <div className="upload-container">
              <div>
                  {imageUrl || videoUrl ? (
                        <div className="center-button-container">
                        <button onClick={clearPreview}>Clear Preview</button>
                      </div>
                    ) : null 
                    }

                    <div className="preview-container">
                      {imageUrl && !videoUrl && (
                        <img src={imageUrl} width="200" height="200" alt="Selected Image" />
                      )}
                      {videoUrl && !imageUrl && (
                        <VideoPlayer fileKey={videoUrl} fileType={file?.type || ''} />
                      )}
                    </div>

                <div>

                      <input
                        type="file"
                        id="fileInput"
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                      />

                      {imageUrl || videoUrl ?  null : (
                      <label htmlFor="fileInput">
                        <button type="button"   onClick={handleClick}  >
                          Select Photo/Video to Upload
                        </button>
                      </label>
                      )} 

                </div>

                {imageUrl || videoUrl ? (
                <div className="center-button-container">
                  <button onClick={handleFileUpload}>Upload Media</button>
                </div>
                  ) : null}
              </div>
            </div>
          </div>
      </div>


      <div className="image-grid">
        {imageUrls.map((url, index) => (
          
          <div key={index} className="media-container">
            {/* {console.log("imageUrls", url)!} */}
            {url !== null && isVideoFile(url) ? (
              <VideoPlayer fileKey={url} fileType={getContentTypeFromExtension(url)!} />
            ) : (
              <img src={url} alt={`Image ${index}`} width="200" height="200" className="image" />
            )}
            <button className="delete-button" onClick={() => handleDelete(url, index)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaViewer;