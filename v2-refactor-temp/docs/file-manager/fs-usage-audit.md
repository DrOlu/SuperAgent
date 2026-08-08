# Main Process `fs` Usage Audit

>  `src/main/`  Node.js `fs` 
>  File Manager 
>
> - ****: 2026-04-06
> - ****: `src/main/` 

## 

|  |  |
|------|------|
| `sync` |  API`readFileSync`  |
| `async` | /Promise API`fs/promises` |
| `stream` |  API`createReadStream`  |
| `watch` | `watch`/`watchFile` |
| `stat` |  `stat`/`lstat`/`access`  API |
| `dir` | `mkdir`/`readdir`/`rmdir` |
| `rw` | `readFile`/`writeFile` |
| `del` | `unlink`/`rm` |
| `copy` | /`copyFile`/`rename` |

---

## 1. Utils`src/main/utils/`

### `utils/index.ts`
- **Import**: `import fs from 'node:fs'`, `import fsAsync from 'node:fs/promises'`
- **Tags**: `sync` `async` `rw` `stat` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.mkdirSync()` |  |  |
| `fsAsync.readdir()` |  |  |
| `fsAsync.stat()` |  | / |

### `utils/file.ts`
- **Import**: `import * as fs from 'node:fs'`, `import { readFile } from 'node:fs/promises'`
- **Tags**: `sync` `async` `rw` `stat` `dir` `del` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.readdirSync()` |  |  |
| `fs.statSync()` |  |  |
| `fs.existsSync()` |  |  |
| `fs.mkdirSync()` |  |  |
| `fs.promises.access()` |  |  |
| `readFile()` |  |  |
| `fs.promises.open()` |  |  |
| `fs.promises.writeFile()` |  |  |
| `fs.promises.rename()` |  |  |
| `fs.promises.unlink()` |  |  |
| `fs.promises.stat()` |  |  |
| `fs.promises.readFile()` |  |  base64  |
| `fs.promises.readdir()` |  |  |

### `utils/fileOperations.ts`
- **Import**: `import * as fs from 'node:fs'`
- **Tags**: `async` `copy` `del` `dir` `rw` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.promises.lstat()` |  |  |
| `fs.promises.mkdir()` |  |  |
| `fs.promises.readdir()` |  |  |
| `fs.promises.copyFile()` |  |  |
| `fs.promises.chmod()` |  |  |
| `fs.promises.rm()` |  |  |

### `utils/init.ts`
- **Import**: `import * as fs from 'node:fs'`
- **Tags**: `sync` `rw` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.accessSync()` |  |  |
| `fs.existsSync()` |  |  |
| `fs.readFileSync()` |  |  config.json  |
| `fs.mkdirSync()` |  |  |
| `fs.writeFileSync()` |  |  config.json  |

### `utils/process.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  git  |
| `fs.existsSync()` |  |  |

### `utils/rtk.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `rw` `stat` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  | / rtk  |
| `fs.mkdirSync()` |  |  bin  |
| `fs.readFileSync()` |  |  |
| `fs.copyFileSync()` |  |  rtk  bin  |
| `fs.chmodSync()` |  |  Unix |
| `fs.writeFileSync()` |  |  |

### `utils/ocr.ts`
- **Import**: `import { readFile } from 'fs/promises'`
- **Tags**: `async` `rw`

| API | / |  |
|-----|-----------|------|
| `readFile()` |  |  buffer  |

### `utils/markdownParser.ts`
- **Import**: `import * as fs from 'fs'`
- **Tags**: `async` `rw` `stat` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.promises.stat()` |  |  markdown  |
| `fs.promises.readFile()` |  |  markdown  |
| `fs.promises.readdir()` |  |  |

### `utils/builtinSkills.ts`
- **Import**: `import fs from 'node:fs/promises'`
- **Tags**: `async` `rw` `dir` `copy` `del` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.access()` |  |  |
| `fs.readdir()` |  |  |
| `fs.mkdir()` |  |  |
| `fs.cp()` |  |  |
| `fs.writeFile()` |  |  app  |
| `fs.readlink()` |  |  |
| `fs.rm()` |  |  |
| `fs.symlink()` |  |  junction  |
| `fs.readFile()` |  |  SKILL.md  |

