// import React, { useState, useRef } from 'react';

import React, { useState, useRef } from 'react';
import { FaMicrophone, FaStop, FaVolumeUp } from 'react-icons/fa';
import './ChatRoom.css'; // Reuse card styles

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh-cn', label: 'Chinese (Simplified)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
];

const VoiceTranslator = ({ onSendMessage, isDarkMode }) => {
  const [recording, setRecording] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [audioSrc, setAudioSrc] = useState('');
  const [sourceLang, setSourceLang] = useState('hi');
  const [targetLang, setTargetLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    setTranslatedText('');
    setAudioSrc('');
    setError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current.onstop = handleStop;
      mediaRecorderRef.current.start();
      setRecording(true);
    } catch {
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'recording.wav');
    formData.append('source_lang', sourceLang);
    formData.append('target_lang', targetLang);

    try {
      const response = await fetch('http://127.0.0.1:8000/voice-translate', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Failed to translate voice');
      }
      const data = await response.json();
      setTranslatedText(data.translated_text);
      setAudioSrc(`data:audio/mp3;base64,${data.audio_base64}`);
      if (onSendMessage) {
        onSendMessage({
          content: data.translated_text,
          audio_base64: data.audio_base64,
          username: 'You',
          detected_language: targetLang,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      setError('Error translating voice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`chat-room-card${isDarkMode ? ' dark' : ''}`} style={{ maxWidth: 480, margin: '40px auto' }}>
      <div className="chat-header">
        <div style={{ fontWeight: 700, fontSize: '1.3em' }}>Voice Translator</div>
      </div>
      <div className="chat-controls" style={{ justifyContent: 'center', gap: 16 }}>
        <label className="lang-label">
          <span>From:</span>
          <select className="lang-select" value={sourceLang} onChange={e => setSourceLang(e.target.value)}>
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </label>
        <label className="lang-label">
          <span>To:</span>
          <select className="lang-select" value={targetLang} onChange={e => setTargetLang(e.target.value)}>
            {LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0 16px 0' }}>
        {!recording ? (
          <button
            className="mic-btn"
            style={{ fontSize: 28, width: 56, height: 56, borderRadius: '50%' }}
            onClick={startRecording}
            title="Start Recording"
            disabled={loading}
          >
            <FaMicrophone />
          </button>
        ) : (
          <button
            className="mic-btn recording"
            style={{ fontSize: 28, width: 56, height: 56, borderRadius: '50%' }}
            onClick={stopRecording}
            title="Stop Recording"
          >
            <FaStop />
          </button>
        )}
      </div>
      {loading && <div className="system-message"><span role="img" aria-label="loading">⏳</span> Translating...</div>}
      {error && <div className="system-message" style={{ color: 'red' }}>{error}</div>}
      {translatedText && (
        <div style={{ marginTop: 18, textAlign: 'center', animation: 'chat-bubble-in 0.3s cubic-bezier(.4,0,.2,1)' }}>
          <h3 style={{ marginBottom: 6 }}>Translated Text:</h3>
          <div className="chat-bubble" style={{ display: 'inline-block', fontSize: '1.1em', marginBottom: 8 }}>{translatedText}</div>
          {audioSrc && (
            <div style={{ marginTop: 10 }}>
              <audio controls src={audioSrc} style={{ width: '100%' }} />
              <div style={{ color: '#2563eb', marginTop: 4, fontSize: 18 }}><FaVolumeUp /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceTranslator;
