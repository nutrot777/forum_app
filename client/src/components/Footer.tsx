import { Link } from "wouter";

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#1A1A1B] text-white py-5 mt-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm">&copy; {new Date().getFullYear()} StudentForum. All rights reserved.</p>
          </div>
          <div className="flex space-x-4">
            <Link href="#" className="text-gray-400 hover:text-white">Terms</Link>
            <Link href="#" className="text-gray-400 hover:text-white">Privacy</Link>
            <Link href="#" className="text-gray-400 hover:text-white">Help</Link>
            <Link href="#" className="text-gray-400 hover:text-white">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
