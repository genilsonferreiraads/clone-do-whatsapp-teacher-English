# 🚀 Guia de Deploy - Netlify

## 📋 Pré-requisitos

1. **Conta no Netlify** (gratuita)
2. **Projeto no GitHub/GitLab** com o código
3. **Chaves de API** configuradas

## 🔧 Configuração das Variáveis de Ambiente

### 1. Firebase Configuration

Vá para [Firebase Console](https://console.firebase.google.com/) > Seu Projeto > Project Settings > General:

```env
VITE_FIREBASE_API_KEY=AIzaSyAwXUBcRqzOJlBJqnHDdsWjjh-uE-l2cJE
VITE_FIREBASE_AUTH_DOMAIN=whatsapp-de-ingles.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=whatsapp-de-ingles
VITE_FIREBASE_STORAGE_BUCKET=whatsapp-de-ingles.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1000042613834
VITE_FIREBASE_APP_ID=1:1000042613834:web:98819dbe7a250983fcaab3
```

### 2. Google APIs

#### Gemini API
- Vá para [Google AI Studio](https://makersuite.google.com/app/apikey)
- Crie uma nova API key
- Configure como:
```env
VITE_GEMINI_API_KEY=sua_chave_gemini_aqui
```

#### Google Text-to-Speech API
- Vá para [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- Crie uma nova API key
- Configure como:
```env
VITE_GOOGLE_TTS_API_KEY=sua_chave_tts_aqui
```

## 🌐 Deploy no Netlify

### Método 1: Deploy via Git (Recomendado)

1. **Conecte seu repositório**:
   - Faça login no [Netlify](https://netlify.com)
   - Clique em "New site from Git"
   - Escolha seu provedor (GitHub/GitLab)
   - Selecione o repositório

2. **Configure o build**:
   ```
   Build command: npm run build
   Publish directory: dist
   ```

3. **Configure as variáveis de ambiente**:
   - Vá para Site settings > Environment variables
   - Adicione todas as variáveis listadas acima
   - Clique em "Save"

4. **Deploy**:
   - Clique em "Deploy site"
   - Aguarde o build completar

### Método 2: Deploy Manual

1. **Build local**:
   ```bash
   npm run build
   ```

2. **Upload para Netlify**:
   - Vá para [Netlify](https://netlify.com)
   - Arraste a pasta `dist` para a área de upload
   - Configure as variáveis de ambiente

## 🔒 Configurações de Segurança

### Firebase Authentication

1. **Habilite Email/Senha**:
   - Firebase Console > Authentication > Sign-in method
   - Ative "Email/Password"

2. **Crie um usuário**:
   - Firebase Console > Authentication > Users
   - Clique em "Add User"
   - Digite email e senha

### Google APIs

1. **Habilite as APIs**:
   - Google Cloud Console > APIs & Services > Library
   - Procure e ative:
     - Gemini API
     - Cloud Text-to-Speech API

2. **Configure quotas** (opcional):
   - Google Cloud Console > APIs & Services > Quotas
   - Ajuste conforme necessário

## 🧪 Teste Pós-Deploy

1. **Acesse o site** fornecido pelo Netlify
2. **Teste o login** com as credenciais criadas
3. **Teste o chat** enviando uma mensagem
4. **Teste o áudio** clicando no botão de som
5. **Teste a tradução** clicando em palavras

## 🔧 Troubleshooting

### Erro: "API key not found"
- Verifique se todas as variáveis estão configuradas no Netlify
- Confirme se os nomes das variáveis estão corretos (VITE_*)

### Erro: "Firebase not initialized"
- Verifique se as configurações do Firebase estão corretas
- Confirme se o projeto está ativo no Firebase Console

### Erro: "Authentication failed"
- Verifique se o usuário foi criado no Firebase
- Confirme se Email/Password está habilitado

### Erro: "API quota exceeded"
- Verifique as quotas no Google Cloud Console
- Considere aumentar os limites se necessário

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no Netlify (Site settings > Functions > Logs)
2. Verifique o console do navegador (F12)
3. Confirme se todas as variáveis estão configuradas

## 🎯 Checklist Final

- [ ] Todas as variáveis de ambiente configuradas no Netlify
- [ ] Firebase Authentication habilitado
- [ ] Usuário criado no Firebase
- [ ] Google APIs habilitadas
- [ ] Deploy realizado com sucesso
- [ ] Login funcionando
- [ ] Chat funcionando
- [ ] Áudio funcionando
- [ ] Tradução funcionando

---

**🎉 Parabéns! Seu app está pronto para produção!** 