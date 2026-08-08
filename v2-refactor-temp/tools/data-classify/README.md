# 

SuperAgent  TypeScript 

****: 2.0.0
****: 2025-11-28

> ⚠️ ****
>
>  **generate** /****
>
> |  |  |
> | --- | --- |
> | `npm run generate``generate:preferences``generate:boot-config``generate:migration` | `npm run extract``validate``validate:gen``check:duplicates``all` |
>
>  `DO-NOT-USE-` `DO-NOT-USE-extract-inventory.js``DO-NOT-USE-validate-consistency.js``DO-NOT-USE-validate-generation.js``DO-NOT-USE-check-duplicates.js` npm 

## 



- ****: 
- ****: 
- ****:  TypeScript 
- ****: 

## 

```
v2-refactor-temp/tools/data-classify/
├── scripts/
│   ├── lib/
│   │   └── classificationUtils.js          # 
│   ├── generate-all.js                     # 
│   ├── generate-preferences.js             #  preferenceSchemas.ts
│   ├── generate-boot-config.js             #  bootConfigSchemas.ts
│   ├── generate-migration.js               #  PreferencesMappings.ts + BootConfigMappings.ts
│   ├── DO-NOT-USE-extract-inventory.js     # [] 
│   ├── DO-NOT-USE-validate-consistency.js  # [] 
│   ├── DO-NOT-USE-validate-generation.js   # [] 
│   └── DO-NOT-USE-check-duplicates.js      # [] 
├── data/
│   ├── classification.json         # 
│   ├── inventory.json              # 
│   └── target-key-definitions.json #  target key 
├── package.json
└── README.md                       # 
```

## 

```bash
# 
cd v2-refactor-temp/tools/data-classify

# 
npm install

# 
npm run generate

# 
npm run generate:preferences   #  preferenceSchemas.ts
npm run generate:boot-config   #  bootConfigSchemas.ts
npm run generate:migration     #  PreferencesMappings.ts + BootConfigMappings.ts
```

> `extract` / `validate` / `validate:gen` / `check:duplicates` / `all` 

## 

|                            |                                              |         |
| ------------------------------ | ------------------------------------------------ | ----------- |
| `npm run generate`             |                                | ✅      |
| `npm run generate:preferences` |  preferenceSchemas.ts                      | ✅      |
| `npm run generate:boot-config` |  bootConfigSchemas.ts                      | ✅      |
| `npm run generate:migration`   |  PreferencesMappings.ts + BootConfigMappings.ts | ✅      |
| `npm run extract`              |                              | ⛔    |
| `npm run validate`             |                                    | ⛔    |
| `npm run validate:gen`         |                                  | ⛔    |
| `npm run check:duplicates`     |                                  | ⛔    |
| `npm run all`                  |                                    | ⛔    |

> ⛔ ****

## 

>  `extract-inventory` / `validate-consistency` / `validate-generation` / `check-duplicates`  `DO-NOT-USE-`  `generate-*` 

### 

```
┌─────────────────────────────────────────────────────────────┐
│                                                      │
│  scripts/lib/classificationUtils.js                         │
│  - loadClassification()    - traverseClassifications()      │
│  - saveClassification()    - calculateStats()               │
│  - loadInventory()         - normalizeType()                │
│  - extractPreferencesData() - inferTypeFromValue()          │
└─────────────────────────────────────────────────────────────┘
                    ▲                    ▲
                    │                    │
        ┌───────────┘                    └───────────┐
        │                                            │
┌───────┴───────┐                          ┌────────┴────────┐
│ extract-      │                          │ validate-       │
│ inventory.js  │                          │ consistency.js  │
│               │                          │                 │
│       │                          │         │
│       │                          │           │
└───────────────┘                          └─────────────────┘

┌─────────────────────┐
│   generate-all.js   │─────────────────────┬──────────────────────┐
│                     │                     │                      │
│       │                     │                      │
└─────────────────────┘                     │                      │
         │                                  │                      │
         │ require()                        │ require()            │ require()
         ▼                                  ▼                      ▼
┌─────────────────────┐    ┌─────────────────────┐   ┌─────────────────────┐
│ generate-           │    │ generate-           │   │ generate-           │
│ preferences.js      │    │ boot-config.js      │   │ migration.js        │
│                     │    │                     │   │                     │
│                 │    │                 │   │                 │
│ preferenceSchemas.ts│    │ bootConfigSchemas.ts│   │ PreferencesMappings │
└─────────────────────┘    └─────────────────────┘   │ BootConfigMappings  │
                                                     └─────────────────────┘

┌─────────────────────┐                    ┌─────────────────────┐
│ validate-           │                    │ check-              │
│ generation.js       │                    │ duplicates.js       │
│                     │                    │                     │
│     │                    │       │
│ ()          │                    │ ()          │
└─────────────────────┘                    └─────────────────────┘
```

### 

|                       |                                     |                                           |                                                                            |
| ------------------------- | --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| `generate-preferences.js` | `classification.json`                   | `preferenceSchemas.ts`                        |                                                                              |
| `generate-boot-config.js` | `classification.json`                   | `bootConfigSchemas.ts`                        |                                                                              |
| `generate-migration.js`   | `classification.json`                   | `PreferencesMappings.ts`, `BootConfigMappings.ts` |                                                                              |
| `generate-all.js`         | -                                       |                                 | `generate-preferences.js`, `generate-boot-config.js`, `generate-migration.js`  |
| `DO-NOT-USE-extract-inventory.js` _()_    |                               | `data/inventory.json`                         | `classificationUtils.js`                                                       |
| `DO-NOT-USE-validate-consistency.js` _()_ | `inventory.json`, `classification.json` | `validation-report.md`                        | `classificationUtils.js`                                                       |
| `DO-NOT-USE-validate-generation.js` _()_  |  `.ts`                        |                                     |                                                                              |
| `DO-NOT-USE-check-duplicates.js` _()_     | `classification.json`                   |                                     |                                                                              |

## 

> ⚠️  1 4 3

### 1. 

```bash
npm run extract
```



- **Redux Store**: `src/renderer/store/*.ts`
- **Electron Store**: `src/main/services/ConfigManager.ts`
- **LocalStorage**:  localStorage 
- **Dexie **: `src/renderer/databases/index.ts`

> ****: `dexieSettings`  key  key [dexieSettings ](#dexiesettings-) 

### 2. 

 `data/classification.json` 

```json
{
  "originalKey": "theme",
  "type": "string",
  "status": "classified",
  "category": "preferences",
  "targetKey": "ui.theme_mode"
}
```

### 3. 

```bash
npm run generate
```

 TypeScript 

- `src/shared/data/preference/preferenceSchemas.ts` - 
- `src/shared/data/bootConfig/bootConfigSchemas.ts` - 
- `src/main/data/migration/v2/migrators/mappings/PreferencesMappings.ts` - 
- `src/main/data/migration/v2/migrators/mappings/BootConfigMappings.ts` - 

### 4. 

```bash
npm run validate
npm run validate:gen
```



- 
- 
- 
- 
- 

---

## 

 SuperAgent  6 

### 1.  (preferences)

****:

- ✅ 
- ✅ 
- ✅ boolean/string/number/ array/object
- ✅ 
- ✅ 
- ✅ 

****:

- `showAssistants`: 
- `theme`: light/dark/system
- `fontSize`: 
- `language`: 

****:

- `ui.fontSize``system.language`
- `ui.*``system.*``app.*`

### 2.  (bootConfig)

****:

- ✅  Node.js  `app.whenReady` lifecycle  `BeforeReady` 
- ✅ 
- ✅  SQLite  lifecycle `BeforeReady`  boot config 
- ✅  I/O `~/.superagent/boot-config.json` userData 

****:

```
Boot Config  → bootstrap appData → app.whenReady → lifecycle BeforeReadyDB → lifecycle WhenReady
```

Boot config 

****:

- `disableHardwareAcceleration`:  Electron API 
-  bootstrap 

** preferences **:

| | bootConfig | preferences |
| --- | --- | --- |
|  |  | lifecycle `BeforeReady`  |
|  | JSON `~/.superagent/boot-config.json` | SQLite  |
| Main | `bootConfigService.get()`  | `application.get('PreferenceService').get()` |
| Renderer | `usePreference('BootConfig.*')`  | `usePreference('key')` |

### 3.  (user_data)

****:

- ✅ 
- ✅ 
- ✅ 
- ✅ 
- ✅ 

****:

- `topics`: 
- `messages`: 
- `files`: 
- `knowledge_notes`: 

****:

- 
- 

### 4.  (cache)

****:

- ✅ 
- ✅ 
- ✅ 
- ✅ 

****:

- `failed_favicon_*`:  favicon 
- 
- 
- 

### 5.  (runtime)

****:

- ✅ 
- ✅  ≤ 
- ✅ 
- ✅ 

****:

- 
- 
- UI /
- 

### 6.  (resources)

****:

- ✅ 
- ✅ 
- ✅ 
- ✅ 

****:

- 
- 
- 
- 

---

## 

```

  ↓
 lifecycle
  ↓                     ↓ 
              /
(bootConfig)            ↓                     ↓ 
                                    
                                              ↓         ↓ 
                                              
                                                        ↓          ↓ 
                                                           
                                                                    ↓         ↓ 
                                                                      
```

---

## 

###  1: Redux settings.showAssistants

```json
{
  "classifications": {
    "redux": {
      "settings": [
        {
          "originalKey": "showAssistants",
          "type": "boolean",
          "defaultValue": true,
          "status": "classified",
          "category": "preferences",
          "targetKey": "ui.show_assistants"
        }
      ]
    }
  }
}
```

****:

1. 
2. ✅
3. ✅
4. ✅ boolean 
5. 

###  2:  (Redux settings with children)

```json
{
  "originalKey": "codeEditor",
  "type": "object",
  "children": [
    {
      "originalKey": "enabled",
      "type": "boolean",
      "defaultValue": true,
      "status": "classified",
      "category": "preferences",
      "targetKey": "code_editor.enabled"
    },
    {
      "originalKey": "fontSize",
      "type": "number",
      "defaultValue": 14,
      "status": "classified",
      "category": "preferences",
      "targetKey": "code_editor.font_size"
    }
  ]
}
```

****:  `status`/`category`/`targetKey`

###  3: Dexie topics 

```json
{
  "originalKey": "topics",
  "type": "table",
  "status": "classified",
  "category": "user_data",
  "targetTable": "topic",
  "notes": ""
}
```

---

## 

`namespace.sub.key_name`

****:

-  2 
- 
- `/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/`

****:

- `app.theme` ()
- `chat.input.send_shortcut` ()
- `Theme` ( - )
- `App.User` ( - )

---

## 

> ⚠️ `npm run extract`

### 

- ****: 
- ****: 
- ****: 
- ****: 

### 

1.  `npm run extract`
2.  `classification.json`  `classification.backup.json`
3. 
4.  `pending` 
5.  `status: 'classified-deleted'`
6. 

---

## 

### inventory.json 

```json
{
  "metadata": {
    "generatedAt": "ISO ",
    "version": ""
  },
  "redux": {
    "moduleName": {
      "fieldName": {
        "type": "",
        "defaultValue": ""
      }
    }
  },
  "electronStore": { ... },
  "localStorage": { ... },
  "dexie": { ... }
}
```

### classification.json 

```json
{
  "metadata": {
    "version": "",
    "lastUpdated": "ISO "
  },
  "classifications": {
    "redux": {
      "moduleName": [
        {
          "originalKey": "",
          "type": "",
          "status": "classified|pending|classified-deleted",
          "category": "preferences|bootConfig|user_data|cache|runtime|resources",
          "targetKey": "target.key.name"
        }
      ]
    },
    "electronStore": { ... },
    "localStorage": { ... },
    "dexieSettings": {
      "settings": [
        {
          "originalKey": "",
          "type": "",
          "status": "classified|pending",
          "category": "preferences",
          "targetKey": "target.key.name"
        }
      ]
    },
    "dexie": { ... }
  }
}
```

### dexieSettings 

`dexieSettings`  classification.json  `redux``electronStore``localStorage``dexie`  Dexie IndexedDB  `settings`  KV 

** `dexie` **:

|  |  |  |  |
| --- | --- | --- | --- |
| `dexie` | Dexie files, topics  |  `targetTable` | `user_data` |
| `dexieSettings` | Dexie  `settings` KV  |  `targetKey` | `preferences` |

**classification.json **:

```json
{
  "classifications": {
    "dexieSettings": {
      "settings": [
        {
          "originalKey": "settingKeyName",
          "type": "string",
          "defaultValue": "defaultValue",
          "status": "classified",
          "category": "preferences",
          "targetKey": "namespace.key_name"
        }
      ]
    }
  }
}
```

****:

1. **`generate-preferences.js`**: `electronStore``redux``localStorage``dexieSettings` `preferenceSchemas.ts`
2. **`generate-migration.js`**:  `DEXIE_SETTINGS_MAPPINGS`  Dexie settings 

**** targetKey :

```
redux () > dexieSettings > localStorage > electronStore ()
```

**** [PR #10162 comment](https://github.com/DrOlu/SuperAgent/pull/10162#issuecomment-4010796619):

Dexie `settings`  KV `{ id: string, value: any }` `image://`  `ImageStorage` 

**:

| Key | Value Type |  |
| --- | --- | --- |
| `translate:model` | `string` (model id) | preference |
| `translate:target:language` | `string` (langCode) | preference |
| `translate:source:language` | `string` (langCode) | preference |
| `translate:bidirectional:enabled` | `boolean` | preference |
| `translate:bidirectional:pair` | `[string, string]` (langCode pair) | preference |
| `translate:scroll:sync` | `boolean` | preference |
| `translate:markdown:enabled` | `boolean` | preference |
| `translate:detect:method` | `string` ('franc'/'llm'/'auto') | preference |
| `pinned:models` | `Model[]` | preference |
| `image://avatar` | `string` (base64 data URL \| emoji) | preference / file manager |

* pattern*:

| Key Pattern | Value Type |  |
| --- | --- | --- |
| `image://provider-${providerId}` | `string` (base64 data URL \| emoji \| `''`) | file manager |
| `mcp:provider:${provider.key}:servers` | `MCPServer[]` | new table |

* IndexedDB *:

| Key |  |
| --- | --- |
| `translate:model:prompt` |  Redux `settings.translateModelPrompt`  preference `feature.translate.model_prompt` |

****:

- `extract-inventory.js`  `db.settings.get/put/add()` **** key key****
- 
- `dexieSettings`  `category`  `preferences`
- `validate-consistency.js`  `dexieSettings`  inventory 
-  `ctx.sources.dexieSettings.get(mapping.originalKey)` 
-  `${}`  pattern 1:1 

### 

| Status               |              |                                  |
| -------------------- | ---------------- | ---------------------------------------- |
| `pending`            |            |  category  targetKey |
| `classified`         |            |                  |
| `classified-deleted` |  |            |

### targetKey 

 `status: "classified"` `targetKey` 

| targetKey |  |  |
| --------- | ---- | -------- |
|  `"ui.theme"` |  |  preferenceSchemas.ts |
| `null` |  |  preferenceSchemas.ts |

**** `status: "classified"`  `targetKey: null`""

---

## 

### 

`originalKey → targetKey`

1. ** (1→N)**:  target keys
2. ** (N→1)**: 
3. **/**: 
4. ****: 