---

## 2. Services`src/main/services/` agent

### `services/AppService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `async` `dir` `rw` `del` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.promises.access()` |  | mkdir  |
| `fs.promises.mkdir()` |  |  |
| `fs.promises.writeFile()` |  |  Linux  desktop  |
| `fs.promises.unlink()` |  |  desktop  |

### `services/FileSystemService.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.readFile()` |  |  |

### `services/FileStorage.ts`
- **Import**: `import * as fs from 'fs'`, `import { writeFileSync } from 'fs'`, `import { readFile } from 'fs/promises'`
- **Tags**: `sync` `async` `stream` `stat` `rw` `del` `copy` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  | / |
| `fs.mkdirSync()` |  | // |
| `fs.createReadStream()` |  |  |
| `fs.statSync()` |  |  |
| `fs.promises.readdir()` |  |  |
| `fs.promises.copyFile()` |  |  |
| `fs.promises.stat()` |  |  |
| `fs.promises.unlink()` |  |  |
| `fs.promises.rm()` |  |  |
| `fs.promises.rename()` |  | / |
| `fs.promises.mkdir()` |  |  |
| `fs.readFileSync()` |  |  |
| `fs.promises.readFile()` |  |  buffer  |
| `fs.promises.writeFile()` |  | base64 buffer |
| `fs.accessSync()` |  |  |

### `services/CopilotService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `async` `rw` `dir` `del` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  token  |
| `fs.promises.mkdir()` |  |  token  |
| `fs.promises.writeFile()` |  |  Copilot token |
| `fs.promises.readFile()` |  |  token  |
| `fs.promises.access()` |  |  token  |
| `fs.promises.unlink()` |  |  token  |

### `services/ObsidianVaultService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `stat` `dir` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  | / |
| `fs.readFileSync()` |  |  Obsidian  JSON  |
| `fs.statSync()` |  |  |
| `fs.readdirSync()` |  |  |

### `services/OpenClawService.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `del` `rw` `dir` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  | // |
| `fs.unlinkSync()` |  |  |
| `fs.rmSync()` |  |  |
| `fs.readFileSync()` |  |  JSON  |
| `fs.writeFileSync()` |  |  JSON  |
| `fs.mkdirSync()` |  |  |
| `fs.renameSync()` |  |  |

### `services/KnowledgeService.ts`
- **Import**: `import * as fs from 'node:fs'`
- **Tags**: `sync` `del` `dir` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.mkdirSync()` |  |  |
| `fs.rmSync()` |  |  |
| `fs.readFileSync()` |  |  |
| `fs.writeFileSync()` |  |  |
| `fs.unlinkSync()` |  |  |

### `services/AnthropicService.ts`
- **Import**: `import { promises } from 'fs'`
- **Tags**: `async` `rw` `del` `dir`

| API | / |  |
|-----|-----------|------|
| `promises.mkdir()` |  |  OAuth  |
| `promises.writeFile()` |  |  OAuth  |
| `promises.readFile()` |  |  OAuth  |
| `promises.chmod()` |  | 0o600 |
| `promises.unlink()` |  |  |

### `services/CodeCliService.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `rw` `dir` `del`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  | // |
| `fs.readFileSync()` |  |  manifest JSON |
| `fs.writeFileSync()` |  |  manifest |
| `fs.mkdirSync()` |  |  |
| `fs.chmodSync()` |  |  |
| `fs.unlinkSync()` |  |  |

### `services/ProtocolClient.ts`
- **Import**: `import fs from 'node:fs/promises'`
- **Tags**: `async` `rw` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.mkdir()` |  |  .local/share/applications  |
| `fs.writeFile()` |  |  desktop  |

### `services/SpanCacheService.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `del` `dir` `rw` `stat` `stream`

