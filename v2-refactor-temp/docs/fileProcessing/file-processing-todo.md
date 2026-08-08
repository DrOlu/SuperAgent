# File Processing TODO

 `v2-file-processing-service` PR  file-processing 

 [`file-processing-service.md`](./file-processing-service.md) TODO

---

## 1. 

 Main-side job API  PR

1. Renderer / preload  `startJob``getJob``cancelJob`
2.  OCR  `window.api.ocr`  file-processing job API
3.  `src/main/services/ocr`  preprocess provider
4.  i18nmigration 

---

## 2. 

 PR  blocker

1.  Renderer job subscription / IPC broadcast
2.  UI job center
3.  DataApi job table
4.  Cache / SharedCache job mirror
5.  OCR IPC  file-processing job API

 UI JobManager progress  job bridge

---

## 3.  TODO

### 3.1 Mistral MIME 

`src/main/services/fileProcessing/processors/mistral/utils.ts`

 Mistral processor  MIME 



1.  file management / file-type resolution  MIME 
2. Mistral processor  MIME 

### 3.2 OV OCR 

`src/main/services/fileProcessing/processors/ovocr/utils.ts`

 OV OCR  processor handler 



1.  `ProcessManagerService` 
2. OV OCR processor 

### 3.3 Tesseract Runtime 

`src/main/services/fileProcessing/processors/tesseract/runtime/TesseractRuntimeService.ts`

 Tesseract runtime  Main  shared worker idle release



1.  `ProcessManagerService` utility process  worker pool worker 
2.  PR  language worker pool  per-task worker

---

## 4. 

1.  Renderer / preload  job API contract 
2.  OCR
3.  OCR / preprocess 
4. i18nmigrationfile managementProcessManager 
