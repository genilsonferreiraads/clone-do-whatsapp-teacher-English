import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';

// Biblioteca para ícones
import { SendHorizonal, Volume2, Mic, Play, Loader2, Phone, Video, X, Lightbulb, MoreVertical, Settings, LogOut } from 'lucide-react';

// ====================================================================
// PASSO 1: Configurações do Firebase - Variáveis de Ambiente
// Configure estas variáveis no Netlify: Site settings > Environment variables
// ====================================================================
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validação das configurações do Firebase
const requiredFirebaseVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
];

const missingFirebaseVars = requiredFirebaseVars.filter(varName => !import.meta.env[varName]);
if (missingFirebaseVars.length > 0) {
    console.error('❌ Variáveis do Firebase não configuradas:', missingFirebaseVars);
    console.error('Configure no Netlify ou .env.local');
}

// ====================================================================
// PASSO 2: Chaves de API - Variáveis de Ambiente
// Configure estas variáveis no Netlify: Site settings > Environment variables
// ====================================================================
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
const googleTtsApiKey = import.meta.env.VITE_GOOGLE_TTS_API_KEY;

// Validação das variáveis de ambiente
if (!geminiApiKey) {
    console.error('❌ VITE_GEMINI_API_KEY não configurada. Configure no Netlify ou .env.local');
}
if (!googleTtsApiKey) {
    console.error('❌ VITE_GOOGLE_TTS_API_KEY não configurada. Configure no Netlify ou .env.local');
}

