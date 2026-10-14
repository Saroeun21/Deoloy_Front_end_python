import { useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CloudSun,
  Footprints,
  Heart,
  ImagePlus,
  Images,
  MapPin,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Sun,
  Wallet,
  X,
} from 'lucide-react';

const memories = [
  {
    day: 1,
    date: 'MON, APR 06',
    place: 'BANGKOK',
    title: 'Arrival in the City of Angels & Night River Cruise',
    time: '4:30 PM — 10:15 PM',
    location: 'Bangkok, Thailand',
    note: 'The city welcomed us with warm air, the scent of jasmine, and a thousand little moments. We watched the skyline shimmer from the river as the sun disappeared behind the temples.',
    tags: ['#Bangkok', '#StreetFood', '#NightCruise'],
    photos: [
      {
        src: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1200&q=85',
        alt: 'Bangkok skyline and river at dusk',
        featured: true,
      },
      {
        src: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=700&q=85',
        alt: 'Ornate Thai temple roof',
      },
      {
        src: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=700&q=85',
        alt: 'Colorful Bangkok street at night',
      },
    ],
  },
  {
    day: 2,
    date: 'TUE, APR 07',
    place: 'BANGKOK',
    title: 'Gilded Splendor of Wat Phra Kaew & Sunset at Wat Arun',
    time: '8:00 AM — 6:40 PM',
    location: 'Old City, Bangkok',
    note: 'A morning among golden spires and intricate mosaics, followed by a slow ferry ride across the river. Wat Arun at sunset felt like the perfect pause in a very full day.',
    tags: ['#TempleHopping', '#WatArun', '#GoldenHour'],
    photos: [
      {
        src: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=1200&q=85',
        alt: 'The decorated facade of a Thai temple',
        featured: true,
      },
      {
        src: 'https://images.unsplash.com/photo-1564910443496-5fd2d76b47fa?auto=format&fit=crop&w=700&q=85',
        alt: 'Golden details inside a Thai temple',
      },
      {
        src: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=700&q=85',
        alt: 'Temple beside the Chao Phraya River',
      },
    ],
    weather: '32°C Sunny',
  },
  {
    day: 3,
    date: 'WED, APR 08',
    place: 'CHIANG MAI',
    title: 'Chiang Mai Old City & Ethical Elephant Sanctuary',
    time: '7:15 AM — 5:20 PM',
    location: 'Chiang Mai, Thailand',
    note: 'We traded temple bells for birdsong and spent the morning learning how the sanctuary cares for its gentle residents. No rushing, no riding — just muddy paths and unforgettable company.',
    tags: ['#ChiangMai', '#ElephantSanctuary', '#SlowTravel'],
    photos: [
      {
        src: 'https://images.unsplash.com/photo-1557223562-6c77ef16210f?auto=format&fit=crop&w=900&q=85',
        alt: 'Elephants walking through a green sanctuary',
        featured: true,
      },
      {
        src: 'https://images.unsplash.com/photo-1513415277900-a62401e19be4?auto=format&fit=crop&w=900&q=85',
        alt: 'A quiet, leafy path in northern Thailand',
      },
    ],
    audio: 'Morning walk with elephants — Chiang Mai',
  },
];

