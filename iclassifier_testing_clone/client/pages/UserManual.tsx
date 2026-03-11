import { Search, Zap, Globe } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { Link } from "react-router-dom";

export default function UserManual() {
  return (
    <SidebarLayout>
      <div className="max-w-3xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl leading-none text-blue-600" aria-hidden="true">𓀨</span>
            <h2 className="text-[28px] sm:text-[34px] font-semibold leading-[110%] tracking-[-0.68px]">
              User Manual
            </h2>
          </div>
          <p className="text-base text-gray-700 leading-[150%]">
            Learn how to navigate and use the iClassifier reporting system
          </p>
        </div>

        {/* Table of Contents */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-lg text-gray-800 mb-3">
            Table of Contents
          </h3>
          <ul className="space-y-2">
            <li>
              <a href="#information-types" className="hover:underline text-blue-700">
                • Classifier Analysis (classifier levels and information types)
              </a>
            </li>
            <li>
              <a href="#lemma-search" className="hover:underline text-yellow-700">
                • How to search for lemmas and dictionary entries
              </a>
            </li>
            <li>
              <a href="#classifier-search" className="hover:underline text-blue-700">
                • How to search for classifier categories
              </a>
            </li>
            <li>
              <a href="#network-search" className="hover:underline text-pink-700">
                • How to produce, save and export networks of a classifier, lemma or text selection
              </a>
            </li>
            <li>
              <a href="#advanced-query" className="hover:underline text-gray-700">
                • How to explore the data with the Advanced Queries Page
              </a>
            </li>
            <li>
              <a href="#publications" className="hover:underline text-green-700">
                • Related publications
              </a>
            </li>
          </ul>
        </div>

        {/* Information Types Section */}
        <section id="information-types" className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-6 h-6 text-blue-600" />
            <h3 className="text-2xl font-semibold text-gray-800">Classifier Analysis (classifier levels and information types)</h3>
          </div>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">What are Classifier Information Types?</h4>
              <p className="text-gray-700 leading-relaxed">
                Classifier Information Types refer to different types of semantic information that a sign in the role of classifier can convey. 
                These types help organize and understand the various functions that classifiers serve in ancient writing systems.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <h5 className="font-medium text-gray-800 mb-1">Encyclopedic (also Semantic, Lexical)</h5>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Classifiers that provide semantic or lexical information about the word they classify, 
                  often indicating the conceptual category or domain of the referent.
                  
              
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-800 mb-1">Pragmatic (also referent classifier)</h5>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Classifiers that help identify or specify the particular referent in context, often used to disambiguate between different possible meanings.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-800 mb-1">Derivational (also Grammatical)</h5>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Classifiers that serve grammatical functions, including derivational processes that change word class or meaning systematically.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-800 mb-1">Metatextual</h5>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Classifiers that provide information about the text itself, such as indicating foreign words, quotations, or special textual status.
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-800 mb-1">Phonetic (including false etymology)</h5>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Classifiers used for phonetic purposes, including cases where historical sound changes have obscured the original semantic relationship (false etymology).
                </p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">How to Use These Categories</h4>
              <p className="text-gray-700 leading-relaxed">
                When filtering data by Information Types, you can select multiple categories to focus your analysis on specific types of classifier functions. This is particularly useful for studying semantic networks and understanding how different types of classifiers interact within the ancient writing system.
              </p>
            </div>
          </div>
        </section>

        {/* Lemma Search Section */}
        <section id="lemma-search" className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-6 h-6 text-blue-600" />
            <h3 className="text-2xl font-semibold text-gray-800">
              How to Search for Lemma
            </h3>
          </div>

          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">
                What is a Lemma?
              </h4>
              <p className="text-gray-700 leading-relaxed">
                A lemma is the base form or root of a word in ancient scripts.
                It represents the fundamental meaning unit before any
                grammatical modifications or inflections.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">
                How to Search:
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>Navigate to the "Lemma" section from the left sidebar</li>
                <li>
                  Select a project from the "Choose project" dropdown (e.g.,
                  Egyptian iClassifier, Sumerian iClassifier)
                </li>
                <li>
                  Use the search box to find lemmas by transliteration or meaning
                </li>
                <li>
                  Click on a lemma to view its frequency statistics and
                  co-occurrence patterns
                </li>
                <li>
                  View the network graph showing relationships with classifiers
                </li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Tips:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>
                  Filter by token type: "All tokens", "Standalone", "Compound"
                </li>
                <li>
                  Use partial spelling to search for multiple related lemmas
                </li>
                <li>
                  Export the report of a lemma or a classifier as CSV for further analysis
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Classifier Search Section */}
        <section id="classifier-search" className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-6 h-6 text-blue-600" />
            <h3 className="text-2xl font-semibold text-gray-800">
              How to Search for Classifier
            </h3>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">
                What is a Classifier?
              </h4>
              <p className="text-gray-700 leading-relaxed">
                Classifiers are semantic or functional categories used in ancient
                writing systems to organize and categorize words. They help
                understand the semantic relationships between lemmas.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">
                How to Search:
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>Navigate to the "Classifier" section from the left sidebar</li>
                <li>
                  Select a project to view available classifiers in that dataset
                </li>
                <li>
                  Search for a specific classifier using the search box (optional)
                </li>
                <li>
                  Select a classifier to view its statistics and co-occurrence
                  patterns
                </li>
                <li>
                  Explore which lemmas and tokens are associated with that
                  classifier
                </li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Features:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>View classifier frequency and total occurrences</li>
                <li>Analyze co-occurring classifiers in a network graph</li>
                <li>Export lemma frequencies and co-classifier data as CSV</li>
                <li>
                  See the list of all tokens carrying that classifier
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Network Visualization Section */}
        <section id="network-search" className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-6 h-6 text-blue-600" />
            <h3 className="text-2xl font-semibold text-gray-800">
              How to Use Network Visualization
            </h3>
          </div>

          <div className="bg-pink-50 rounded-lg border border-pink-200 p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Overview</h4>
              <p className="text-gray-700 leading-relaxed">
                The Network visualization displays relationships between lemmas
                and classifiers as an interactive graph. Nodes represent
                linguistic elements, and edges show co-occurrence relationships.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">
                Understanding the Network:
              </h4>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>
                  <strong>Nodes:</strong> Circular elements representing lemmas,
                  classifiers, or scripts
                </li>
                <li>
                  <strong>Edges:</strong> Lines connecting nodes that co-occur
                  together
                </li>
                <li>
                  <strong>Node Size:</strong> Larger nodes indicate higher
                  frequency
                </li>
                <li>
                  <strong>Edge Thickness:</strong> Thicker edges indicate
                  stronger co-occurrence relationships
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Using the Map:</h4>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>Navigate to the "Network" section from the left sidebar</li>
                <li>Select a project to see the overall text distribution</li>
                <li>
                  Use filters to focus on specific scripts or text groups
                </li>
                <li>View the semantic network of lemmas and classifiers</li>
                <li>Hover over nodes to see detailed information</li>
              </ol>
            </div>
          </div>
        </section>

        {/* Advanced Query Section */}
        <section id="advanced-query" className="mb-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-3">
            Advanced Query Features
          </h3>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">
                Regular Expression Search Box
              </h4>
              <p className="text-gray-700 leading-relaxed mb-3">
                The Advanced Query page allows you to search using regular
                expressions (regex) on the MDC (Manuel de Codage) token notation.
              </p>
              <div className="text-sm bg-gray-100 p-3 rounded border border-gray-300 text-gray-800 space-y-2">
                <div className="font-semibold text-gray-700">Examples by project type:</div>
                <div className="font-mono text-sm space-y-1">
                  <div>
                    Ancient Egyptian (hieroglyphic): <code>\bM7[A-Za-z0-9]*A2\b</code> matches tokens starting with M7 and ending with A2.
                  </div>
                  <div>
                    Sumerian / RINAP (cuneiform): <code>\b(LU2|DU|DINGIR)\b</code> matches common sign tokens.
                  </div>
                  <div>
                    Ancient Chinese (Guodian): <code>水|火|木</code> matches tokens containing those characters.
                  </div>
                  <div>
                    Combined filters: regex <code>\bA1.*D21\b</code> plus POS <code>N</code> and a comment containing <code>determinative</code>.
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">
                Semantic Network in Results
              </h4>
              <p className="text-gray-700 leading-relaxed">
                After performing a query, the results display a semantic network
                showing relationships between lemmas and classifiers within your
                filtered dataset.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Tips:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Start with simpler patterns and gradually increase complexity</li>
                <li>Use anchors (^ and $) to match specific positions</li>
                <li>The search is case-insensitive by default</li>
                <li>Invalid regex patterns will show an error message</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Publications Section */}
        <section id="publications" className="mb-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-3">
            Related Publications
          </h3>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-gray-700 mb-3">
              Learn more about the iClassifier project and its methodology in
              our publications:
            </p>
            <a
              href="https://iclassifier.net/publications/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-3 bg-[#F5C842] text-[#0B1F6B] rounded-lg font-semibold hover:bg-[#F1BD2E] active:bg-[#EAB927] transition-colors"
            >
              <Globe className="w-5 h-5" />
              View Publications
            </a>
            <p className="text-sm text-gray-600 mt-3">
              Opens iClassifier.net/publications in a new window
            </p>
          </div>
        </section>

        {/* Contact Section */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-[#0B1F6B] mb-3">
            Need More Help?
          </h3>
          <p className="text-gray-700 mb-3">
            If you have questions or need assistance, feel free to reach out to us:
          </p>
          <div className="space-y-2 text-sm">
            <p>
              𓏞 Email:{" "}
              <a
                href="mailto:iclassifierteam@gmail.com"
                className="text-blue-600 hover:underline"
              >
                iclassifierteam@gmail.com
              </a>
            </p>
            <p>
              𓏛{" "}
              <Link to="/contact-us" className="text-blue-600 hover:underline">
                Contact us directly through our chat
              </Link>
            </p>
            <p>
            𓆧{" "}
              <Link to="/bug-report" className="text-blue-600 hover:underline">
                Report bugs
              </Link>
            </p>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
