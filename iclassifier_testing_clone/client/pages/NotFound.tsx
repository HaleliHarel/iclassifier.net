import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <SidebarLayout>
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="text-center max-w-xl">
          <div className="text-6xl font-bold text-gray-900">404</div>
          <p className="mt-4 text-2xl font-semibold text-gray-800">
            Your lost your way!
          </p>
          <p className="mt-2 text-gray-600">
            This page does not exist yet.
            {" "}
            <Link to="/bug-report" className="text-blue-600 hover:underline">
              Report error
            </Link>
            .
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/reports");
                }
              }}
            >
              Go back
            </Button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};

export default NotFound;
