import SidebarLayout from "@/components/SidebarLayout";
import { Link } from "react-router-dom";

export default function TestPage() {
  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-3">✅ Test Page</h1>
        
        <div className="space-y-3 mb-6">
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800">✅ SidebarLayout is rendering</p>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800">✅ Styling is working (Tailwind CSS)</p>
          </div>

          <div className="p-3 bg-pink-50 border border-pink-200 rounded">
            <p className="text-pink-800">✅ React components are loading</p>
          </div>
        </div>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="font-semibold mb-2">If you see this page, the app is working!</p>
          <p className="text-sm text-yellow-700">
            If the Lemma Report page is blank, there may be an issue with that specific component.
          </p>
        </div>

        <div className="mt-6">
          <Link to="/project/ancient-egyptian/lemma" className="text-blue-600 hover:underline font-semibold">
            Try Lemma Report →
          </Link>
        </div>
      </div>
    </SidebarLayout>
  );
}