| API | / |  |
|-----|-----------|------|
| `fs.rm()` |  |  trace  |
| `fs.readdir()` |  |  topic  trace  |
| `fs.mkdir()` |  |  trace  |
| `fs.access()` |  |  trace  |
| `fs.appendFile()` |  |  span  trace  |
| `fs.open()` |  |  trace  |

### `services/VersionService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `stat` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.statSync()` |  |  |
| `fs.openSync()` |  |  |
| `fs.readSync()` |  |  1KB |
| `fs.closeSync()` |  |  |
| `fs.appendFileSync()` |  |  |

### `services/WebviewService.ts`
- **Import**: `import { promises as fs } from 'fs'`
- **Tags**: `async` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.writeFile()` |  |  PDF  HTML  |

### `services/DxtService.ts`
- **Import**: `import * as fs from 'fs'`
- **Tags**: `sync` `del` `copy` `dir` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.mkdirSync()` |  |  MCP  |
| `fs.renameSync()` |  |  |
| `fs.rmSync()` |  |  |
| `fs.readdirSync()` |  |  |
| `fs.copyFileSync()` |  |  |
| `fs.readFileSync()` |  |  manifest.json  |
| `fs.unlinkSync()` |  |  DXT  |

### `services/mcp/oauth/storage.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `rw` `del` `dir` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.readFile()` |  |  OAuth  JSON  |
| `fs.mkdir()` |  |  oauth  |
| `fs.writeFile()` |  |  OAuth  |
| `fs.rename()` |  |  |
| `fs.unlink()` |  |  OAuth  |

### `services/ocr/builtin/TesseractService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `async` `stat` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.promises.stat()` |  | OCR  |
| `fs.promises.access()` |  |  |
| `fs.promises.mkdir()` |  |  Tesseract  |

### `services/ocr/builtin/OvOcrService.ts`
- **Import**: `import * as fs from 'fs'`
- **Tags**: `sync` `async` `stat` `dir` `del` `rw` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  OCR  |
| `fs.promises.readdir()` |  |  img/output  |
| `fs.promises.stat()` |  |  |
| `fs.promises.rmdir()` |  |  |
| `fs.promises.unlink()` |  |  |
| `fs.promises.mkdir()` |  |  img/output  |
| `fs.promises.copyFile()` |  |  img  |
| `fs.promises.readFile()` |  |  OCR  |

### `services/remotefile/MistralService.ts`
- **Import**: `import fs from 'node:fs/promises'`
- **Tags**: `async` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.readFile()` |  |  buffer  Mistral |

### `services/remotefile/OpenAIService.ts`
- **Import**: `import * as fs from 'fs'`
- **Tags**: `stream` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.createReadStream()` |  |  OpenAI |

### `services/memory/MemoryService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `stat` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.renameSync()` |  |  |

### `services/lanTransfer/handlers/fileTransfer.ts`
- **Import**: `import * as fs from 'node:fs'`
- **Tags**: `async` `stream` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.promises.stat()` |  |  |
| `fs.createReadStream()` |  |  |

---

## 3. Agent Services`src/main/services/agents/`

### `services/agents/BaseService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `stat` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.statSync()` |  | / |
| `fs.mkdirSync()` |  |  agent  |

### `services/agents/database/DatabaseManager.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `dir` `stat` `del`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.mkdirSync()` |  |  |
| `fs.renameSync()` |  |  |
| `fs.statSync()` |  |  |
| `fs.unlinkSync()` |  |  |

### `services/agents/database/MigrationService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.readFileSync()` |  |  JSON  |

### `services/agents/services/claudecode/index.ts`
- **Import**: `import * as fs from 'node:fs'`
- **Tags**: `sync` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |

### `services/agents/services/SessionService.ts`
- **Import**: `import * as fs from 'node:fs'`
- **Tags**: `async` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.promises.readdir()` |  |  `.claude/commands/`  |

