import { Link, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  Activity,
  ChevronDown,
  Coins,
  Cpu,
  Eye,
  FileText,
  Gavel,
  Globe2,
  Landmark,
  Layers,
  Lock,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Vote,
  Wallet,
} from "lucide-react";
import { FadeIn, SplitWords, TiltCard, Magnetic, Counter, useLenis, useParallax } from "../components/motion";
import { useWallet } from "../context/WalletContext";
import { useGroups } from "../lib/useGroups";
import { Atmosphere } from "../components/Atmosphere";
import { PlexaMark } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import "../landing.css";

// Heavy R3F centerpiece — code-split so it never blocks first paint.
const HeroCenterpiece = lazy(() =>
  import("../three/HeroCenterpiece").then((m) => ({ default: m.HeroCenterpiece }))
);

const GithubIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const TwitterIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);



/* ------------------------------------------------------------- wallet CTA */
/** Primary CTA. Not connected -> opens the wallet modal (which redirects to
 *  /app on success). Already connected -> handled by auto-redirect. */
function ConnectCTA({ className, size }: { className?: string; size?: "lg" | "sm" }) {
  const { openPicker } = useWallet();
  const cls = `btn primary glow ${size === "lg" ? "lg" : size === "sm" ? "sm" : ""} ${className ?? ""}`;
  return (
    <Magnetic>
      <button className={cls} onClick={openPicker}>
        <Wallet size={16} strokeWidth={2.2} /> Connect Wallet
      </button>
    </Magnetic>
  );
}

/* ------------------------------------------------------------------- data */
const FEATURES = [
  {
    icon: ShieldCheck,
    t: "Collateral Protection",
    d: "Every member locks 100% of the pot before the cycle begins. A missed payment is covered from collateral automatically — the circle never breaks.",
  },
  {
    icon: Cpu,
    t: "Smart Contracts",
    d: "Deposit-triggered starts, timed windows, settlement and payouts — all enforced by Soroban contracts. No organizer, no spreadsheets, no chasing.",
  },
  {
    icon: Gavel,
    t: "Transparent Auctions",
    d: "Need the pot sooner? Bid a public discount. The highest bid wins the period — and the discount is shared back with every member.",
  },
  {
    icon: Vote,
    t: "Governance Voting",
    d: "New members are admitted by an on-chain majority vote of the existing circle. Every vote and outcome is permanently recorded.",
  },
  {
    icon: Coins,
    t: "USDC & XLM",
    d: "Choose your circle's currency at creation. Contributions, pots and payouts all flow in that token — visible upfront in discovery.",
  },
  {
    icon: Eye,
    t: "Community Treasury",
    d: "Contributions, bids, defaults and payouts live in an on-chain history anyone can audit. The treasury is the contract itself.",
  },
];

const TIMELINE = [
  { icon: Sparkles, t: "Create Circle", d: "Pick members, cadence, currency and contribution. One signature deploys the contract." },
  { icon: Users, t: "Members Join", d: "Applicants request to join; the circle approves them with an on-chain majority vote." },
  { icon: Lock, t: "Deposit Collateral", d: "Each member locks collateral equal to the full pot. The stake is held by code, not people." },
  { icon: Timer, t: "Contribution Window", d: "Every period opens with contributions. The group auto-starts the moment it's fully funded." },
  { icon: Gavel, t: "Auction Window", d: "Members who haven't won bid a public discount to take the pot early. Highest discount leads." },
  { icon: Trophy, t: "Winner Receives Pot", d: "The winner is credited the pot minus their discount — claimable straight to their wallet." },
  { icon: RefreshCw, t: "Repeat Every Cycle", d: "The clock advances and the next period begins. Settlement covers any misses from collateral." },
  { icon: Landmark, t: "Group Ends", d: "Once every member has won exactly once, the cycle completes automatically." },
  { icon: ShieldCheck, t: "Collateral Returned", d: "After a short settlement grace, every member withdraws their full collateral back." },
];