### 

```
┌─────────────────────────────────────────────────────────────┐
│  classification.json (status: classified)                    │
│  ─────────────────────────────────────────                  │
│   target keys                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  target-key-definitions.json                                 │
│  ─────────────────────────────────────────                  │
│  1:  -  target keys          │
│  2:  -  v2  preferences        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  preferenceSchemas.ts ()                             │
└─────────────────────────────────────────────────────────────┘
```

### target-key-definitions.json

 `classification.json`  preference keys

1. ****:  target keys
2. ****:  v2  preferences

****:

```json
{
  "metadata": {
    "version": "1.0.0",
    "description": "Target key definitions...",
    "lastUpdated": "2025-01-18"
  },
  "definitions": [
    {
      "targetKey": "app.window.position.x",
      "type": "number",
      "defaultValue": 0,
      "status": "classified",
      "description": "Window X position (from complex mapping)"
    }
  ]
}
```

****:

|            |  |                                                      |
| -------------- | ---- | -------------------------------------------------------- |
| `targetKey`    | ✓    | preference key                       |
| `type`         | ✓    | TypeScript string, number, boolean,  |
| `defaultValue` | ✓    |  `VALUE: ...`                      |
| `status`       | ✓    | `classified` `pending`                         |
| `description`  |      |                                                  |

