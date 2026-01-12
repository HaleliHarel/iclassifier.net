import { Link } from "react-router-dom";

export default function AppHeader() {
  return (
    <header className="bg-black text-white py-4 px-6 border-b border-gray-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2F9b85a9b7160046d8810aa65084b2d8be%2F76ae63b1df5a400db37e149d10b72c61?format=webp&width=800"
            alt="iClassifier Logo"
            className="h-10 w-auto"
          />
          <div className="text-xl font-semibold">
            <p>Reports</p>
          </div>
        </Link>
        <div className="text-sm text-gray-400">
          <p>Browse through networks of concepts and categories</p>
        </div>
      </div>
    </header>
  );
}
