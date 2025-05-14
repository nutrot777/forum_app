import React from "react";
import Header from "./Header";
import Footer from "./Footer";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [location] = useLocation();

  // Don't show the layout on the login page
  if (location === "/login") {
    return <>{children}</>;
  }

  // Redirect to login if not authenticated
  if (!user && location !== "/login") {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
