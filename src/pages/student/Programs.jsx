import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Code, Briefcase, Stethoscope, HeartHandshake, PenTool, BrainCircuit, HardHat, Building, Scale, Microscope, Loader2, Server, Cpu, Bot, Pill, Activity, Radiation, TestTube, Wrench, Zap, Radio, Factory, FlaskConical, Calculator, Coins, Megaphone, Lightbulb, Utensils, GraduationCap, BookOpen, Dna, Palette, X, MapPin, Globe, ExternalLink, Sparkles, CheckCircle2, Compass } from 'lucide-react';
import useSWR from 'swr';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { calculateLocationProximity, getSavedPinnedLocation } from '../../data/locationsData';
import { CATEGORY_DEFAULT_MAP, PROGRAM_ASSESSMENT_MAP, RIASEC_TRAITS } from '../../data/assessmentData';

// 1. Hoist static data outside component to avoid recreation (rendering-hoist-jsx)
const CATEGORIES = ['All', 'Technology', 'Business', 'Engineering', 'Health', 'Criminal Justice', 'Arts & Humanities', 'Sciences', 'Education'];

// Map of categories to relevant Senior High School (SHS) academic and TVL strands
const CATEGORY_STRANDS_MAP = {
  'Technology': ['STEM'],
  'Business': ['ABM'],
  'Engineering': ['STEM'],
  'Health': ['STEM'],
  'Criminal Justice': ['HUMSS', 'GAS'],
  'Arts & Humanities': ['HUMSS', 'GAS'],
  'Sciences': ['STEM'],
  'Education': ['HUMSS', 'GAS'],
};

// 2. Map string identifiers from the database to actual React components
const ICON_MAP = {
  Code: <Code size={24} />,
  BrainCircuit: <BrainCircuit size={24} />,
  Briefcase: <Briefcase size={24} />,
  Building: <Building size={24} />,
  HardHat: <HardHat size={24} />,
  Stethoscope: <Stethoscope size={24} />,
  Microscope: <Microscope size={24} />,
  PenTool: <PenTool size={24} />,
  HeartHandshake: <HeartHandshake size={24} />,
  Scale: <Scale size={24} />,
  Server: <Server size={24} />,
  Cpu: <Cpu size={24} />,
  Bot: <Bot size={24} />,
  Pill: <Pill size={24} />,
  Activity: <Activity size={24} />,
  Radiation: <Radiation size={24} />,
  TestTube: <TestTube size={24} />,
  Wrench: <Wrench size={24} />,
  Zap: <Zap size={24} />,
  Radio: <Radio size={24} />,
  Factory: <Factory size={24} />,
  FlaskConical: <FlaskConical size={24} />,
  Calculator: <Calculator size={24} />,
  Coins: <Coins size={24} />,
  Megaphone: <Megaphone size={24} />,
  Lightbulb: <Lightbulb size={24} />,
  Utensils: <Utensils size={24} />,
  GraduationCap: <GraduationCap size={24} />,
  BookOpen: <BookOpen size={24} />,
  Dna: <Dna size={24} />,
  Palette: <Palette size={24} />,
};

// 3. Define the SWR fetcher outside the component (data-n-plus-one: single relational request)
const fetchPrograms = async () => {
  const { data, error } = await supabase
    .from('programs')
    .select(`
      *,
      universities:program_universities(
        university:universities(*)
      )
    `)
    .order('category')
    .order('title');
    
  if (error) throw error;
  
  // Transform the nested structure into a flatter one for easier UI usage
  return data.map(program => ({
    ...program,
    universities: program.universities.map(u => u.university).filter(Boolean)
  }));
};

// Helper: Calculate whether a program aligns with the student's strand and Holland Code
const getProgramRecommendation = (program, userStrand, hollandCode) => {
  const categoryStrands = CATEGORY_STRANDS_MAP[program.category] || [];
  const programAssessment = PROGRAM_ASSESSMENT_MAP[program.title] || CATEGORY_DEFAULT_MAP[program.category] || { code: 'IRC', why: '' };
  const programCode = programAssessment.code || 'IRC';

  const strandMatch = Boolean(
    userStrand && categoryStrands.some(s => s.toLowerCase() === userStrand.toLowerCase())
  );
  
  let hollandMatch = false;
  let sharedLetters = [];
  if (hollandCode && programCode) {
    const studentLetters = hollandCode.toUpperCase().split('');
    const programLetters = programCode.toUpperCase().split('');
    sharedLetters = studentLetters.filter(l => programLetters.includes(l));
    // Matches if primary letter matches or has at least 2 shared traits
    hollandMatch = studentLetters[0] === programLetters[0] || sharedLetters.length >= 2;
  }

  const isRecommended = strandMatch || hollandMatch;

  return {
    isRecommended,
    strandMatch,
    hollandMatch,
    categoryStrands,
    programCode,
    sharedLetters,
    why: programAssessment.why
  };
};

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

