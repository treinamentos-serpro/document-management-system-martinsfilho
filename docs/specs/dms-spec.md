# Especificação - Document Management System

> Especificação e plano de execução do DMS, elaborados a partir de
> [spec-template.md](./spec-template.md). Este documento registra o escopo e
> orienta as próximas etapas; não implementa nem altera arquivos de backend ou
> frontend.

## 1. Objetivo

Disponibilizar uma aplicação web para que cada usuário envie, consulte e baixe
seus documentos, armazenando os arquivos no filesystem local e mantendo seus
metadados em memória.

## 2. Escopo

### Dentro do escopo

- Envio de um arquivo por requisição.
- Listagem dos documentos pertencentes ao usuário identificado na requisição.
- Download de um documento pelo identificador, com verificação de propriedade.
- Exibição no frontend dos documentos do usuário, opção de envio e ação de
  download, com estados de carregamento e erro.
- Uso de armazenamento local em `backend/storage`, com `multer` e `diskStorage`.
- Persistência dos metadados somente em memória nesta fase.
- Respostas HTTP e mensagens de erro consistentes para as operações da API.

### Fora do escopo

- Armazenamento externo, em nuvem, ou uso de serviços de upload de terceiros.
- Banco de dados ou persistência durável dos metadados.
- Autenticação, cadastro e administração de usuários. A aplicação recebe a
  identidade de usuário por meio de um contexto de autenticação confiável já
  fornecido à requisição.
- Versionamento, edição, exclusão, compartilhamento e busca de documentos.
- Upload de múltiplos arquivos em uma única requisição.
- Pré-visualização ou processamento do conteúdo dos arquivos.

## 3. Requisitos funcionais

| ID    | Requisito |
| ----- | --------- |
| RF-01 | O usuário pode enviar um arquivo usando `multipart/form-data`, no campo `file`. |
| RF-02 | A API valida a presença de um arquivo, aplica o limite de tamanho configurado e rejeita requisições inválidas com erro HTTP apropriado. |
| RF-03 | O arquivo aceito é gravado no filesystem local em `backend/storage`, usando `multer` com `diskStorage` e um nome interno único, independente do nome original. |
| RF-04 | Após o upload bem-sucedido, a API registra e devolve os metadados do documento, incluindo seu identificador e o proprietário. |
| RF-05 | O usuário pode listar somente os documentos associados à sua identidade; a lista é ordenada do mais recente para o mais antigo. |
| RF-06 | O usuário pode baixar um documento pelo identificador somente quando ele lhe pertence. |
| RF-07 | A resposta do download entrega o conteúdo binário e apresenta o nome original como nome sugerido para o arquivo baixado. |
| RF-08 | A API responde com `401` quando não há identidade de usuário disponível no contexto confiável da requisição. |
| RF-09 | O frontend permite selecionar e enviar um arquivo, apresenta o resultado ou erro da operação e exibe os documentos retornados pela API. |
| RF-10 | O frontend permite baixar um documento listado e informa quando não há documentos disponíveis. |

## 4. Requisitos não funcionais

| ID     | Requisito |
| ------ | --------- |
| RNF-01 | Os arquivos enviados permanecem exclusivamente no filesystem local; `multer` deve usar `diskStorage` com diretório padrão `backend/storage`. |
| RNF-02 | Os metadados são mantidos em memória. Após reiniciar o processo, a listagem fica vazia; os arquivos que permanecerem no disco não serão reconstruídos automaticamente como documentos. |
| RNF-03 | A configuração operacional é obtida por variáveis de ambiente, incluindo `PORT`, `STORAGE_DIR` (opcional, com padrão local `backend/storage`) e `MAX_FILE_SIZE_BYTES` (com padrão de 10 MiB). |
| RNF-04 | O backend usa Node.js e Express em CommonJS; o frontend usa React e Vite em ESM, respeitando as dependências existentes sempre que possível. |
| RNF-05 | O frontend chama a API pelo prefixo `/api`; o proxy do Vite remove esse prefixo e encaminha as chamadas ao backend local. |
| RNF-06 | O nome original não é utilizado como caminho de armazenamento. O nome interno é gerado pela aplicação para evitar colisões e traversal de diretório. |
| RNF-07 | O download e as operações de listagem respeitam o proprietário do documento; não se revela se um identificador de outro usuário existe. |
| RNF-08 | Falhas de escrita, leitura ou remoção compensatória do arquivo são tratadas explicitamente, sem respostas de sucesso para operações incompletas. |
| RNF-09 | As camadas seguem o fluxo de dependência `routes -> controllers -> services -> repositories`; camadas internas não dependem de Express ou de detalhes HTTP. |
| RNF-10 | O backend tem testes automatizados com `node:test` para regras e contratos principais; o frontend deve ser validado por build e testes disponíveis no projeto. |

