import { useEffect, useRef, useState } from 'react';

const AUDIO_MIME_TYPE = 'audio/mpeg';

/**
 * Plays finalized audio segments as a FIFO queue.
 *
 * The backend sends one MP3 as multiple Uint8Array chunks. Those chunks are not
 * individually playable MP3 files, so the hook buffers them until the backend
 * marks the segment as final, then plays one combined Blob.
 *
 * @param {(Uint8Array|{bytes: Uint8Array, isFinal: boolean})[]} audioChunks
 * @returns {{ isPlaying: boolean, hasAudio: boolean }}
 */
export function useStreamingAudio(audioChunks) {
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const pendingChunkPartsRef = useRef([]);
  const nextChunkIndexRef = useRef(0);
  const objectUrlRef = useRef(null);
  const playingRef = useRef(false);
  const cancelledRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  const cleanupCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const playNext = () => {
    if (cancelledRef.current || playingRef.current) return;

    const audioParts = queueRef.current.shift();
    if (!audioParts) {
      setIsPlaying(false);
      return;
    }

    cleanupCurrentAudio();

    const blob = new Blob(audioParts, { type: AUDIO_MIME_TYPE });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    objectUrlRef.current = url;
    audioRef.current = audio;
    audio.volume = 1;

    audio.onended = () => {
      playingRef.current = false;
      setIsPlaying(false);
      cleanupCurrentAudio();
      playNext();
    };

    audio.onerror = (event) => {
      console.error('[StreamAudio] playback error:', event);
      playingRef.current = false;
      setIsPlaying(false);
      cleanupCurrentAudio();
      playNext();
    };

    playingRef.current = true;
    setIsPlaying(true);

    audio.play().catch((error) => {
      console.warn('[StreamAudio] playback blocked:', error);
      playingRef.current = false;
      setIsPlaying(false);
      cleanupCurrentAudio();
    });
  };

  useEffect(() => {
    if (!audioChunks || audioChunks.length === 0) {
      queueRef.current = [];
      pendingChunkPartsRef.current = [];
      nextChunkIndexRef.current = 0;
      setHasAudio(false);
      return;
    }

    setHasAudio(true);

    const nextChunks = audioChunks.slice(nextChunkIndexRef.current);
    if (nextChunks.length === 0) return;

    for (const chunk of nextChunks) {
      const bytes = chunk?.bytes || chunk;
      const isFinal = Boolean(chunk?.isFinal);

      if (bytes && bytes.length > 0) {
        pendingChunkPartsRef.current.push(bytes);
      }

      if (isFinal && pendingChunkPartsRef.current.length > 0) {
        queueRef.current.push(pendingChunkPartsRef.current);
        pendingChunkPartsRef.current = [];
      }
    }

    nextChunkIndexRef.current = audioChunks.length;
    playNext();
  }, [audioChunks]);

  useEffect(() => {
    cancelledRef.current = false;

    return () => {
      cancelledRef.current = true;
      queueRef.current = [];
      pendingChunkPartsRef.current = [];
      playingRef.current = false;
      cleanupCurrentAudio();
    };
  }, []);

  return { isPlaying, hasAudio };
}
