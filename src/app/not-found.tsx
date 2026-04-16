export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-dark-900 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="text-center max-w-sm">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-gray-500 mb-4">Sayfa bulunamadı</p>
        <a href="/" className="text-accent hover:text-accent-hover text-sm font-medium">
          Ana sayfaya dön
        </a>
      </div>
    </div>
  );
}
