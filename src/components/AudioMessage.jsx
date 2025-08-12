import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';

const AudioMessage = ({ 
    audioUrl, 
    isUser = false, 
    profileImage = null, 
    duration = null, 
    onPlay, 
    onPause, 
    isLoading = false,
    className = "" 
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(duration || 0);
    const audioRef = useRef(null);
    const progressRef = useRef(null);

    const handlePlayPause = () => {
        if (isLoading || !audioUrl) return;

        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
            onPause?.();
        } else {
            // Verifica se o áudio está carregado
            if (audioRef.current && audioRef.current.readyState >= 2) {
                audioRef.current.play().catch(error => {
                    console.error('Erro ao reproduzir áudio:', error);
                    setIsPlaying(false);
                });
                setIsPlaying(true);
                onPlay?.();
            } else {
                console.log('Áudio ainda não carregou completamente');
                // Tenta carregar o áudio primeiro
                audioRef.current?.load();
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current && isFinite(audioRef.current.duration)) {
            setAudioDuration(audioRef.current.duration);
            console.log('Duração do áudio carregada:', audioRef.current.duration);
        } else {
            setAudioDuration(0);
            console.log('Duração do áudio não pôde ser determinada');
        }
    };

    const handleCanPlay = () => {
        console.log('Áudio pronto para reprodução');
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onPause?.();
    };

    const handleError = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        setAudioDuration(0);
        onPause?.();
    };

    const formatTime = (time) => {
        if (!time || isNaN(time) || !isFinite(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const progressPercentage = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

    return (
        <div className={`flex items-center space-x-3 p-3 rounded-xl shadow-md audio-message ${
            isUser 
                ? 'bg-[#DCF8C6] text-gray-800 rounded-br-none' 
                : 'bg-white text-gray-800 rounded-bl-none'
        } ${isPlaying ? 'audio-playing' : ''} ${className}`}>
            
            {/* Foto do perfil (apenas para mensagens da IA) */}
            {!isUser && profileImage && (
                <div className="flex-shrink-0">
                    <img
                        src={profileImage}
                        alt="Perfil"
                        className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                </div>
            )}

            {/* Botão de play/pause */}
            <button
                onClick={handlePlayPause}
                disabled={isLoading}
                className={`flex-shrink-0 p-2.5 rounded-full transition-all duration-200 shadow-sm audio-play-button ${
                    isLoading 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : isUser
                            ? 'bg-[#075E54] hover:bg-[#128C7E] text-white'
                            : 'bg-[#075E54] hover:bg-[#128C7E] text-white'
                }`}
                aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
            >
                {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                ) : isPlaying ? (
                    <Pause size={18} />
                ) : (
                    <Play size={18} className="ml-0.5" />
                )}
            </button>

            {/* Barra de progresso e informações */}
            <div className="flex-1 min-w-0">
                {/* Barra de progresso */}
                <div className="relative h-1.5 bg-gray-300 rounded-full mb-2 overflow-hidden">
                    <div
                        ref={progressRef}
                        className="absolute top-0 left-0 h-full audio-progress-bar rounded-full transition-all duration-200 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>

                {/* Tempo e duração */}
                <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(audioDuration)}</span>
                </div>
            </div>

            {/* Elemento de áudio oculto */}
            <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                onEnded={handleEnded}
                onError={handleError}
                preload="metadata"
            />
        </div>
    );
};

export default AudioMessage;
