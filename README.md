# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey MOSF!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-serpro/document-management-system-martinsfilho/issues/1)

---

## Backend DMS

```sh
cd backend
npm install
npm start
```

O backend usa as camadas `routes -> controllers -> services -> repositories`.
`GET /health` permanece público. As operações de documentos são:

- `POST /upload`: recebe um arquivo no campo `file` de um formulário
	`multipart/form-data` e retorna os metadados com status `201`.
- `GET /documents`: lista os documentos do usuário, do mais recente para o
	mais antigo.
- `GET /documents/:id/download`: baixa um documento do usuário pelo UUID,
	preservando o nome original no download.

As três rotas exigem `req.user.id` como string não vazia, preenchido por
middleware confiável antes do roteador registrado em `backend/src/app.js`.
Sem esse contexto, retornam `401`. A autenticação não está implementada;
cabeçalhos, campos de formulário e parâmetros enviados pelo cliente não são
aceitos como identidade.

Configuração por variáveis de ambiente:

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP |
| `STORAGE_DIR` | `backend/storage` | Diretório local de arquivos; caminhos relativos são resolvidos a partir do diretório de execução |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Limite por arquivo (10 MiB); inteiro positivo |

Os uploads usam `multer.diskStorage`, com nomes internos UUID e diretório criado
automaticamente. Os metadados permanecem somente em memória: reiniciar o
processo esvazia a listagem, mas não remove os arquivos do disco.

Execute os testes HTTP com `npm test --prefix backend`, na raiz do projeto.
Eles usam armazenamento temporário e simulam o contexto confiável apenas no
ambiente de teste.

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)

