import { useState, useEffect, useRef } from "react";
import { Send, Phone, Clock } from "lucide-react";
import SidebarLayout from "@/components/SidebarLayout";
import { Link } from "react-router-dom";

interface Message {
  id: string;
  sender: "user" | "admin";
  text: string;
  timestamp: Date;
}

export default function ContactUs() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "admin",
      text: "Hello! Welcome to iClassifier. How can we assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [adminOnline, setAdminOnline] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Simulate admin status check
  useEffect(() => {
    const checkAdminStatus = setInterval(() => {
      // In production, this would check against your backend
      setAdminOnline(Math.random() > 0.3);
    }, 30000);

    return () => clearInterval(checkAdminStatus);
  }, []);

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Simulate sending message to backend
    setTimeout(() => {
      const adminMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "admin",
        text: "Thanks for your message! We'll get back to you shortly.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, adminMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Phone className="w-8 h-8 text-blue-600" />
            <h2 className="text-[28px] sm:text-[34px] font-semibold leading-[110%] tracking-[-0.68px]">
              Contact Us
            </h2>
          </div>
          <p className="text-base text-gray-700 leading-[150%]">
            Chat with the iClassifier team to get help with finding data or
            any other inquiry - <br />
            <b>The chat below is human operated and not a chatbot!</b>
          </p>
        </div>

        {/* Status Bar */}
        <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              adminOnline ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <span className="text-sm font-medium text-gray-700">
            {adminOnline
              ? "Admin is online - usually responds within minutes"
              : "Admin is currently offline - we'll respond to your message as soon as possible"}
          </span>
        </div>

        {/* Chat Container */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col h-[500px]">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md rounded-lg p-3 ${
                    message.sender === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <span
                    className={`text-xs mt-2 block ${
                      message.sender === "user"
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-3 bg-white">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  adminOnline
                    ? "Type your message..."
                    : "Message will be received when admin is online..."
                }
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="px-4 py-2 bg-[#F5C842] text-[#0B1F6B] rounded-lg font-semibold hover:bg-[#F1BD2E] active:bg-[#EAB927] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg leading-none text-blue-600" aria-hidden="true">𓇶</span>
            <h3 className="font-semibold text-[#0B1F6B]">Response Time</h3>
            </div>
            <p className="text-sm text-[#0B1F6B]">
              During our working hours our team checks messeges regularly. 
              After hours, we'll get back to you in our next support
              checkup.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-[#0B1F6B] mb-3">Other Ways to Reach Us</h3>
            <div className="text-sm text-[#0B1F6B] space-y-2">
              <div>
                𓏞 Email: iclassifierteam@gmail.com or contact team members and collaborators, 
                <a href="https://iclassifier.net/about/" target="_blank" rel="noopener noreferrer"> through our team page </a>
              </div>
              <p>
                𓆧 For bug reports, use our{" "}
                <Link
                  to="/bug-report"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Bug Report
                </Link>
                {" "}page
              </p>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
