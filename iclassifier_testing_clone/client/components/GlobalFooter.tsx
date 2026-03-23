import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function GlobalFooter() {
  const navigate = useNavigate();

  const learnMoreItems = [
    {
      id: "about",
      label: "About",
      icon: "𓏛",
      path: "/about",
    },
    {
      id: "user-manual",
      label: "User Manual",
      icon: "𓀨",
      path: "/user-manual",
    },
    {
      id: "contact-us",
      label: "Contact us",
      icon: "𓀁",
      path: "/contact-us",
    },
    {
      id: "bug-report",
      label: "Bug report",
      icon: "𓆧",
      path: "/bug-report",
    },
  ];

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
          {learnMoreItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm hover:bg-gray-100"
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}
