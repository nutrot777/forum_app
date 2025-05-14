import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Rows3, Settings } from "lucide-react";
import UserSection from "./UserSection";

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="bg-white shadow sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Rows3 className="text-[#0079D3] h-6 w-6 mr-2" />
          <h1 className="text-xl font-ibm font-semibold">StudentForum</h1>
        </Link>
        
        {user && (
          <div className="flex items-center space-x-4">
            <UserSection />
            
            <Link href="/settings">
              <Button 
                variant="ghost"
                size="icon"
                className="rounded-full text-gray-700 hover:bg-gray-100"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            
            <Button 
              className="rounded-full px-4 py-1.5 bg-[#0079D3] text-white text-sm font-medium hover:bg-[#0079D3]/90 transition-colors"
              onClick={handleLogout}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Logout</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
