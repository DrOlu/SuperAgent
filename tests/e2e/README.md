# E2E Testing Guide

 SuperAgent  (E2E)  Playwright  Electron 

## 

```
tests/e2e/
├── README.md                 # 
├── global-setup.ts           # 
├── global-teardown.ts        # 
├── fixtures/
│   └── electron.fixture.ts   # Electron  fixture
├── utils/
│   ├── wait-helpers.ts       # 
│   ├── ui-locator.ts         # data-ui contract locator
│   └── index.ts              # 
└── specs/                    # 
    └── app-launch.spec.ts    # 
```

---

## 

### 

1. `pnpm install`
2. `pnpm build`

### 

```bash
#  e2e 
pnpm test:e2e

# 
pnpm test:e2e --headed

# 
pnpm playwright test tests/e2e/specs/app-launch.spec.ts

# 
pnpm playwright test -g "reasonable size"

# 
pnpm playwright test --debug

#  Playwright UI 
pnpm playwright test --ui

# 
pnpm playwright show-report
```

##  E2E 

[](../../docs/references/testing/frontend-testing.md)
Electron E2E 

-  `fixtures/electron.fixture.ts`  `test``expect``electronApp`  `mainWindow`
-  `utils/ui-locator.ts` 
  [UI Semantic Contract](../../docs/references/components/ui-semantic-contract.md)
-  `playwright.config.ts` 

 E2E 

---

## 

 `playwright.config.ts`

- `testDir`:  (`./tests/e2e/specs`)
- `timeout`:  (60)
- `workers`:  (1Electron )
- `retries`:  (CI  2)

---

## 

- [Playwright ](https://playwright.dev/docs/intro)
- [Playwright Electron ](https://playwright.dev/docs/api/class-electron)
