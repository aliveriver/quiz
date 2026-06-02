import { useEffect, useRef, useState } from 'react';

const AUDIO_MIME_TYPE = 'audio/mpeg';

/**
 * Plays audio chunks as a FIFO queue.
 *
 * The backend sends MiniMax TTS audio through SSE as Uint8Array chunks. Creating
 * one ever-growing Blob causes playback to restart/rebuild as the stream grows,
 * so this hook only enqueues chunks that have not been seen yet and starts the
 * next Audio element as soon as the previous one finishes.
 *
 * @param {Uint8Array[]} audioChunks
 * @returns {{ isPlaying: boolean, hasAudio: boolean }}
 */
export function useStreamingAudio(audioChunks) {
  const audioRef = useRef(null);
  const queueRef = useRef([]);
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

    const chunk = queueRef.current.shift();
    if (!chunk) {
      setIsPlaying(false);
      return;
    }

    cleanupCurrentAudio();

    const blob = new Blob([chunk], { type: AUDIO_MIME_TYPE });
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
      nextChunkIndexRef.current = 0;
      setHasAudio(false);
      return;
    }

    setHasAudio(true);

    const nextChunks = audioChunks.slice(nextChunkIndexRef.current);
    if (nextChunks.length === 0) return;

    queueRef.current.push(...nextChunks);
    nextChunkIndexRef.current = audioChunks.length;
    playNext();
  }, [audioChunks]);

  useEffect(() => {
    cancelledRef.current = false;

    return () => {
      cancelledRef.current = true;
      queueRef.current = [];
      playingRef.current = false;
      cleanupCurrentAudio();
    };
  }, []);

  return { isPlaying, hasAudio };
}