#### 

 preference v2  `definitions` 

****:  v2 

```json
{
  "definitions": [
    {
      "targetKey": "feature.new_assistant.enabled",
      "type": "boolean",
      "defaultValue": false,
      "status": "classified",
      "description": "v2 "
    },
    {
      "targetKey": "feature.new_assistant.default_model",
      "type": "string",
      "defaultValue": "gpt-4",
      "status": "classified",
      "description": "v2 "
    }
  ]
}
```

 `npm run generate:preferences`  keys  `preferenceSchemas.ts` 

****:
-  `PreferenceTransformers.ts`  `ComplexPreferenceMappings.ts` 
-  `target-key-definitions.json` 

****:  `description` """v2 "

**defaultValue **:

 classification.json  `VALUE: ...` 

```json
// 
{ "defaultValue": "VALUE: PreferenceTypes.ThemeMode.system" }
// : PreferenceTypes.ThemeMode.system

// 
{ "defaultValue": "VALUE: TRANSLATE_PROMPT" }
// : TRANSLATE_PROMPT

//  null 
{ "defaultValue": "VALUE: null" }
// : null

//  VALUE: 
{ "defaultValue": "light" }
// : 'light'
```

### 



```
src/main/data/migration/v2/migrators/
├── mappings/
│   ├── PreferencesMappings.ts          # 
│   ├── BootConfigMappings.ts           # 
│   └── ComplexPreferenceMappings.ts    # 
├── transformers/
│   └── PreferenceTransformers.ts       # 
├── PreferencesMigrator.ts              # 
└── BootConfigMigrator.ts               # 
```

****:

1.  `target-key-definitions.json`  target keys `status: "classified"`
2.  `PreferenceTransformers.ts` 
3.  `ComplexPreferenceMappings.ts` 
4.  `npm run generate:preferences`  preferenceSchemas.ts

### 

**** target key 

classification.json key

---

## 

### "Module not found" 

```bash
cd v2-refactor-temp/tools/data-classify
npm install
```

### 

1.  `validation-report.md` 
2.  `classification.json` 
3. 

### 

1. ~~ `npm run validate:gen` ~~
2. 
3.  `npm run generate` 

### 



### 

 `classification.json`

- `classification.backup.json`
- Git 
