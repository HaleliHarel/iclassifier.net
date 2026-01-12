import SidebarLayout from "@/components/SidebarLayout";

export default function TestPage() {
  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">✅ Test Page</h1>
        
        <div className="space-y-4 mb-8">
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800">✅ SidebarLayout is rendering</p>
          </div>
          
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800">✅ Styling is working (Tailwind CSS)</p>
          </div>

          <div className="p-4 bg-purple-50 border border-purple-200 rounded">
            <p className="text-purple-800">✅ React components are loading</p>
          </div>
        </div>

        <div className="p-4 bg-amber-50 border border-amber-200 rounded">
          <p className="font-semibold mb-2">If you see this page, the app is working!</p>
          <p className="text-sm text-amber-700">
            If the Lemma Report page is blank, there may be an issue with that specific component.
          </p>
        </div>

        <div className="mt-8">
          <a href="/project/ancient-egyptian/lemma" className="text-blue-600 hover:underline font-semibold">
            Try Lemma Report →
          </a>
        </div>
      </div>
    </SidebarLayout>
  );
}