### `services/agents/services/channels/ChannelMessageHandler.ts`
- **Import**: `import fs from 'node:fs/promises'`
- **Tags**: `async` `dir` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.mkdir()` |  | / |
| `fs.writeFile()` |  | base64  |
| `fs.writeFile()` |  | base64  |

### `services/agents/services/channels/adapters/wechat/WeChatProtocol.ts`
- **Import**: `import fs from 'node:fs'`, `import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'`
- **Tags**: `sync` `async` `rw` `del` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  token  |
| `fs.readFileSync()` |  |  token |
| `readFile()` |  |  token  bot  |
| `mkdir()` |  |  token  0o700 |
| `writeFile()` |  |  bot  token 0o600 |
| `chmod()` |  |  token  |
| `rm()` |  |  token  |

### `services/agents/services/builtin/BuiltinAgentProvisioner.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `dir` `rw` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.mkdirSync()` |  |  agent  |
| `fs.readdirSync()` |  |  |
| `fs.copyFileSync()` |  |  agent  |
| `fs.existsSync()` |  |  agent.json  |
| `fs.readFileSync()` |  |  agent.json  |

### `services/agents/skills/SkillInstaller.ts`
- **Import**: `import * as fs from 'fs'`
- **Tags**: `async` `rw` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.promises.rename()` |  |  |
| `fs.promises.rename()` |  |  |
| `fs.promises.readFile()` |  |  SKILL.md  SHA-256  |

### `services/agents/skills/SkillService.ts`
- **Import**: `import * as fs from 'node:fs'`
- **Tags**: `async` `dir` `rw` `stat` `del`

| API | / |  |
|-----|-----------|------|
| `fs.promises.readdir()` |  |  |
| `fs.promises.readFile()` |  |  API |
| `fs.promises.mkdir()` |  |  .claude/skills  |
| `fs.promises.lstat()` |  | / |
| `fs.promises.rm()` |  |  |
| `fs.promises.symlink()` |  |  global-skills  junction  .claude/skills |
| `fs.promises.unlink()` |  |  |
| `fs.promises.writeFile()` |  |  ZIP  |
| `fs.promises.stat()` |  |  ZIP  |

### `services/agents/services/cherryclaw/seedWorkspace.ts`
> **PR #16726**`seedWorkspaceTemplates`  Soul Mode 
- **Import**: `import { mkdir, stat, writeFile } from 'node:fs/promises'`
- **Tags**: `async` `dir` `rw` `stat`

| API | / |  |
|-----|-----------|------|
| `mkdir()` |  |  memory  |
| `writeFile()` |  |  SOUL.md  USER.md  |
| `stat()` |  |  |

### `services/agents/services/cherryclaw/prompt.ts`
> **PR #16726** `src/main/ai/agents/prompt.ts`fs 
- **Import**: `import { readdir, readFile, stat } from 'node:fs/promises'`
- **Tags**: `async` `rw` `stat` `dir`

| API | / |  |
|-----|-----------|------|
| `readdir()` |  |  |
| `stat()` |  |  mtime  |
| `readFile()` |  |  SOUL.mdUSER.mdFACT.md  |

### `services/agents/services/cherryclaw/heartbeat.ts`
> **PR #16726** `src/main/ai/agents/heartbeat.ts`fs 
- **Import**: `import { readFile } from 'node:fs/promises'`
- **Tags**: `async` `rw`

| API | / |  |
|-----|-----------|------|
| `readFile()` |  |  heartbeat.md  |

---

## 4. Data Layer`src/main/data/`

### `data/db/DbService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `stat` `del`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.statSync()` |  |  |
| `fs.unlinkSync()` |  | / |
| `fs.unlinkSync()` |  |  WAL/SHM  |

### `services/file/utils/pathResolver.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.realpathSync()` |  |  local_external  |
| `fs.realpathSync()` |  |  |

### `data/bootConfig/BootConfigService.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `rw` `stat` `del` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.readFileSync()` |  |  |
| `fs.unlinkSync()` |  |  |
| `fs.mkdirSync()` |  |  |
| `fs.writeFileSync()` |  |  |
| `fs.renameSync()` |  |  |

### `data/migration/v2/window/MigrationIpcHandler.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `dir` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.mkdir()` |  |  |
| `fs.writeFile()` |  |  JSON  |

### `data/migration/v2/utils/DexieFileReader.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `rw` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.readFile()` |  |  JSON  |
| `fs.access()` |  |  |
| `fs.stat()` |  |  |

### `data/migration/v2/utils/JSONStreamReader.ts`
- **Import**: `import { createReadStream } from 'fs'`
- **Tags**: `stream`

| API | / |  |
|-----|-----------|------|
| `createReadStream()` |  |  JSON  |
| `createReadStream()` |  |  JSON  |
| `createReadStream()` |  |  JSON  |

### `data/migration/v2/core/MigrationDbService.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `stat` `del`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.statSync()` |  |  |
| `fs.unlinkSync()` |  | / |
| `fs.unlinkSync()` |  |  WAL/SHM  |

### `data/migration/v2/core/MigrationContext.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.readFile()` |  |  localStorage  JSON  |

### `data/migration/v2/core/MigrationEngine.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `del`