// Variáveis globais para o ambiente do Gemini (deixe como estão)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Helper function to convert PCM audio to WAV format
function pcmToWav(pcmData, sampleRate) {
    const buffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(buffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File length
    view.setUint32(4, 36 + pcmData.length * 2, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (1 = PCM)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, pcmData.length * 2, true);

    // Write the PCM data
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++, offset += 2) {
        view.setInt16(offset, pcmData[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}


// Helper function to decode base64 string to ArrayBuffer
function base64ToArrayBuffer(base64) {
    // Remove the data URI scheme if present
    const cleanBase64 = base64.split(',')[1] || base64;
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Main React component
const App = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [audioCache, setAudioCache] = useState(new Map());
    const [isRecording, setIsRecording] = useState(false);
    const messagesEndRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const [profileImageUrl, setProfileImageUrl] = useState('');
    const [isImageLoading, setIsImageLoading] = useState(true);
    // Novo estado para controlar o indicador de digitação da IA
    const [isAiTyping, setIsAiTyping] = useState(false);

    // Estado para controlar o áudio da IA em carregamento
    const [loadingAudioId, setLoadingAudioId] = useState(null);
    // Estado para controlar o áudio do usuário em carregamento
    const [loadingUserAudioId, setLoadingUserAudioId] = useState(null);
    
    // Novo estado para a modal de tradução de palavras
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [translatedWord, setTranslatedWord] = useState('');
    const [translation, setTranslation] = useState('');
    const [isWordTranslating, setIsWordTranslating] = useState(false);
    
    // Novo estado para o áudio no modal
    const [originalWordAudio, setOriginalWordAudio] = useState(null);
    const [translatedWordAudio, setTranslatedWordAudio] = useState(null);
    const [playingModalAudio, setPlayingModalAudio] = useState(null); // 'original' ou 'translated'
    const [newMessageIds, setNewMessageIds] = useState(new Set());
    
    // Estado para controlar áudio automático
    const [autoPlayAudio, setAutoPlayAudio] = useState(true);
    
    // Estado para controlar o menu de configurações
    const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
    
    // Estado para controlar a animação dos pontos
    const [typingDots, setTypingDots] = useState('');
    
    // Estado para controlar o modal do perfil
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isProfileModalClosing, setIsProfileModalClosing] = useState(false);
    
    // Estados para o sistema de login
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    
    // Efeito para gerar a imagem do professor
    useEffect(() => {
        const generateImage = async () => {
            setIsImageLoading(true);

            // Tenta carregar a imagem do cache do navegador (local storage)
            const cachedImage = localStorage.getItem('professorProfileImage');
            if (cachedImage) {
                setProfileImageUrl(cachedImage);
                setIsImageLoading(false);
                return;
            }

            try {
                const prompt = "A friendly, smiling male teacher, professional portrait, in a classroom background, realistic photography style.";
                const payload = { instances: [{ prompt: prompt }], parameters: { "sampleCount": 1} };
                // Usando a chave de API do Gemini para gerar a imagem
                const apiKey = geminiApiKey;
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
                    const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
                    setProfileImageUrl(imageUrl);
                    // Salva a nova imagem no cache
                    localStorage.setItem('professorProfileImage', imageUrl);
                } else {
                    console.error("Imagem gerada inválida.");
                    // Fallback para o placeholder em caso de falha
                    const fallbackUrl = "https://placehold.co/40x40/075E54/DCF8C6?text=🧑‍🏫";
                    setProfileImageUrl(fallbackUrl);
                    localStorage.setItem('professorProfileImage', fallbackUrl);
                }
            } catch (error) {
                console.error("Erro ao gerar imagem:", error);
                // Fallback para o placeholder em caso de erro
                const fallbackUrl = "https://placehold.co/40x40/075E54/DCF8C6?text=🧑‍🏫";
                setProfileImageUrl(fallbackUrl);
                localStorage.setItem('professorProfileImage', fallbackUrl);
            } finally {
                setIsImageLoading(false);
            }
        };

        generateImage();
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages]);

    // Limpar mensagens marcadas como novas após a animação
    useEffect(() => {
        if (newMessageIds.size > 0) {
            const timer = setTimeout(() => {
                setNewMessageIds(new Set());
            }, 1000); // Tempo suficiente para a animação completar
            
            return () => clearTimeout(timer);
        }
    }, [newMessageIds]);

    // Fechar menu de configurações quando clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isSettingsMenuOpen && !event.target.closest('.settings-menu')) {
                setIsSettingsMenuOpen(false);
            }
            if (isProfileModalOpen && !event.target.closest('.profile-modal')) {
                handleCloseProfileModal();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSettingsMenuOpen, isProfileModalOpen]);

    // Animação dos pontos de digitação
    useEffect(() => {
        if (isAiTyping) {
            const interval = setInterval(() => {
                setTypingDots(prev => {
                    if (prev === '...') return '';
                    if (prev === '') return '.';
                    if (prev === '.') return '..';
                    return '...';
                });
            }, 500);
            
            return () => clearInterval(interval);
        } else {
            setTypingDots('');
        }
    }, [isAiTyping]);

    useEffect(() => {
        console.log("Iniciando configuração do Firebase...");
        
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);
            console.log("Firebase inicializado com sucesso");

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                console.log("Estado de autenticação mudou:", user ? "Usuário logado" : "Sem usuário");
                if (user) {
                    // Usuário está logado
                    setUserId(user.uid);
                    setIsLoggedIn(true);
                    setIsAuthReady(true);
                    setIsLoginModalOpen(false);
                    console.log("Usuário logado:", user.email);
                } else {
                    // Usuário não está logado
                    setIsLoggedIn(false);
                    setIsAuthReady(true);
                    setIsLoginModalOpen(true);
                    console.log("Usuário não logado, mostrando modal de login");
                }
            });
            return () => unsubscribe();
        } catch (error) {
            console.error("Erro na inicialização do Firebase:", error);
            // Fallback: permitir uso local sem Firebase
            setUserId(crypto.randomUUID());
            setIsAuthReady(true);
            setIsLoggedIn(true); // Permite uso local
            console.log("Fallback: Firebase falhou, usando modo local");
        }
    }, []);

    /* COMENTADO TEMPORARIAMENTE - useEffect do Firestore
    useEffect(() => {
        if (db && userId) {
            console.log("UserID:", userId);
            try {
                const messagesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/messages`);
                const q = query(messagesCollectionRef, orderBy('timestamp'));

                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const fetchedMessages = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setMessages(fetchedMessages);
                }, (error) => {
                    console.error("Erro ao buscar mensagens do Firestore:", error);
                });
                return () => unsubscribe();
            } catch (error) {
                console.error("Erro ao configurar listener do Firestore:", error);
            }
        }
    }, [db, userId]);
    */
    
    // Função para gerar o áudio TTS usando Google Text-to-Speech com configuração HD
    const getTtsAudio = async (text, languageCode) => {
        try {
            // Mapeamento de idiomas para códigos do Google TTS
            const languageMap = {
                'en-US': 'en-US',
                'pt-BR': 'pt-BR',
                'inglês': 'en-US',
                'português': 'pt-BR',
                'Charon': 'en-US', // Voz HD em inglês
                'Zephyr': 'en-US', // Voz HD em inglês
                'Kore': 'pt-BR'    // Voz HD em português
            };

            // Determina o código do idioma
            const langCode = languageMap[languageCode] || 'en-US';
            
            // Configuração da voz baseada no idioma
            const voiceConfig = langCode === 'pt-BR' 
                ? { languageCode: 'pt-BR', name: 'pt-BR-Chirp3-HD-Achird' } // Voz HD em português
                : { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Algenib' }; // Voz HD em inglês

            const payload = {
                input: { text: text },
                voice: voiceConfig,
                audioConfig: {
                    audioEncoding: 'LINEAR16',
                    effectsProfileId: ['small-bluetooth-speaker-class-device'],
                    pitch: 0,
                    speakingRate: 1
                }
            };

            const apiKey = googleTtsApiKey;
            const apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.audioContent) {
                // Converte o áudio base64 para blob
                const audioData = atob(result.audioContent);
                const arrayBuffer = new ArrayBuffer(audioData.length);
                const view = new Uint8Array(arrayBuffer);
                for (let i = 0; i < audioData.length; i++) {
                    view[i] = audioData.charCodeAt(i);
                }
                
                // Para LINEAR16, precisamos converter para WAV para compatibilidade
                const wavBlob = pcmToWav(new Int16Array(arrayBuffer), 24000); // LINEAR16 geralmente usa 24kHz
                return URL.createObjectURL(wavBlob);
            } else {
                console.error("Resposta de áudio inválida da API do Google TTS:", result);
                return null;
            }
        } catch (error) {
            console.error("Erro ao gerar áudio com Google TTS:", error);
            return null;
        }
    };

    // Função para gerar e reproduzir o áudio da resposta da IA
    const handlePlayAudio = async (text, messageId) => {
        if (!text || loadingAudioId) return;

        setLoadingAudioId(messageId);

        if (audioCache.has(text)) {
            const audioUrl = audioCache.get(text);
            const audio = new Audio(audioUrl);
            audio.play();
            audio.onended = () => setLoadingAudioId(null);
            return;
        }
        
        try {
            const audioUrl = await getTtsAudio(text, "en-US");
            if (audioUrl) {
                setAudioCache(prevCache => new Map(prevCache).set(text, audioUrl));
                const audio = new Audio(audioUrl);
                audio.play();
                audio.onended = () => {
                    setLoadingAudioId(null);
                };
            }
        } catch (error) {
            console.error("Erro ao gerar ou reproduzir áudio:", error);
        } finally {
            setLoadingAudioId(null);
        }
    };
    
    // Função para reproduzir o áudio do usuário
    const handlePlayUserAudio = (audioUri, messageId) => {
        if (!audioUri || loadingUserAudioId) return;

        setLoadingUserAudioId(messageId);
        
        let audio;
        let objectUrl = null;

        try {
            const arrayBuffer = base64ToArrayBuffer(audioUri);
            const audioBlob = new Blob([arrayBuffer], { type: 'audio/webm' });
            objectUrl = URL.createObjectURL(audioBlob);
            
            audio = new Audio(objectUrl);
            audio.play();

            audio.onended = () => {
                setLoadingUserAudioId(null);
                URL.revokeObjectURL(objectUrl); // Revoga a URL para liberar memória
            };
            audio.onerror = (e) => {
                console.error("Erro na reprodução do áudio do usuário.", e);
                setLoadingUserAudioId(null);
                if (objectUrl) {
                     URL.revokeObjectURL(objectUrl);
                }
            };
        } catch (error) {
            console.error("Erro ao reproduzir o áudio do usuário:", error);
            setLoadingUserAudioId(null);
            if (objectUrl) {
                 URL.revokeObjectURL(objectUrl);
            }
        }
    };

    // Função para enviar a mensagem do usuário e obter a resposta da IA
    const sendMessage = async (messageContent, isAudio = false) => {
        if (!messageContent && !isAudio || loading) return; // Removido !db temporariamente

        setLoading(true);
        let userMessage, audioUri = null;

        if (isAudio) {
            userMessage = "O usuário enviou um áudio. Por favor, transcreva, traduza e responda.";
            audioUri = messageContent;
        } else {
            userMessage = messageContent;
            setInput('');
        }

        try {
            // TEMPORÁRIO: Criar mensagem local sem Firebase
            const userMessageObj = {
                id: Date.now().toString(),
                sender: 'user',
                text_raw: isAudio ? null : userMessage,
                audio_uri: audioUri,
                timestamp: new Date(),
            };
            

            
            // Adicionar mensagem do usuário localmente
            setMessages(prev => [...prev, userMessageObj]);
            
            // Marcar mensagem como nova para animação
            setNewMessageIds(prev => new Set([...prev, userMessageObj.id]));
            
            /* COMENTADO TEMPORARIAMENTE - Firebase
            const userDocRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/messages`), {
                sender: 'user',
                text_raw: isAudio ? null : userMessage,
                audio_uri: audioUri,
                timestamp: new Date(),
            });
            */

            // Ativa o indicador de digitação da IA
            setIsAiTyping(true);

            const chatPrompt = `
                Você é um professor de inglês nativo americano, amigável e objetivo.
                Você está em uma conversa com um aluno.

                Instruções IMPORTANTES:
                1. O usuário te enviou uma mensagem. Se for um áudio, transcreva-o.
                2. Responda em inglês, como se fosse um nativo. Seja natural e encorajador.
                3. Traduza sua resposta para o português.
                4. IMPORTANTE: Traduza a mensagem do usuário APENAS para o idioma oposto:
                   - Se a mensagem for em português, traduza APENAS para inglês (deixe user_translation_pt vazio)
                   - Se a mensagem for em inglês, traduza APENAS para português (deixe user_translation_en vazio)
                5. Se a mensagem do usuário for em inglês e tiver erros, corrija-a de forma resumida e objetiva, explicando o erro em português.
                6. O objetivo é ajudar o usuário a praticar inglês.
                7. Mantenha a conversa fluida e interessante.
                8. Após sua resposta principal, forneça 3 sugestões de frases curtas para continuar a conversa.

                Por favor, forneça a resposta em formato JSON com o seguinte esquema:
                {
                  "user_transcription": "a transcrição do áudio do usuário (se aplicável), ou a mensagem original se for texto",
                  "user_translation_en": "a tradução da mensagem do usuário para inglês (preencher APENAS se a mensagem original for em português)",
                  "user_translation_pt": "a tradução da mensagem do usuário para português (preencher APENAS se a mensagem original for em inglês)",
                  "ai_response_en": "sua resposta em inglês",
                  "ai_response_pt": "sua resposta em português",
                  "correction_pt": "sua correção resumida em português (se aplicável, caso a mensagem do usuário tenha erros em inglês)",
                  "suggestions": [
                    { "en": "Sugestão 1 em inglês", "pt": "Tradução 1 em português" },
                    { "en": "Sugestão 2 em inglês", "pt": "Tradução 2 em português" },
                    { "en": "Sugestão 3 em inglês", "pt": "Tradução 3 em português" }
                  ]
                }
            `;
            
            // CONSTRÓI O PAYLOAD MULTIMODAL
            const parts = [{ text: chatPrompt }];
            if (audioUri) {
                // A API precisa do áudio em Base64
                const base64Audio = audioUri.split(',')[1];
                parts.push({
                    inlineData: {
                        mimeType: 'audio/webm',
                        data: base64Audio
                    }
                });
            } else {
                parts.push({ text: `Mensagem do usuário: "${userMessage}"` });
            }

            const payload = {
                contents: [{ parts }],
                generationConfig: {
                    responseMimeType: "application/json",
                }
            };
            
            const apiKey = geminiApiKey; // Usa a chave da API do Gemini
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (jsonText) {
                const jsonResponse = JSON.parse(jsonText);
                
                console.log('Resposta da IA:', jsonResponse);
                console.log('Traduções do usuário:', {
                    en: jsonResponse.user_translation_en,
                    pt: jsonResponse.user_translation_pt
                });
                
                /* COMENTADO TEMPORARIAMENTE - Firebase
                const userUpdatePayload = {
                    text_raw: jsonResponse.user_transcription || userMessage,
                    text_en: jsonResponse.user_translation_en || null,
                    text_pt: jsonResponse.user_translation_pt || null,
                };
                await updateDoc(userDocRef, userUpdatePayload);
                
                await addDoc(collection(db, `artifacts/${appId}/users/${userId}/messages`), {
                    sender: 'ai',
                    text_en: jsonResponse.ai_response_en,
                    text_pt: jsonResponse.ai_response_pt,
                    correction_pt: jsonResponse.correction_pt || null,
                    suggestions: jsonResponse.suggestions || [],
                    timestamp: new Date(),
                });
                */
                
                // TEMPORÁRIO: Atualizar a mensagem do usuário com as traduções
                setMessages(prev => prev.map(msg => 
                    msg.id === userMessageObj.id 
                        ? {
                            ...msg,
                            text_raw: jsonResponse.user_transcription || userMessage,
                            text_en: jsonResponse.user_translation_en || null,
                            text_pt: jsonResponse.user_translation_pt || null,
                        }
                        : msg
                ));
                
                // TEMPORÁRIO: Criar mensagem da IA localmente
                const aiMessageObj = {
                    id: (Date.now() + 1).toString(),
                    sender: 'ai',
                    text_en: jsonResponse.ai_response_en,
                    text_pt: jsonResponse.ai_response_pt,
                    correction_pt: jsonResponse.correction_pt || null,
                    suggestions: jsonResponse.suggestions || null,
                    timestamp: new Date(),
                };
                
                setMessages(prev => [...prev, aiMessageObj]);
                
                // Marcar mensagem da IA como nova para animação
                setNewMessageIds(prev => new Set([...prev, aiMessageObj.id]));
                
                // Reproduzir áudio automaticamente se ativado
                if (autoPlayAudio) {
                    setTimeout(() => {
                        handlePlayAudio(jsonResponse.ai_response_en, aiMessageObj.id);
                    }, 500); // Pequeno delay para garantir que a mensagem foi renderizada
                }
            } else {
                throw new Error("Resposta da IA inválida");
            }
        } catch (error) {
            console.error("Erro ao enviar mensagem ou obter resposta da IA:", error);
            
            // TEMPORÁRIO: Criar mensagem de erro localmente
            const errorMessageObj = {
                id: (Date.now() + 2).toString(),
                sender: 'system',
                text_en: 'Error communicating with AI. Please try again.',
                text_pt: 'Erro ao se comunicar com a IA. Por favor, tente novamente.',
                timestamp: new Date(),
            };
            
            setMessages(prev => [...prev, errorMessageObj]);
            
            // Marcar mensagem de erro como nova para animação
            setNewMessageIds(prev => new Set([...prev, errorMessageObj.id]));
            
            /* COMENTADO TEMPORARIAMENTE - Firebase
            addDoc(collection(db, `artifacts/${appId}/users/${userId}/messages`), {
                sender: 'system',
                text_en: 'Error communicating with AI. Please try again.',
                text_pt: 'Erro ao se comunicar com a IA. Por favor, tente novamente.',
                timestamp: new Date(),
            });
            */
        } finally {
            // Desativa os indicadores de digitação
            setIsAiTyping(false);
            setLoading(false);
        }
    };
    
    // Função para traduzir uma única palavra e gerar áudio
    const translateWord = async (word, sourceLang) => {
        setIsWordTranslating(true);
        setTranslatedWord(word);
        setTranslation('Carregando...');
        
        try {
            // Passo 1: Obter a tradução do texto
            const prompt = `Traduza a palavra "${word}" de ${sourceLang} para ${sourceLang === 'português' ? 'inglês' : 'português'}. Apenas retorne a palavra traduzida, sem frases adicionais.`;

            const textPayload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "text/plain" }
            };
            
            const apiKey = geminiApiKey;
            const textApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            const textResponse = await fetch(textApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(textPayload)
            });

            const textResult = await textResponse.json();
            const translatedText = textResult?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (translatedText) {
                setTranslation(translatedText);
                
                // Passo 2: Gerar os áudios para a palavra original e a tradução
                const originalLangCode = sourceLang === 'português' ? 'pt-BR' : 'en-US';
                const translatedLangCode = sourceLang === 'português' ? 'en-US' : 'pt-BR';
                
                const [originalAudioUrl, translatedAudioUrl] = await Promise.all([
                    getTtsAudio(word, originalLangCode),
                    getTtsAudio(translatedText, translatedLangCode)
                ]);
                
                setOriginalWordAudio(originalAudioUrl);
                setTranslatedWordAudio(translatedAudioUrl);

            } else {
                setTranslation('Não foi possível traduzir.');
                setOriginalWordAudio(null);
                setTranslatedWordAudio(null);
            }

        } catch (error) {
            console.error("Erro ao traduzir a palavra:", error);
            setTranslation('Erro ao traduzir.');
            setOriginalWordAudio(null);
            setTranslatedWordAudio(null);
        } finally {
            setIsWordTranslating(false);
        }
    };
    
    // Handler para o clique na palavra
    const handleWordClick = (word, language) => {
        setIsModalOpen(true);
        // Limpa os estados de áudio ao abrir o modal
        setOriginalWordAudio(null);
        setTranslatedWordAudio(null);
        setPlayingModalAudio(null);
        translateWord(word, language);
    };
    
    // Handler para reproduzir áudio no modal
    const handlePlayModalAudio = (audioType) => {
        const audioUrl = audioType === 'original' ? originalWordAudio : translatedWordAudio;
        if (!audioUrl || playingModalAudio) return;
        
        setPlayingModalAudio(audioType);
        
        const audio = new Audio(audioUrl);
        audio.play();
        audio.onended = () => {
            setPlayingModalAudio(null);
        };
        audio.onerror = () => {
            setPlayingModalAudio(null);
        };
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setTranslatedWord('');
        setTranslation('');
        // Revoga os URLs de áudio para liberar memória
        if (originalWordAudio) URL.revokeObjectURL(originalWordAudio);
        if (translatedWordAudio) URL.revokeObjectURL(translatedWordAudio);
    };
    
    const handleOpenProfileModal = () => {
        setIsProfileModalOpen(true);
    };
    
    const handleCloseProfileModal = () => {
        setIsProfileModalClosing(true);
        setTimeout(() => {
            setIsProfileModalOpen(false);
            setIsProfileModalClosing(false);
        }, 300);
    };
    
    const handleSuggestionClick = (suggestionText) => {
        setInput(suggestionText);
    };
    
    // Função para fazer login
    const handleLogin = async (e) => {
        e.preventDefault();
        if (!loginEmail || !loginPassword) {
            setLoginError('Por favor, preencha todos os campos.');
            return;
        }
        
        setIsLoggingIn(true);
        setLoginError('');
        
        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            // O onAuthStateChanged vai lidar com o sucesso
        } catch (error) {
            console.error('Erro no login:', error);
            let errorMessage = 'Erro ao fazer login.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Usuário não encontrado.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Senha incorreta.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Muitas tentativas. Tente novamente mais tarde.';
                    break;
                default:
                    errorMessage = 'Erro ao fazer login. Verifique suas credenciais.';
            }
            
            setLoginError(errorMessage);
        } finally {
            setIsLoggingIn(false);
        }
    };
    
    const handleLogout = async () => {
        try {
            await auth.signOut();
            setLoginEmail('');
            setLoginPassword('');
            setLoginError('');
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
    };

    // FUNÇÕES PARA O RECONHECIMENTO DE VOZ E ENVIO DE ÁUDIO
    const startRecording = async () => {
        if (!navigator.mediaDevices || !window.MediaRecorder) {
            alert('Desculpe, a gravação de áudio não é suportada pelo seu navegador.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const audioURI = reader.result;
                    sendMessage(audioURI, true);
                };
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Erro ao iniciar a gravação de áudio:', error);
            alert('Não foi possível acessar o microfone. Verifique as permissões.');
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };
    
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        
        // Verifica se é um timestamp do Firestore ou uma Date normal
        let date;
        if (timestamp && timestamp.seconds) {
            // Formato do Firestore
            date = new Date(timestamp.seconds * 1000);
        } else if (timestamp instanceof Date) {
            // Date normal
            date = timestamp;
        } else {
            // String ou número
            date = new Date(timestamp);
        }
        
        // Verifica se a data é válida
        if (isNaN(date.getTime())) {
            return '';
        }
        
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    
    // Função para renderizar as palavras de um texto com a funcionalidade de clique
    const renderClickableText = (text, language) => {
        if (!text) return null;
        const words = text.split(/(\s+)/); // Divide o texto mantendo os espaços

        return words.map((word, index) => {
            const trimmedWord = word.trim();
            if (trimmedWord) {
                // Se a palavra não for apenas espaço em branco, torne-a clicável
                return (
                    <span 
                        key={index} 
                        className="cursor-pointer font-bold hover:underline" 
                        onClick={() => handleWordClick(trimmedWord, language)}
                    >
                        {word}
                    </span>
                );
            }
            return <span key={index}>{word}</span>; // Retorna espaços como texto normal
        });
    };

    return (
        <div className="h-screen h-[100dvh] bg-[#E5DDD5] font-[Inter] antialiased flex flex-col overflow-hidden chat-container">

            {/* Modal de Tradução de Palavra */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-96 max-w-[90vw] relative overflow-hidden border border-gray-100">
                        {/* Header do Modal */}
                        <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] p-4 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                        <Volume2 size={16} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-semibold">Tradução</h3>
                                </div>
                                <button 
                                    onClick={handleCloseModal} 
                                    className="p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
                                >
                            <X size={20} />
                        </button>
                            </div>
                        </div>

                        {/* Conteúdo do Modal */}
                        <div className="p-6 space-y-4">
                            {/* Palavra Original */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                                        Palavra Original
                                    </span>
                            {originalWordAudio && (
                                <button
                                    onClick={() => handlePlayModalAudio('original')}
                                            className="p-2 rounded-full bg-[#075E54] hover:bg-[#128C7E] transition-colors text-white shadow-sm"
                                    aria-label="Play original word audio"
                                    disabled={playingModalAudio !== null}
                                >
                                    {playingModalAudio === 'original' ? (
                                                <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                                <Volume2 size={16} />
                                    )}
                                </button>
                            )}
                                </div>
                                <p className="text-xl font-bold text-gray-800">{translatedWord}</p>
                            </div>

                            {/* Tradução */}
                            <div className="bg-[#DCF8C6] rounded-xl p-4 border border-[#B8E6B8]">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-[#075E54] uppercase tracking-wide">
                                        Tradução
                                    </span>
                            {translatedWordAudio && !isWordTranslating && (
                                <button
                                    onClick={() => handlePlayModalAudio('translated')}
                                            className="p-2 rounded-full bg-[#075E54] hover:bg-[#128C7E] transition-colors text-white shadow-sm"
                                    aria-label="Play translated word audio"
                                    disabled={playingModalAudio !== null}
                                >
                                    {playingModalAudio === 'translated' ? (
                                                <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                                <Volume2 size={16} />
                                    )}
                                </button>
                            )}
                                </div>
                                <div className="flex items-center">
                                    {isWordTranslating ? (
                                        <div className="flex items-center space-x-2">
                                            <Loader2 size={16} className="animate-spin text-[#075E54]" />
                                            <span className="text-[#075E54]">Traduzindo...</span>
                                        </div>
                                    ) : (
                                        <p className="text-xl font-bold text-[#075E54]">{translation}</p>
                                    )}
                                </div>
                            </div>

                            {/* Dica */}
                            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                                <p className="text-xs text-blue-700 text-center">
                                    💡 Clique nos botões de áudio para ouvir a pronúncia
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal do Perfil do Professor */}
            {isProfileModalOpen && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 modal-backdrop ${isProfileModalClosing ? 'modal-backdrop-closing' : ''}`}>
                    <div className={`bg-white rounded-2xl shadow-2xl w-80 max-w-[95vw] relative overflow-hidden border border-gray-100 profile-modal modal-content ${isProfileModalClosing ? 'modal-content-closing' : ''}`}>
                        <style jsx>{`
                            .modal-backdrop {
                                animation: fadeIn 0.3s ease-out;
                            }
                            .modal-backdrop-closing {
                                animation: fadeOut 0.3s ease-in;
                            }
                            .modal-content {
                                animation: slideInUp 0.3s ease-out;
                            }
                            .modal-content-closing {
                                animation: slideOutDown 0.3s ease-in;
                            }
                            @keyframes fadeIn {
                                from {
                                    opacity: 0;
                                }
                                to {
                                    opacity: 1;
                                }
                            }
                            @keyframes fadeOut {
                                from {
                                    opacity: 1;
                                }
                                to {
                                    opacity: 0;
                                }
                            }
                            @keyframes slideInUp {
                                from {
                                    opacity: 0;
                                    transform: translateY(20px) scale(0.95);
                                }
                                to {
                                    opacity: 1;
                                    transform: translateY(0) scale(1);
                                }
                            }
                            @keyframes slideOutDown {
                                from {
                                    opacity: 1;
                                    transform: translateY(0) scale(1);
                                }
                                to {
                                    opacity: 0;
                                    transform: translateY(20px) scale(0.95);
                                }
                            }
                        `}</style>
                        {/* Header do Modal */}
                        <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] p-4 text-white text-center">
                            <button 
                                onClick={handleCloseProfileModal} 
                                className="absolute top-3 right-3 p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
                            >
                                <X size={18} />
                            </button>
                            <div className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden border-3 border-white shadow-lg">
                                <img
                                    src="/Teacher.png"
                                    alt="Foto de perfil do professor"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h2 className="text-xl font-bold mb-1">Professor</h2>
                            <p className="text-[#DCF8C6] text-xs">Professor de Inglês IA</p>
                        </div>

                        {/* Conteúdo do Modal */}
                        <div className="p-4 space-y-3">
                            {/* Descrição */}
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                                    <span className="w-1.5 h-1.5 bg-[#075E54] rounded-full mr-2"></span>
                                    Sobre
                                </h3>
                                <p className="text-xs text-gray-700 leading-relaxed">
                                    Professor de inglês americano criado por IA. Especializado em conversação, 
                                    correção gramatical e aprendizado natural.
                                </p>
                            </div>

                            {/* Especialidades */}
                            <div className="bg-[#DCF8C6] rounded-lg p-3 border border-[#B8E6B8]">
                                <h3 className="text-sm font-semibold text-[#075E54] mb-2 flex items-center">
                                    <span className="w-1.5 h-1.5 bg-[#075E54] rounded-full mr-2"></span>
                                    Especialidades
                                </h3>
                                <div className="space-y-1">
                                    <div className="flex items-center text-[#075E54]">
                                        <span className="w-1 h-1 bg-[#075E54] rounded-full mr-2"></span>
                                        <span className="text-xs">Conversação em inglês</span>
                                    </div>
                                    <div className="flex items-center text-[#075E54]">
                                        <span className="w-1 h-1 bg-[#075E54] rounded-full mr-2"></span>
                                        <span className="text-xs">Correção gramatical</span>
                                    </div>
                                    <div className="flex items-center text-[#075E54]">
                                        <span className="w-1 h-1 bg-[#075E54] rounded-full mr-2"></span>
                                        <span className="text-xs">Tradução e pronúncia</span>
                                    </div>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs font-medium text-blue-700">Online</span>
                                    </div>
                                    <span className="text-xs text-blue-600">Disponível</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Modal de Login */}
            {isLoginModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-80 max-w-[95vw] relative overflow-hidden border border-gray-100">
                        {/* Header do Modal */}
                        <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] p-6 text-white text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden border-3 border-white shadow-lg">
                                <img
                                    src="/Teacher.png"
                                    alt="Foto de perfil do professor"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <h2 className="text-xl font-bold mb-1">Professor de Inglês</h2>
                            <p className="text-[#DCF8C6] text-xs">Acesso Restrito</p>
                        </div>

                        {/* Formulário de Login */}
                        <div className="p-6">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#075E54] focus:border-transparent"
                                        placeholder="seu@email.com"
                                        disabled={isLoggingIn}
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Senha
                                    </label>
                                    <input
                                        type="password"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#075E54] focus:border-transparent"
                                        placeholder="••••••••"
                                        disabled={isLoggingIn}
                                        required
                                    />
                                </div>
                                
                                {loginError && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="text-sm text-red-600">{loginError}</p>
                                    </div>
                                )}
                                
                                <button
                                    type="submit"
                                    disabled={isLoggingIn}
                                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                                        isLoggingIn 
                                            ? 'bg-gray-400 cursor-not-allowed text-white' 
                                            : 'bg-[#075E54] hover:bg-[#128C7E] text-white'
                                    }`}
                                >
                                    {isLoggingIn ? (
                                        <div className="flex items-center justify-center space-x-2">
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>Entrando...</span>
                                        </div>
                                    ) : (
                                        'Entrar'
                                    )}
                                </button>
                            </form>
                            
                            <div className="mt-4 text-center">
                                <p className="text-xs text-gray-500">
                                    Acesso restrito apenas para usuários autorizados
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        
            {/* Chat - Apenas quando logado */}
            {isLoggedIn && (
                <>
                {/* Header do Chat - FIXO NO TOPO */}
                <header className="flex items-center p-3 md:p-4 bg-[#075E54] border-b border-gray-200 shadow-md flex-shrink-0 z-10 chat-header">
                <button
                    onClick={handleOpenProfileModal}
                    className="rounded-full w-10 h-10 overflow-hidden hover:opacity-80 transition-opacity cursor-pointer"
                >
                <img
                    src="/Teacher.png"
                    alt="Foto de perfil do professor sorrindo"
                        className="w-full h-full object-cover"
                />
                </button>
                <div className="ml-4 flex-1">
                    <h1 className="text-lg font-bold text-white">Professor</h1>
                    <p className="text-sm text-[#DCF8C6]">
                        {isAiTyping ? `Digitando${typingDots}` : "Online"}
                    </p>
                </div>
                <div className="flex space-x-2">
                    <button
                        title="Funcionalidade de chamada de vídeo não ativa"
                        className="p-2 rounded-full text-white hover:bg-[#128C7E] transition-colors"
                    >
                        <Video size={24} />
                    </button>
                    <button
                        title="Funcionalidade de chamada de voz não ativa"
                        className="p-2 rounded-full text-white hover:bg-[#128C7E] transition-colors"
                    >
                        <Phone size={24} />
                    </button>
                    <div className="relative settings-menu">
                        <button
                            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
                            title="Configurações"
                            className="p-2 rounded-full text-white hover:bg-[#128C7E] transition-colors"
                        >
                            <MoreVertical size={24} />
                        </button>
                        
                        {/* Menu de Configurações */}
                        {isSettingsMenuOpen && (
                            <div className="absolute right-0 top-12 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 z-50">
                                <div className="px-4 py-2 border-b border-gray-100">
                                    <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                                        <Settings size={16} className="mr-2" />
                                        Configurações
                                    </h3>
                                </div>
                                <div className="px-4 py-2">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-sm text-gray-700">Áudio automático</span>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={autoPlayAudio}
                                                onChange={(e) => setAutoPlayAudio(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`w-10 h-6 rounded-full transition-colors ${
                                                autoPlayAudio ? 'bg-[#128C7E]' : 'bg-gray-300'
                                            }`}>
                                                <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
                                                    autoPlayAudio ? 'translate-x-5' : 'translate-x-1'
                                                }`} style={{ marginTop: '2px' }}></div>
                                            </div>
                                        </div>
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Reproduz áudio automaticamente quando a IA responde
                                    </p>
                                </div>
                                
                                {/* Separador */}
                                <div className="border-t border-gray-100 my-2"></div>
                                
                                {/* Botão de Logout */}
                                <div className="px-4 py-2">
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center w-full text-sm text-red-600 hover:text-red-700 transition-colors"
                                    >
                                        <LogOut size={16} className="mr-2" />
                                        Sair
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Container das Mensagens - SCROLLÁVEL */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 scroll-smooth chat-messages">
                <style jsx>{`
                    @keyframes slideInFromBottom {
                        from {
                            opacity: 0;
                            transform: translateY(20px) scale(0.98);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                    }
                    .message-enter {
                        animation: slideInFromBottom 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                        animation-delay: calc(var(--message-index, 0) * 0.05s);
                    }
                `}</style>
                {messages.length === 0 && !loading && (
                    <div className="flex justify-center items-center h-full">
                        <div className="text-center text-gray-500">
                            <h2 className="text-xl font-semibold">Comece sua jornada no inglês!</h2>
                            <p>Pratique conversação, receba correções e aprenda gramática com o Professor de inglês.</p>
                        </div>
                    </div>
                )}
                {messages.map((msg, index) => (
                    <div 
                        key={index} 
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} ${newMessageIds.has(msg.id) ? 'message-enter' : ''}`}
                        style={newMessageIds.has(msg.id) ? { '--message-index': 0 } : {}}
                    >
                        <div className={`relative p-3 max-w-xs md:max-w-md lg:max-w-lg rounded-xl shadow-md ${
                            msg.sender === 'user' ? 'bg-[#DCF8C6] text-gray-800 rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'
                        }`}>
                            {msg.sender === 'user' && msg.text_raw && (
                                <div className="flex flex-col">
                                    <p className="pr-16">{renderClickableText(msg.text_raw, 'português')}</p>
                                    {/* Mostra apenas a tradução relevante */}
                                    {(() => {
                                        // Se tem tradução em inglês, mostra ela (mensagem original era em português)
                                        if (msg.text_en) {
                                            return <p className="text-sm text-gray-500 mt-1 pr-16">{renderClickableText(msg.text_en, 'inglês')}</p>;
                                        }
                                        // Se tem tradução em português, mostra ela (mensagem original era em inglês)
                                        if (msg.text_pt) {
                                            return <p className="text-sm text-gray-500 mt-1 pr-16">{renderClickableText(msg.text_pt, 'português')}</p>;
                                        }
                                        return null;
                                    })()}
                                    <span className="absolute bottom-2 right-3 text-xs text-gray-500">
                                        {formatTime(msg.timestamp)}
                                    </span>
                                </div>
                            )}
                            {msg.sender === 'user' && msg.audio_uri && (
                                <div className="flex flex-col">
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handlePlayUserAudio(msg.audio_uri, msg.id)}
                                            className={`p-1 rounded-full text-white transition-colors
                                                ${loadingUserAudioId === msg.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#075E54] hover:bg-[#128C7E]'}`}
                                            aria-label="Play user audio"
                                            disabled={loadingUserAudioId !== null}
                                        >
                                            {loadingUserAudioId === msg.id ? (
                                                <Loader2 size={20} className="animate-spin text-white" />
                                            ) : (
                                                <Play size={20} />
                                            )}
                                        </button>
                                        <div className="flex flex-col">
                                            <p className="font-semibold text-gray-800">
                                                {renderClickableText(msg.text_raw || 'Áudio recebido...', 'português')}
                                            </p>
                                            {/* Mostra apenas a tradução relevante */}
                                            {(() => {
                                                // Se tem tradução em inglês, mostra ela (mensagem original era em português)
                                                if (msg.text_en) {
                                                    return <p className="text-sm text-gray-500 mt-1">{renderClickableText(msg.text_en, 'inglês')}</p>;
                                                }
                                                // Se tem tradução em português, mostra ela (mensagem original era em inglês)
                                                if (msg.text_pt) {
                                                    return <p className="text-sm text-gray-500 mt-1">{renderClickableText(msg.text_pt, 'português')}</p>;
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>
                                    <span className="absolute bottom-2 right-3 text-xs text-gray-500">
                                        {formatTime(msg.timestamp)}
                                    </span>
                                </div>
                            )}
                            {msg.sender === 'ai' && msg.text_en && (
                                <>
                                    <p className="pr-16">{renderClickableText(msg.text_en, 'inglês')}</p>
                                    {msg.text_pt && (
                                        <p className="text-sm text-gray-600 mt-1 pr-16">{renderClickableText(msg.text_pt, 'português')}</p>
                                    )}
                                </>
                            )}
                            {msg.sender === 'ai' && msg.correction_pt && (
                                <div className="mt-2 p-2 bg-yellow-100 text-yellow-800 rounded-lg">
                                    <h4 className="font-bold">Correção:</h4>
                                    <p className="text-sm">{msg.correction_pt}</p>
                                </div>
                            )}
                            {msg.sender === 'ai' && msg.text_en && (
                                <button
                                    onClick={() => handlePlayAudio(msg.text_en, msg.id)}
                                    className="mt-2 p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
                                    aria-label="Play audio"
                                    disabled={loadingAudioId !== null}
                                >
                                    {loadingAudioId === msg.id ? (
                                        <Loader2 size={16} className="animate-spin text-gray-600" />
                                    ) : (
                                        <Volume2 size={16} className="text-gray-600" />
                                    )}
                                </button>
                            )}
                            {msg.sender === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                                <div className="mt-4 p-2 bg-purple-50 text-purple-800 rounded-lg shadow-inner mb-6">
                                    <h4 className="flex items-center font-bold mb-2">
                                        <Lightbulb size={16} className="mr-2" />
                                        Ideias para continuar a conversa:
                                    </h4>
                                    <ul className="list-disc list-inside space-y-1">
                                        {msg.suggestions.map((sug, i) => (
                                            <li key={i} className="text-sm">
                                                <button
                                                    onClick={() => handleSuggestionClick(sug.en)}
                                                    className="text-left font-semibold text-purple-700 hover:underline"
                                                >
                                                    {sug.en}
                                                </button>
                                                <p className="text-xs text-purple-600">{sug.pt}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <span className="absolute bottom-2 right-3 text-xs text-gray-500">
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start message-enter" style={{ '--message-index': 0 }}>
                        <div className="p-3 bg-white rounded-xl rounded-bl-none shadow-md">
                            <p className="text-gray-500">Digitando{typingDots}</p>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Barra de Input - FIXA NA PARTE INFERIOR */}
            <div className="p-3 md:p-4 bg-[#F0F0F0] border-t border-gray-300 flex-shrink-0 z-10 chat-input">
                <div className="flex items-end bg-white rounded-3xl p-3 shadow-inner gap-2">
                    {/* Input de texto */}
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage(input);
                            }
                        }}
                        onInput={(e) => {
                            // Auto-resize do textarea
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                        }}
                        className="flex-1 py-2 px-3 focus:outline-none rounded-2xl text-base md:text-lg font-inter placeholder:text-gray-400 resize-none overflow-hidden leading-6 min-h-[44px] max-h-[120px] transition-all duration-200 ease-in-out"
                        placeholder={isRecording ? 'Gravando...' : 'Digite uma mensagem...'}
                        disabled={!isAuthReady || loading || isRecording}
                        rows={1}
                    />

                    
                    {/* Alterna entre o botão de envio e o microfone */}
                    {input.trim() ? (
                        <button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || loading || !isAuthReady}
                            className={`p-3 md:p-4 rounded-full text-white transition-colors ${
                                !input.trim() || loading || !isAuthReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#128C7E] hover:bg-[#075E54]'
                            }`}
                        >
                            <SendHorizonal size={22} className="md:w-7 md:h-7" />
                        </button>
                    ) : (
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={!isAuthReady || loading}
                            className={`p-3 md:p-4 rounded-full text-white transition-colors ${
                                isRecording ? 'bg-[#D22F27] hover:bg-[#A92520]' : 'bg-[#128C7E] hover:bg-[#075E54]'
                            }`}
                            aria-label="Toggle voice recording"
                        >
                            <Mic size={22} className="md:w-7 md:h-7" />
                        </button>
                    )}
                </div>
            </div>
                </>
            )}
        </div>
    );
};

export default App;