### Identidade do usuário

As operações protegidas dependem de uma identidade confiável disponível como
`req.user.id` (ou contexto equivalente injetado por middleware de autenticação).
O identificador do proprietário não deve ser aceito diretamente de um campo do
formulário, query string ou cabeçalho arbitrário enviado pelo cliente. A
implementação de autenticação não faz parte deste escopo; a integração do
middleware confiável é um pré-requisito para habilitar o uso multiusuário. Sem
esse contexto, as operações protegidas devem responder `401`.

## 5. Modelo de dados (metadados do documento)

### Metadados retornados pela API

| Campo        | Tipo   | Obrigatório | Descrição |
| ------------ | ------ | ----------- | --------- |
| `id`         | string | Sim         | Identificador único do documento, gerado pela aplicação (UUID). |
| `originalName` | string | Sim       | Nome original enviado pelo cliente; usado apenas como metadado e nome sugerido no download. |
| `size`       | number | Sim         | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Sim         | Data e hora do upload em ISO 8601. |
| `owner`      | string | Sim         | Identificador do usuário obtido do contexto confiável da requisição. |

### Dado interno do repositório

| Campo            | Tipo   | Descrição |
| ---------------- | ------ | --------- |
| `storedFilename` | string | Nome interno único usado para localizar o arquivo dentro do diretório de armazenamento. Não é exposto na resposta pública da API. |

Os registros são mantidos em memória pelo repositório durante a vida do
processo. O caminho absoluto do arquivo deve ser derivado do diretório de
armazenamento configurado e do nome interno; não deve ser construído a partir
do `originalName` ou de um caminho fornecido pelo cliente.

## 6. Contratos de API

Todas as rotas abaixo são chamadas pelo frontend como `/api/...`. O proxy de
desenvolvimento remove `/api`, encaminhando-as para as rotas correspondentes do
backend (`/upload` e `/documents...`). As operações exigem identidade de usuário
no contexto confiável do backend.

### Formato de erro

