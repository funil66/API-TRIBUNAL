# 🚀 INSTRUÇÕES PARA FAZER PUSH PARA O GITHUB

## ⚠️ PRÉ-REQUISITOS

Você precisa instalar o Git primeiro:

### 1. Instalar Git
- Baixe em: https://git-scm.com/download/windows
- Ou via Chocolatey: `choco install git`
- Ou via Winget: `winget install Git.Git`

### 2. Configurar Git (primeira vez)
```bash
git config --global user.name "funil66"
git config --global user.email "seu-email@gmail.com"
```

## 🔄 EXECUTAR O PUSH

### Opção 1: Script Automático
Após instalar o Git, execute:
```powershell
.\git-push.ps1
```

### Opção 2: Comandos Manuais
```bash
# 1. Inicializar repositório
git init

# 2. Adicionar remote
git remote add origin https://github.com/funil66/API-TRIBUNAL.git

# 3. Adicionar arquivos
git add .

# 4. Fazer commit
git commit -m "feat: Initial commit - Legal Search API complete implementation"

# 5. Configurar branch
git branch -M main

# 6. Push para GitHub
git push -u origin main
```

## 🔐 AUTENTICAÇÃO

Se der erro de autenticação, você tem 3 opções:

### 1. Personal Access Token (Recomendado)
1. Vá em GitHub → Settings → Developer settings → Personal access tokens
2. Gere um novo token com permissões de `repo`
3. Use o token como senha quando solicitado

### 2. GitHub CLI
```bash
# Instalar GitHub CLI
winget install GitHub.cli

# Fazer login
gh auth login

# Fazer push
gh repo sync
```

### 3. SSH Key
```bash
# Gerar chave SSH
ssh-keygen -t ed25519 -C "seu-email@gmail.com"

# Adicionar ao GitHub
cat ~/.ssh/id_ed25519.pub
```

## 📁 ARQUIVOS PREPARADOS

✅ Todos os arquivos do site foram removidos
✅ README.md atualizado para focar apenas na API
✅ .gitignore configurado corretamente
✅ Projeto limpo e pronto para o GitHub

## 🎯 RESULTADO ESPERADO

Após executar os comandos, você terá:
- ✅ Repositório inicializado
- ✅ Código enviado para https://github.com/funil66/API-TRIBUNAL
- ✅ Branch main configurada
- ✅ Projeto disponível publicamente

## 🆘 PROBLEMAS COMUNS

### "Git não é reconhecido"
- Instale o Git e reinicie o terminal

### "Authentication failed"
- Use Personal Access Token em vez da senha

### "Repository not found"
- Verifique se o repositório existe: https://github.com/funil66/API-TRIBUNAL

### "Permission denied"
- Verifique se você é proprietário do repositório
- Use o token de acesso correto

---

**📞 Precisa de ajuda?**
1. Verifique se o Git está instalado: `git --version`
2. Verifique se está no diretório correto
3. Verifique se o repositório GitHub existe
4. Use Personal Access Token para autenticação
