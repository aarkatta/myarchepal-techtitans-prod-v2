import { useNavigate } from "react-router-dom";
import { User, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface AccountButtonProps {
  /** Hide on mobile — use when ResponsiveLayout's top bar already renders these icons */
  mobileHidden?: boolean;
}

export const AccountButton = ({ mobileHidden = false }: AccountButtonProps) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${mobileHidden ? 'hidden lg:flex' : ''}`}>
      <button
        className="p-2 hover:bg-muted rounded-full transition-colors"
        onClick={() => navigate("/help")}
        aria-label="Help"
      >
        <HelpCircle className="w-5 h-5 text-muted-foreground" />
      </button>
      <button
        className="p-2 hover:bg-muted rounded-full transition-colors"
        onClick={() => navigate("/account")}
        aria-label="Account"
      >
        <User className="w-5 h-5 text-muted-foreground" />
      </button>
    </div>
  );
};
