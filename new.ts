import React, { useState } from 'react';
import { 
  Instagram, 
  Linkedin, 
  User, 
  Search, 
  CheckCircle, 
  Calendar, 
  MapPin, 
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  ExternalLink,
  PhoneCall,
  Plus,
  Mail,
  Users,
  Eye,
  TrendingUp,
  Activity,
  Camera,
  DollarSign
} from 'lucide-react';

// --- MOCK DATA ---

const COLLEGES = [
  { name: "Princeton", domain: "princeton.edu", logoUrl: "https://standup.princeton.edu/wp-content/uploads/sites/12/2025/04/cropped-Princeton-University_mark-export-1.png" },
  { name: "MIT", domain: "mit.edu" },
  { name: "Harvard", domain: "harvard.edu" },
  { name: "Stanford", domain: "stanford.edu" },
  { name: "Yale", domain: "yale.edu" },
  { name: "Columbia", domain: "columbia.edu", logoUrl: "https://pluspng.com/img-png/columbia-university-logo-png-columbia-university-professional-school-fair-606.png" },
  { name: "UPenn", domain: "upenn.edu" },
  { name: "Caltech", domain: "caltech.edu", logoUrl:"https://www.mics.caltech.edu/wp-content/uploads/2023/02/caltech.webp" },
  { name: "Johns Hopkins", domain: "jhu.edu" },
  { name: "Dartmouth", domain: "dartmouth.edu" },
  { name: "UChicago", domain: "uchicago.edu", logoUrl: "https://i0.wp.com/biocars.uchicago.edu/wp-content/uploads/2019/05/cropped-logo.png?ssl=1"},
  { name: "Northwestern", domain: "northwestern.edu" },
  { name: "Brown", domain: "brown.edu" },
  { name: "Vanderbilt", domain: "vanderbilt.edu", logoUrl: "https://vanderbilthustler.com/wp-content/uploads/2022/03/Primary.png" },
  { name: "Cornell", domain: "cornell.edu" },
  { name: "Rice", domain: "rice.edu" },
  { name: "UC Berkeley", domain: "berkeley.edu" },
  { name: "UCLA", domain: "ucla.edu" },
  { name: "UMichigan", domain: "umich.edu", logoUrl: "https://brand.umich.edu/assets/brand/style-guide/logo-guidelines/Block_M-Hex.png" },
  { name: "Duke", domain: "duke.edu" },
  { name: "USC", domain: "usc.edu" },
  { name: "UNC", domain: "unc.edu" },
  { name: "Babson", domain: "babson.edu" }
];

const BRANDS = [
  { name: "Summer Fridays", domain: "summerfridays.com" },
  { name: "Tru Fru", domain: "trufru.com" },
  { name: "Sol de Janeiro", domain: "soldejaneiro.com" },
  { name: "Olipop", domain: "drinkolipop.com" },
  { name: "La Croix", domain: "lacroixwater.com" },
  { name: "Rare Beauty", domain: "rarebeauty.com" },
  { name: "Glow Recipe", domain: "glowrecipe.com" },
  { name: "Saie", domain: "saiehello.com" },
  { name: "Skims", domain: "skims.com" },
  { name: "Tarte", domain: "tartecosmetics.com" },
  { name: "Alo", domain: "aloyoga.com" },
  { name: "Lululemon", domain: "lululemon.com" },
  { name: "Rhode", domain: "rhodeskin.com" },
  { name: "Laneige", domain: "us.laneige.com" },
  { name: "Poppi", domain: "drinkpoppi.com" }
];

const FEATURED_COLLABS = [
  {
    id: 1,
    title: "Sigma Kappa x Garnier",
    subtitle: "Product sampling event at Babson College",
    image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 2,
    title: "Sigma Kappa x Hero Cosmetics",
    subtitle: "Brand activation at Babson College",
    image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80"
  }
];