// ─── Program Details Modal Component ─────────────────────────────────────────
const ProgramDetailsModal = ({ program, recommendation, userStrand, hollandCode, onClose }) => {
  if (!program) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem'
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-card"
        style={{
          width: '100%', maxWidth: '720px', maxHeight: '90vh',
          overflowY: 'auto', padding: '2.5rem', position: 'relative',
          border: '1px solid var(--accent-teal)'
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute', top: '1.5rem', right: '1.5rem',
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', padding: '0.5rem'
          }}
        >
          <X size={24} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ 
            padding: '1rem', borderRadius: '16px', 
            background: 'rgba(0, 242, 254, 0.1)', color: 'var(--accent-teal)'
          }}>
            {ICON_MAP[program.icon_name] || <Code size={32} />}
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-teal)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {program.category}
            </span>
            <h2 style={{ fontSize: '2rem', margin: '0.2rem 0', color: 'var(--text-primary)' }}>{program.title}</h2>
          </div>
        </div>

        <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          {program.description}
        </p>

        {/* Academic & Career Alignment Section */}
        <div style={{
          marginBottom: '2rem',
          padding: '1.25rem',
          borderRadius: '14px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--glass-border)'
        }}>
          <h3 style={{ fontSize: '1.15rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Compass size={20} color="var(--accent-teal)" />
            Academic & Career Alignment
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {/* SHS Strand Alignment */}
            <div style={{ padding: '0.9rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em' }}>
                Senior High Strand Fit
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                {(recommendation?.categoryStrands || []).map(strand => {
                  const isMatch = userStrand && strand.toLowerCase() === userStrand.toLowerCase();
                  return (
                    <span key={strand} style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      background: isMatch ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      color: isMatch ? '#4ade80' : 'var(--text-primary)',
                      border: isMatch ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      {strand} {isMatch && <CheckCircle2 size={12} />}
                    </span>
                  );
                })}
              </div>
              {recommendation?.strandMatch ? (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#4ade80' }}>
                  ✓ Direct match for your {userStrand} strand
                </p>
              ) : userStrand ? (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Your profile strand is {userStrand}
                </p>
              ) : null}
            </div>

            {/* Holland RIASEC Code */}
            <div style={{ padding: '0.9rem', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em' }}>
                Holland RIASEC Code
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: 'var(--accent-teal)'
                }}>
                  {recommendation?.programCode}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  ({recommendation?.programCode.split('').map(letter => RIASEC_TRAITS[letter]?.name || letter).join(' · ')})
                </span>
              </div>
              {hollandCode ? (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: recommendation?.hollandMatch ? '#4ade80' : 'var(--text-secondary)' }}>
                  {recommendation?.hollandMatch 
                    ? `✓ Aligns with your Holland Code (${hollandCode})` 
                    : `Your Holland Code is ${hollandCode}`}
                </p>
              ) : (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Take the Career Assessment to check code fit
                </p>
              )}
            </div>
          </div>

          {recommendation?.why && (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
              &ldquo;{recommendation.why}&rdquo;
            </p>
          )}
        </div>

        <div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GraduationCap size={22} color="var(--accent-violet)" />
            Offered by these Universities
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {program.universities && program.universities.length > 0 ? (
              program.universities.map((uni) => (
                <motion.div
                  key={uni.id}
                  whileHover={{ x: 5, background: 'rgba(255,255,255,0.05)' }}
                  style={{
                    padding: '1.25rem', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: '48px', height: '48px', borderRadius: '8px',
                      background: 'rgba(112, 0, 255, 0.1)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: 'var(--accent-violet)'
                    }}>
                      {uni.logo_url ? <img src={uni.logo_url} alt={uni.name} style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} /> : <Building size={24} />}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{uni.name}</h4>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MapPin size={12} /> {uni.location || 'Location not listed'}
                      </p>
                    </div>
                  </div>
                  {uni.website && (
                    <a 
                      href={uni.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-teal)', display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}
                    >
                      <Globe size={16} /> Website <ExternalLink size={14} />
                    </a>
                  )}
                </motion.div>
              ))
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No universities currently listed for this program.</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Programs = () => {
  const { user, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [hollandCode, setHollandCode] = useState(null);
  const pinnedLocation = getSavedPinnedLocation(user?.id);

  // Derive the student's strand from profile or user metadata
  const userStrand = profile?.shs_strand || user?.user_metadata?.shs_strand || null;

  // Load the student's assessment Holland Code
  useEffect(() => {
    let isCurrent = true;
    const loadAssessment = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('assessment_attempts')
          .select('result')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.result?.code && isCurrent) {
          setHollandCode(data.result.code);
          return;
        }
      }

      try {
        const raw = localStorage.getItem(`skillmatch_assessment_${user?.id || 'guest'}`);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.hollandCode && isCurrent) setHollandCode(parsed.hollandCode);
      } catch {
        // ignore
      }
    };

    loadAssessment();
    return () => { isCurrent = false; };
  }, [user?.id]);

  // 4. Client-side deduplication and caching using SWR (client-swr-dedup)
  const { data: programs, error, isLoading } = useSWR('programs_list', fetchPrograms, {
    revalidateOnFocus: false, // Prevents unnecessary refetches on tab switch
  });

  // 5. Use useMemo for expensive filtering and personalized prioritization (rerender-memo)
  const filteredPrograms = useMemo(() => {
    if (!programs) return [];
    
    // js-hoist-regexp: Hoist toLowerCase outside the loop to prevent recalculating N times
    const searchLower = searchQuery.toLowerCase();

    // Attach recommendation metadata to each program
    const list = programs.map(program => ({
      ...program,
      _rec: getProgramRecommendation(program, userStrand, hollandCode)
    }));
    
    const filtered = list.filter(program => {
      // Category filtering: handle "Recommended" special view vs specific category vs "All"
      if (activeCategory === 'Recommended') {
        if (!program._rec.isRecommended) return false;
      } else if (activeCategory !== 'All') {
        if (program.category !== activeCategory) return false;
      }
      
      // js-early-exit: If no search query, keep program
      if (!searchLower) return true;

      return (
        program.title.toLowerCase().includes(searchLower) || 
        program.description.toLowerCase().includes(searchLower) ||
        program.category.toLowerCase().includes(searchLower) ||
        (program._rec.categoryStrands || []).some(s => s.toLowerCase().includes(searchLower)) ||
        program._rec.programCode.toLowerCase().includes(searchLower)
      );
    });

    // When viewing "All", pin/sort recommended programs near the top for easy discovery
    if (activeCategory === 'All' && (userStrand || hollandCode)) {
      return [...filtered].sort((a, b) => {
        if (a._rec.isRecommended && !b._rec.isRecommended) return -1;
        if (!a._rec.isRecommended && b._rec.isRecommended) return 1;
        return a.title.localeCompare(b.title);
      });
    }

    return filtered;
  }, [searchQuery, activeCategory, programs, userStrand, hollandCode]);

  return (
    <div className="student-page" style={{ padding: '2rem 0' }}>
      
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '2rem' }}
      >
        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 2.5rem)', margin: 0, color: 'var(--text-primary)' }}>College Programs</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Explore degree programs aligned with your strand and career assessment.</p>
      </motion.div>

      {/* Personalized Student Strand & Holland Code Recommendation Banner */}
      {(userStrand || hollandCode) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: '2rem',
            padding: '1.25rem 1.5rem',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.08), rgba(112, 0, 255, 0.08))',
            border: '1px solid rgba(0, 242, 254, 0.25)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(0, 242, 254, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-teal)',
              flexShrink: 0
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                Personalized Strand & Career Recommendations
              </h4>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {userStrand ? <>Your SHS Strand: <strong style={{ color: '#fff' }}>{userStrand}</strong></> : null}
                {userStrand && hollandCode ? ' • ' : null}
                {hollandCode ? (
                  <>Your Holland Code: <strong style={{ color: 'var(--accent-teal)' }}>{hollandCode}</strong> ({hollandCode.split('').map(l => RIASEC_TRAITS[l]?.name || l).join(' · ')})</>
                ) : (
                  <span>Take the <Link to="/dashboard/assessment" style={{ color: 'var(--accent-teal)', textDecoration: 'underline' }}>Career Assessment</Link> to unlock Holland RIASEC matching.</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveCategory(activeCategory === 'Recommended' ? 'All' : 'Recommended')}
            style={{
              padding: '0.6rem 1.15rem',
              borderRadius: '999px',
              background: activeCategory === 'Recommended' ? 'var(--accent-teal)' : 'rgba(0, 242, 254, 0.15)',
              color: activeCategory === 'Recommended' ? '#000' : 'var(--accent-teal)',
              border: '1px solid var(--accent-teal)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Sparkles size={15} />
            {activeCategory === 'Recommended' ? 'Showing Recommended (View All)' : 'Show Recommended Programs'}
          </button>
        </motion.div>
      )}

      {/* Filter and Search Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: '3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
      >
        <div style={{ position: 'relative', maxWidth: '600px' }}>
          <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            id="program-search"
            type="text" 
            placeholder="Search programs by title, strand (STEM, ABM...), or RIASEC code..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search programs"
            style={{
              width: '100%',
              padding: '1rem 1rem 1rem 3rem',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Category Pills with Strand & Recommendation Tagging */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* All Programs button */}
          <button
            onClick={() => setActiveCategory('All')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '999px',
              border: `1px solid ${activeCategory === 'All' ? 'var(--accent-teal)' : 'var(--glass-border)'}`,
              background: activeCategory === 'All' ? 'rgba(0, 242, 254, 0.1)' : 'var(--glass-bg)',
              color: activeCategory === 'All' ? 'var(--accent-teal)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.9rem',
              fontWeight: activeCategory === 'All' ? 600 : 400
            }}
          >
            All
          </button>

          {/* Quick Filter: Recommended for You */}
          {(userStrand || hollandCode) && (
            <button
              onClick={() => setActiveCategory('Recommended')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                border: `1px solid ${activeCategory === 'Recommended' ? 'var(--accent-teal)' : 'rgba(0, 242, 254, 0.35)'}`,
                background: activeCategory === 'Recommended' ? 'rgba(0, 242, 254, 0.18)' : 'rgba(0, 242, 254, 0.05)',
                color: 'var(--accent-teal)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Sparkles size={14} />
              Recommended for You
            </button>
          )}

          {CATEGORIES.filter(c => c !== 'All').map(category => {
            const categoryStrands = CATEGORY_STRANDS_MAP[category] || [];
            const categoryDefault = CATEGORY_DEFAULT_MAP[category];
            const isStrandMatch = Boolean(userStrand && categoryStrands.some(s => s.toLowerCase() === userStrand.toLowerCase()));
            const isHollandMatch = Boolean(hollandCode && categoryDefault && (
              hollandCode[0] === categoryDefault.code[0] || 
              categoryDefault.code.split('').filter(l => hollandCode.includes(l)).length >= 2
            ));
            const isRecommendedCat = isStrandMatch || isHollandMatch;

            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '999px',
                  border: `1px solid ${activeCategory === category ? 'var(--accent-teal)' : isRecommendedCat ? 'rgba(0, 242, 254, 0.3)' : 'var(--glass-border)'}`,
                  background: activeCategory === category 
                    ? 'rgba(0, 242, 254, 0.1)' 
                    : isRecommendedCat 
                      ? 'rgba(0, 242, 254, 0.03)' 
                      : 'var(--glass-bg)',
                  color: activeCategory === category 
                    ? 'var(--accent-teal)' 
                    : isRecommendedCat 
                      ? 'var(--text-primary)' 
                      : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: activeCategory === category ? 600 : 400
                }}
              >
                {isRecommendedCat && <Sparkles size={12} color="var(--accent-teal)" />}
                {category}
                {categoryStrands.length > 0 && (
                  <span style={{ fontSize: '0.72rem', opacity: 0.65, textTransform: 'uppercase' }}>
                    ({categoryStrands[0]})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Programs Grid */}
      <motion.div 
        variants={CONTAINER_VARIANTS}
        initial="hidden"
        animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '2rem' }}
      >
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}
            >
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: 'linear', duration: 1 }}>
                <Loader2 size={48} color="var(--accent-teal)" />
              </motion.div>
              <p style={{ marginTop: '1rem', fontSize: '1.2rem' }}>Loading programs...</p>
            </motion.div>
          ) : error ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0' }}
            >
              <p style={{ color: '#ff4d4d', fontSize: '1.2rem' }}>Failed to load programs. Please try again.</p>
            </motion.div>
          ) : filteredPrograms.length > 0 ? (
            filteredPrograms.map((program) => {
              const nearbyUnis = (program.universities || []).filter(u => 
                calculateLocationProximity(pinnedLocation, u.location, u.name).isNearby
              );
              const isNearby = nearbyUnis.length > 0;
              const rec = program._rec;

              return (
                <motion.div
                  key={program.id}
                  layout
                  variants={CARD_VARIANTS}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass-card"
                  whileHover={{ translateY: -5, borderColor: 'var(--accent-teal)' }}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem',
                    borderColor: rec?.isRecommended ? 'rgba(0, 242, 254, 0.35)' : undefined,
                    boxShadow: rec?.isRecommended ? '0 4px 20px rgba(0, 242, 254, 0.08)' : undefined
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ 
                      padding: '0.75rem', 
                      borderRadius: '12px', 
                      background: 'rgba(0, 242, 254, 0.1)',
                      color: 'var(--accent-teal)'
                    }}>
                      {ICON_MAP[program.icon_name] || <Code size={24} />}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {rec?.isRecommended && (
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '0.22rem 0.6rem',
                          borderRadius: '999px',
                          background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(112, 0, 255, 0.2))',
                          border: '1px solid rgba(0, 242, 254, 0.4)',
                          color: 'var(--accent-teal)',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <Sparkles size={11} />
                          {rec.strandMatch && rec.hollandMatch 
                            ? 'Top Match' 
                            : rec.strandMatch 
                              ? `${userStrand} Match` 
                              : 'Holland Match'}
                        </span>
                      )}
                      {isNearby && (
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '999px',
                          background: 'rgba(74, 222, 128, 0.15)',
                          color: '#4ade80',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem'
                        }}>
                          <MapPin size={10} /> Near You
                        </span>
                      )}
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '999px',
                        background: 'var(--glass-border)',
                        color: 'var(--text-secondary)'
                      }}>
                        {program.category}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                      {program.title}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                      {program.description}
                    </p>
                  </div>

                  {/* SHS Strand & Holland Code Badges */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '0.25rem' }}>
                    {rec?.categoryStrands?.length > 0 && (
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: rec.strandMatch ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: rec.strandMatch ? '#4ade80' : 'var(--text-secondary)',
                        border: rec.strandMatch ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                        fontWeight: 600
                      }}>
                        Strand: {rec.categoryStrands.join(' / ')}
                      </span>
                    )}
                    {rec?.programCode && (
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: rec.hollandMatch ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: rec.hollandMatch ? 'var(--accent-teal)' : 'var(--text-secondary)',
                        border: rec.hollandMatch ? '1px solid rgba(0, 242, 254, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                        fontWeight: 600
                      }}>
                        RIASEC: {rec.programCode}
                      </span>
                    )}
                  </div>
                
                  <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                    <motion.button 
                      onClick={() => setSelectedProgram(program)}
                      whileHover={{ backgroundColor: 'var(--accent-violet)', color: '#fff' }}
                      aria-label={`View details for ${program.title}`}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--accent-violet)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease, color 0.2s ease',
                      }}
                    >
                      View Details
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0' }}
            >
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
                {activeCategory === 'Recommended'
                  ? 'No recommended programs found for your current filter. Try viewing "All" to browse all disciplines.'
                  : 'No programs found matching your criteria.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Program Details Modal with Academic Alignment */}
      <AnimatePresence>
        {selectedProgram && (
          <ProgramDetailsModal 
            program={selectedProgram}
            recommendation={selectedProgram._rec}
            userStrand={userStrand}
            hollandCode={hollandCode}
            onClose={() => setSelectedProgram(null)} 
          />
        )}
      </AnimatePresence>

    </div>
  );
};

export default Programs;