import { useState } from 'react';
import type { EntityOption } from '../types';

interface BuildMenuProps {
  buildings: EntityOption[];
  units: EntityOption[];
  selectedEntity: EntityOption | null;
  onSelect: (option: EntityOption) => void;
  onCancel: () => void;
}

export default function BuildMenu({
  buildings,
  units,
  selectedEntity,
  onSelect,
  onCancel,
}: BuildMenuProps) {
  const [currentPage, setCurrentPage] = useState('buildings'); // 'buildings' or 'units'

  const currentOptions = currentPage === 'buildings' ? buildings : units;

  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-slate-800 text-white rounded-2xl shadow-2xl font-sans flex flex-col h-full">
      <h3 className="text-2xl font-bold mb-6 text-center text-indigo-400">Build Menu</h3>

      {/* Pagination/Category Tabs */}
      <div className="flex justify-center gap-4 mb-6">
        <button
          className={`px-6 py-2 rounded-full text-lg font-semibold transition-all duration-300 ${currentPage === 'buildings'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-700 text-gray-400 hover:bg-indigo-500 hover:text-white'
            }`}
          onClick={() => setCurrentPage('buildings')}
        >
          Buildings
        </button>
        <button
          className={`px-6 py-2 rounded-full text-lg font-semibold transition-all duration-300 ${currentPage === 'units'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-700 text-gray-400 hover:bg-indigo-500 hover:text-white'
            }`}
          onClick={() => setCurrentPage('units')}
        >
          Units
        </button>
      </div>

      {/* Item grid with pagination */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 max-h-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-2">
          {currentOptions.map((option) => (
            <div
              key={option.id}
              className={`p-4 border-2 rounded-xl flex flex-col items-center gap-3 cursor-pointer transition-all duration-300 transform hover:scale-105 ${selectedEntity?.id === option.id
                  ? 'border-green-400 bg-slate-700 shadow-lg'
                  : 'border-slate-700 bg-slate-700 hover:border-indigo-400'
                }`}
              onClick={() => onSelect(option)}
            >
              <img
                src={option.image}
                alt={option.name}
                className="w-20 h-20 object-cover rounded-full border-2 border-slate-600"
              />
              <div className="text-center">
                <span className="font-bold text-lg">{option.name}</span>
                <p className="text-sm text-gray-400 mt-1">${option.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Button */}
      {selectedEntity && (
        <button
          className="mt-6 w-full py-3 bg-red-600 text-white rounded-full font-bold shadow-lg hover:bg-red-700 transition-colors duration-300"
          onClick={onCancel}
        >
          Cancel Selection
        </button>
      )}
    </div>
  );
}