| API | / |  |
|-----|-----------|------|
| `fs.rm()` |  |  |

### `data/migration/v2/migrators/KnowledgeMigrator.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.statSync()` |  |  |

---

## 5. Knowledge`src/main/knowledge/`

### `knowledge/embedjs/loader/draftsExportLoader.ts`
- **Import**: `import * as fs from 'node:fs'`
- **Tags**: `sync` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.readFileSync()` |  |  Drafts  JSON  |

### `knowledge/embedjs/loader/epubLoader.ts`
- **Import**: `import * as fs from 'fs'`
- **Tags**: `sync` `stream` `rw` `del`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  EPUB  |
| `fs.createWriteStream()` |  |  |
| `fs.readFileSync()` |  |  |
| `fs.unlinkSync()` |  |  |

### `knowledge/preprocess/BasePreprocessProvider.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `async` `stat` `dir` `rw` `copy` `del`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.mkdirSync()` |  |  |
| `fs.existsSync()` |  |  |
| `fs.promises.stat()` |  |  |
| `fs.promises.readdir()` |  |  |
| `fs.promises.stat()` |  |  |
| `fs.existsSync()` |  |  |
| `fs.mkdirSync()` |  |  |
| `fs.copyFileSync()` |  |  |
| `fs.unlinkSync()` |  |  |

### `knowledge/preprocess/MistralPreprocessProvider.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `rw` `dir` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.readFileSync()` |  |  base64 |
| `fs.mkdirSync()` |  |  OCR  |
| `fs.writeFileSync()` |  |  base64  |
| `fs.writeFileSync()` |  |  markdown  |
| `fs.statSync()` |  |  markdown  |

### `knowledge/preprocess/OpenMineruPreprocessProvider.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `async` `rw` `dir` `stat` `del` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.promises.stat()` |  |  PDF |
| `fs.promises.readFile()` |  |  PDF  |
| `fs.readdirSync()` |  |  |
| `fs.renameSync()` |  |  markdown  |
| `fs.existsSync()` |  |  |
| `fs.mkdirSync()` |  |  |
| `fs.writeFileSync()` |  |  ZIP  |
| `fs.unlinkSync()` |  |  ZIP  |

### `knowledge/preprocess/Doc2xPreprocessProvider.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `async` `stream` `rw` `dir` `stat` `del`

