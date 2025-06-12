import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const UserSection: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="hidden sm:flex items-center">
      <div className="flex items-center space-x-1">
        <Avatar className="w-8 h-8">
          <AvatarImage src={`https://ui-avatars.com/api/?name=${user.username}&background=random`} alt={user.username} />
          <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-[#1A1A1B]">{user.username}</span>
      </div>
    </div>
  );
};

export default UserSection;
