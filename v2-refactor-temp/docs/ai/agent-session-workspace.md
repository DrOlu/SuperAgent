## Session / Workspace 

### 1. 

 workspace

1. **User-owned workspace**
   -  workspace renderer 
   - 
   - 
   -  session  user-owned workspace
   - user-owned workspace 
   - runtime 

2. **System-owned workspace**
   - “ workspace / No project” session  workspace 
   -  workspace  session 
   - create  system workspace  `path`
   - system workspace  `path`  system workspace root 
   -  session  session/workspace  workspace 
   -  session 
   - system-owned workspace  create  runtime 

### 2. 

 session 

|  /  |  |
| --- | --- |
|  workspace |  session `workspaceId` |
|  No project |  system workspace row session  |
|  session  workspace |  session  workspace |
|  user-owned workspace session | runtime  |
|  system-owned workspace session | runtime  |
|  user-owned workspace |  workspace  session  workspace row |
|  system-owned session |  system workspace row /  |
|  user-owned workspace |  |
|  system-owned session/workspace |  |
|  system-owned  |  /  |

### 3. 



- `session.workspaceId` ****
- session  workspace row
- workspace row  `path` 
- session create  path 
-  session/workspace 
- 
- user-owned workspace 
- system-owned workspace  runtime 
- system-owned workspace  `path`  create runtime  path 
- system-owned workspace  session  `session.workspaceId -> workspace.id`  workspace  session
- workspace path  runtime 

session  workspace 

### 4. Runtime 

runtime 

 workspace 

1. **User-owned workspace**
   -  directory
   -  directory
   - 
   - 

2. **System-owned workspace**
   - runtime 
   -  path  system workspace root 
   - runtime  system-owned workspace  user-owned workspace 
   - ensure  directory 
   -  directory
   -  runtime 
   -  session/workspace delete 

 `assertClaudeCodeWorkspaceDirectory`  pure assert runtime preparation

```ts
prepareClaudeCodeWorkspaceDirectory(session)
```



```ts
if (session.workspace.type === 'system') {
  ensureSystemWorkspaceDirectory(session.workspace.path)
}

assertClaudeCodeWorkspaceDirectory(session.id, session.workspace.path)
```



- `prepareClaudeCodeWorkspaceDirectory` runtime  workspace 
- `ensureSystemWorkspaceDirectory` system-owned workspace  path  system workspace root 
- `assertClaudeCodeWorkspaceDirectory`
- user-owned workspace 

### 5. 

 session create/delete  filesystem side effect  workflow



- session create  workspace 
-  system-owned session  workspace 
- create/delete  workspace 
-  renderer  IPC  main workflow
- DataApi  session create



“ session ”

-  session 
-  session/workspace 
- workspace path  runtime 
- system-owned workspace  runtime start 
- session create/delete 
- 

 session create/delete  filesystem orchestration

### 6. 

 session create 

1.  session row
2.  `workspaceId`
3.  system workspace row 
4.  system workspace  system workspace root  `path`
5. 
6. 
7.  workspace

 session/workspace delete 

1.  session row
2.  workspace row
3. 
4. 

 DataApi 

“ IPC”

-  workspace 
- session  workspace
- create/delete 
- runtime  system directory ensure  directory validation
- task/channel  session  workspace binding  latest session workspace fallback

### 7. 

****



- user-owned workspace 
- system-owned workspace “ / ”
- session/workspace create/delete 



- session/workspace API 
- runtime  system directory ensure 
- 
- 



### 8. 



-  `POST /agent-sessions`  DataApi 
- “ workspaceId  session workspace”
-  session  workspace 
  - existing user workspace
  - system workspace for No project
- session create  `assertClaudeCodeWorkspaceDirectory`
- session create 
- session/workspace delete 
- runtime 
- runtime  system-owned workspace  mkdir-if-missing
- runtime  system-owned workspace mkdir  path  system workspace root 
- runtime ensure 
- runtime  user-owned workspace 
- user-owned workspace  sessions  workspace row
- system-owned workspace  session  session  workspace row / 
- system-owned workspace  session  `session.workspaceId -> workspace.id` workspace row  session 
- task/channel  session  workspace binding  latest session workspace fallback
- 
-  session create/delete  runtime / cleanup 



> session create/delete  IPC
>  filesystem // DB row  workspace  DataApi 
>  latest workspace  fallback workspace binding 
> system-owned workspace  runtime start user-owned workspace 
> 
