# SuperAgent UI Library Issues Snapshot (2026-04-16)

> 2026-04-16
> `packages/ui`
>  `@cherrystudio/ui`  v2 UI 
>
> **** 
> [`packages/ui/docs/design-token-system.md`](../../../packages/ui/docs/design-token-system.md) 
> [`packages/ui/docs/variable-catalog.md`](../../../packages/ui/docs/variable-catalog.md) 

## 

`packages/ui` 

1. React 
2. 
3. 
4. Storybook / design reference
5. 

 monorepo “”

 `@cherrystudio/ui` “”“ UI ”

## 

### 1. 

`packages/ui/package.json` 

1. `dist`
2. `README.md`

 `exports`  `src/styles/*`

1. `./styles`
2. `./styles/tokens.css`
3. `./styles/theme.css`
4. `./styles/index.css`



1.  workspace 
2.  npm 
3. UI  monorepo 

`./icons` export  `dist/components/icons/index.*` export 



`@cherrystudio/ui` “”“”

### 2. 

 v2 

1. `@cherrystudio/ui`
2. Tailwind CSS
3. shadcn / Radix



1. `EditableNumber`  `antd`
2. `EditableNumber``Scrollbar``Sortable``HorizontalScrollContainer`  `styled-components`
3. `tsdown.config.ts`  `styled-components`  external 
4. `package.json`  devDependencies  `antd``styled-components``@types/styled-components`

“”

1.  API 
2. renderer  UI 
3.  UI 

 UI  v2 UI 

### 3. 

 Shadcn v2 

1. `tokens/**`  foundation 
2. `theme-input.css` 
3. `shadcn.css` 
4. `product.css` 
5.  `theme.css`  Tailwind `@theme inline` 

Renderer  `tailwind.css` 
`--cs-theme-*`  CSS  `--color-*`


### 4. 

 `packages/ui/README.md` 

1.  `HeroUIProvider`
2. 
3. 
4. 



1. 
2. UI “”“”

### 5. 

`packages/ui` 

1. primitives / composites 
2. icons runtime catalog
3. icons source assets
4. icon generation scripts
5. design reference
6. Storybook
7. migration 



1. 
2. 
3.  concerns 
4. 



### 6. 

 `@cherrystudio/ui/lib/utils`  `cn` 

 monorepo 

1. 
2. 
3. 



1.  alias
2.  public API

### 7. 

 `packages/ui` 

1.  primitives
2. CodeEditor 
3. 



1. 
2. 
3.  registry / fallback 
4. 
5. 



“ contract”

## 

### 

1. 
2. UI  `antd` / `styled-components` 
3. renderer  UI 

 UI  v2 

### 

1.  ownership 
2. 
3.  API 



### 

1. 
2. 



## 

### 1. “”



1. `exports` 
2.  workspace 
3. `icons``styles`  export 

“”

### 2.  UI 



1.  v2 UI 
2. 



1.  UI  `antd`
2.  UI  `styled-components`
3. 

### 3.  contract



1. token 
2. theme 
3. runtime 



1.  CSS  contract
2.  UI 
3. renderer 

### 4.  `packages/ui` “”“”

`packages/ui`  UI 

1. 
2.  token / theme contract
3.  runtime 



1. 
2. 
3. 
4. 

## 

“”“”



1.  UI  renderer 
2. 
3. 

 contract 

### 

 `packages/ui`  design system

1.  UI 
2.  UI 
3.  contract 
4. 

### 

#### Phase 1: 



 `@cherrystudio/ui` “”



1.  `package.json`  `exports``files` 
2.  `styles``icons`  export 
3. “workspace-only”“”
4.  renderer  `packages/ui/src/*`
5.  public API 



1. 
2. 
3. 



1.  UI  public API 
2.  package exports
3. renderer 

#### Phase 2: 



 `antd` / `styled-components` “ UI ”



1. 
2. “ /  / ”
3. 
4. 



1. `EditableNumber`
2. `Scrollbar`
3. `HorizontalScrollContainer`
4. `Sortable`



1.  `antd` 
2.  `styled-components` 
3.  compatibility



1. 
2. compatibility 
3. 

#### Phase 3: 



 tokenthemeruntime override 



1. `tokens`: 
2. `theme`:  Tailwind 
3. `runtime override`: 



1.  CSS variable contract
2. 
3.  renderer 
4.  `useUserTheme` 
5. 



1. token “”
2. theme “”
3. runtime override  contract 



1.  `@cherrystudio/ui/styles/theme.css` Tailwind 
2.  CSS  Shadcn 
3. `--color-*`  Tailwind  API
4. `--cs-theme-*`  runtime override input
5.  foundation  `@cherrystudio/ui/styles/tokens.css`



1.  contract 
2. 
3. renderer 

#### Phase 4: 



 `packages/ui`



1. 
2. 
3. design reference
4. Storybook 
5. 



1. `packages/ui` 
2. 
3. UI “”“”



1. 
2. 
3. 

## 



1. 
2.  renderer  `src/*` 
3.  external 
4.  contract  runtime override
5. 



1. 
2. 
3. 

## 

 5  workstream 

### Workstream A: 



1. `package.json`
2. `tsdown.config.ts`
3. 
4. styles/icons export 



1.  export 
2. 

### Workstream B: 



1. 
2. compatibility 
3. 



1.  v2 
2. 

### Workstream C:  contract



1. tokens/theme/runtime override 
2. CSS variable contract
3. renderer 



1.  UI 
2. 

### Workstream D: 



1. runtime icon catalog
2. 
3. 
4. 



1. 
2.  UI “”

### Workstream E: 



1. README 
2. public API 
3. 
4. 



1. 
2. 

## 

### Milestone 1: 



1. renderer  `packages/ui/src/*`
2. styles  icons  export 
3. README 

### Milestone 2: 



1.  UI  `antd`
2.  UI  `styled-components`
3. compatibility 

### Milestone 3: 



1. token/theme/runtime override 
2. 
3.  UI 

### Milestone 4: 



1. `packages/ui` 
2. 
3. UI  v2 UI 

## 



1. `@cherrystudio/ui`  contract
2. renderer  UI 
3.  `antd` / `styled-components`
4.  public contract  internal-only contract
5. 

## 



1.  export “”
2. 
3.  renderer 
4. 

 UI “”

## 

`packages/ui` “”

1. UI 
2. 
3. 
4. 
5. 

 v2  UI  UI 
