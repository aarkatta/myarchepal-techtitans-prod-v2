import { HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const HelpButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/help")}
      aria-label="Help"
      className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all duration-200 flex items-center justify-center"
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  );
};
