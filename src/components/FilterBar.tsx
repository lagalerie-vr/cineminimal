'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronDown, Filter, X, Globe, Languages, Tag, Check, Tv, ArrowUpDown, Search, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const getSortOptions = (type: 'movie' | 'tv') => [
  { id: 'popularity.desc', name: 'Popularity' },
  { id: type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc', name: 'Newest' },
  { id: 'vote_average.desc', name: 'Top Rated' },
  { id: 'revenue.desc', name: 'Box Office' },
];

interface FilterOption {
  id: string | number;
  name: string;
  logo_path?: string;
  iso_639_1?: string;
  iso_3166_1?: string;
  provider_id?: string | number;
  english_name?: string;
  provider_name?: string;
}

interface FilterBarProps {
  genres: FilterOption[];
  languages: FilterOption[];
  countries: FilterOption[];
  providers?: FilterOption[];
  type: 'movie' | 'tv';
}

const FilterBar = ({ genres, languages, countries, providers = [], type }: FilterBarProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  const currentGenre = searchParams.get('with_genres') || '';
  const currentLang = searchParams.get('with_original_language') || '';
  const currentRegion = searchParams.get('with_origin_country') || '';
  const currentProviders = searchParams.get('with_watch_providers') || '';
  const currentSort = searchParams.get('sort_by') || 'popularity.desc';
  const currentCert = searchParams.get('certification') || '';

  const ageRatings = [
    { id: type === 'movie' ? 'G' : 'TV-G', name: 'Kids (G / TV-G)' },
    { id: type === 'movie' ? 'PG' : 'TV-PG', name: 'Young Kids (PG / TV-PG)' },
    { id: type === 'movie' ? 'PG-13' : 'TV-14', name: 'Teens (PG-13 / TV-14)' },
    { id: type === 'movie' ? 'R' : 'TV-MA', name: 'Adults (R / TV-MA)' },
  ];

  const updateFilter = (key: string, value: string, isMulti: boolean = false) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (isMulti) {
      let currentValues = params.get(key)?.split(',').filter(Boolean) || [];
      if (currentValues.includes(value)) {
        currentValues = currentValues.filter(v => v !== value);
      } else {
        currentValues.push(value);
      }
      
      if (currentValues.length > 0) {
        params.set(key, currentValues.join(','));
      } else {
        params.delete(key);
      }
    } else {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    
    router.push(`?${params.toString()}`);
    if (!isMulti) setActiveDropdown(null);
    setFilterSearch('');
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  const FilterDropdown = ({ title, icon: Icon, options, paramKey, activeValue, isMulti = false }: any) => {
    const activeValues = isMulti ? activeValue.split(',').filter(Boolean) : [activeValue];

    const filteredOptions = useMemo(() => {
      if (!filterSearch) return options;
      return options.filter((opt: any) => {
        const name = (opt.name || opt.english_name || opt.provider_name || '').toLowerCase();
        return name.includes(filterSearch.toLowerCase());
      });
    }, [options, filterSearch]);

    return (
      <div className="relative">
        <button
          onClick={() => {
            if (activeDropdown === title) {
              setActiveDropdown(null);
            } else {
              setActiveDropdown(title);
              setFilterSearch('');
            }
          }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all ${
            activeValue ? 'bg-accent/10 border-accent/50 text-accent' : 'bg-white/5 border-white/10 text-muted hover:border-white/20'
          }`}
        >
          <Icon size={16} />
          <span className="text-sm font-medium">
            {isMulti && activeValues.length > 0 
              ? `${activeValues.length} Selected` 
              : options.find((o: any) => String(o.id || o.iso_639_1 || o.iso_3166_1) === activeValue)?.name || 
                options.find((o: any) => String(o.id || o.iso_639_1 || o.iso_3166_1) === activeValue)?.english_name || 
                title}
          </span>
          <ChevronDown size={14} className={`transition-transform ${activeDropdown === title ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {activeDropdown === title && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full mt-2 left-0 w-64 bg-card border border-white/10 rounded-2xl p-2 z-50 shadow-2xl backdrop-blur-xl flex flex-col"
            >
              {/* Internal Dropdown Search */}
              <div className="relative mb-2 px-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                <input
                  autoFocus
                  type="text"
                  placeholder={`Search ${title}...`}
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {!isMulti && !filterSearch && (
                  <button
                    onClick={() => updateFilter(paramKey, '')}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors text-muted"
                  >
                    All {title}s
                  </button>
                )}
                
                {filteredOptions.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-white/30">
                    No {title.toLowerCase()} found
                  </div>
                )}

                {filteredOptions
                  .sort((a: any, b: any) => {
                    const nameA = a.name || a.english_name || a.provider_name;
                    const nameB = b.name || b.english_name || b.provider_name;
                    const codeA = a.iso_639_1 || a.iso_3166_1;
                    const codeB = b.iso_639_1 || b.iso_3166_1;
                    
                    if (codeA === 'ar' || codeA === 'TN') return -1;
                    if (codeB === 'ar' || codeB === 'TN') return 1;
                    
                    return String(nameA).localeCompare(String(nameB));
                  })
                  .map((opt: any) => {
                    const id = String(opt.id || opt.iso_639_1 || opt.iso_3166_1 || opt.provider_id);
                    const name = opt.name || opt.english_name || opt.provider_name;
                    const isActive = activeValues.includes(id);

                    return (
                      <button
                        key={id}
                        onClick={() => updateFilter(paramKey, id, isMulti)}
                        className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive ? 'bg-accent/20 text-accent' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          {opt.logo_path && (
                            <img 
                              src={`https://image.tmdb.org/t/p/original${opt.logo_path}`} 
                              alt={name}
                              className="w-5 h-5 rounded shadow-sm"
                            />
                          )}
                          <span className="truncate">{name}</span>
                        </div>
                        {isActive && <Check size={14} />}
                      </button>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const hasFilters = currentGenre || currentLang || currentRegion || currentProviders || currentCert;

  return (
    <div className="flex flex-wrap items-center gap-4 mb-8">
      <div className="flex items-center space-x-2 text-muted mr-2">
        <Filter size={18} />
        <span className="text-sm font-bold uppercase tracking-widest text-[10px]">Filters</span>
      </div>

      <FilterDropdown 
        title="Genre" 
        icon={Tag} 
        options={genres} 
        paramKey="with_genres" 
        activeValue={currentGenre} 
      />
      
      <FilterDropdown 
        title="Language" 
        icon={Languages} 
        options={languages} 
        paramKey="with_original_language" 
        activeValue={currentLang} 
      />

      <FilterDropdown 
        title="Country" 
        icon={Globe} 
        options={countries} 
        paramKey="with_origin_country" 
        activeValue={currentRegion} 
      />

      {providers.length > 0 && (
        <FilterDropdown 
          title="Services" 
          icon={Tv} 
          options={providers} 
          paramKey="with_watch_providers" 
          activeValue={currentProviders} 
          isMulti={true}
        />
      )}

      <FilterDropdown 
        title="Sort By" 
        icon={ArrowUpDown} 
        options={getSortOptions(type)} 
        paramKey="sort_by" 
        activeValue={currentSort} 
      />

      <FilterDropdown 
        title="Age Rating" 
        icon={ShieldCheck} 
        options={ageRatings} 
        paramKey="certification" 
        activeValue={currentCert} 
      />

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center space-x-1 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <X size={14} />
          <span>Clear All</span>
        </button>
      )}
    </div>
  );
};

export default FilterBar;