Respostas de erro usam o formato:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrição objetiva do erro."
  }
}
```

Não incluir caminhos locais, stack traces ou detalhes internos na mensagem
pública.

### POST `/api/upload`

- **Finalidade:** gravar um documento local e registrar seus metadados.
- **Entrada:** `multipart/form-data`, com exatamente um arquivo no campo `file`.
- **Limite:** `MAX_FILE_SIZE_BYTES`; padrão de 10 MiB.
- **Sucesso:** `201 Created`.

```json
{
  "document": {
    "id": "uuid",
    "originalName": "relatorio.pdf",
    "size": 12345,
    "uploadedAt": "2026-10-26T19:54:35.590Z",
    "owner": "user-123"
  }
}
```

- **Erros:** `400 Bad Request` para arquivo ausente, campo incorreto ou mais de
  um arquivo; `401 Unauthorized` sem identidade confiável; `413 Payload Too
  Large` quando excedido o limite; `500 Internal Server Error` para falha de
  armazenamento.
- Se a gravação no disco ocorrer, mas o registro dos metadados falhar, a
  implementação tenta remover o arquivo recém-gravado e retorna erro. A
  resposta não pode indicar sucesso nessa situação.

### GET `/api/documents`

- **Finalidade:** listar os documentos do usuário autenticado.
- **Entrada:** nenhuma.
- **Sucesso:** `200 OK`, ordenado por `uploadedAt` decrescente.

```json
{
  "documents": [
    {
      "id": "uuid",
      "originalName": "relatorio.pdf",
      "size": 12345,
      "uploadedAt": "2026-10-26T19:54:35.590Z",
      "owner": "user-123"
    }
  ]
}
```

- Quando não houver documentos, retornar `200 OK` com `"documents": []`.
- **Erros:** `401 Unauthorized` sem identidade confiável; `500 Internal Server
  Error` para falha inesperada ao consultar o repositório.

### GET `/api/documents/:id/download`

- **Finalidade:** baixar o conteúdo de um documento pertencente ao usuário.
- **Entrada:** `id` UUID no segmento da rota.
- **Sucesso:** `200 OK`, conteúdo binário, `Content-Type` apropriado quando
  conhecido (ou `application/octet-stream`) e `Content-Disposition` como
  `attachment`, com o nome original tratado com segurança.
- **Erros:** `400 Bad Request` para identificador malformado; `401 Unauthorized`
  sem identidade confiável; `404 Not Found` se o documento não existir, não
  pertencer ao usuário ou se o arquivo local não estiver disponível; `500
  Internal Server Error` para outras falhas de leitura.

## 7. Decisões arquiteturais

- **Rotas (`routes/`):** declaram os caminhos e encaminham as requisições aos
  controllers.
- **Controllers (`controllers/`):** leem parâmetros, arquivo e identidade do
  contexto HTTP, validam a entrada básica, chamam os serviços e traduzem os
  resultados para status e respostas HTTP.
- **Services (`services/`):** concentram as regras de negócio, como associação
  de proprietário, listagem por usuário e autorização do download.
- **Repositories (`repositories/`):** encapsulam o registro de metadados em
  memória e o acesso aos arquivos no filesystem local.
- `multer` com `diskStorage` é configurado no limite HTTP do backend, com
  diretório local e limite de tamanho. O nome persistido é gerado pela
  aplicação; o nome original fica apenas nos metadados.
- O repositório é a única camada responsável por conhecer a estrutura interna
  dos metadados e a localização dos arquivos. Não há banco de dados nem
  integração com armazenamento externo.
- O frontend é organizado em componentes React e consome a API via `fetch`
  usando `/api`. A interface não define nem envia o proprietário do documento.
- A reinicialização do backend perde os metadados em memória. A limpeza e a
  recuperação de arquivos órfãos não fazem parte desta primeira versão e devem
  ser consideradas em uma evolução futura.

## 8. Plano de execução

As etapas abaixo são um plano para implementação futura. Nesta etapa, somente
este documento deve ser criado; nenhum arquivo de backend ou frontend deve ser
implementado ou alterado.

1. **Preparar critérios e configuração:** confirmar o contrato de identidade
   confiável, variáveis de ambiente, limite de upload e respostas de erro antes
   de iniciar a implementação.
2. **Implementar domínio e repositórios do backend:** definir o formato dos
   metadados e encapsular a coleção em memória e o acesso ao filesystem local.
3. **Implementar os serviços do backend:** aplicar propriedade, ordenação,
   validações de negócio e regras de autorização para listagem e download.
4. **Implementar rotas e controllers do backend:** configurar upload com
   `multer`/`diskStorage`, implementar os contratos HTTP e tratar erros de
   entrada, disco e contexto de usuário.
5. **Testar o backend:** cobrir upload, limite/tipos de entrada, isolamento por
   proprietário, listagem, download, arquivo ausente e falhas de armazenamento
   com `node:test`.
6. **Implementar a interface do frontend:** criar fluxo de upload, listagem,
   estados vazio/carregando/erro e download usando as rotas `/api`.
7. **Integrar e validar a aplicação:** verificar o proxy do Vite, executar o
   build do frontend e os testes do backend, e validar manualmente o fluxo
   completo com o diretório local de armazenamento.
8. **Documentar configuração e limitações:** registrar variáveis necessárias,
   execução local, dependência de contexto de autenticação confiável e a perda
   de metadados após reiniciar o backend.