function Avatar({ initials, color = 'bg-rose-100 text-rose-700', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-white text-[11px] font-bold ${color} ${className}`}
    >
      {initials}
    </span>
  );
}

function TopBar({ searchQuery, onSearchChange }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex min-h-18 items-center gap-3 px-4 sm:px-7 xl:px-10">
        <div className="hidden min-w-0 items-center gap-2 text-xs sm:flex">
          <a href="/trips" className="font-medium text-slate-400 hover:text-emerald-700">My Trips</a>
          <ChevronRight size={14} className="text-slate-300" />
          <span className="max-w-48 truncate font-semibold text-slate-700">Thailand Adventure 2026</span>
        </div>
        <label className="ml-auto flex h-10 min-w-0 max-w-72.5 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-50">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            aria-label="Search trips and memories"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search trips, memories..."
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-400 lg:inline">
            ⌘ K
          </kbd>
        </label>
        <a
          href="/trips/create"
          className="hidden h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 sm:inline-flex"
        >
          <Plus size={16} /> <span className="hidden lg:inline">New Trip</span>
        </a>
        <span className="hidden h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 lg:flex">
          <Sun size={15} className="text-amber-500" /> Bangkok 31°C
        </span>
        <button
          type="button"
          className="hidden h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 md:flex"
        >
          $ USD <ChevronDown size={13} className="text-slate-400" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-rose-500" />
        </button>
        <Avatar initials="SL" color="bg-violet-100 text-violet-700" className="h-8 w-8" />
      </div>
    </header>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[11px] font-bold text-slate-800">{value}</span>
        <span className="block whitespace-nowrap text-[9px] font-medium text-slate-400">{label}</span>
      </span>
    </div>
  );
}

function PhotoGrid({ photos, day }) {
  return (
    <div className={`grid h-55 gap-2 overflow-hidden rounded-2xl sm:h-65 ${
      photos.length === 2 ? 'grid-cols-2' : 'grid-cols-[1.35fr_0.85fr]'
    }`}>
      {photos.map((photo, index) => (
        <div
          key={photo.src}
          className={`group relative min-h-0 overflow-hidden rounded-xl bg-slate-100 ${
            photo.featured && photos.length === 3 ? 'row-span-2' : ''
          }`}
        >
          <img
            src={photo.src}
            alt={photo.alt}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
          {index === 0 && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/55 px-2.5 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              <Images size={12} /> Day {day} highlights
            </span>
          )}
          {index === photos.length - 1 && photos.length > 2 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-slate-700">
              +8 photos
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Waveform({ playing }) {
  const heights = [10, 16, 12, 23, 17, 29, 14, 21, 33, 18, 26, 12, 22, 34, 18, 26, 14, 21, 30, 15, 24, 11, 19, 28, 15, 23, 12, 18, 27, 14, 21, 10, 18, 25, 13, 20];
  return (
    <div className="flex h-9 flex-1 items-center gap-0.75" aria-hidden="true">
      {heights.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={`w-0.75 rounded-full ${playing && index < 13 ? 'bg-emerald-500' : 'bg-emerald-200'}`}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}

function DayCard({ memory, isPlaying, onToggleAudio }) {
  return (
    <article className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
            Day {memory.day}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{memory.date}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <MapPin size={13} className="text-emerald-600" /> {memory.place}
        </div>
      </div>

      <h2 className="mb-3 max-w-3xl text-[17px] font-bold leading-snug tracking-tight text-slate-900 sm:text-[19px]">
        {memory.title}
      </h2>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" />{memory.location}</span>
        <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-slate-400" />{memory.time}</span>
        {memory.weather && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
            <CloudSun size={13} /> {memory.weather}
          </span>
        )}
      </div>

      <PhotoGrid photos={memory.photos} day={memory.day} />

      <div className="mt-4 rounded-xl border-l-[3px] border-emerald-400 bg-emerald-50/70 px-4 py-3">
        <p className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-emerald-800">A note from the day</p>
        <p className="text-[12px] leading-[1.75] text-slate-600">{memory.note}</p>
      </div>

      {memory.audio && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            aria-label={isPlaying ? 'Pause audio memory' : 'Play audio memory'}
            onClick={onToggleAudio}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700"
          >
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
          </button>
          <div className="min-w-33.75 flex-1">
            <p className="mb-1.5 truncate text-[11px] font-bold text-slate-700">{memory.audio}</p>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold text-slate-400">{isPlaying ? '0:18' : '0:00'}</span>
              <Waveform playing={isPlaying} />
              <span className="text-[9px] font-semibold text-slate-400">1:24</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1.5 text-[9px] font-bold text-violet-700">
            <AudioLines size={12} /> SPATIAL AUDIO
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {memory.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500">
            {tag}
          </span>
        ))}
        <button type="button" aria-label={`Like Day ${memory.day} memory`} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-500">
          <Heart size={14} /> <span className="hidden sm:inline">Love this</span>
        </button>
      </div>
    </article>
  );
}

function SmartReel() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-bold text-slate-900">TripOS Smart Reel</h2>
          <p className="mt-0.5 text-[10px] text-slate-400">Your trip in 60 seconds</p>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600"><Sparkles size={15} /></span>
      </div>
      <button
        type="button"
        aria-label="Play Thailand trip highlight reel"
        className="group relative block h-38.75 w-full overflow-hidden rounded-xl bg-slate-800 text-left"
      >
        <img
          src="https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=900&q=85"
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105"
        />
        <span className="absolute inset-0 bg-linear-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
        <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-white/25 text-white shadow-lg backdrop-blur-md transition group-hover:scale-110">
          <Play size={19} fill="currentColor" className="ml-0.5" />
        </span>
        <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
          <span>
            <span className="block text-xs font-bold">Thailand, through our eyes</span>
            <span className="mt-1 block text-[9px] text-white/75">7 days · 142 moments</span>
          </span>
          <span className="rounded-md bg-black/40 px-1.5 py-1 text-[9px] font-bold">1:02</span>
        </span>
      </button>
    </section>
  );
}

function Superlatives() {
  const entries = [
    { title: 'Best Meal', detail: 'Pad Thai at Thipsamai', icon: '✦', color: 'bg-amber-50 text-amber-700', rank: '01' },
    { title: 'Favorite Landmark', detail: 'Wat Arun at golden hour', icon: '⌖', color: 'bg-sky-50 text-sky-700', rank: '02' },
    { title: 'Funniest Moment', detail: 'The tuk-tuk karaoke ride', icon: '☺', color: 'bg-rose-50 text-rose-700', rank: '03' },
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-slate-900">Highlights & superlatives</h2>
        <button type="button" className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800">See all</button>
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.title} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base font-bold ${entry.color}`}>{entry.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold text-slate-800">{entry.title}</span>
              <span className="mt-0.5 block truncate text-[9px] text-slate-400">{entry.detail}</span>
            </span>
            <span className="text-[9px] font-extrabold text-slate-300">{entry.rank}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompanionAlbum({ onSync, synced }) {
  const companions = [
    { name: 'Sokha Lim', initials: 'SL', photos: 48, color: 'bg-violet-100 text-violet-700' },
    { name: 'Dara Kim', initials: 'DK', photos: 36, color: 'bg-sky-100 text-sky-700' },
    { name: 'Mina Chan', initials: 'MC', photos: 29, color: 'bg-rose-100 text-rose-700' },
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-bold text-slate-900">Companion album</h2>
          <p className="mt-0.5 text-[10px] text-slate-400">3 travelers · shared memories</p>
        </div>
        <div className="flex -space-x-2">
          {companions.map((person) => <Avatar key={person.initials} initials={person.initials} color={person.color} className="h-7 w-7 text-[9px]" />)}
        </div>
      </div>
      <div className="space-y-2">
        {companions.map((person) => (
          <div key={person.initials} className="flex items-center gap-2.5">
            <Avatar initials={person.initials} color={person.color} className="h-7 w-7 text-[9px]" />
            <span className="flex-1 text-[10px] font-semibold text-slate-700">{person.name}</span>
            <span className="text-[9px] font-medium text-slate-400">{person.photos} photos</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onSync}
        className={`mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border text-[10px] font-bold transition ${
          synced ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
        }`}
      >
        {synced ? <Check size={13} /> : <Images size={13} />}
        {synced ? 'Album is up to date' : 'Sync shared album'}
      </button>
    </section>
  );
}

function RouteFootprint() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-bold text-slate-900">Route footprint</h2>
          <p className="mt-0.5 text-[10px] text-slate-400">Every mile tells a story</p>
        </div>
        <Footprints size={17} className="text-emerald-600" />
      </div>
      <div className="relative flex h-31.5 items-center justify-center overflow-hidden rounded-xl border border-emerald-100 bg-[#f0f7f2]">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(#a6c8b3 0.8px, transparent 0.8px)', backgroundSize: '14px 14px' }} />
        <svg viewBox="0 0 320 130" className="absolute inset-0 h-full w-full" role="img" aria-label="Travel route from Bangkok to Chiang Mai and Phuket">
          <path d="M79 90 C82 76 100 70 108 56 S131 34 145 40 S162 66 179 69 S200 48 214 38" fill="none" stroke="#10b981" strokeDasharray="4 5" strokeLinecap="round" strokeWidth="2.5" />
          <path d="M79 90 C101 104 126 101 145 90 S167 76 179 69" fill="none" stroke="#7c3aed" strokeDasharray="3 5" strokeLinecap="round" strokeWidth="2" />
          <circle cx="79" cy="90" r="5" fill="#059669" stroke="white" strokeWidth="3" />
          <circle cx="145" cy="40" r="5" fill="#059669" stroke="white" strokeWidth="3" />
          <circle cx="179" cy="69" r="5" fill="#7c3aed" stroke="white" strokeWidth="3" />
          <text x="55" y="112" fill="#475569" fontSize="9" fontWeight="600">Bangkok</text>
          <text x="124" y="27" fill="#475569" fontSize="9" fontWeight="600">Chiang Mai</text>
          <text x="185" y="85" fill="#475569" fontSize="9" fontWeight="600">Phuket</text>
        </svg>
        <span className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[8px] font-bold text-slate-500 shadow-sm">THAILAND</span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-medium text-slate-500">Total distance</span>
        <span className="text-[13px] font-extrabold text-slate-900">1,284 <span className="text-[10px] font-semibold text-slate-400">km</span></span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {['Bangkok · 3 days', 'Chiang Mai · 2 days', 'Phuket · 2 days'].map((place) => (
          <span key={place} className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold text-slate-500">{place}</span>
        ))}
      </div>
    </section>
  );
}

export default function TripMemories() {
  const [activeDay, setActiveDay] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [synced, setSynced] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef(null);

  const filteredMemories = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return memories.filter((memory) => {
      const matchesDay = activeDay === 'all' || memory.day === Number(activeDay);
      const searchable = `${memory.title} ${memory.location} ${memory.note} ${memory.tags.join(' ')}`.toLowerCase();
      return matchesDay && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [activeDay, searchQuery]);

  async function handleShare() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is not available in this browser.');
      }
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Share link copied to clipboard.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not copy the share link.');
    }
  }

  function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) {
      setNotice(`${files.length} ${files.length === 1 ? 'photo' : 'photos'} selected and ready to add.`);
      event.target.value = '';
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="min-h-screen">
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-6 sm:px-7 lg:px-8 xl:px-10">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-emerald-800">
                  <BookOpen size={11} /> Archive Journal
                </span>
                <span className="text-[10px] font-semibold text-slate-400">APR 06 — APR 12, 2026</span>
              </div>
              <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.04em] text-slate-900 sm:text-[32px]">
                Thailand Adventure Memories
              </h1>
              <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-slate-500">
                Seven unforgettable days, three good friends, and a thousand little reasons to come back.
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 sm:flex-none"
              >
                <ImagePlus size={15} /> Add Memory
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-[11px] font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:flex-none"
              >
                <ArrowDownToLine size={14} /> Export PDF
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-[11px] font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:flex-none"
              >
                <Share2 size={14} /> Share Link
              </button>
            </div>
          </div>

          {notice && (
            <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[11px] font-medium text-emerald-800">
              <span className="flex items-center gap-2"><Check size={14} />{notice}</span>
              <button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')} className="rounded p-1 hover:bg-emerald-100"><X size={14} /></button>
            </div>
          )}

          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            <Stat icon={CalendarDays} value="7 Days" label="TRAVELED" />
            <Stat icon={MapPin} value="14 Places" label="VISITED" />
            <Stat icon={Images} value="3 Friends" label="TOGETHER" />
            <Stat icon={ImagePlus} value="142 Captures" label="COLLECTED" />
            <Stat icon={Wallet} value="$2,840" label="TOTAL SPENT" />
          </div>

          <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'All Days (7)' },
              { id: '1', label: 'Day 1: Bangkok' },
              { id: '2', label: 'Day 2: Temples' },
              { id: '3', label: 'Day 3: Chiang Mai' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeDay === tab.id}
                onClick={() => setActiveDay(tab.id)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-bold transition ${
                  activeDay === tab.id
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button type="button" className="ml-auto hidden shrink-0 items-center gap-1 rounded-full px-2 py-2 text-[10px] font-semibold text-slate-400 hover:text-slate-600 md:inline-flex">
              Newest first <ChevronDown size={13} />
            </button>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
            <section aria-label="Trip journal timeline" className="space-y-4 lg:col-span-8">
              {filteredMemories.map((memory) => (
                <DayCard
                  key={memory.day}
                  memory={memory}
                  isPlaying={isPlaying && memory.day === 3}
                  onToggleAudio={() => setIsPlaying((playing) => !playing)}
                />
              ))}
              {filteredMemories.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                  <Search size={22} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-700">No memories found</p>
                  <p className="mt-1 text-xs text-slate-400">Try another day or search term.</p>
                </div>
              )}
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-4 text-[11px] font-bold text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700"
              >
                <Plus size={15} /> Load more days <ArrowRight size={14} />
              </button>
            </section>

            <aside aria-label="Trip memory widgets" className="space-y-4 lg:col-span-4">
              <SmartReel />
              <Superlatives />
              <CompanionAlbum onSync={() => setSynced(true)} synced={synced} />
              <RouteFootprint />
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><Star size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-slate-800">A trip worth remembering</p>
                    <p className="mt-0.5 text-[9px] text-slate-400">Your journal is private to your group.</p>
                  </div>
                  <button type="button" aria-label="Learn about journal privacy" className="grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><ChevronRight size={15} /></button>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