| API | / |  |
|-----|-----------|------|
| `fs.promises.stat()` |  |  |
| `fs.promises.readFile()` |  |  |
| `fs.createReadStream()` |  |  |
| `fs.mkdirSync()` |  |  ZIP/ |
| `fs.existsSync()` |  |  |
| `fs.writeFileSync()` |  |  ZIP  |
| `fs.unlinkSync()` |  |  ZIP  |
| `fs.statSync()` |  |  markdown  |

### `knowledge/preprocess/MineruPreprocessProvider.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `async` `rw` `dir` `stat` `del`

| API | / |  |
|-----|-----------|------|
| `fs.promises.stat()` |  |  |
| `fs.promises.readFile()` |  |  |
| `fs.readdirSync()` |  |  |
| `fs.renameSync()` |  |  markdown  |
| `fs.existsSync()` |  |  |
| `fs.statSync()` |  |  |
| `fs.writeFileSync()` |  |  ZIP  |
| `fs.mkdirSync()` |  |  |
| `fs.unlinkSync()` |  |  ZIP  |

### `knowledge/preprocess/PaddleocrPreprocessProvider.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `async` `rw` `dir` `stat` `del`

| API | / |  |
|-----|-----------|------|
| `fs.promises.stat()` |  |  |
| `fs.promises.readFile()` |  |  PDF |
| `fs.existsSync()` |  |  |
| `fs.rmSync()` |  |  |
| `fs.mkdirSync()` |  |  |
| `fs.writeFileSync()` |  |  markdown  |

---

## 6. MCP Servers`src/main/mcpServers/`