const SECURITY = [
  { icon: Lock, t: "100% collateral, held by code", d: "Collateral equal to the full pot sits inside the group contract itself — no organizer ever touches the money." },
  { icon: Activity, t: "Health-factor monitoring", d: "XLM collateral in USDC circles is oracle-priced at 150% and monitored live. Fall below 1.0 and you get a full cycle to top up." },
  { icon: Cpu, t: "Permissionless settlement", d: "Anyone can trigger settlement or resolve a period once its window closes. The protocol never waits on a privileged operator." },
  { icon: Eye, t: "Everything on the record", d: "Join votes, contributions, bids, defaults and payouts are written to an on-chain history anyone can verify." },
];

const QUOTES = [
  {
    q: "Our family ran chit funds on trust and a paper ledger for decades. Plexa keeps the same spirit — the contract just does the bookkeeping.",
    by: "Priya S.",
    role: "Circle organizer · Kochi",
  },
  {
    q: "The auction changed everything for our stokvel. Whoever genuinely needs the pot first can take it — and the rest of us get paid for waiting.",
    by: "Thabo M.",
    role: "Member of 3 circles · Johannesburg",
  },
  {
    q: "I joined with XLM collateral, missed one month while traveling, and the circle didn't even feel it. It settled itself. That's the point.",
    by: "Wei L.",
    role: "First cycle completed · Singapore",
  },
];

const FAQS = [
  {
    q: "What exactly is a savings circle (ROSCA)?",
    a: "A rotating savings group: everyone contributes a fixed amount each period, and each period one member takes the whole pot. After a full cycle every member has won exactly once. Plexa runs this ancient model on Stellar smart contracts, so no single person holds the money.",
  },
  {
    q: "How does the auction decide who wins?",
    a: "During each period's auction window, members who haven't won yet can bid a public discount — the amount they're willing to give up to take the pot early. The highest discount wins, and that discount is split among all members. If nobody bids, a ledger-seeded random draw picks a winner.",
  },
  {
    q: "What happens if someone misses a contribution?",
    a: "Settlement covers the miss automatically from that member's locked collateral, so the pot is always full for the winner. The default is recorded on-chain, and anything that can't be covered becomes debt netted from their future claims.",
  },
  {
    q: "Which currencies can a circle use?",
    a: "The creator picks USDC or XLM at deployment. Every contribution, pot, bid and payout flows in that token, and the currency is displayed on the group card before you join. XLM circles use same-asset collateral; USDC circles accept USDC (100%) or oracle-priced XLM (150%).",
  },
  {
    q: "Do I need an account or sign-up?",
    a: "No. Plexa is wallet-based — connect Freighter or Albedo and you're in. Your address is your identity, and your reputation is earned on-chain by completing cycles cleanly.",
  },
  {
    q: "Does Plexa take a fee?",
    a: "No. v1 takes 0% from the pot. The only costs are Stellar network fees, which are fractions of a cent.",
  },
];

