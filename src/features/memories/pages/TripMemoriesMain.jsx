import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  CalendarDays,
  Check,
  ChevronDown,
  CloudSun,
  Footprints,
  Grid2X2,
  Heart,
  ImagePlus,
  Images,
  List,
  MapPin,
  Pause,
  Play,
  Plus,
  Share2,
  Sparkles,
  Star,
  Trash2,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import memoryApi from '../../../services/api/memory_api.js';
import memoryPhotoApi from '../../../services/api/memory_photo_api.js';
import { resolveApiUrl } from '../../../services/api/httpClient.js';
import tripApi from '../../../services/api/tripapi.js';
import { useAuth } from '../../../app/providers/authContext.js';

const sampleJournal = [
  {
    day: 1,
    date: 'Saturday, Dec 20',
    place: 'BANGKOK',
    title: 'Arrival in the City of Angels & Night River Cruise',
    location: 'Seminyak Beach & Canggu, Bali',
    note: 'Bali welcomed us with warm air, the scent of frangipani, and a thousand little moments. We watched the sun slip into the Indian Ocean before wandering toward the lantern-lit food stalls.',
    tags: ['#Bali', '#StreetFood', '#IslandSunset'],
    photos: [
      {
        src: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=85',
        alt: 'Bali coastline and tropical greenery at golden hour',
        caption: 'Bali Golden Hour',
      },
      {
        src: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=800&q=85',
        alt: 'Palm trees and island landscape in Bali',
        caption: 'Island Breeze',
      },
      {
        src: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=800&q=85',
        alt: 'A glowing sunset over an Indonesian island',
        caption: 'Last Light on the Coast',
      },
    ],
    reactions: 4,
  },
  {
    day: 2,
    date: 'Sunday, Dec 21',
    place: 'YOGYAKARTA',
    title: 'Ancient Stone at Borobudur & Sunset over Prambanan',
    location: 'Borobudur & Prambanan, Yogyakarta',
    note: 'We wandered among centuries-old stone carvings as the morning mist lifted, then let the day wind down beneath the temple silhouettes. Every quiet corner seemed to hold another story.',
    tags: ['#Yogyakarta', '#TempleTrails', '#GoldenHour'],
    photos: [
      {
        src: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=1200&q=85',
        alt: 'Ancient stone temple surrounded by green landscape',
        caption: 'First light at Borobudur',
      },
      {
        src: 'https://images.unsplash.com/photo-1577717903315-1691ae25ab3f?auto=format&fit=crop&w=800&q=85',
        alt: 'Carved stonework at an Indonesian temple',
        caption: 'Stories in the stone',
      },
      {
        src: 'https://images.unsplash.com/photo-1604999333679-b86d54738315?auto=format&fit=crop&w=800&q=85',
        alt: 'Temple towers at sunset in Java',
        caption: 'Prambanan at dusk',
      },
    ],
    reactions: 7,
    weather: '32°C Sunny',
  },
  {
    day: 3,
    date: 'Monday, Dec 22',
    place: 'UBUD',
    title: 'Ubud Rice Terraces & a Slow Morning on the Forest Trails',
    location: 'Tegallalang & Ubud, Bali',
    note: 'We left the busy lanes behind for a quiet walk through emerald rice terraces and shady forest paths. No rushing, just birdsong, cool morning air, and time together.',
    tags: ['#Ubud', '#RiceTerraces', '#SlowTravel'],
    photos: [
      {
        src: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1000&q=85',
        alt: 'Lush green rice terraces in Bali',
        caption: 'A slow morning in Ubud',
      },
      {
        src: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=900&q=85',
        alt: 'A green walking trail through the Indonesian countryside',
        caption: 'The forest trail',
      },
    ],
    reactions: 6,
    audio: 'Morning walk through the Ubud forest',
  },
];

const companionAvatars = [
  { name: 'Sovan Dara', initials: 'SD', color: 'bg-slate-100 text-slate-600' },
  { name: 'Mina Chan', initials: 'MC', color: 'bg-teal-50 text-teal-700' },
  { name: 'Dara Kim', initials: 'DK', color: 'bg-slate-200 text-slate-700' },
];

function getDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDayDate(value, fallbackDay) {
  const date = getDate(value);
  if (!date) return fallbackDay === 1 ? 'Saturday, Dec 20' : `Day ${String(fallbackDay).padStart(2, '0')}`;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function mapBackendMemories(records, photos) {
  const chronological = [...records].sort(
    (left, right) => new Date(left.memory_date) - new Date(right.memory_date),
  );
  const firstDate = getDate(chronological[0]?.memory_date);

  return chronological.map((record, index) => {
    const date = getDate(record.memory_date);
    const day = date && firstDate
      ? Math.max(1, Math.floor((date - firstDate) / 86_400_000) + 1)
      : index + 1;
    const recordPhotos = photos
      .filter((photo) => String(photo.memory_id) === String(record.id))
      .map((photo) => ({
        src: photo.image_path,
        alt: photo.caption || record.title || 'Trip memory photo',
        caption: photo.caption || 'A moment from the trip',
      }))
      .filter((photo) => photo.src);
    const fallback = sampleJournal[(day - 1) % sampleJournal.length];

    return {
      id: record.id,
      trip_id: record.trip_id,
      day,
      date: formatDayDate(record.memory_date, day),
      place: String(record.location || 'THAILAND').split(',')[0].toUpperCase(),
      title: record.title || 'A day to remember',
      location: record.location || 'Indonesia',
      note: record.description || 'A little moment, saved for the days when we want to remember.',
      tags: fallback.tags,
      photos: recordPhotos.length ? recordPhotos : fallback.photos,
      reactions: fallback.reactions,
      weather: fallback.weather,
      audio: fallback.audio,
    };
  });
}

function Avatar({ initials, color, className = '' }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full border-2 border-white text-[10px] font-bold ${color} ${className}`}>
      {initials}
    </span>
  );
}

function StatBadge({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-33 items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <span>
        <span className="block whitespace-nowrap text-[11px] font-bold text-slate-800">{value}</span>
        <span className="mt-0.5 block whitespace-nowrap text-[9px] font-semibold text-slate-500">{label}</span>
      </span>
    </div>
  );
}

function JournalPhotoImage({ photo, className }) {
  const { accessToken } = useAuth();
  const [imageSource, setImageSource] = useState('');
  const [loadError, setLoadError] = useState(false);
  const isPrivateUpload = photo.src.startsWith(
    '/api/v1/memory-photos/files/',
  );

  useEffect(() => {
    if (!isPrivateUpload) {
      setImageSource(photo.src);
      setLoadError(false);
      return undefined;
    }

    const abortController = new AbortController();
    let objectUrl = '';
    let active = true;
    setImageSource('');
    setLoadError(false);

    async function loadImage() {
      try {
        const response = await fetch(resolveApiUrl(photo.src), {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {},
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Photo request failed (HTTP ${response.status}).`);
        }
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) {
          setImageSource(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
          objectUrl = '';
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Could not load uploaded memory photo:', error);
        if (active) setLoadError(true);
      }
    }

    void loadImage();
    return () => {
      active = false;
      abortController.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, isPrivateUpload, photo.src]);

  if (loadError) {
    return (
      <div
        aria-label={`${photo.alt} (could not be loaded)`}
        className={`${className} bg-slate-100`}
        role="img"
      />
    );
  }
  if (!imageSource) {
    return (
      <div
        aria-label={`Loading ${photo.alt}`}
        aria-busy="true"
        className={`${className} animate-pulse bg-slate-100`}
        role="img"
      />
    );
  }
  return (
    <img
      alt={photo.alt}
      className={className}
      loading="lazy"
      src={imageSource}
    />
  );
}

