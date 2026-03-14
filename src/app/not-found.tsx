export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-gray-500 mb-4">Sayfa bulunamadı</p>
        <a href="/" className="text-accent hover:text-accent-hover text-sm font-medium">
          Ana sayfaya dön
        </a>
      </div>
    </div>
  );
}