const ACTION_SHOTS = [
  { id: 1, title: "Garnier Product Distribution", location: "Babson College", tag: "BUZZ Event", image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=400&q=80" },
  { id: 2, title: "Hero Cosmetics Brand Showcase", location: "Student Center", tag: "BUZZ Event", image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=400&q=80" },
  { id: 3, title: "Mighty Patch Demo Session", location: "Dorm Room Pop-up", tag: "BUZZ Event", image: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=400&q=80" },
  { id: 4, title: "Sour Strips Grad Celebration", location: "Campus Center", tag: "BUZZ Event", image: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=400&q=80" },
  { id: 5, title: "Zeta Tau Alpha Recruitment", location: "Sorority House", tag: "BUZZ Event", image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=400&q=80" },
  { id: 6, title: "LaCroix Product Demo", location: "Student Center", tag: "BUZZ Event", image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=400&q=80" },
];

const CAMPAIGNS = [
  {
    id: 1,
    title: "Poppi New Flavor Launch Pop-Up",
    brand: "Poppi",
    description: "Poppi is dropping a brand new flavor! We are looking for campus organizations to host a launch pop-up on their campus. We will send cases of the new flavor, merch, and everything you need for an amazing event.",
    location: "Multiple Campuses",
    date: "Coming Soon",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: 2,
    title: "Pink Guava Butter Balm Pop-Up",
    brand: "Summer Fridays",
    description: "Bring Summer Fridays' viral Pink Guava Lip Butter Balm to your campus! Host a sensory pop-up (think: pink decor, lip touch-ups, photo moments) for students to try the new shade.",
    location: "Your Campus",
    date: "5/8/2026",
    image: "https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&w=800&q=80"
  }
];

// Mocking brand's view of applicants for a specific campaign
const MOCK_APPLICANTS = [
  { id: 1, org: "Babson Sigma Kappa", handle: "babsonsigmakappa", followers: "1.2K", status: "Pending" },
  { id: 2, org: "Cornell Alpha Phi", handle: "cornellalphaphi", followers: "2.5K", status: "Pending" },
  { id: 3, org: "USC Marketing Association", handle: "uscmktg", followers: "800", status: "Pending" },
];


// --- COMPONENTS ---

const Header = ({ setView, onContactClick }: { setView: (v: string) => void, onContactClick: () => void }) => (
  <header className="w-full relative z-50">
    {/* Top Bar - Centered Waitlist */}
    <div className="bg-[#fffcf5] text-xs font-semibold tracking-wider py-2 px-6 flex items-center justify-center border-b border-yellow-100 relative h-10">
      <div className="absolute left-6 flex space-x-4">
        <Instagram size={16} className="cursor-pointer text-gray-500 hover:text-[#ff5b70]" />
        <Linkedin size={16} className="cursor-pointer text-gray-500 hover:text-[#ff5b70]" />
      </div>
      <div className="text-center cursor-pointer hover:underline font-bold text-[#ff5b70]" onClick={() => setView('register')}>JOIN!</div>
      <div className="absolute right-6 flex items-center gap-4">
        <button onClick={() => setView('brand-dashboard')} className="text-[#ff5b70] hover:text-rose-500 hidden md:block">
          Brand Portal
        </button>
        <User size={18} className="cursor-pointer text-gray-500 hover:text-[#ff5b70]" onClick={() => setView('register')} />
      </div>
    </div>

    {/* Main Nav */}
    <nav className="bg-[#ff5b70] text-white py-4 px-8 flex justify-between items-center relative h-16 shadow-sm">
      <div className="flex space-x-8 font-medium">
        <button onClick={() => setView('home')} className="hover:text-yellow-200 transition">Home</button>
      </div>

      {/* Overlapping Logo */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 -top-2 bg-[#ff5b70] w-72 h-20 flex flex-col justify-center items-center cursor-pointer hover:bg-rose-500 transition shadow-sm z-10"
        onClick={() => setView('home')}
      >
        <div className="flex items-center space-x-1">
          <span className="text-3xl font-serif italic font-bold text-white">BUZZ</span>
        </div>
        <span className="text-[10px] font-light mt-1 text-white tracking-wider">@bringthebuzzover</span>
      </div>

      <div className="flex space-x-8 font-medium">
        <button onClick={onContactClick} className="hover:text-yellow-200 transition">Contact</button>
        <button onClick={() => setView('register')} className="hover:text-yellow-200 transition">Join!</button>
      </div>
    </nav>
  </header>
);

const Marquee = ({ items, reverse = false, title, subtitle }: { items: any[], reverse?: boolean, title: string, subtitle?: string }) => {
  return (
    <div className="w-full py-16 bg-[#fffcf5] overflow-hidden border-b border-yellow-100">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>
      <div className="relative flex w-full flex-nowrap items-center">
        <div className={`flex w-max shrink-0 items-center justify-center space-x-16 px-8 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}>
          {[...items, ...items].map((item, i) => (
            <div key={i} className="flex flex-col items-center justify-center opacity-80 hover:opacity-100 transition duration-300 w-32 h-32 grayscale hover:grayscale-0">
               {/* Fixed square container ensures all logos share the same bounds and object-contain resizes them accurately */}
               <div className="w-20 h-20 flex items-center justify-center mb-3">
                 <img 
                   src={item.logoUrl || `https://logo.clearbit.com/${item.domain}`} 
                   alt={item.name}
                   className="w-full h-full object-contain drop-shadow-sm"
                   onError={(e) => {
                     const target = e.target as HTMLImageElement;
                     const fallbackSrc = `https://icon.horse/icon/${item.domain}`;
                     if (target.src !== fallbackSrc) {
                       target.src = fallbackSrc;
                     }
                   }}
                 />
               </div>
               <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap text-center block">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Home = ({ setView }: { setView: (v: string) => void }) => (
  <div className="w-full">
    {/* Hero Section */}
    <section className="relative h-[600px] flex items-center bg-gray-900 overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 z-0 w-full h-full object-cover opacity-60"
      >
        <source src="RenderedVideo.mov" type="video/quicktime" />
        <source src="RenderedVideo.mov" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      
      <div className="relative z-10 max-w-6xl mx-auto px-8 w-full text-center md:text-left">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-2 leading-tight">
          BRING YOUR BRAND<br/>TO OUR CAMPUS
        </h1>
        <h2 className="text-2xl italic text-[#ff5b70] mb-6 drop-shadow-sm">BRING THE BUZZ OVER</h2>
        <p className="text-white text-lg max-w-md mb-8 font-medium mx-auto md:mx-0">
          Connecting brands with campus communities for authentic college marketing, at scale.
        </p>
        <div className="flex flex-col sm:flex-row justify-center md:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
          <button 
            onClick={() => setView('register')}
            className="bg-[#ff5b70] hover:bg-rose-600 text-white px-8 py-3 rounded-lg font-bold transition shadow-md"
          >
            Join Buzz!
          </button>
          <button 
            onClick={() => setView('campaigns')}
            className="bg-black/30 hover:bg-black/50 border border-white/50 text-white px-8 py-3 rounded-lg font-bold backdrop-blur-sm transition shadow-sm"
          >
            Browse Campaigns
          </button>
        </div>
        <div className="mt-8 text-sm text-white/80 font-medium inline-block px-4 py-1">
          Yerba Madre x Cornell University
        </div>
      </div>
    </section>

    {/* College Slider */}
    <Marquee items={COLLEGES} title="Our College Network" subtitle="Our ambassadors are ready to bring your brand to top campuses nationwide" />

    {/* Featured Collaborations */}
    <section className="py-7 px-8 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-12">
        Featured Campus <span className="text-[#ff5b70]">Collaborations</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        {FEATURED_COLLABS.map(collab => (
          <div key={collab.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition border border-yellow-100">
            <div className="h-64 overflow-hidden border-b border-yellow-100">
              <img src={collab.image} alt={collab.title} className="w-full h-full object-cover" />
            </div>
            <div className="p-6 text-center bg-[#fffcf5]">
              <h3 className="font-bold text-xl italic mb-1 text-[#ff5b70]">{collab.title}</h3>
              <p className="text-gray-500 text-sm font-medium">{collab.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* CTA Section */}
    <section className="py-12 px-8 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Create Campaign Box */}
      <div className="bg-gradient-to-br from-[#ff5b70] to-[#ff8594] rounded-2xl p-10 text-white relative overflow-hidden shadow-sm border border-rose-400">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#fdf3cb]/20 rounded-full -translate-y-1/2 translate-x-1/4"></div>
        <h3 className="text-3xl font-bold mb-4 relative z-10 flex items-center gap-2">
           Create a Campaign
        </h3>
        <p className="mb-8 relative z-10 opacity-90 max-w-md">
          Launch your brand campaign and connect with student organizations who can authentically represent your products on college campuses.
        </p>
        <ul className="space-y-3 mb-8 relative z-10 opacity-90 font-medium">
          <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#fdf3cb]"></div> Search through 25+ top college campuses</li>
          <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#fdf3cb]"></div> Verified campus organizations & sororities</li>
          <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#fdf3cb]"></div> Select the perfect groups for your campaign</li>
        </ul>
        <button 
          onClick={() => setView('brand-dashboard')}
          className="bg-[#fdf3cb] text-[#ff5b70] px-8 py-3 rounded-lg font-bold hover:bg-yellow-200 transition relative z-10 shadow-sm"
        >
          Post a Campaign
        </button>
      </div>

      {/* Register Group Box */}
      <div className="bg-[#fdf3cb] rounded-2xl p-10 text-gray-800 relative overflow-hidden shadow-sm border border-yellow-200">
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-yellow-200/50 rotate-45 translate-y-1/4 translate-x-1/4"></div>
        <h3 className="text-3xl font-bold text-[#ff5b70] mb-4 relative z-10">Register Your Campus Group</h3>
        <p className="mb-8 relative z-10 max-w-md text-gray-600 font-medium">
          Join our network of campus organizations and apply to host exciting brand campaigns at your college.
        </p>
        <ul className="space-y-3 mb-8 relative z-10 text-gray-700 font-medium">
          <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#ff5b70]"></div> Represent your sorority, fraternity or club</li>
          <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#ff5b70]"></div> Access exclusive products and PR packages</li>
          <li className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[#ff5b70]"></div> Apply to brand campaigns that interest you</li>
        </ul>
        <button 
          onClick={() => setView('register')}
          className="bg-[#ff5b70] text-white px-8 py-3 rounded-lg font-bold hover:bg-rose-500 transition relative z-10 shadow-sm"
        >
          Register Your Group
        </button>
      </div>
    </section>
  </div>
);

const Register = ({ setView }: { setView: (v: string) => void }) => (
  <div className="max-w-2xl mx-auto py-12 px-8">
    <div className="text-center mb-8">
      <h2 className="text-3xl font-bold text-[#ff5b70] mb-2">Register Your Campus Group</h2>
      <p className="text-gray-500 text-sm font-medium">Join our network to receive PR and host pop-ups for top brands.</p>
    </div>

    <form 
      className="space-y-6" 
      onSubmit={(e) => { 
        e.preventDefault(); 
        alert("Profile registered! You can now apply to campaigns."); 
        setView('campaigns'); 
      }}
    >
      <div className="bg-white p-8 rounded-xl shadow-sm border border-yellow-200">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">Organization Name</label>
            <input required type="text" placeholder="e.g. Babson Sigma Kappa" className="w-full p-3 bg-[#fffcf5] rounded-lg border border-yellow-200 outline-none focus:border-[#ff5b70] focus:ring-1 focus:ring-[#ff5b70]" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">College/University Name</label>
            <input required type="text" placeholder="e.g. Babson College" className="w-full p-3 bg-[#fffcf5] rounded-lg border border-yellow-200 outline-none focus:border-[#ff5b70] focus:ring-1 focus:ring-[#ff5b70]" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">School Email (.edu)</label>
            <input required type="email" placeholder="you@babson.edu" className="w-full p-3 bg-[#fffcf5] rounded-lg border border-yellow-200 outline-none focus:border-[#ff5b70] focus:ring-1 focus:ring-[#ff5b70]" />
            <p className="text-xs text-gray-400 mt-1 font-medium">Must be an active .edu email for verification.</p>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">Organization Instagram Handle</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400 font-medium">@</span>
              <input required type="text" placeholder="babsonsigmakappa" className="w-full pl-8 p-3 bg-[#fffcf5] rounded-lg border border-yellow-200 outline-none focus:border-[#ff5b70] focus:ring-1 focus:ring-[#ff5b70]" />
            </div>
            <p className="text-xs text-gray-400 mt-1 font-medium">Brands will preview this to select you for campaigns.</p>
          </div>
        </div>
      </div>

      <button type="submit" className="w-full bg-[#ff5b70] hover:bg-rose-500 text-white font-bold py-4 rounded-lg shadow-md transition text-lg">
        Create Profile
      </button>
      <p className="text-center text-xs text-gray-500 mt-4 font-medium">
        By registering, you confirm you are an authorized representative of the campus group.
      </p>
    </form>
  </div>
);

const Campaigns = ({ setView, setSelected }: { setView: (v: string) => void, setSelected: (c: any) => void }) => (
  <div className="max-w-5xl mx-auto py-12 px-8">
    <div className="text-center mb-12">
      <h2 className="text-3xl font-bold mb-2">Active <span className="text-[#ff5b70]">Campaigns</span></h2>
      <p className="text-gray-500 text-sm font-medium">Apply to host pop-ups and receive PR from these brands</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
      {CAMPAIGNS.map(camp => (
        <div key={camp.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-yellow-200 flex flex-col hover:shadow-md transition">
          <div className="h-56 relative overflow-hidden flex items-center justify-center border-b border-yellow-100">
            <img src={camp.image} alt={camp.title} className="w-full h-full object-cover" />
          </div>
          <div className="p-6 flex-1 flex flex-col bg-[#fffcf5]">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-[#ff5b70] text-xl leading-tight pr-4">{camp.title}</h3>
              <span className="bg-[#fdf3cb] text-[10px] font-bold px-3 py-1 rounded-full text-gray-800 whitespace-nowrap border border-yellow-200">{camp.brand}</span>
            </div>
            <p className="text-sm text-gray-600 mb-6 flex-1 line-clamp-3 font-medium">
              {camp.description}
            </p>
            <div className="flex items-center text-xs text-gray-500 gap-4 mb-6 font-bold">
              <span className="flex items-center gap-1"><MapPin size={14} className="text-[#ff5b70]"/> {camp.location}</span>
              <span className="flex items-center gap-1"><Calendar size={14} className="text-[#ff5b70]"/> {camp.date}</span>
            </div>
            <button 
              onClick={() => { setSelected(camp); setView('details'); }}
              className="w-full bg-[#ff5b70] hover:bg-rose-500 text-white font-semibold py-3 rounded-lg transition shadow-sm"
            >
              View Campaign & Apply
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CampaignDetails = ({ campaign, onApply, onBack }: { campaign: any, onApply: () => void, onBack: () => void }) => {
  if(!campaign) return null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-8">
      <button onClick={onBack} className="flex items-center text-gray-500 hover:text-[#ff5b70] mb-6 font-bold text-sm transition">
        <ChevronLeft size={16} className="mr-1"/> Back to Campaigns
      </button>

      <div className="bg-black text-white h-80 rounded-2xl overflow-hidden relative mb-8 flex items-end shadow-md border-2 border-yellow-100">
        <img src={campaign.image} alt={campaign.title} className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="relative z-10 p-8 w-full bg-gradient-to-t from-black via-black/60 to-transparent">
          <span className="bg-[#ff5b70] text-xs font-bold px-3 py-1 rounded-full text-white mb-3 inline-block shadow-sm">{campaign.brand}</span>
          <h1 className="text-4xl md:text-5xl font-bold">{campaign.title}</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-8 border-b border-yellow-200 pb-6">
        <span className="flex items-center gap-2 bg-[#fdf3cb] text-gray-800 px-4 py-2 rounded-lg font-bold"><Calendar size={16} className="text-[#ff5b70]"/> {campaign.date}</span>
        <span className="flex items-center gap-2 bg-[#fdf3cb] text-gray-800 px-4 py-2 rounded-lg font-bold"><MapPin size={16} className="text-[#ff5b70]"/> {campaign.location}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#ff5b70]">About this Campaign</h2>
            <p className="text-gray-700 text-base leading-relaxed font-medium bg-white p-6 rounded-xl border border-yellow-100 shadow-sm">
              {campaign.description}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4 text-[#ff5b70]">What You'll Receive</h2>
            <ul className="text-gray-700 space-y-3 list-none font-medium bg-white p-6 rounded-xl border border-yellow-100 shadow-sm">
              <li className="flex items-start gap-3"><CheckCircle size={20} className="text-[#ff5b70] shrink-0 mt-0.5"/> Full PR packages for your group members</li>
              <li className="flex items-start gap-3"><CheckCircle size={20} className="text-[#ff5b70] shrink-0 mt-0.5"/> Decor and promotional material for the pop-up</li>
              <li className="flex items-start gap-3"><CheckCircle size={20} className="text-[#ff5b70] shrink-0 mt-0.5"/> Products to distribute to campus attendees</li>
            </ul>
          </section>
        </div>

        <div>
          <div className="bg-[#fdf3cb] p-8 rounded-2xl sticky top-24 shadow-sm border border-yellow-200">
            <h3 className="text-xl font-bold text-[#ff5b70] mb-3">Ready to host?</h3>
            <p className="text-sm text-gray-700 mb-6 leading-relaxed font-medium">
              Apply now to host this campaign. The brand will review your organization's profile and Instagram to select the perfect fit.
            </p>
            <button 
              onClick={onApply}
              className="w-full bg-[#ff5b70] hover:bg-rose-500 text-white font-bold py-4 rounded-xl shadow-md transition text-lg"
            >
              Apply Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const StrategyCallModal = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200 border-2 border-yellow-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-[#ff5b70] z-10 bg-[#fffcf5] p-1 rounded-full border border-yellow-100 transition shadow-sm">
          <X size={20} />
        </button>

        <div className="p-6 border-b border-yellow-100 bg-[#fffcf5]">
          <h2 className="font-bold text-xl text-[#ff5b70]">Book a Strategy Call</h2>
          <p className="text-sm text-gray-600 mt-2 font-medium">
            Leave your phone number below and a BUZZ representative will call you back shortly to help plan your perfect campus campaign.
          </p>
        </div>

        <form className="p-6 space-y-4 bg-white" onSubmit={(e) => { e.preventDefault(); onClose(); alert('Request submitted! A representative will call you soon.'); }}>
          <div className="bg-[#fdf3cb] p-4 rounded-xl border border-yellow-200 shadow-sm text-center">
             <p className="text-sm text-[#ff5b70] font-bold mb-1">Your profile will be shared</p>
             <p className="text-xs text-gray-700 font-medium">Your brand and account details will automatically be shared with our representative.</p>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">Phone Number</label>
            <input 
              required 
              type="tel" 
              placeholder="(555) 123-4567" 
              className="w-full p-3 rounded-lg border border-yellow-200 outline-none focus:border-[#ff5b70] focus:ring-1 focus:ring-[#ff5b70] text-sm bg-[#fffcf5]" 
            />
          </div>
          <button type="submit" className="w-full bg-[#ff5b70] hover:bg-rose-500 text-white font-bold py-3 rounded-lg shadow-md transition mt-4 border-2 border-[#ff5b70]">
            Request Call
          </button>
        </form>
      </div>
    </div>
  );
}

// --- BRAND DASHBOARD VIEWS ---

const BrandDashboard = ({ setView, onPreviewIG, onBookCall }: { setView: (v: string) => void, onPreviewIG: (handle: string) => void, onBookCall: () => void }) => {
  const [activeTab, setActiveTab] = useState('campaigns');

  return (
    <div className="max-w-6xl mx-auto py-8 px-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Brand Portal</h1>
          <p className="text-gray-500 font-medium">Manage your campus campaigns and review applicants.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={onBookCall}
            className="flex items-center gap-2 bg-white border border-yellow-200 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-[#fdf3cb] hover:text-[#ff5b70] transition shadow-sm"
          >
            <PhoneCall size={16} /> Book Strategy Call
          </button>
          <button 
             onClick={() => setView('post-campaign')}
             className="flex items-center gap-2 bg-[#ff5b70] text-white px-4 py-2 rounded-lg font-bold hover:bg-rose-500 transition shadow-sm"
          >
            <Plus size={16} /> Post Campaign
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-yellow-200 overflow-hidden">
        <div className="border-b border-yellow-100 flex gap-8 px-8 bg-[#fffcf5]">
          <button className={`py-4 font-bold border-b-2 ${activeTab === 'campaigns' ? 'border-[#ff5b70] text-[#ff5b70]' : 'border-transparent text-gray-500 hover:text-gray-800'}`} onClick={() => setActiveTab('campaigns')}>
            Active Campaigns
          </button>
          <button className={`py-4 font-bold border-b-2 ${activeTab === 'stats' ? 'border-[#ff5b70] text-[#ff5b70]' : 'border-transparent text-gray-500 hover:text-gray-800'}`} onClick={() => setActiveTab('stats')}>
            Stats & Performance
          </button>
        </div>

        {activeTab === 'campaigns' && (
          <div className="p-8">
            <h3 className="font-bold text-xl mb-6 text-[#ff5b70]">Your Campaign: Poppi New Flavor Launch</h3>
            
            <div className="overflow-x-auto rounded-xl border border-yellow-100">
              <table className="w-full text-left border-collapse bg-white">
                <thead className="bg-[#fffcf5]">
                  <tr className="border-b border-yellow-100 text-sm text-gray-600">
                    <th className="p-4 font-bold">Organization</th>
                    <th className="p-4 font-bold">Instagram Handle</th>
                    <th className="p-4 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_APPLICANTS.map(app => (
                    <tr key={app.id} className="border-b border-yellow-50 hover:bg-[#fffcf5] transition">
                      <td className="p-4 font-bold text-gray-800">{app.org}</td>
                      <td className="p-4 text-[#ff5b70] font-medium">@{app.handle}</td>
                      <td className="p-4">
                        <button 
                          onClick={() => onPreviewIG(app.handle)}
                          className="flex items-center gap-1 text-sm bg-[#fdf3cb] hover:bg-yellow-200 text-gray-800 px-3 py-1.5 rounded-lg font-bold transition shadow-sm border border-yellow-200"
                        >
                          <ExternalLink size={14} className="text-[#ff5b70]" /> Preview IG
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="p-8">
            <h3 className="font-bold text-xl mb-6 text-[#ff5b70]">Campaign Performance Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-[#fffcf5] border border-yellow-200 p-8 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
                <div className="bg-[#fdf3cb] p-4 rounded-full mb-4">
                  <Activity size={32} className="text-[#ff5b70]" />
                </div>
                <div className="text-4xl font-black text-gray-900 mb-2">3</div>
                <div className="text-sm text-gray-600 font-bold uppercase tracking-wider">Campaigns in Progress</div>
              </div>
              
              <div className="bg-[#fffcf5] border border-yellow-200 p-8 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
                <div className="bg-[#fdf3cb] p-4 rounded-full mb-4">
                  <CheckCircle size={32} className="text-[#ff5b70]" />
                </div>
                <div className="text-4xl font-black text-gray-900 mb-2">12</div>
                <div className="text-sm text-gray-600 font-bold uppercase tracking-wider">Campaigns Finished</div>
              </div>
              
              <div className="bg-[#fffcf5] border border-yellow-200 p-8 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
                <div className="bg-[#fdf3cb] p-4 rounded-full mb-4">
                  <Camera size={32} className="text-[#ff5b70]" />
                </div>
                <div className="text-4xl font-black text-gray-900 mb-2">348</div>
                <div className="text-sm text-gray-600 font-bold uppercase tracking-wider">Total Posts Submitted</div>
              </div>

              <div className="bg-[#fffcf5] border border-yellow-200 p-8 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
                <div className="bg-[#fdf3cb] p-4 rounded-full mb-4">
                  <Heart size={32} className="text-[#ff5b70]" />
                </div>
                <div className="text-4xl font-black text-gray-900 mb-2">45.2K</div>
                <div className="text-sm text-gray-600 font-bold uppercase tracking-wider">Total Engagements</div>
              </div>
              
              <div className="bg-[#fffcf5] border border-yellow-200 p-8 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
                <div className="bg-[#fdf3cb] p-4 rounded-full mb-4">
                  <Eye size={32} className="text-[#ff5b70]" />
                </div>
                <div className="text-4xl font-black text-gray-900 mb-2">1.2M</div>
                <div className="text-sm text-gray-600 font-bold uppercase tracking-wider">Estimated Reach</div>
              </div>

              <div className="bg-[#fffcf5] border border-yellow-200 p-8 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
                <div className="bg-[#fdf3cb] p-4 rounded-full mb-4">
                  <DollarSign size={32} className="text-[#ff5b70]" />
                </div>
                <div className="text-4xl font-black text-gray-900 mb-2">$0.14</div>
                <div className="text-sm text-gray-600 font-bold uppercase tracking-wider">Cost Per Engagement</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PostCampaign = ({ setView }: { setView: (v: string) => void }) => (
  <div className="max-w-2xl mx-auto py-12 px-8">
    <button onClick={() => setView('brand-dashboard')} className="flex items-center text-gray-500 hover:text-[#ff5b70] mb-6 font-bold text-sm transition">
      <ChevronLeft size={16} className="mr-1"/> Back to Portal
    </button>
    
    <div className="mb-8">
      <h2 className="text-3xl font-bold text-[#ff5b70] mb-2">Post a New Campaign</h2>
      <p className="text-gray-500 text-sm font-medium">Announce a new product drop or event to our network of campus organizations.</p>
    </div>

    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert('Campaign posted successfully!'); setView('brand-dashboard'); }}>
      <div className="bg-white p-8 rounded-xl shadow-sm border border-yellow-200 space-y-6">
        <div>
          <label className="block text-sm font-bold mb-2 text-gray-700">Campaign Title</label>
          <input required type="text" placeholder="e.g. Poppi New Flavor Launch" className="w-full p-3 bg-[#fffcf5] rounded-lg border border-yellow-200 outline-none focus:border-[#ff5b70] focus:ring-1 focus:ring-[#ff5b70]" />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2 text-gray-700">Target Campuses</label>
          <select className="w-full p-3 bg-[#fffcf5] rounded-lg border border-yellow-200 outline-none focus:border-[#ff5b70] focus:ring-1 focus:ring-[#ff5b70] text-gray-700">
            <option>All Network Campuses</option>
            <option>Ivy League Only</option>
            <option>West Coast Schools</option>
            <option>Select Specific...</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2 text-gray-700">Campaign Details</label>
          <textarea required rows={5} placeholder="Describe the event, what you will send (PR boxes, merch), and what the students need to do..." className="w-full p-3 bg-[#fffcf5] rounded-lg border border-yellow-200 outline-none focus:border-[#ff5b70] focus:ring-1 focus:ring-[#ff5b70] resize-none"></textarea>
        </div>
      </div>
      <button type="submit" className="w-full bg-[#ff5b70] hover:bg-rose-500 text-white font-bold py-4 rounded-lg shadow-md transition text-lg border-2 border-[#ff5b70]">
        Publish Campaign
      </button>
    </form>
  </div>
);

// --- MODALS ---

const IGPreviewModal = ({ handle, onClose }: { handle: string, onClose: () => void }) => {
  if(!handle) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200 border-2 border-[#fdf3cb]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-[#ff5b70] z-10 bg-[#fffcf5] rounded-full p-1 shadow-sm border border-yellow-100">
          <X size={20} />
        </button>

        {/* Mock Instagram Header */}
        <div className="p-4 border-b border-gray-100 bg-white">
           <div className="text-center font-bold text-base mb-4 flex items-center justify-center gap-1">
             {handle} <CheckCircle size={14} className="text-blue-500 fill-blue-500 text-white"/>
           </div>
           
           <div className="flex items-center justify-around mb-4">
             <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-0.5">
               <div className="w-full h-full bg-white rounded-full border-2 border-white overflow-hidden">
                 <img src={`https://ui-avatars.com/api/?name=${handle}&background=random`} alt="profile" className="w-full h-full object-cover" />
               </div>
             </div>
             <div className="text-center">
               <div className="font-bold text-lg">124</div>
               <div className="text-xs text-gray-500 font-medium">posts</div>
             </div>
             <div className="text-center">
               <div className="font-bold text-lg">2,451</div>
               <div className="text-xs text-gray-500 font-medium">followers</div>
             </div>
             <div className="text-center">
               <div className="font-bold text-lg">450</div>
               <div className="text-xs text-gray-500 font-medium">following</div>
             </div>
           </div>

           <div className="px-2 mb-4">
             <div className="font-bold text-sm">{handle.toUpperCase()}</div>
             <div className="text-sm text-gray-700 whitespace-pre-line font-medium">
               Official chapter of {handle}<br/>
               📍 Campus Location<br/>
               Building leaders and making an impact.<br/>
               <span className="text-blue-800 font-bold">linktr.ee/{handle}</span>
             </div>
           </div>
           
           <div className="flex gap-2 px-2">
             <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-black font-bold py-1.5 rounded-lg text-sm transition">Following</button>
             <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-black font-bold py-1.5 rounded-lg text-sm transition">Message</button>
           </div>
        </div>

        {/* Mock Grid */}
        <div className="grid grid-cols-3 gap-0.5 bg-white">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="aspect-square bg-gray-100 relative group cursor-pointer">
              <img src={`https://source.unsplash.com/random/400x400?college,student&sig=${i}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" alt="post" />
              <div className="absolute inset-0 bg-[#ff5b70]/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4 text-white">
                <span className="flex items-center gap-1 font-bold text-sm"><Heart size={16} className="fill-white"/> 120</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ApplyModal = ({ campaign, onClose }: { campaign: any, onClose: () => void }) => {
  if(!campaign) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200 border-2 border-yellow-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-[#ff5b70] z-10 bg-[#fffcf5] p-1 rounded-full">
          <X size={20} />
        </button>

        <div className="p-6 border-b border-yellow-100 bg-[#fffcf5]">
          <h2 className="font-bold text-lg text-[#ff5b70]">Apply for {campaign.title}</h2>
          <p className="text-xs text-gray-500 mt-1 font-medium">Submit your registered group profile to {campaign.brand}.</p>
        </div>

        <form className="p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); onClose(); alert('Application submitted! The brand will review your IG profile.'); }}>
          <div className="bg-[#fdf3cb] p-4 rounded-xl border border-yellow-200 mb-4 shadow-sm">
            <p className="text-sm text-gray-700 mb-2 font-bold">Your profile will be shared:</p>
            <ul className="text-sm font-bold text-[#ff5b70] space-y-1">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#ff5b70]"></div> Organization Name</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#ff5b70]"></div> .edu Email Address</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#ff5b70]"></div> Instagram Profile Preview</li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-gray-700">Why is your group a good fit for {campaign.brand}?</label>
            <textarea 
              required
              rows={4} 
              placeholder="Tell the brand why your members would love this product and how you plan to run the pop-up event..."
              className="w-full p-3 rounded-lg border border-yellow-200 outline-none focus:border-[#ff5b70] focus:ring-1 focus:ring-[#ff5b70] text-sm resize-none bg-[#fffcf5]"
            ></textarea>
          </div>
          <button type="submit" className="w-full bg-[#ff5b70] hover:bg-rose-500 text-white font-bold py-3 rounded-lg shadow-md transition mt-2 border-2 border-[#ff5b70]">
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
}

const ContactModal = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200 border-2 border-yellow-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-[#ff5b70] z-10 bg-[#fffcf5] p-1 rounded-full border border-yellow-100 transition shadow-sm">
          <X size={20} />
        </button>
        
        <div className="p-8 text-center bg-[#fffcf5] border-b border-yellow-100">
          <div className="flex items-center justify-center space-x-1 mb-2">
            <span className="text-4xl font-serif italic font-bold text-[#ff5b70] drop-shadow-sm">BUZZ</span>
          </div>
          <h2 className="text-2xl font-bold text-[#ff5b70] mb-1">Contact Us</h2>
          <p className="text-gray-500 font-medium text-sm">Reach out anytime!</p>
        </div>
        
        <div className="p-6 space-y-4 bg-white">
          <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
            <div className="bg-[#fdf3cb] p-2.5 rounded-full shadow-sm text-[#ff5b70] border border-yellow-200"><User size={20} /></div>
            <div className="text-left">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Name</p>
              <p className="font-bold text-gray-800">Avery Example</p>
            </div>
          </div>
          
          <a href="mailto:ae101@example.edu" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition group border border-transparent hover:border-gray-100">
            <div className="bg-[#fdf3cb] p-2.5 rounded-full shadow-sm text-[#ff5b70] border border-yellow-200 group-hover:scale-105 transition"><Mail size={20} /></div>
            <div className="text-left">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Email</p>
              <p className="font-bold text-gray-800 group-hover:text-[#ff5b70] transition">ae101@example.edu</p>
            </div>
          </a>

          <a href="https://instagram.com/bringthebuzzover" target="_blank" rel="noreferrer" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition group border border-transparent hover:border-gray-100">
            <div className="bg-[#fdf3cb] p-2.5 rounded-full shadow-sm text-[#ff5b70] border border-yellow-200 group-hover:scale-105 transition"><Instagram size={20} /></div>
            <div className="text-left">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Instagram</p>
              <p className="font-bold text-gray-800 group-hover:text-[#ff5b70] transition">@bringthebuzzover</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

const Footer = ({ onContactClick }: { onContactClick: () => void }) => (
  <footer className="bg-white py-16 px-8 border-t border-yellow-100 mt-20">
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
      <div>
        <div className="flex items-center space-x-2 font-bold mb-4 text-gray-800">
          <span className="bg-[#fdf3cb] text-xs px-2 py-1 rounded text-[#ff5b70] border border-yellow-200">BZ</span>
          <span className="text-[#ff5b70]">Bring the Buzz Over</span>
        </div>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed font-medium">
          Connecting brands with college campuses through authentic student ambassadors and group pop-ups.
        </p>
      </div>
      
      <div>
        <h4 className="font-bold mb-4 text-gray-900">For Students</h4>
        <ul className="space-y-2 text-sm text-gray-600 font-medium">
          <li className="hover:text-[#ff5b70] cursor-pointer">Register Student Org</li>
          <li className="hover:text-[#ff5b70] cursor-pointer">Browse Campaigns</li>
          <li className="hover:text-[#ff5b70] cursor-pointer">Ambassador Resources</li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold mb-4 text-gray-900">For Brands</h4>
        <ul className="space-y-2 text-sm text-gray-600 font-medium">
          <li className="hover:text-[#ff5b70] cursor-pointer">Brand Portal</li>
          <li className="hover:text-[#ff5b70] cursor-pointer">Post a Campaign</li>
          <li className="hover:text-[#ff5b70] cursor-pointer">Book a Strategy Call</li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold mb-4 text-gray-900">Company</h4>
        <ul className="space-y-2 text-sm text-gray-600 font-medium">
          <li onClick={onContactClick} className="hover:text-[#ff5b70] cursor-pointer">Contact</li>
          <li className="hover:text-[#ff5b70] cursor-pointer">Privacy Policy</li>
        </ul>
      </div>
    </div>
  </footer>
);

// --- MAIN APP COMPONENT ---

export default function App() {
  const [view, setView] = useState('home');
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [previewIGHandle, setPreviewIGHandle] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);

  // Scroll to top on view change
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <div className="font-sans text-gray-800 bg-[#fffcf5] min-h-screen relative selection:bg-[#fdf3cb] selection:text-[#ff5b70]">
      {/* CSS injected for the seamless marquee animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .animate-marquee-reverse {
          animation: marquee-reverse 50s linear infinite;
        }
      `}} />

      <Header setView={setView} onContactClick={() => setIsContactModalOpen(true)} />
      
      <main className="min-h-[60vh]">
        {view === 'home' && <Home setView={setView} />}
        {view === 'register' && <Register setView={setView} />}
        {view === 'campaigns' && <Campaigns setView={setView} setSelected={setSelectedCampaign} />}
        {view === 'details' && (
          <CampaignDetails 
            campaign={selectedCampaign || CAMPAIGNS[0]} 
            onApply={() => setIsApplyModalOpen(true)} 
            onBack={() => setView('campaigns')}
          />
        )}
        {view === 'brand-dashboard' && <BrandDashboard setView={setView} onPreviewIG={setPreviewIGHandle} onBookCall={() => setIsStrategyModalOpen(true)} />}
        {view === 'post-campaign' && <PostCampaign setView={setView} />}
      </main>

      <Footer onContactClick={() => setIsContactModalOpen(true)} />

      {isStrategyModalOpen && (
        <StrategyCallModal onClose={() => setIsStrategyModalOpen(false)} />
      )}

      {isContactModalOpen && (
        <ContactModal onClose={() => setIsContactModalOpen(false)} />
      )}

      {isApplyModalOpen && (
        <ApplyModal 
          campaign={selectedCampaign || CAMPAIGNS[0]} 
          onClose={() => setIsApplyModalOpen(false)} 
        />
      )}

      {previewIGHandle && (
        <IGPreviewModal handle={previewIGHandle} onClose={() => setPreviewIGHandle(null)} />
      )}
    </div>
  );
}