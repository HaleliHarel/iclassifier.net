import SidebarLayout from "@/components/SidebarLayout";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <SidebarLayout>
      <div className="max-w-3xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="egyptian-unicode text-3xl text-blue-600 leading-none" aria-hidden="true">𓏛</span>
            <h2 className="text-[28px] sm:text-[34px] font-semibold leading-[110%] tracking-[-0.68px]">
              About iClassifier
            </h2>
          </div>
          <p className="text-base text-gray-700 leading-[150%]">
            iClassifier is a digital research app built for exploring classifier systems across writing systems and languages and studying the unique and common characterstics of linguistic categorizations.
          </p>
        </div>

        <div className="mb-6 bg-green-50 rounded-lg border border-green-200 p-4 space-y-3">
          <h3 className="font-semibold text-lg text-gray-800">Our research goals</h3>
          <p className="text-base text-gray-700 leading-[150%]">
            Our research aims to collect and organize data on systems of linguistic categorization. We established a novel, data-driven approach, to chart systems of classifiers as classifier graphemes (aka determinatives) in complex scripts and as classifier morphemes in languages, and to
            identify what is shared across systems and which features are unique to a given system.
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3">
          <h3 className="font-semibold text-lg text-amber-900">We inquire</h3>
          <p className="text-base text-gray-800 leading-[150%]">
            How do systems of linguistic categorization operate?
          </p>
          <p className="text-base text-gray-800 leading-[150%]">
            How does the phenomenon known as classifiers in modern languages resemble classifiers (aka determinatives) in complex scripts?
          </p>
          <p className="text-base text-gray-800 leading-[150%]">
            What is the semantic scope of a category, and how can it be calculated and defined?
          </p>
          <p className="text-base text-gray-800 leading-[150%]">
            How do classifier morphemes or graphemes develop, and how do they change over time?
          </p>
          <p className="text-base text-gray-800 leading-[150%]">
            How does the use of classifiers differ according to metadata variables such as genres, registers, or linguistic textemes?
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="font-semibold text-lg text-gray-800 mb-2">Learn more</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            For detailed guidance on search, network generation, and classifier analysis, visit the{" "}
            <Link to="/user-manual" className="text-blue-700 hover:underline">
              User Manual
            </Link>
            .
          </p>
        </div>
      </div>
    </SidebarLayout>
  );
}