### `mcpServers/memory.ts`
- **Import**: `import { promises as fs } from 'fs'`
- **Tags**: `async` `rw` `dir` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.mkdir()` |  |  memory  |
| `fs.access()` |  |  memory  |
| `fs.writeFile()` |  | / memory  |
| `fs.readFile()` |  |  |
| `fs.writeFile()` |  |  |

### `mcpServers/assistant.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: `sync` `rw` `stat` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.readdirSync()` |  |  .log  |
| `fs.statSync()` |  |  |
| `fs.readFileSync()` |  |  |
| `fs.existsSync()` |  |  |
| `fs.statSync()` |  |  |
| `fs.readdirSync()` |  |  |
| `fs.readFileSync()` |  |  |

### `mcpServers/claw.ts`
> **PR #16726**/ `src/main/ai/mcp/servers/cherryAutonomyTools.ts`fs 
- **Import**: `import { appendFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'`
- **Tags**: `async` `rw` `dir` `stat` `copy`

| API | / |  |
|-----|-----------|------|
| `mkdir()` |  |  |
| `readdir()` |  |  |
| `readFile()` |  |  |
| `writeFile()` |  |  |
| `appendFile()` |  |  |
| `rename()` |  | / |
| `stat()` |  |  |

### `mcpServers/filesystem/server.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.mkdir()` |  |  filesystem MCP  baseDir  |

### `mcpServers/filesystem/tools/delete.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `stat` `del`

| API | / |  |
|-----|-----------|------|
| `fs.stat()` |  | / |
| `fs.rm()` |  |  |
| `fs.rmdir()` |  |  |
| `fs.unlink()` |  |  |

### `mcpServers/filesystem/tools/ls.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.readdir()` |  |  |

### `mcpServers/filesystem/tools/edit.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `rw` `stat` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.stat()` |  |  |
| `fs.mkdir()` |  |  |
| `fs.readFile()` |  |  |
| `fs.writeFile()` |  |  |

### `mcpServers/filesystem/tools/write.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `rw` `stat` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.mkdir()` |  |  |
| `fs.stat()` |  |  |
| `fs.writeFile()` |  |  |

### `mcpServers/filesystem/tools/read.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `rw` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.stat()` |  |  |
| `fs.readFile()` |  |  UTF-8  |

### `mcpServers/filesystem/tools/glob.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `stat`

| API | / |  |
|-----|-----------|------|
| `fs.stat()` |  |  |
| `fs.stat()` |  |  |

### `mcpServers/filesystem/tools/grep.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `rw` `stat` `dir`

| API | / |  |
|-----|-----------|------|
| `fs.readFile()` |  |  |
| `fs.readdir()` |  |  |
| `fs.stat()` |  |  |

### `mcpServers/filesystem/types.ts`
- **Import**: `import fs from 'fs/promises'`
- **Tags**: `async` `stat` `rw`

| API | / |  |
|-----|-----------|------|
| `fs.realpath()` |  |  |
| `fs.open()` |  |  |

---

## 7. `src/main/`

### `bootstrap.ts`
- **Import**: `import fs from 'fs'`
- **Tags**: `sync` `stat` `copy`

| API | / |  |
|-----|-----------|------|
| `fs.existsSync()` |  |  |
| `fs.cpSync()` |  |  |

### `ipc.ts`
- **Import**: `import fs from 'node:fs'`
- **Tags**: _ import_

---

## 8. 

### 

|  |  |
|------|--------|
| Utils | 9 |
| Services agent | 21 |
| Agent Services | 13 |
| Data Layer | 10 |
| Knowledge | 8 |
| MCP Servers | 12 |
| Top-level | 2 |
| **** | **75** |

### Import 

|  |  |  |
|------|---------|------|
| `import fs from 'fs'` | ~12 | AppService, DbService |
| `import fs from 'node:fs'` | ~15 | CodeCliService, BootConfigService |
| `import * as fs from 'fs'` | ~5 | FileStorage, DxtService |
| `import * as fs from 'node:fs'` | ~5 | KnowledgeService, SkillService |
| `import fs from 'fs/promises'` | ~10 | SpanCacheService, MigrationEngine |
| `import fs from 'node:fs/promises'` | ~4 | ProtocolClient, MistralService |
| `import { promises } from 'fs'` | ~2 | AnthropicService |
| `import { promises as fs } from 'fs'` | ~2 | WebviewService, memory.ts |
| Named imports (`{ readFile, ... }`) | ~5 | cherryAutonomyTools.ts, ai/agents/* claw.ts, cherryclaw/*PR #16726  |

> ****8+  import 

### Sync vs Async 

|  |  |  |
|------|--------|------|
|  sync | ~18 | 24% |
|  async | ~30 | 40% |
| sync + async  | ~27 | 36% |

###  API Top 10

| API |  |  |
|-----|-----------|---------|
| `existsSync()` | 30+ |  |
| `mkdirSync()` / `mkdir()` | 25+ |  |
| `readFileSync()` / `readFile()` | 25+ |  |
| `writeFileSync()` / `writeFile()` | 20+ |  |
| `statSync()` / `stat()` | 20+ |  |
| `unlinkSync()` / `unlink()` | 15+ |  |
| `readdirSync()` / `readdir()` | 15+ |  |
| `rmSync()` / `rm()` | 8+ |  |
| `renameSync()` / `rename()` | 8+ | / |
| `copyFileSync()` / `copyFile()` | 6+ |  |

### 

1. **** `import fs`
2. **Import **`'fs'` vs `'node:fs'` vs `'fs/promises'` 
3. **Sync/Async ** sync  async
4. ****`existsSync() + mkdirSync({ recursive: true })`  20+ 
5. ****`mcp/oauth/storage.ts`  `BootConfigService.ts` +rename `utils/file.ts` 
6. ****`chmod`  `AnthropicService``WeChatProtocol``rtk.ts` 
7. **FileStorage.ts ** fs sync/async/stream/stat/rw/del/copy/dir
8. **MCP filesystem tools ** `fs/promises` async

### 

|  |  |  |
|--------|------|------|
| P0 | `FileStorage.ts` |  fs  |
| P0 | `utils/file.ts` + `utils/fileOperations.ts` |  |
| P1 | `knowledge/preprocess/*` | 8  |
| P1 | `data/`  |  |
| P2 | `services/agents/*` | Agent  |
| P2 | `mcpServers/*` |  |
| P3 |  services |  |