function PhotoGrid({ photos, day }) {
  const photoSet = photos.length >= 3 ? photos.slice(0, 3) : [...photos, ...sampleJournal[(day - 1) % sampleJournal.length].photos].slice(0, 3);

  return (
    <div className="grid h-70 grid-cols-[1.4fr_1fr] gap-2 overflow-hidden rounded-xl bg-slate-100 sm:h-80">
      <figure className="group relative min-h-0 overflow-hidden rounded-xl">
        <JournalPhotoImage
          photo={photoSet[0]}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 to-transparent px-4 pb-3 pt-12">
          <figcaption className="text-[11px] font-semibold tracking-wide text-white">{photoSet[0].caption}</figcaption>
        </div>
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-700 backdrop-blur-sm">
          <Images size={12} /> Day {String(day).padStart(2, '0')} · Feature
        </span>
      </figure>
      <div className="grid min-h-0 grid-rows-2 gap-2">
        {photoSet.slice(1, 3).map((photo, index) => (
          <figure key={`${photo.src}-${index}`} className="group relative min-h-0 overflow-hidden rounded-xl">
            <JournalPhotoImage
              photo={photo}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 to-transparent px-3 pb-2.5 pt-8">
              <figcaption className="text-[10px] font-semibold tracking-wide text-white">{photo.caption}</figcaption>
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}

function ReactionSummary({ count }) {
  return (
    <button
      type="button"
      aria-label={`${count} reactions from your travel companions`}
      className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-white/80"
    >
      <span className="flex -space-x-2">
        {companionAvatars.map((person) => (
          <Avatar key={person.initials} initials={person.initials} color={person.color} className="h-6 w-6" />
        ))}
      </span>
      <span className="whitespace-nowrap text-[9px] font-semibold text-slate-500">All Reactions {count}</span>
      <Heart size={13} className="text-teal-700" />
    </button>
  );
}

function JournalCard({ memory, viewMode, playing, onToggleAudio, onDelete }) {
  const canDelete = typeof memory?.id !== 'undefined' && memory.id !== null && typeof onDelete === 'function';

  return (
    <article className="relative pb-1 pl-10 sm:pl-12">
      <span className="absolute bottom-0 left-3 top-0 w-px bg-slate-200 sm:left-3.75" />
      <span className="absolute left-1.25 top-5 z-10 grid h-3.75 w-3.75 place-items-center rounded-full border-[3px] border-slate-50 bg-teal-700 ring-2 ring-teal-100 sm:left-2">
        <span className="h-1 w-1 rounded-full bg-white" />
      </span>
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="rounded-md bg-teal-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-teal-800">
                DAY {String(memory.day).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">{memory.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.11em] text-slate-600">
                <MapPin size={12} className="text-teal-700" /> {memory.place}
              </span>
              {canDelete && (
                <button
                  type="button"
                  aria-label={`Delete ${memory.title}`}
                  title="Delete memory"
                  onClick={() => onDelete(memory)}
                  className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
          <h2 className="max-w-3xl text-[17px] font-bold leading-snug tracking-tight text-slate-900 sm:text-[20px]">
            {memory.title}
          </h2>
          <div className="mb-4 mt-2 flex flex-wrap items-center gap-2.5 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
              <MapPin size={12} className="text-teal-700" /> {memory.location}
            </span>
            {memory.weather && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1.5 font-semibold text-teal-800">
                <CloudSun size={12} /> {memory.weather}
              </span>
            )}
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {memory.photos.map((photo, index) => (
                <figure key={`${photo.src}-${index}`} className="group relative aspect-4/3 overflow-hidden rounded-xl bg-slate-100">
                  <JournalPhotoImage photo={photo} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-3 pb-2 pt-7 text-[9px] font-semibold text-white">{photo.caption}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <PhotoGrid photos={memory.photos} day={memory.day} />
          )}

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-teal-800">
                Journal Entry <span className="mx-1 text-slate-400">by</span> Sovan Dara
              </p>
              <ReactionSummary count={memory.reactions} />
            </div>
            <p className="mt-2 text-[11px] leading-[1.85] text-slate-600 sm:text-[12px]">{memory.note}</p>
            {memory.audio && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
                <button
                  type="button"
                  aria-label={playing ? 'Pause audio memory' : 'Play audio memory'}
                  onClick={onToggleAudio}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-700 text-white transition hover:bg-teal-800"
                >
                  {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                </button>
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-700">{memory.audio}</span>
                <span className="hidden items-center gap-0.75 sm:flex" aria-hidden="true">
                  {[10, 17, 12, 23, 15, 20, 11, 24, 17, 12, 21, 14, 19, 9, 17, 24, 12, 20].map((height, index) => (
                    <span key={`${height}-${index}`} className={`w-0.75 rounded-full ${playing && index < 8 ? 'bg-teal-700' : 'bg-teal-100'}`} style={{ height: `${height}px` }} />
                  ))}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold tracking-wide text-slate-600">
                  <AudioLines size={11} /> SPATIAL
                </span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {memory.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-teal-800">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

function SidebarWidgets({ onShare }) {
  return (
    <aside aria-label="Trip memory highlights" className="space-y-4 lg:col-span-4">
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[12px] font-bold text-slate-900">TripOS Smart Reel</h2>
            <p className="mt-1 text-[9px] text-slate-500">Seven days, in one little film</p>
          </div>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-700"><Sparkles size={15} /></span>
        </div>
        <button type="button" aria-label="Play Indonesia trip reel" className="group relative block h-40 w-full overflow-hidden rounded-xl bg-slate-800 text-left">
          <img src={sampleJournal[0].photos[0].src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" />
          <span className="absolute inset-0 bg-linear-to-t from-black/70 via-black/5 to-transparent" />
          <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-white/25 text-white backdrop-blur"><Play size={17} fill="currentColor" /></span>
          <span className="absolute bottom-3 left-3 text-white">
            <span className="block text-[11px] font-bold">Indonesia, through our eyes</span>
            <span className="mt-1 block text-[9px] text-white/75">7 days · 142 moments</span>
          </span>
          <span className="absolute bottom-3 right-3 rounded bg-black/40 px-1.5 py-1 text-[8px] font-bold text-white">1:02</span>
        </button>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[12px] font-bold text-slate-900">Little trip superlatives</h2>
          <Star size={15} className="text-teal-700" />
        </div>
        {[
          ['✦', 'Best meal', 'Nasi campur in Ubud', 'bg-teal-50 text-teal-700'],
          ['⌖', 'Favorite landmark', 'Borobudur at first light', 'bg-slate-100 text-slate-600'],
          ['☺', 'Funniest moment', 'Our scooter map debate', 'bg-teal-50 text-teal-700'],
        ].map(([icon, title, detail, color], index) => (
          <div key={title} className="flex items-center gap-2.5 border-t border-slate-100 py-2.5 first:border-0 first:pt-0 last:pb-0">
            <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${color}`}>{icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold text-slate-700">{title}</span>
              <span className="mt-0.5 block truncate text-[9px] text-slate-500">{detail}</span>
            </span>
            <span className="text-[9px] font-bold text-slate-400">0{index + 1}</span>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[12px] font-bold text-slate-900">The people in these pages</h2>
            <p className="mt-1 text-[9px] text-slate-500">Shared album · 142 captures</p>
          </div>
          <span className="flex -space-x-2">
            {companionAvatars.map((person) => <Avatar key={person.initials} initials={person.initials} color={person.color} className="h-7 w-7" />)}
          </span>
        </div>
        {companionAvatars.map((person, index) => (
          <div key={person.initials} className="flex items-center gap-2.5 py-1.5">
            <Avatar initials={person.initials} color={person.color} className="h-7 w-7" />
            <span className="flex-1 text-[10px] font-semibold text-slate-700">{person.name}</span>
            <span className="text-[9px] text-slate-500">{[48, 36, 29][index]} photos</span>
          </div>
        ))}
        <button type="button" onClick={onShare} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-[9px] font-bold text-teal-700 transition hover:bg-teal-50">
          <UsersRound size={13} /> Share with companions
        </button>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[12px] font-bold text-slate-900">Route footprint</h2>
            <p className="mt-1 text-[9px] text-slate-500">A little map of a big week</p>
          </div>
          <Footprints size={16} className="text-teal-700" />
        </div>
        <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <span className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(#94a3b8 0.8px, transparent 0.8px)', backgroundSize: '14px 14px' }} />
          <svg viewBox="0 0 300 115" className="absolute inset-0 h-full w-full" role="img" aria-label="Route through Bali, Yogyakarta, and Komodo">
            <path d="M70 75 C81 61 92 52 108 48 S126 30 142 28 S162 51 180 55 S203 37 224 28" fill="none" stroke="#0f766e" strokeDasharray="4 5" strokeLinecap="round" strokeWidth="2.5" />
            <path d="M70 75 C99 94 121 91 142 79 S164 59 180 55" fill="none" stroke="#64748b" strokeDasharray="3 5" strokeLinecap="round" strokeWidth="2" />
            <circle cx="70" cy="75" r="5" fill="#0f766e" stroke="white" strokeWidth="3" />
            <circle cx="142" cy="28" r="5" fill="#0f766e" stroke="white" strokeWidth="3" />
            <circle cx="180" cy="55" r="5" fill="#475569" stroke="white" strokeWidth="3" />
            <text x="42" y="98" fill="#475569" fontSize="8" fontWeight="600">Bali</text>
            <text x="119" y="17" fill="#475569" fontSize="8" fontWeight="600">Yogyakarta</text>
            <text x="187" y="70" fill="#475569" fontSize="8" fontWeight="600">Komodo</text>
          </svg>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[9px] font-medium text-slate-500">Distance wandered</span>
          <span className="text-[12px] font-extrabold text-slate-800">1,284 <span className="text-[9px] font-medium">km</span></span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['Bali · 3 days', 'Yogyakarta · 2 days', 'Komodo · 2 days'].map((place) => (
            <span key={place} className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold text-slate-600">{place}</span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function AddMemoryDialog({ trips, saving, error, isSignedIn, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [memoryDate, setMemoryDate] = useState('2026-12-20');
  const [tripId, setTripId] = useState(() => String(trips[0]?.id || ''));

  useEffect(() => {
    const previews = photoFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setPhotoPreviews(previews);
    return () => previews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [photoFiles]);

  function handlePhotoFileChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const supportedTypes = new Set([
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    const validFiles = [];
    const rejectedFiles = [];
    for (const file of files) {
      if (!supportedTypes.has(file.type)) {
        rejectedFiles.push(`${file.name}: unsupported image format`);
      } else if (file.size > 10 * 1024 * 1024) {
        rejectedFiles.push(`${file.name}: larger than 10 MB`);
      } else {
        validFiles.push(file);
      }
    }
    if (validFiles.length) {
      setPhotoFiles((current) => {
        const existing = new Set(
          current.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
        );
        return [
          ...current,
          ...validFiles.filter((file) => {
            const key = `${file.name}:${file.size}:${file.lastModified}`;
            if (existing.has(key)) return false;
            existing.add(key);
            return true;
          }),
        ];
      });
    }
    setPhotoError(
      rejectedFiles.length
        ? `Some files were not added. ${rejectedFiles.join('; ')}.`
        : '',
    );
  }

  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <form
        aria-labelledby="add-memory-title"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            trip_id: Number(tripId),
            title,
            description,
            location,
            memory_date: memoryDate,
            photoFiles,
            photoCaption: photoCaption.trim(),
          });
        }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-teal-700">Keep this moment</p>
            <h2 id="add-memory-title" className="mt-1 text-xl font-bold text-slate-900">Add to your journal</h2>
          </div>
          <button type="button" aria-label="Close" disabled={saving} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={17} /></button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        {!isSignedIn && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Sign in to save a memory to your account. The sample journal is available to preview.
          </p>
        )}
        {isSignedIn && !trips.length && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            There are no trips in the backend yet. Create a trip before saving memories. The sample journal remains available to preview the page.
          </p>
        )}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Trip
            <select value={tripId} onChange={(event) => setTripId(event.target.value)} disabled={!isSignedIn || !trips.length || saving} required className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
              {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Memory title
            <input required maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A little moment to remember" className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Date
              <input required type="date" value={memoryDate} onChange={(event) => setMemoryDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Location
              <input maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Where it happened" className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Field note
            <textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Write down what you want to remember..." className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal leading-5 text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
          </label>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <label className="block text-sm font-medium text-slate-700" htmlFor="memory-photo-file">
              <span className="inline-flex items-center gap-2">
                <ImagePlus aria-hidden="true" className="text-teal-700" size={16} />
                Add photos from your device (optional)
              </span>
              <input
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="mt-2 block w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-600 file:mr-3 file:cursor-pointer file:border-0 file:bg-teal-50 file:px-3 file:py-2.5 file:font-semibold file:text-teal-800"
                disabled={saving}
                id="memory-photo-file"
                onChange={handlePhotoFileChange}
                multiple
                type="file"
              />
            </label>
            <p className="mt-1.5 text-xs font-normal leading-5 text-slate-500">
              Select multiple photos from your computer or phone library. JPEG, PNG, GIF, or WebP, up to 10 MB each.
            </p>
            {photoError && (
              <p className="mt-2 text-xs text-rose-700" role="alert">{photoError}</p>
            )}
            {photoFiles.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photoPreviews.slice(0, 8).map(({ file, url }) => (
                  <img
                    key={`${file.name}:${file.size}:${file.lastModified}`}
                    alt={file.name}
                    className="aspect-square w-full rounded-lg bg-white object-cover"
                    src={url}
                    title={file.name}
                  />
                ))}
              </div>
            )}
            {photoFiles.length > 0 && (
              <p className="mt-2 text-xs font-medium text-slate-600">
                {photoFiles.length} {photoFiles.length === 1 ? 'photo' : 'photos'} selected
                {photoFiles.length > 8 && ` · ${photoFiles.length - 8} more`}
              </p>
            )}
            {photoFiles.length > 0 && (
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Photo caption (optional)
                <input
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  disabled={saving}
                  maxLength={255}
                  onChange={(event) => setPhotoCaption(event.target.value)}
                  placeholder="Describe this moment"
                  value={photoCaption}
                />
              </label>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={saving || !isSignedIn || !trips.length} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Saving...' : <><Plus size={13} /> Save memory</>}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function TripMemoriesMain() {
  const { accessToken } = useAuth();
  const [memories, setMemories] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('timeline');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const loadData = useCallback(async (isCurrent = () => true) => {
    if (!accessToken) {
      return;
    }
    const [memoryResult, photoResult, tripResult] = await Promise.allSettled([
      memoryApi.list(),
      memoryPhotoApi.list(),
      tripApi.list(),
    ]);
    if (!isCurrent()) return;

    const messages = [];
    if (memoryResult.status === 'fulfilled' && Array.isArray(memoryResult.value)) {
      setMemories(memoryResult.value);
    } else {
      const reason = memoryResult.status === 'rejected' ? memoryResult.reason : new Error('The memories response was not a list.');
      console.error('Could not load trip memories:', reason);
      messages.push(reason instanceof Error ? reason.message : 'Could not load trip memories.');
      setMemories([]);
    }
    if (photoResult.status === 'fulfilled' && Array.isArray(photoResult.value)) {
      setPhotos(photoResult.value);
    } else {
      const reason = photoResult.status === 'rejected' ? photoResult.reason : new Error('The memory photos response was not a list.');
      console.error('Could not load memory photos:', reason);
      messages.push(reason instanceof Error ? reason.message : 'Could not load memory photos.');
      setPhotos([]);
    }
    if (tripResult.status === 'fulfilled' && Array.isArray(tripResult.value)) {
      setTrips(tripResult.value);
    } else {
      const reason = tripResult.status === 'rejected' ? tripResult.reason : new Error('The trips response was not a list.');
      console.error('Could not load trips for memories:', reason);
      messages.push(reason instanceof Error ? reason.message : 'Could not load trips.');
      setTrips([]);
    }
    setLoadError(messages.join(' '));
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    if (!accessToken) return undefined;
    void Promise.resolve().then(() => loadData(() => active));
    return () => {
      active = false;
    };
  }, [accessToken, loadData, reloadKey]);

  const indonesiaTrip = trips.find((trip) => /indonesia/i.test(trip.name || ''));
  const tripMemories = useMemo(() => {
    if (!memories.length) return [];
    const selectedRecords = indonesiaTrip
      ? memories.filter((memory) => String(memory.trip_id) === String(indonesiaTrip.id))
      : memories;
    return mapBackendMemories(selectedRecords, photos);
  }, [memories, photos, indonesiaTrip]);
  const usingSampleData = tripMemories.length === 0;
  const journal = usingSampleData ? sampleJournal : tripMemories;

  const filteredJournal = useMemo(() => {
    if (activeTab === 'all') return journal;
    const day = Number(activeTab);
    return journal.filter((memory) => memory.day === day);
  }, [activeTab, journal]);

  async function handleShare() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is not available in this browser.');
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Journal link copied to clipboard.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not copy the journal link.');
    }
  }

  async function handleDeleteMemory(memory) {
    if (!memory?.id || !accessToken) return;
    if (!window.confirm(`Delete "${memory.title}" from this trip journal? This cannot be undone.`)) {
      return;
    }

    setActionError('');
    try {
      const memoryPhotoIds = photos
        .filter((photo) => String(photo.memory_id) === String(memory.id))
        .map((photo) => photo.id);

      for (const photoId of memoryPhotoIds) {
        await memoryPhotoApi.remove(photoId);
      }
      await memoryApi.remove(memory.id);

      setMemories((current) => current.filter((item) => item.id !== memory.id));
      setPhotos((current) => current.filter((photo) => !memoryPhotoIds.includes(photo.id)));
      setNotice(`"${memory.title}" was deleted from the journal.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      console.error('Could not delete trip memory:', error);
      setActionError(error instanceof Error ? error.message : 'Could not delete this memory.');
    }
  }

  async function handleSaveMemory(payload) {
    if (!accessToken) {
      setActionError('Sign in to save a memory to your account.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    try {
      const {
        photoFiles,
        photoCaption,
        ...memoryPayload
      } = payload;
      const createdMemory = await memoryApi.create(memoryPayload);
      let photoSaveError = '';
      let uploadedPhotoCount = 0;
      if (photoFiles.length) {
        try {
          if (createdMemory?.id == null) {
            throw new Error('The saved memory did not include an ID for its photo.');
          }
          const uploadErrors = [];
          for (const file of photoFiles) {
            try {
              await memoryPhotoApi.upload({
                memoryId: createdMemory.id,
                file,
                caption: photoCaption || '',
              });
              uploadedPhotoCount += 1;
            } catch (error) {
              uploadErrors.push(
                `${file.name}: ${error instanceof Error ? error.message : 'upload failed'}`,
              );
            }
          }
          if (uploadErrors.length) {
            photoSaveError = `Memory saved; ${uploadedPhotoCount} of ${photoFiles.length} photos uploaded. ${uploadErrors.join('; ')}`;
          }
        } catch (error) {
          console.error('Memory was saved, but its photo could not be attached:', error);
          photoSaveError = error instanceof Error
            ? `Memory saved, but its photo could not be attached: ${error.message}`
            : 'Memory saved, but its photo could not be attached.';
        }
      }
      setIsDialogOpen(false);
      const photoWasAdded = uploadedPhotoCount > 0;
      setNotice(
        photoSaveError
          ? ''
          : photoWasAdded
            ? `Memory and ${uploadedPhotoCount} ${uploadedPhotoCount === 1 ? 'photo' : 'photos'} saved to your trip journal.`
            : 'Memory saved to your trip journal.',
      );
      setActionError(photoSaveError);
      setLoading(true);
      setReloadKey((key) => key + 1);
    } catch (error) {
      console.error('Could not save trip memory:', error);
      setActionError(error instanceof Error ? error.message : 'Could not save this memory.');
    } finally {
      setIsSaving(false);
    }
  }

  const dayTabs = [
    { id: 'all', label: 'All Days (7)' },
    { id: '1', label: 'Day 1: Bali' },
    { id: '2', label: 'Day 2: Yogyakarta' },
    { id: '3', label: 'Day 3: Ubud' },
  ];

  return (
    <main className="min-h-full bg-slate-50 p-5 pb-16 text-slate-800 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
              After the journey
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Trip memories
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Keep the moments, photos, and stories from your trips together.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-start">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setActionError(''); setIsDialogOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800">
                <Plus size={15} /> Add Memory / Photo Drop
              </button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                <ArrowDownToLine size={14} /> Export PDF
              </button>
              <button type="button" onClick={handleShare} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                <Share2 size={14} /> Share Link
              </button>
            </div>
          <a href="/trips" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800">
            View full trip summary <ArrowRight size={14} />
          </a>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          <StatBadge icon={CalendarDays} value="7 Days" label="TRAVELED" />
          <StatBadge icon={MapPin} value="14 Places" label="VISITED" />
          <StatBadge icon={UsersRound} value="3 Companions" label="TOGETHER" />
          <StatBadge icon={Images} value="142 Captures" label="COLLECTED" />
          <StatBadge icon={Wallet} value="$742.50" label="TOTAL SPENT" />
        </div>

        {notice && (
          <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-2.5 text-[11px] font-medium text-teal-800">
            <span className="flex items-center gap-2"><Check size={14} />{notice}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')} className="rounded p-1 hover:bg-teal-100"><X size={14} /></button>
          </div>
        )}

        {loadError && (
          <div role="alert" className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>Some journal data could not be loaded from the backend: {loadError} {usingSampleData ? 'Showing the sample journal instead.' : ''}</span>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="shrink-0 font-bold underline underline-offset-2">Retry</button>
          </div>
        )}
        {actionError && !isDialogOpen && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{actionError}</p>}
        {usingSampleData && !loadError && !loading && (
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-semibold text-slate-600">
            <Sparkles size={11} /> Sample journal preview — add a memory to connect this trip to your account.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
          <nav aria-label="Filter journal by day" className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {dayTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative shrink-0 px-3.5 py-3 text-[10px] font-bold transition sm:px-4 ${
                  activeTab === tab.id ? 'text-teal-800' : 'text-slate-500 hover:text-teal-800'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-teal-700 sm:inset-x-4" />}
              </button>
            ))}
          </nav>
          <div className="mb-1 flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <button type="button" aria-label="Timeline view" aria-pressed={viewMode === 'timeline'} onClick={() => setViewMode('timeline')} className={`grid h-7 w-7 place-items-center rounded-md ${viewMode === 'timeline' ? 'bg-teal-50 text-teal-800' : 'text-slate-400 hover:text-teal-800'}`}><List size={15} /></button>
            <button type="button" aria-label="Grid view" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} className={`grid h-7 w-7 place-items-center rounded-md ${viewMode === 'grid' ? 'bg-teal-50 text-teal-800' : 'text-slate-400 hover:text-teal-800'}`}><Grid2X2 size={14} /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
          <section aria-label="Journal timeline" className="space-y-5 lg:col-span-8">
            {loading && accessToken && (
              <div className="rounded-2xl border border-slate-100 bg-white px-5 py-10 text-center text-xs font-medium text-slate-500 shadow-sm">
                Loading your trip memories…
              </div>
            )}
            {(!loading || !accessToken) && filteredJournal.map((memory) => (
              <JournalCard
                key={memory.id ? `memory-${memory.id}` : `${memory.day}-${memory.title}`}
                memory={memory}
                viewMode={viewMode}
                playing={isPlaying && Boolean(memory.audio)}
                onDelete={accessToken ? handleDeleteMemory : undefined}
                onToggleAudio={() => setIsPlaying((playing) => !playing)}
              />
            ))}
            {(!loading || !accessToken) && !filteredJournal.length && (
              <div className="ml-10 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
                <Images size={21} className="mx-auto text-teal-700" />
                <p className="mt-3 text-sm font-bold text-slate-800">No memories for this day yet</p>
                <p className="mt-1 text-[10px] text-slate-500">Choose another day or add a moment to the journal.</p>
              </div>
            )}
            <button type="button" onClick={() => setNotice('You are viewing the available journal entries.')} className="ml-10 flex w-[calc(100%-2.5rem)] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white py-3.5 text-[10px] font-bold text-slate-500 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800">
              <Plus size={14} /> More days from this trip <ChevronDown size={13} />
            </button>
          </section>
          <SidebarWidgets onShare={handleShare} />
        </div>
      </div>
      {isDialogOpen && (
        <AddMemoryDialog
          trips={trips}
          saving={isSaving}
          error={actionError}
          isSignedIn={Boolean(accessToken)}
          onClose={() => setIsDialogOpen(false)}
          onSubmit={handleSaveMemory}
        />
      )}
    </main>
  );
}
