# Componente de Áudio Estilo WhatsApp

## Visão Geral

Este projeto agora inclui um componente de áudio personalizado que simula a aparência e funcionalidade dos áudios do WhatsApp, com botão de play/pause, barra de progresso, foto do perfil e controles de tempo.

## Características

### 🎵 **Funcionalidades do Áudio**
- **Botão Play/Pause**: Controle intuitivo de reprodução
- **Barra de Progresso**: Visualização do progresso em tempo real
- **Contador de Tempo**: Exibe tempo atual e duração total
- **Foto do Perfil**: Mostra a foto do professor nas mensagens da IA
- **Animações Suaves**: Transições e efeitos visuais elegantes

### 🎨 **Design Visual**
- **Estilo WhatsApp**: Cores e layout idênticos ao WhatsApp
- **Responsivo**: Funciona perfeitamente em desktop e mobile
- **Estados Visuais**: Loading, playing, paused, hover effects
- **Gradientes**: Barra de progresso com gradiente verde

### 🔧 **Funcionalidades Técnicas**
- **Cache de Áudio**: Evita regeneração desnecessária de áudios
- **Controle de Estado**: Gerencia múltiplos áudios simultaneamente
- **Auto-play**: Reprodução automática configurável
- **Fallbacks**: Tratamento de erros e estados de loading

## Como Usar

### Para Mensagens do Usuário (Áudio Gravado)

```jsx
<AudioMessage
    audioUrl={msg.audio_uri}
    isUser={true}
    isLoading={loadingUserAudioId === msg.id}
    onPlay={() => handlePlayUserAudio(msg.audio_uri, msg.id)}
    onPause={() => setLoadingUserAudioId(null)}
/>
```

### Para Mensagens da IA (TTS)

```jsx
<AudioMessage
    audioUrl={aiAudioUrls.get(msg.id) || ''}
    isUser={false}
    profileImage="/Teacher.png"
    isLoading={loadingAudioId === msg.id}
    onPlay={async () => {
        if (!aiAudioUrls.has(msg.id)) {
            setLoadingAudioId(msg.id);
            const audioUrl = await getAiAudioUrl(msg.text_en, msg.id);
            if (audioUrl) {
                setAiAudioUrls(prev => new Map(prev).set(msg.id, audioUrl));
            }
            setLoadingAudioId(null);
        }
    }}
    onPause={() => setLoadingAudioId(null)}
/>
```

## Props do Componente

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `audioUrl` | string | - | URL do arquivo de áudio |
| `isUser` | boolean | false | Se é mensagem do usuário ou da IA |
| `profileImage` | string | null | URL da foto do perfil (apenas para IA) |
| `duration` | number | null | Duração do áudio em segundos |
| `onPlay` | function | - | Callback quando o áudio começa |
| `onPause` | function | - | Callback quando o áudio pausa |
| `isLoading` | boolean | false | Estado de carregamento |
| `className` | string | "" | Classes CSS adicionais |

## Estados Visuais

### 🟢 **Reproduzindo**
- Botão mostra ícone de pause
- Barra de progresso animada
- Classe `audio-playing` aplicada

### ⏸️ **Pausado**
- Botão mostra ícone de play
- Barra de progresso estática
- Tempo atual mantido

### ⏳ **Carregando**
- Botão mostra spinner animado
- Botão desabilitado
- Estado de loading aplicado

### 🎯 **Hover**
- Botão escala ligeiramente
- Sombra aumenta
- Transições suaves

## Estilos CSS

O componente usa classes CSS personalizadas:

```css
.audio-message {
  transition: all 0.2s ease-in-out;
}

.audio-play-button {
  transition: all 0.2s ease-in-out;
}

.audio-progress-bar {
  background: linear-gradient(90deg, #075E54 0%, #128C7E 100%);
}
```

## Integração com o Sistema

### Cache de Áudio
- Áudios da IA são cacheados para evitar regeneração
- URLs são armazenadas em `aiAudioUrls` state
- Verificação automática de cache antes de gerar novo áudio

### Controle de Estado
- `loadingAudioId`: Controla qual áudio está carregando
- `loadingUserAudioId`: Controla áudios do usuário
- Estados são limpos automaticamente

### Auto-play
- Configurável via `autoPlayAudio` state
- Gera áudio automaticamente para novas mensagens da IA
- Delay de 500ms para garantir renderização

## Melhorias Futuras

- [ ] Controle de velocidade de reprodução
- [ ] Waveform visual do áudio
- [ ] Controles de volume
- [ ] Download de áudio
- [ ] Compartilhamento de áudio
- [ ] Histórico de áudios favoritos

## Compatibilidade

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers
- ⚠️ IE11 (não suportado)

## Troubleshooting

### Áudio não reproduz
1. Verifique se a URL do áudio é válida
2. Confirme permissões de áudio no navegador
3. Verifique se o formato é suportado (WAV, MP3, etc.)

### Loading infinito
1. Verifique conexão com a API de TTS
2. Confirme se as chaves de API estão configuradas
3. Verifique logs do console para erros

### Performance
1. O cache de áudio melhora significativamente a performance
2. Áudios são gerados sob demanda
3. URLs são revogadas automaticamente para liberar memória
