import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { HomePage } from '@/pages/HomePage'
import { CompressPage } from '@/pages/CompressPage'
import { ImageToPdfPage } from '@/pages/ImageToPdfPage'
import { PdfEditorPage } from '@/pages/PdfEditorPage'
import { NotFound } from '@/components/not-found'
import { AppHeader } from '@/components/app-header'
import { AppFooter } from '@/components/app-footer'
import { LegalPage } from '@/pages/LegalPage'
import './App.css'

function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col overflow-hidden text-foreground">
      <AppHeader />
      <NotFound
        homeHref="/"
        onGoBack={
          typeof window !== 'undefined' && window.history.length > 1
            ? () => window.history.back()
            : undefined
        }
      />
      <AppFooter />
    </div>
  )
}

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/comprimir-pdf" element={<CompressPage />} />
          <Route path="/imagenes-a-pdf" element={<ImageToPdfPage />} />
          <Route path="/editor-pdf" element={<PdfEditorPage />} />
          <Route path="/comprimir" element={<Navigate to="/comprimir-pdf" replace />} />
          <Route path="/privacy" element={<LegalPage document="privacy" />} />
          <Route path="/terms" element={<LegalPage document="terms" />} />
          <Route path="/web/privacy" element={<LegalPage document="privacy" platform="web" />} />
          <Route path="/web/terms" element={<LegalPage document="terms" platform="web" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  )
}

export default App
