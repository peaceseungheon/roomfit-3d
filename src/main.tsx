import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './index.css'
import App from './App.tsx'
import { restoreSaved, startAutoSave } from './io/persist'

// 순서 고정: 복원(손상본 백업 포함)이 끝난 뒤에 자동 저장을 시작한다.
restoreSaved()
startAutoSave()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
