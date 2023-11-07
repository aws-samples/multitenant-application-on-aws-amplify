/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import React, { useRef, useEffect } from 'react';

interface VideoPlayerProps {
  fileKey: string;
  fileType: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ fileKey }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.src = fileKey;
    }
  }, [fileKey]);

  return <video ref={videoRef} controls width="200" height="200" />;
};

export default VideoPlayer;
