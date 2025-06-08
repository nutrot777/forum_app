import { Button } from "@/components/ui/button";

interface FilterOptionsProps {
  currentFilter: string;
  setFilter: (filter: string) => void;
}

const FilterOptions: React.FC<FilterOptionsProps> = ({ currentFilter, setFilter }) => {
  return (
    <div className="flex items-center mb-4 space-x-4">
      <h3 className="font-ibm font-medium">Filter by:</h3>
      <div className="flex space-x-1 text-sm">
        <Button
          className={`px-3 py-1.5 ${
            currentFilter === "recent"
              ? "bg-[#0079D3] text-white"
              : "text-[#1A1A1B] hover:bg-gray-100"
          } rounded-md`}
          onClick={() => setFilter("recent")}
        >
          Recent
        </Button>
        <Button
          className={`px-3 py-1.5 ${
            currentFilter === "helpful"
              ? "bg-[#0079D3] text-white"
              : "text-[#1A1A1B] hover:bg-gray-100"
          } rounded-md`}
          onClick={() => setFilter("helpful")}
        >
          Most Helpful
        </Button>
        <Button
          className={`px-3 py-1.5 ${
            currentFilter === "my"
              ? "bg-[#0079D3] text-white"
              : "text-[#1A1A1B] hover:bg-gray-100"
          } rounded-md`}
          onClick={() => setFilter("my")}
        >
          My Discussions
        </Button>
        <Button
          className={`px-3 py-1.5 ${
            currentFilter === "bookmarks"
              ? "bg-[#0079D3] text-white"
              : "text-[#1A1A1B] hover:bg-gray-100"
          } rounded-md`}
          onClick={() => setFilter("bookmarks")}
        >
          Bookmarks
        </Button>
      </div>
    </div>
  );
};

export default FilterOptions;
