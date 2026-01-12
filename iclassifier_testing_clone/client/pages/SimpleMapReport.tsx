import SidebarLayout from "@/components/SidebarLayout";

export default function SimpleMapReport() {
  console.log("✅ SimpleMapReport: Component rendering");
  
  return (
    <SidebarLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold">Map Report Test</h1>
        <p>This is a simple test of the MapReport page.</p>
        <div className="mt-4">
          <p>If you can see this, the page is loading correctly.</p>
        </div>
      </div>
    </SidebarLayout>
  );
}