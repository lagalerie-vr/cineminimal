'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import VideoPlayer from './VideoPlayer';
import MovieCard from './MovieCard';
import { Star, Calendar, Users, List, Bookmark, ChevronRight } from 'lucide-react';
import { getImageUrl } from '@/lib/imageUrl';
import WatchlistButton from './WatchlistButton';
import AdSpace from './AdSpace';
import ReviewSection from './ReviewSection';

interface TVPlayerContainerProps {
  show: any;
}

const TVPlayerContainer = ({ show }: TVPlayerContainerProps) => {
  const [activeSeason, setActiveSeason] = useState(1);
  const [activeEpisode, setActiveEpisode] = useState(1);
  
  const currentSeason = show.seasons.find((s: any) => s.season_number === activeSeason);
  const releaseYear = (show.first_air_date || '').split('-')[0];

  return (
    <div className="container mx-auto px-6 -mt-40 relative z-20 space-y-8">
      <AdSpace type="banner" className="mt-8 mb-4 opacity-80" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Player and Details */}
        <div className="lg:col-span-2 space-y-8">
          <VideoPlayer 
            type="tv" 
            id={show.id} 
            imdbId={show.external_ids?.imdb_id} 
            season={activeSeason} 
            episode={activeEpisode} 
            title={show.name}
            posterPath={show.poster_path}
            videos={show.videos.results}
          />
          
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <h1 className="text-4xl md:text-5xl font-bold text-white">{show.name}</h1>
                <div className="flex items-center space-x-4">
                  <WatchlistButton 
                    id={show.id} 
                    type="tv" 
                    title={show.name} 
                    posterPath={show.poster_path} 
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm font-medium text-muted">
                <div className="flex items-center space-x-1">
                  <Star className="text-yellow-500 fill-yellow-500" size={16} />
                  <span className="text-white">{show.vote_average.toFixed(1)}</span>
                </div>
                <div className="flex items-center space-x-1 text-accent">
                  <span>{show.number_of_seasons} Seasons</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar size={16} />
                  <span>{releaseYear}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {show.genres.map((genre: any) => (
                <span key={genre.id} className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/80">
                  {genre.name}
                </span>
              ))}
            </div>

            {/* Episode Selector */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent">
                    <List size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-white">Episodes</h3>
                </div>
                <select 
                  value={activeSeason}
                  onChange={(e) => {
                    setActiveSeason(Number(e.target.value));
                    setActiveEpisode(1);
                  }}
                  className="bg-card border border-white/10 text-white text-sm rounded-xl px-4 py-2 focus:ring-2 focus:ring-accent outline-none"
                >
                  {show.seasons
                    .filter((s: any) => s.season_number > 0)
                    .map((s: any) => (
                      <option key={s.id} value={s.season_number}>
                        Season {s.season_number}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {Array.from({ length: currentSeason?.episode_count || 0 }, (_, i) => i + 1).map((ep) => (
                  <button
                    key={ep}
                    onClick={() => setActiveEpisode(ep)}
                    className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                      activeEpisode === ep 
                        ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' 
                        : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    EP {ep}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-lg text-white/70 leading-relaxed max-w-3xl">
              {show.overview}
            </p>

            {/* Cast */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <Users size={20} className="text-accent" />
                <span>Top Cast</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {show.credits.cast.slice(0, 6).map((person: any) => (
                  <Link 
                    key={person.id} 
                    href={`/person/${person.id}`}
                    className="text-center space-y-2 group"
                  >
                    <div className="relative aspect-square rounded-full overflow-hidden bg-card border border-white/5 group-hover:border-accent transition-all duration-300">
                      <Image 
                        src={getImageUrl(person.profile_path, 'w185')} 
                        alt={person.name}
                        fill
                        sizes="100px"
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-accent transition-colors">{person.name}</p>
                      <p className="text-[10px] text-muted line-clamp-1">{person.character}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Reviews Section */}
            <ReviewSection reviews={show.reviews.results} />
          </div>
        </div>

        {/* Right Column: Recommendations & Ads */}
        <div className="space-y-8 flex flex-col">
          <AdSpace type="portrait" className="flex-1 min-h-[400px]" />
          <h3 className="text-xl font-bold text-white tracking-tight pt-4">Similar Shows</h3>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
            {show.recommendations.results.slice(0, 4).map((rec: any) => (
              <MovieCard 
                key={rec.id}
                id={rec.id}
                title={rec.name}
                posterPath={rec.poster_path}
                rating={rec.vote_average}
                date={(rec.first_air_date || '').split('-')[0]}
                type="tv"
              />
            ))}
          </div>

          <AdSpace type="portrait" className="mt-8" />
        </div>
      </div>
    </div>
  );
};

export default TVPlayerContainer;
