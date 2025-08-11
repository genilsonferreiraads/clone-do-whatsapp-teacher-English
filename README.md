# Clone Zap - Aprender Inglês

Um aplicativo de chat estilo WhatsApp para aprender inglês com inteligência artificial.

## 🚀 Funcionalidades

- Chat em tempo real com IA
- Gravação de áudio
- Tradução de palavras ao clicar
- Geração de áudio TTS
- Interface responsiva estilo WhatsApp
- Integração com Firebase
- API do Gemini para IA

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- Conta no Firebase
- Chave de API do Google Gemini

## ⚙️ Configuração

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

#### Para Desenvolvimento Local:
1. Copie o arquivo `env.example` para `.env.local`
2. Preencha com suas chaves reais

#### Para Produção (Netlify):
Veja o guia completo em [DEPLOY.md](./DEPLOY.md)

### 3. Configurar Firebase
1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative o Authentication (Email/Password)
3. Crie um usuário em Authentication > Users
4. Copie as configurações do projeto

### 4. Configurar Google APIs
1. **Gemini API**: [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Text-to-Speech API**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

## 🚀 Executar

```bash
npm run dev
```

O aplicativo será aberto em `http://localhost:3000`

## 📱 Como usar

1. Digite mensagens em português ou inglês
2. Use o microfone para gravar áudio
3. Clique nas palavras para ver traduções
4. Use os botões de áudio para ouvir as respostas
5. Siga as sugestões para continuar a conversa

## 🚀 Deploy

### Netlify (Recomendado)
Veja o guia completo de deploy em [DEPLOY.md](./DEPLOY.md)

### Build para Produção
```bash
npm run build
```

## 🛠️ Tecnologias

- React 18
- Vite
- Tailwind CSS
- Firebase Authentication
- Google Gemini API
- Google Text-to-Speech API
- Lucide React (ícones)

## 🔒 Segurança

- ✅ Chaves de API protegidas por variáveis de ambiente
- ✅ Firebase Authentication para acesso restrito
- ✅ Validação de variáveis de ambiente
- ✅ Logs de erro para debugging

## 📝 Licença

MIT 