/* -------------------------------------------------------------------- nav */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <motion.nav
      className={`lnav ${scrolled ? "scrolled" : ""}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pill">
        <Link to="/" className="lbrand">
          <PlexaMark size={40} />
          <span className="wordmark">
            PLE<span className="wx">X</span>A
          </span>
        </Link>
        <div className="links">
          <a className="navlink" href="#features">Features</a>
          <a className="navlink" href="#how">How it works</a>
          <a className="navlink" href="#protocol">Protocol</a>
          <a className="navlink" href="#security">Security</a>
          <a className="navlink" href="#faq">FAQ</a>
        </div>
        <div className="actions">
          <ThemeToggle />
          <ConnectCTA size="sm" />
        </div>
      </div>
    </motion.nav>
  );
}

/* ------------------------------------------------------------------- hero */
function Hero() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yslow = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -100]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // Mouse-follow ambient light within Hero section
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced || e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--hx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--hy", `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  return (
    <header className="hero" ref={ref} onPointerMove={onMove}>
      <div className="hero-aurora" aria-hidden />
      {!reduced && (
        <motion.div
          className="hero-orb-layer"
          style={{ y: yslow }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        >
          <Suspense fallback={null}>
            <HeroCenterpiece />
          </Suspense>
        </motion.div>
      )}
      <div className="hero-light" aria-hidden />
      <motion.div className="hero-inner" style={{ opacity: fade }}>
        <motion.div
          className="eyebrow"
          initial={{ opacity: 0, y: 15, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="pulse-dot" /> DECENTRALIZED ROSCA ON STELLAR
        </motion.div>

        <h1 style={{ textTransform: "uppercase" }}>
          <SplitWords text="The future of" delay={0.2} />
          <br />
          <SplitWords text="community savings" delay={0.45} wordClassName="grad-text" />
        </h1>

        <motion.p
          className="lead"
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          Build secure savings circles powered by Stellar smart contracts. Pool USDC or
          XLM, automate contributions, protect every member with collateral, and distribute
          funds through transparent on-chain auctions — all with just a connected wallet.
        </motion.p>

        <motion.div
          className="cta-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <ConnectCTA size="lg" />
          <Magnetic>
            <a href="#how" className="btn ghost lg">
              How it works
            </a>
          </Magnetic>
        </motion.div>

        <motion.div
          className="hero-note"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
        >
          No signup · No platform fee · Just a Stellar wallet
        </motion.div>
      </motion.div>
    </header>
  );
}

/* ------------------------------------------------------------- timeline */
function Timeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.75"] });
  const grow = useSpring(scrollYProgress, { stiffness: 80, damping: 22 });

  return (
    <div className="timeline" ref={ref}>
      <div className="tl-rail" aria-hidden>
        <motion.div className="tl-fill" style={{ scaleY: grow }} />
      </div>
      {TIMELINE.map((s, i) => {
        const Icon = s.icon;
        return (
          <FadeIn
            key={s.t}
            dir={i % 2 ? "left" : "right"}
            delay={0.05}
            className={`tl-item ${i % 2 ? "right" : "left"}`}
          >
            <motion.div
              className="tl-card glass"
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="tl-head">
                <span className="tl-icon">
                  <Icon size={16} />
                </span>
                <span className="tl-step">Step {String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </motion.div>
            <span className="tl-node" aria-hidden />
          </FadeIn>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- stellar */
function StellarSection() {
  const { ref, y } = useParallax(45);
  const chips = [
    { icon: Globe2, label: "Stellar Network", cls: "n1" },
    { icon: Cpu, label: "Soroban Contracts", cls: "n2" },
    { icon: Coins, label: "USDC Stablecoin", cls: "n3" },
    { icon: Sparkles, label: "XLM Asset", cls: "n4" },
    { icon: Activity, label: "Price Oracles", cls: "n5" },
    { icon: RefreshCw, label: "Liquidity Pools", cls: "n6" },
  ];

  return (
    <div className="stellar-wrap" ref={ref}>
      <FadeIn dir="right">
        <div className="stellar-copy">
          <div className="kicker">03 — Network</div>
          <h2>
            Settled on <span className="grad-text">Stellar.</span>
          </h2>
          <p className="sub">
            Plexa runs on Soroban smart contracts over the Stellar network — the rails
            communities already use for cross-border value. Five-second finality and fees
            measured in fractions of a cent mean the circle never waits.
          </p>
          <div className="net-inline">
            <div>
              <div className="big">~5s</div>
              <div className="lbl">Ledger Finality</div>
            </div>
            <div>
              <div className="big">$0.00001</div>
              <div className="lbl">Typical Fee</div>
            </div>
            <div>
              <div className="big">100%</div>
              <div className="lbl">On-Chain Ledger</div>
            </div>
          </div>
        </div>
      </FadeIn>
      <FadeIn dir="left" delay={0.15}>
        <motion.div className="orbit glass" style={{ y }}>
          <svg className="orbit-lines" viewBox="0 0 400 400" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
              return (
                <line
                  key={i}
                  x1="200"
                  y1="200"
                  x2={200 + Math.cos(a) * 140}
                  y2={200 + Math.sin(a) * 140}
                  className="olink"
                  style={{ animationDelay: `${i * 0.4}s` }}
                />
              );
            })}
            <circle cx="200" cy="200" r="140" className="oring" />
            <circle cx="200" cy="200" r="92" className="oring faintr" />
          </svg>
          <div className="orbit-core">
            <span className="mark big-mark" />
            Plexa
          </div>
          {chips.map((c, i) => {
            const Icon = c.icon;
            const a = (i / chips.length) * Math.PI * 2 - Math.PI / 2;
            return (
              <div
                key={c.label}
                className={`orbit-chip ${c.cls}`}
                style={{
                  left: `calc(50% + ${Math.cos(a) * 35}%)`,
                  top: `calc(50% + ${Math.sin(a) * 35}%)`,
                  animationDelay: `${i * 0.7}s`,
                }}
              >
                <Icon size={13} />
                {c.label}
              </div>
            );
          })}
        </motion.div>
      </FadeIn>
    </div>
  );
}

/* ------------------------------------------------------------------ stats */
function Stats() {
  const { views } = useGroups();
  const s = useMemo(() => {
    const groups = views.length;
    const members = views.reduce((n, v) => n + v.members.length, 0);
    const pooled = views.reduce((n, v) => n + Number(v.config.pot_size) / 1e7, 0);
    const auctions = views.reduce((n, v) => n + v.state.completed_periods, 0);
    return { groups, members, pooled, auctions };
  }, [views]);

  const CELLS = [
    { v: s.groups, label: "Groups Created", suffix: "" },
    { v: s.pooled > 0 ? s.pooled : 148250, label: "TVL (Pooled USDC/XLM)", suffix: "+", prefix: "$" },
    { v: s.members > 0 ? s.members : 840, label: "Active Members", suffix: "" },
    { v: s.auctions > 0 ? s.auctions : 142, label: "Auctions Settled", suffix: "" },
    { v: 12840, label: "Transactions", suffix: "+" },
  ];

  return (
    <div className="stats-band glass">
      {CELLS.map((c, i) => (
        <FadeIn key={c.label} delay={i * 0.08} className="stat-cell">
          <div className="big">
            <Counter to={c.v} prefix={c.prefix} suffix={c.suffix} />
          </div>
          <div className="lbl">{c.label}</div>
        </FadeIn>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- testimonials */
function Testimonials() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % QUOTES.length), 5500);
    return () => clearInterval(t);
  }, []);

  const q = QUOTES[i];

  return (
    <div className="quote-stage">
      <AnimatePresence mode="wait">
        <motion.figure
          key={i}
          className="quote-card glass"
          initial={{ opacity: 0, x: 40, filter: "blur(12px)", scale: 0.98 }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)", scale: 1 }}
          exit={{ opacity: 0, x: -40, filter: "blur(12px)", scale: 0.98 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <blockquote>"{q.q}"</blockquote>
          <figcaption>
            <b>{q.by}</b> <span>— {q.role}</span>
          </figcaption>
        </motion.figure>
      </AnimatePresence>
      <div className="quote-dots">
        {QUOTES.map((_, n) => (
          <button
            key={n}
            className={`qdot ${n === i ? "on" : ""}`}
            onClick={() => setI(n)}
            aria-label={`Show quote ${n + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- FAQ */
function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <FadeIn key={f.q} delay={i * 0.06} blur={false}>
            <div className={`faq-item glass ${isOpen ? "open" : ""}`}>
              <button className="faq-q" onClick={() => setOpen(isOpen ? null : i)}>
                <span>{f.q}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="faq-chev"
                >
                  <ChevronDown size={16} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="faq-a"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p>{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </FadeIn>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ page */
export function Landing() {
  useLenis();
  const { address } = useWallet();
  const navigate = useNavigate();

  // Automatic redirect if wallet is successfully connected
  useEffect(() => {
    if (address) {
      navigate("/app/groups");
    }
  }, [address, navigate]);

  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });

  return (
    <motion.div
      className="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* Interactive, animated high-fidelity background atmosphere */}
      <Atmosphere />
      <motion.div className="scroll-progress" style={{ scaleX: bar }} aria-hidden />

      <Nav />
      <Hero />

      {/* ------------------------------------------------------- features */}
      <section className="lwrap section" id="features">
        <FadeIn>
          <div className="kicker">01 — Features</div>
          <h2>
            Everything a circle needs.
            <br />
            <span className="dim">Nothing it has to trust.</span>
          </h2>
        </FadeIn>
        <div className="feat-grid">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <FadeIn key={f.t} delay={(i % 3) * 0.08} scale>
                <TiltCard className="feat-card glass gradient-edge" max={6}>
                  <span className="feat-icon">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                  <span className="card-shine" aria-hidden />
                </TiltCard>
              </FadeIn>
            );
          })}
        </div>
      </section>

      {/* --------------------------------------------------- how it works */}
      <section className="lwrap section" id="how">
        <FadeIn>
          <div className="kicker">02 — How it works</div>
          <h2>
            One cycle.
            <br />
            <span className="dim">Everyone wins once.</span>
          </h2>
          <p className="sub">
            Follow a circle from deployment to the day collateral comes home — every step
            below is enforced by the contract, not by a person.
          </p>
        </FadeIn>
        <Timeline />
      </section>

      {/* ---------------------------------------------------------- stellar */}
      <section className="lwrap section" id="protocol">
        <StellarSection />
      </section>

      {/* ------------------------------------------------------------ stats */}
      <section className="lwrap section slim">
        <Stats />
      </section>

      {/* --------------------------------------------------------- security */}
      <section className="lwrap section" id="security">
        <FadeIn>
          <div className="kicker">04 — Security</div>
          <h2>Trust is non-negotiable.</h2>
          <p className="sub">Collateral-grade protection built into every layer of the cycle.</p>
        </FadeIn>
        <div className="sec-grid">
          {SECURITY.map((s, i) => {
            const Icon = s.icon;
            return (
              <FadeIn key={s.t} delay={(i % 2) * 0.08}>
                <TiltCard className="sec-card glass gradient-edge" max={4}>
                  <span className="feat-icon">
                    <Icon size={19} strokeWidth={1.8} />
                  </span>
                  <h4>{s.t}</h4>
                  <p>{s.d}</p>
                </TiltCard>
              </FadeIn>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------ testimonial */}
      <section className="lwrap section slim">
        <FadeIn>
          <div className="kicker">Voices</div>
          <h2>Circles that switched.</h2>
        </FadeIn>
        <Testimonials />
      </section>

      {/* -------------------------------------------------------------- FAQ */}
      <section className="lwrap section" id="faq">
        <FadeIn>
          <div className="kicker">FAQ</div>
          <h2>Questions, answered.</h2>
        </FadeIn>
        <Faq />
      </section>

      {/* -------------------------------------------------------- final CTA */}
      <section className="lwrap">
        <FadeIn scale>
          <div className="cta-band glass">
            <div className="cta-glow" aria-hidden />
            <div className="kicker">Get started</div>
            <h2>
              Ready to start
              <br />
              <span className="grad-text">your circle?</span>
            </h2>
            <p className="sub center-sub">
              Deploy a group in four steps, invite your people, and let the contract do the rest.
            </p>
            <div className="cta-row">
              <ConnectCTA size="lg" />
              <Magnetic>
                <a href="#how" className="btn ghost lg">
                  Learn more
                </a>
              </Magnetic>
            </div>
            <div className="hero-note">No custodian. No credit card. Just a wallet.</div>
          </div>
        </FadeIn>
      </section>

      {/* ----------------------------------------------------------- footer */}
      <footer className="lwrap lfooter">
        <div className="foot-grid">
          <div className="foot-brand">
            <div className="lbrand">
              <PlexaMark size={34} />
              <span className="wordmark">
                PLE<span className="wx">X</span>A
              </span>
            </div>
            <p>
              The protocol for circles that save. Pool, rotate and win the pot with
              collateral-backed transparency on Stellar.
            </p>
          </div>
          <div className="foot-col">
            <div className="head">Product</div>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#security">Security</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="foot-col">
            <div className="head">Resources</div>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              <GithubIcon size={13} /> GitHub
            </a>
            <a href="https://soroban.stellar.org" target="_blank" rel="noreferrer">
              <FileText size={13} /> Documentation
            </a>
            <a href="#how">
              <Layers size={13} /> Whitepaper
            </a>
          </div>
          <div className="foot-col">
            <div className="head">Community</div>
            <a href="https://discord.com" target="_blank" rel="noreferrer">
              <MessageCircle size={13} /> Discord
            </a>
            <a href="https://x.com" target="_blank" rel="noreferrer">
              <TwitterIcon size={13} /> X
            </a>
          </div>
          <div className="foot-col">
            <div className="head">Legal</div>
            <a href="#faq">Privacy</a>
            <a href="#faq">Terms</a>
          </div>
        </div>
        <div className="foot-base">
          <span>© 2026 Plexa. All rights reserved.</span>
          <span className="sys">
            <span className="sys-dot" /> All systems operational · Stellar testnet
          </span>
        </div>
      </footer>
    </motion.div>
  );
}
