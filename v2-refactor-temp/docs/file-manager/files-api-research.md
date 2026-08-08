# OpenAI / Google / Anthropic Files API 

> 2026-04-18
> developers.openai.comai.google.devdocs.claude.com Context7 MCP / WebFetch 

---

## 

|  | **OpenAI** | **GoogleGemini Dev API** | **Anthropic** |
|---|---|---|---|
| **** | GA | GA | **Beta**`anthropic-beta: files-api-2025-04-14` |
| **** | 512 MB | 2 GB | 500 MB |
| **/** | 2.5 TB /  | 20 GB /  | 500 GB /  |
| **** |  `expires_after` | **48 ** |  `DELETE` |
| **** |  Files Vector Store $0.10/GB· | **** | **** |
| **** | `file_id` / `file_url` / `file_data`base64≤32 MB | `file_data.file_uri` / inline base64 | `source.type="file"` / `base64` / `url` block |
| **purpose ** | assistants/batch/fine-tune/vision/user_data/evals |  |  |
| **** | Responses / Assistants / Batch / Fine-tune / Vision  `file_id` |  `generateContent` | Messages + Code Execution + Skills  |
| **** | Vector Store + File SearchBatch  |  / `fps`/`start_offset` |  Citations + Prompt Caching  |
| **** |  | ✅ MP4 / MP3  | ❌  PDF /  /  /  |
| **** | N/A | Vertex AI  GCS URI Files API | **Bedrock / Vertex AI ** Anthropic  |

### 

- 🤖 **OpenAI**——**** `file_id`  Responses / Batch / Fine-tune / Vision `purpose` 
- 🔷 **Google**——****2 GB  +  **48h **""
- 🟣 **Anthropic**——**** `source`  `file`  `base64` / `url`  Citations / Prompt Caching / Skills  beta 

### 

|  |  |  |
|---|---|---|
|  /  | Anthropic / OpenAI |  Google  48h  |
|  /  | Google |  |
|  + Batch +  | OpenAI | `purpose`  |
|  | Anthropic | `document` + `citations.enabled` + `file_id`  |
|  | Google / Anthropic | OpenAI  Vector Store  GB· |

---

## OpenAI Files API

### 1.1 

Base URL `https://api.openai.com` `Authorization: Bearer $OPENAI_API_KEY`

|  |  |  |
|---|---|---|
|  | `POST` | `/v1/files``multipart/form-data` `file` + `purpose` `expires_after` |
|  | `GET` | `/v1/files` `purpose` / `limit` / `order` / `after`  |
|  | `GET` | `/v1/files/{file_id}` |
|  | `GET` | `/v1/files/{file_id}/content` |
|  | `DELETE` | `/v1/files/{file_id}` |

File `id / object / bytes / created_at / expires_at / filename / purpose / status / status_details`

### 1.2 purpose 

- `assistants` Assistants API`code_interpreter``file_search`
- `batch`Batch API `.jsonl`  purpose  `batch_output`
- `fine-tune``.jsonl` chat/completion 
- `vision`Vision / Responses png/jpg/gif/webp
- `user_data`Responses API PDF  Prompt 
- `evals`Evals API 
- /`batch_output``fine-tune-results`

### 1.3 

- ****512 MB
- **File Search  token**≤ 5,000,000 tokens
- ****2.5 TB****
- ****File Search pdf/md/docx/txt/html/Visionpng/jpg/gif/webpBatch/Fine-tunejsonlResponses `input_file`PDF 

### 1.4 

-  `expires_at: null`**** DELETE
-  `expires_after` `created_at`  anchor
- Batch 
- Vector Store  expiration  File Search 

### 1.5 

- **Responses API**`input_file { file_id }` / `input_image { file_id }` `file_data`base64 ≤32 MB `file_url`
- **Assistants API v2**`file_search`  Vector Store  `purpose=assistants` `code_interpreter`  message `attachments` **v1 **
- **Batch API** `purpose=batch`  `.jsonl` `/v1/batches`  `input_file_id`  `/v1/files/{output_file_id}/content` 
- **Fine-tuning**`purpose=fine-tune`  / 
- **Vision / **`purpose=vision` image edit 

### 1.6 

- Files API ****
- **File Search / Vector Store**$0.10 / GB· 1 GB  $2.50 / 1k calls
- **ChatKit / Agent Kit **$0.10 / GB· 1 GB 
- Fine-tune  token 

### 1.7  SDK 

```python
from openai import OpenAI
client = OpenAI()

f = client.files.create(file=open("report.pdf", "rb"), purpose="user_data")
resp = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": [
        {"type": "input_text", "text": " PDF"},
        {"type": "input_file", "file_id": f.id},
    ]}],
)
print(resp.output_text)
```

```javascript
import fs from "fs";
import OpenAI from "openai";
const openai = new OpenAI();

const f = await openai.files.create({
  file: fs.createReadStream("report.pdf"),
  purpose: "user_data",
});
const r = await openai.responses.create({
  model: "gpt-5",
  input: [{ role: "user", content: [
    { type: "input_text", text: " PDF" },
    { type: "input_file", file_id: f.id },
  ]}],
});
console.log(r.output_text);
```

### 1.8 

- **** `file_id`  Responses / Assistants / Batch / Fine-tune / Vision  purpose  Anthropic  Google " + "
- ****`file_id`Files API/ `file_url`/ `file_data`base64  ≤32 MB""""

### 1.9 

- `evals` purpose 
-  purpose  MIME 
- `expires_after`  / 

---

## Google Gemini Files API

 **Gemini Developer API**`generativelanguage.googleapis.com` Files service Vertex AI

### 2.1 REST v1beta

`https://generativelanguage.googleapis.com`

|  |  |  |
|---|---|---|
| resumable | `POST` | `/upload/v1beta/files` |
|  | `POST` | `/v1beta/files` |
|  | `GET` | `/v1beta/files``pageSize` ≤ 100 10 |
|  | `GET` | `/v1beta/files/{name}` |
|  | `DELETE` | `/v1beta/files/{name}` |
|  GCS  | `POST` | `/v1beta/files:register` |

`name / displayName / mimeType / sizeBytes / uri / statePROCESSING / ACTIVE / FAILED/ expirationTime / sha256Hash / videoMetadata`

### 2.2 

- **Resumable upload**`X-Goog-Upload-Protocol: resumable` + `X-Goog-Upload-Command: start/upload, finalize` SDK `files.upload` 
- **Inlinebase64 `inlineData`** `generateContent.contents`
- ****
  -  ≤ 20 MB  inline Files API
  - PDF /  inline Files API MB 
  - &lt;1  inline&gt;100 MB  10 **** Files API

### 2.3 

-  **2 GB** **20 GB**
- **PDF** ≤ 50 MB  ≤ 1000  **258 tokens**
- ** MIME**`image/png``image/jpeg``image/webp``image/heic``image/heif`
- ** MIME**MP4MPEGMOVAVIFLVMPGWebMWMV3GPP
- **** **32 tokens/** MIME 
-  `generateContent`  payload ≤ 100 MB

### 2.4  TTL

- **48 ** 48 
- `expirationTime` 
- ** / ** GCSVertex AI

### 2.5  generateContent 

 `contents.parts`  `file_data` 

```json
{"file_data": {"mime_type": "video/mp4", "file_uri": "files/abc-123"}}
```

****
-  `state`  `PROCESSING` `ACTIVE` 
- `videoMetadata`  `fps` / `start_offset` / `end_offset`Prompt  `MM:SS` 
-  1 FPS  300 tokens/ 100 tokens/ 258 tokens
- 1M context  1  3 

### 2.6 

- **Files API **
-  token PDF 258 tokens/ tile

### 2.7  SDK  SDK `google-genai`

```python
from google import genai

client = genai.Client(api_key="YOUR_KEY")

my_file = client.files.upload(file="sample.pdf")

resp = client.models.generate_content(
    model="gemini-2.5-pro",
    contents=["", my_file],
)
print(resp.text)

for f in client.files.list():
    print(f.name, f.state)
client.files.delete(name=my_file.name)
```

```javascript
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const uploaded = await ai.files.upload({
  file: "sample.mp3",
  config: { mimeType: "audio/mpeg" },
});

const resp = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    "",
    createPartFromUri(uploaded.uri, uploaded.mimeType),
  ]),
});
console.log(resp.text);
```

>  `google-generativeai`  `google-genai`Python/ `@google/genai`Node

### 2.8 Vertex AI 

Vertex AI ** Files API**
- **GCS `gs://` URI**
- **inline base64 `fileData`**
- ** HTTP(S) URL**
- Vertex AI Studio  7 MB

 Vertex AI "Files" GCS  TTL 48 Gemini Developer API  Files  48h 

---

## Anthropic Files API

### 3.1  Beta Header

Files API  **beta ** GA

```
anthropic-beta: files-api-2025-04-14
anthropic-version: 2023-06-01
```

Messages  `file_id`  beta header** ZDR** **Amazon Bedrock / Google Vertex AI **

### 3.2 

|  |  |  |
|---|---|---|
| `POST` | `/v1/files` | `multipart/form-data` `file` |
| `GET` | `/v1/files` |  workspace  |
| `GET` | `/v1/files/{file_id}` | `id / filename / mime_type / size_bytes / created_at / type / downloadable` `scope` |
| `GET` | `/v1/files/{file_id}/content` | **** Skills / Code Execution  |
| `DELETE` | `/v1/files/{file_id}` |  |

### 3.3  MIME

- ****500 MB
- ****500 GB
- **beta ** 100 req/min
- ** MIME**
  - `application/pdf` → `document` block
  - `text/plain` → `document` block
  - `image/jpeg` / `image/png` / `image/gif` / `image/webp` → `image` block
  - Code Execution CSV / XLSX / DOCX → `container_upload` block
- ****Files API **** Code Execution 
-  `document` .csv / .md / .docx / .xlsx PDF 

### 3.4 

- **** `DELETE`
-  API key  **workspace** workspace  key 
-  Messages  Anthropic 
- **** OpenAI `expires_after`Google 48h TTL 

### 3.5  Messages API 

`source.type = "file"`  `base64` / `url`

```json
{ "type": "document",
  "source": { "type": "file", "file_id": "file_011C..." },
  "title": "...", "context": "...",
  "citations": { "enabled": true } }
```

```json
{ "type": "image",
  "source": { "type": "file", "file_id": "file_011C..." } }
```

- **base64**
- **url**
- **file** Prompt Caching `file_id` 
- **Code Execution Tool**  **Skills**  Files  FilesCSV `/content` 
- **Computer Use**  `file_id` tool_result  image block

### 3.6 

- ** /  /  /  /  / **
-  Messages ** token** 
-  **Prompt Caching**  PDF /  `cache_control`  block `file_id` token 

### 3.7  SDK 

```python
from anthropic import Anthropic
client = Anthropic()
up = client.beta.files.upload(
    file=("doc.pdf", open("doc.pdf", "rb"), "application/pdf"),
)
resp = client.beta.messages.create(
    model="claude-opus-4-7", max_tokens=1024,
    betas=["files-api-2025-04-14"],
    messages=[{"role": "user", "content": [
        {"type": "text", "text": ""},
        {"type": "document", "source": {"type": "file", "file_id": up.id}},
    ]}],
)
```

```javascript
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import fs from "fs";
const anthropic = new Anthropic();
const up = await anthropic.beta.files.upload({
  file: await toFile(fs.createReadStream("doc.pdf"), undefined, { type: "application/pdf" }),
  betas: ["files-api-2025-04-14"],
});
const resp = await anthropic.beta.messages.create({
  model: "claude-opus-4-7", max_tokens: 1024, betas: ["files-api-2025-04-14"],
  messages: [{ role: "user", content: [
    { type: "text", text: "" },
    { type: "document", source: { type: "file", file_id: up.id } },
  ]}],
});
```

### 3.8 

- ** content block ** `source`  `base64` / `url` / `file` """" OpenAI  `file_id`  `image_url` 
- ** Skills / Code Execution **Code Execution  /  `file_id`  `/content` ——" →  →  → "OpenAI  Code Interpreter  assistants/thread 
- **Citations  Prompt Caching **`document` block  `citations.enabled` `file_id`  / Prompt Caching  base64 
- ** + ** OpenAI Assistants  Google  48h  / 
- ** / ** token 

### 3.9 

- 
- Computer Use  `file_id`

---

## 

### OpenAI
- https://platform.openai.com/docs/api-reference/files
- https://platform.openai.com/docs/assistants/tools/file-search
- https://developers.openai.comContext7 

### Google
- https://ai.google.dev/gemini-api/docs/files
- https://ai.google.dev/api/files
- https://ai.google.dev/gemini-api/docs/video-understanding
- https://ai.google.dev/gemini-api/docs/document-processing
- https://ai.google.dev/gemini-api/docs/image-understanding
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/send-multimodal-prompts

### Anthropic
- https://docs.claude.com/en/docs/build-with-claude/files
- https://docs.claude.com/en/api/files-create
- anthropic-sdk-python / anthropic-sdk-typescript 
